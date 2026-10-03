import { fetchBytes, parseSpec, sha256 } from '@agent-escrow/checks';
import type { Address, Instruction, Signature, TransactionSigner } from '@solana/kit';
import { getCreateAssociatedTokenIdempotentInstructionAsync } from '@solana-program/token';
import { type Connection, sendInstructions } from './connection.ts';
import { DEFAULT_REVIEW_WINDOW, USDC_DEVNET_MINT } from './constants.ts';
import {
  getAcceptInstructionAsync,
  getClaimTimeoutInstructionAsync,
  getCompleteInstructionAsync,
  getCreateJobInstructionAsync,
  getRefundInstructionAsync,
  getRegisterAgentInstructionAsync,
  getRejectInstructionAsync,
  getSubmitInstruction,
  JobStatus,
} from './generated/index.ts';
import { findAgentPda, findJobPda, findTokenAccount } from './pdas.ts';
import { getJob, type JobRecord } from './read.ts';

export type Receipt = { job: Address; signature: Signature };
export type NewAgent = { name: string; capabilities?: string[]; uri?: string };
export type NewJob = {
  provider: Address;
  /** Base units of USDC, which has 6 decimals. */
  amount: bigint;
  specUri: string;
  /** Unix seconds by which the provider must submit. */
  deadline: bigint;
  /** Who judges the submission. Defaults to the client. */
  evaluator?: Address;
  reviewWindow?: bigint;
  jobId?: bigint;
};

type Plan<Accounts> = { accounts: Accounts; prepare: Instruction };

function randomJobId(): bigint {
  return crypto.getRandomValues(new BigUint64Array(1))[0];
}

async function send(
  connection: Connection,
  signer: TransactionSigner,
  job: Address,
  instructions: Instruction[],
): Promise<Receipt> {
  return { job, signature: await sendInstructions(connection, signer, instructions) };
}

/** An instruction that creates the owner's USDC account when it is missing. */
function ensureTokenAccount(payer: TransactionSigner, owner: Address) {
  const mint = USDC_DEVNET_MINT;

  return getCreateAssociatedTokenIdempotentInstructionAsync({ payer, owner, mint });
}

/** A spec nobody can run would make the job impossible to judge, so it is refused up front. */
async function fetchValidSpec(specUri: string): Promise<Uint8Array> {
  const bytes = await fetchBytes(specUri);

  parseSpec(bytes);

  return bytes;
}

/** Creates the agent profile, or updates its name, capabilities and URI. */
export async function registerAgent(
  connection: Connection,
  signer: TransactionSigner,
  agent: NewAgent,
): Promise<Signature> {
  const instruction = await getRegisterAgentInstructionAsync({
    authority: signer,
    name: agent.name,
    capabilities: (agent.capabilities ?? []).join(','),
    uri: agent.uri ?? '',
  });

  return sendInstructions(connection, signer, [instruction]);
}

/** Commits the acceptance spec by hash and locks the payment, in one transaction. */
export async function createJob(
  connection: Connection,
  signer: TransactionSigner,
  input: NewJob,
): Promise<Receipt> {
  // Explicit `undefined` counts as left out, so the defaults come from destructuring.
  const { jobId = randomJobId(), evaluator = signer.address, ...rest } = input;
  const reviewWindow = input.reviewWindow ?? DEFAULT_REVIEW_WINDOW;
  const specHash = await sha256(await fetchValidSpec(input.specUri));
  const job = await findJobPda(signer.address, jobId);
  const clientToken = await findTokenAccount(signer.address, USDC_DEVNET_MINT);
  const accounts = { client: signer, job, mint: USDC_DEVNET_MINT, clientToken };
  const args = { ...rest, jobId, evaluator, reviewWindow, specHash };
  const instruction = await getCreateJobInstructionAsync({ ...args, ...accounts });

  return send(connection, signer, job, [instruction]);
}

/** The provider commits to the job and makes sure it has an account to be paid into. */
export async function acceptJob(
  connection: Connection,
  signer: TransactionSigner,
  job: Address,
): Promise<Receipt> {
  const createTokenAccount = await ensureTokenAccount(signer, signer.address);
  const accept = await getAcceptInstructionAsync({ provider: signer, job });

  return send(connection, signer, job, [createTokenAccount, accept]);
}

/** Commits the deliverable at `resultUri` by hash and starts the review window. */
export async function submitResult(
  connection: Connection,
  signer: TransactionSigner,
  job: Address,
  resultUri: string,
): Promise<Receipt> {
  const resultHash = await sha256(await fetchBytes(resultUri));
  const instruction = getSubmitInstruction({ provider: signer, job, resultHash, resultUri });

  return send(connection, signer, job, [instruction]);
}

/**
 * Everything a payout to the provider needs. The provider's token account is created when
 * missing, so closing it cannot be used to block a verdict.
 */
async function releasePlan(authority: TransactionSigner, job: JobRecord) {
  const { address, client, provider, mint } = job;
  const providerToken = await findTokenAccount(provider, mint);
  const accounts = { authority, job: address, client, provider, mint, providerToken };

  return { accounts, prepare: await ensureTokenAccount(authority, provider) };
}

/** Everything a refund to the client needs, creating the client's token account when missing. */
async function returnPlan(authority: TransactionSigner, job: JobRecord) {
  const { address, client, provider, mint, status } = job;
  const clientToken = await findTokenAccount(client, mint);
  // A job nobody accepted has no provider record to update.
  const providerProfile = status === JobStatus.Funded ? undefined : await findAgentPda(provider);
  const accounts = { authority, job: address, client, mint, clientToken, providerProfile };

  return { accounts, prepare: await ensureTokenAccount(authority, client) };
}

/**
 * Builds a settlement action from the accounts it needs and the instruction it sends.
 * Callers that already loaded the job pass the record and save a round trip.
 */
function settlement<Accounts>(
  plan: (authority: TransactionSigner, job: JobRecord) => Promise<Plan<Accounts>>,
  build: (accounts: Accounts) => Promise<Instruction>,
) {
  return async function settle(
    connection: Connection,
    signer: TransactionSigner,
    job: Address | JobRecord,
  ): Promise<Receipt> {
    const record = typeof job === 'string' ? await getJob(connection.rpc, job) : job;
    const { accounts, prepare } = await plan(signer, record);

    return send(connection, signer, record.address, [prepare, await build(accounts)]);
  };
}

/** The evaluator approves: the provider is paid, minus the protocol fee. */
export const completeJob = settlement(releasePlan, (accounts) =>
  getCompleteInstructionAsync(accounts),
);

/** The provider collects after the review window closed without a verdict. */
export const claimTimeout = settlement(releasePlan, (accounts) =>
  getClaimTimeoutInstructionAsync(accounts),
);

/** The evaluator rejects: the client is refunded in full. */
export const rejectJob = settlement(returnPlan, (accounts) => getRejectInstructionAsync(accounts));

/** The client takes the payment back: before acceptance, or after a missed deadline. */
export const refundJob = settlement(returnPlan, (accounts) => getRefundInstructionAsync(accounts));
