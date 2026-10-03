import {
  type Address,
  type Base58EncodedBytes,
  type Base64EncodedBytes,
  type Decoder,
  fetchEncodedAccount,
  getBase64Decoder,
  getBase64Encoder,
} from '@solana/kit';
import { fetchMaybeToken } from '@solana-program/token';
import type { Rpc } from './connection.ts';
import { USDC_DEVNET_MINT } from './constants.ts';
import {
  AGENT_ESCROW_PROGRAM_ADDRESS,
  AGENT_PROFILE_DISCRIMINATOR,
  type AgentProfile,
  decodeJob,
  fetchMaybeAgentProfile,
  getAgentProfileDecoder,
  getJobDecoder,
  JOB_DISCRIMINATOR,
  type Job,
  type JobStatus,
} from './generated/index.ts';
import { findAgentPda, findTokenAccount } from './pdas.ts';

export type JobRecord = Job & { address: Address };
export type AgentRecord = AgentProfile & { address: Address };
export type JobFilter = {
  client?: Address;
  provider?: Address;
  evaluator?: Address;
  status?: JobStatus;
};

type Filter = { memcmp: { offset: bigint; bytes: string; encoding: 'base58' | 'base64' } };
type Row = { pubkey: Address; account: { data: [string, string] } };

/**
 * Byte offsets inside a Job account, after the 8-byte discriminator. They follow the field order
 * of `Job` in the program and are checked against the generated encoder in test/offsets.test.ts.
 */
export const JOB_OFFSETS = { client: 8n, provider: 40n, evaluator: 72n, status: 192n } as const;

function bytesFilter(offset: bigint, bytes: ArrayLike<number>): Filter {
  const encoded = getBase64Decoder().decode(Uint8Array.from(bytes)) as Base64EncodedBytes;

  return { memcmp: { offset, bytes: encoded, encoding: 'base64' } };
}

function jobFilters({ status, ...parties }: JobFilter): Filter[] {
  const byParty = Object.entries(parties).map(([party, address]) => ({
    memcmp: {
      offset: JOB_OFFSETS[party as keyof typeof parties],
      bytes: address as string as Base58EncodedBytes,
      encoding: 'base58' as const,
    },
  }));
  const byStatus = status === undefined ? [] : [bytesFilter(JOB_OFFSETS.status, [status])];

  return [bytesFilter(0n, JOB_DISCRIMINATOR), ...byParty, ...byStatus];
}

async function listAccounts<T extends object>(
  rpc: Rpc,
  decoder: Decoder<T>,
  filters: Filter[],
): Promise<(T & { address: Address })[]> {
  // The filter shape is built at runtime, which kit's overloads cannot follow; the response
  // shape for `encoding: 'base64'` is the one declared in `Row`.
  const config = { encoding: 'base64', filters } as never;
  const rows = await rpc.getProgramAccounts(AGENT_ESCROW_PROGRAM_ADDRESS, config).send();

  return (rows as unknown as Row[]).map(({ pubkey, account }) => ({
    ...decoder.decode(getBase64Encoder().encode(account.data[0])),
    address: pubkey,
  }));
}

/** Every job matching the filter, newest first. The RPC node does the filtering. */
export async function listJobs(rpc: Rpc, filter: JobFilter = {}): Promise<JobRecord[]> {
  const jobs = await listAccounts(rpc, getJobDecoder(), jobFilters(filter));

  return jobs.sort((a, b) => Number(b.createdAt - a.createdAt));
}

export async function getJob(rpc: Rpc, address: Address): Promise<JobRecord> {
  const account = await fetchEncodedAccount(rpc, address);
  const isOurs = account.exists && account.programAddress === AGENT_ESCROW_PROGRAM_ADDRESS;

  if (!isOurs) throw new Error(`No job found at ${address}`);

  return { ...decodeJob(account).data, address };
}

/** Every registered agent, most completed jobs first. */
export async function listAgents(rpc: Rpc): Promise<AgentRecord[]> {
  const filters = [bytesFilter(0n, AGENT_PROFILE_DISCRIMINATOR)];
  const agents = await listAccounts(rpc, getAgentProfileDecoder(), filters);

  return agents.sort((a, b) => b.jobsCompleted - a.jobsCompleted);
}

/** The profile of the agent owned by `authority`, or undefined when it never registered. */
export async function getAgent(rpc: Rpc, authority: Address): Promise<AgentRecord | undefined> {
  const address = await findAgentPda(authority);
  const account = await fetchMaybeAgentProfile(rpc, address);

  return account.exists ? { ...account.data, address } : undefined;
}

/** The USDC a wallet holds, in base units. Zero when it has no token account yet. */
export async function usdcBalance(rpc: Rpc, owner: Address): Promise<bigint> {
  const token = await fetchMaybeToken(rpc, await findTokenAccount(owner, USDC_DEVNET_MINT));

  return token.exists ? token.data.amount : 0n;
}
