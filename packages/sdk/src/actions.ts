import { fromHex, parseSpec, sha256Hex } from '@agent-escrow/checks';
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
import { getJob } from './read.ts';

export type Receipt = { job: Address; signature: Signature };
export type NewAgent = { name: string; capabilities?: string[]; uri?: string };
export type NewJob = {
  provider: Address;
  /** Base units of the mint (USDC has 6 decimals). */
  amount: bigint;
  specUri: string;
  /** Unix seconds by which the provider must submit. */
  deadline: bigint;
  /** Who judges the submission. Defaults to the client. */
  evaluator?: Address;
  reviewWindow?: bigint;
  mint?: Address;
  jobId?: bigint;
};

async function fetchBytes(uri: string): Promise<Uint8Array> {
  const response = await fetch(uri);

  if (!response.ok) throw new Error(`Could not fetch ${uri}: HTTP ${response.status}`);

  return new Uint8Array(await response.arrayBuffer());
}

async function hashOf(bytes: Uint8Array): Promise<Uint8Array> {
  return fromHex(await sha256Hex(bytes));
}

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

/** Fills what the caller left out. Explicit `undefined` counts as left out. */
function withDefaults(input: NewJob, client: Address) {
  const {
    mint = USDC_DEVNET_MINT,
    jobId = randomJobId(),
    evaluator = client,
    reviewWindow = DEFAULT_REVIEW_WINDOW,
  } = input;

  return { ...input, mint, jobId, evaluator, reviewWindow };
}

/** Commits the acceptance spec by hash and locks the payment, in one transaction. */
export async function createJob(
  connection: Connection,
  signer: TransactionSigner,
  input: NewJob,
): Promise<Receipt> {
  const details = withDefaults(input, signer.address);
  const spec = await fetchBytes(input.specUri);
  const job = await findJobPda(signer.address, details.jobId);
  const clientToken = await findTokenAccount(signer.address, details.mint);
  const specHash = await hashOf(spec);
  const accounts = { client: signer, job, clientToken };

  // A spec nobody can run would make the job impossible to judge, so refuse it up front.
  parseSpec(spec);
  const instruction = await getCreateJobInstructionAsync({ ...details, ...accounts, specHash });

  return send(connection, signer, job, [instruction]);
}

/** The provider commits to the job and makes sure it has an account to be paid into. */
export async function acceptJob(
  connection: Connection,
  signer: TransactionSigner,
  job: Address,
): Promise<Receipt> {
  const { mint } = await getJob(connection.rpc, job);
  const createTokenAccount = await getCreateAssociatedTokenIdempotentInstructionAsync({
    payer: signer,
    owner: signer.address,
    mint,
  });
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
  const resultHash = await hashOf(await fetchBytes(resultUri));
  const instruction = getSubmitInstruction({ provider: signer, job, resultHash, resultUri });

  return send(connection, signer, job, [instruction]);
}

async function releaseAccounts(connection: Connection, authority: TransactionSigner, job: Address) {
  const { client, provider, mint } = await getJob(connection.rpc, job);
  const providerToken = await findTokenAccount(provider, mint);

  return { authority, job, client, provider, mint, providerToken };
}

async function returnAccounts(connection: Connection, authority: TransactionSigner, job: Address) {
  const { client, provider, mint, status } = await getJob(connection.rpc, job);
  const clientToken = await findTokenAccount(client, mint);
  // A job nobody accepted has no provider record to update.
  const providerProfile = status === JobStatus.Funded ? undefined : await findAgentPda(provider);

  return { authority, job, client, mint, clientToken, providerProfile };
}

/** The evaluator approves: the provider is paid, minus the protocol fee. */
export async function completeJob(
  connection: Connection,
  signer: TransactionSigner,
  job: Address,
): Promise<Receipt> {
  const accounts = await releaseAccounts(connection, signer, job);

  return send(connection, signer, job, [await getCompleteInstructionAsync(accounts)]);
}

/** The provider collects after the review window closed without a verdict. */
export async function claimTimeout(
  connection: Connection,
  signer: TransactionSigner,
  job: Address,
): Promise<Receipt> {
  const accounts = await releaseAccounts(connection, signer, job);

  return send(connection, signer, job, [await getClaimTimeoutInstructionAsync(accounts)]);
}

/** The evaluator rejects: the client is refunded in full. */
export async function rejectJob(
  connection: Connection,
  signer: TransactionSigner,
  job: Address,
): Promise<Receipt> {
  const accounts = await returnAccounts(connection, signer, job);

  return send(connection, signer, job, [await getRejectInstructionAsync(accounts)]);
}

/** The client takes the payment back: before acceptance, or after a missed deadline. */
export async function refundJob(
  connection: Connection,
  signer: TransactionSigner,
  job: Address,
): Promise<Receipt> {
  const accounts = await returnAccounts(connection, signer, job);

  return send(connection, signer, job, [await getRefundInstructionAsync(accounts)]);
}
