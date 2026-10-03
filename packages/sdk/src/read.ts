import {
  type Address,
  type Base58EncodedBytes,
  type Base64EncodedBytes,
  type Decoder,
  getBase64Decoder,
  getBase64Encoder,
  type ReadonlyUint8Array,
} from '@solana/kit';
import type { Connection } from './connection.ts';
import {
  AGENT_ESCROW_PROGRAM_ADDRESS,
  AGENT_PROFILE_DISCRIMINATOR,
  type AgentProfile,
  fetchMaybeAgentProfile,
  fetchMaybeJob,
  getAgentProfileDecoder,
  getJobDecoder,
  JOB_DISCRIMINATOR,
  type Job,
} from './generated/index.ts';
import { findAgentPda } from './pdas.ts';

type Rpc = Connection['rpc'];

export type JobRecord = Job & { address: Address };
export type AgentRecord = AgentProfile & { address: Address };
export type JobFilter = { client?: Address; provider?: Address; evaluator?: Address };

/** Byte offsets of the party fields inside a Job account, after the 8-byte discriminator. */
const PARTY_OFFSETS = { client: 8n, provider: 40n, evaluator: 72n } as const;

function discriminatorFilter(discriminator: ReadonlyUint8Array) {
  const bytes = getBase64Decoder().decode(discriminator) as Base64EncodedBytes;

  return { memcmp: { offset: 0n, bytes, encoding: 'base64' as const } };
}

function partyFilters(filter: JobFilter) {
  return Object.entries(filter).map(([party, address]) => ({
    memcmp: {
      offset: PARTY_OFFSETS[party as keyof JobFilter],
      bytes: address as string as Base58EncodedBytes,
      encoding: 'base58' as const,
    },
  }));
}

async function listAccounts<T extends object>(
  rpc: Rpc,
  decoder: Decoder<T>,
  filters: object[],
): Promise<(T & { address: Address })[]> {
  const config = { encoding: 'base64', filters } as const;
  const accounts = await rpc
    .getProgramAccounts(AGENT_ESCROW_PROGRAM_ADDRESS, config as never)
    .send();
  const rows = accounts as unknown as { pubkey: Address; account: { data: [string, string] } }[];

  return rows.map(({ pubkey, account }) => ({
    ...decoder.decode(getBase64Encoder().encode(account.data[0])),
    address: pubkey,
  }));
}

/** Every job matching the filter, newest first. */
export async function listJobs(rpc: Rpc, filter: JobFilter = {}): Promise<JobRecord[]> {
  const filters = [discriminatorFilter(JOB_DISCRIMINATOR), ...partyFilters(filter)];
  const jobs = await listAccounts(rpc, getJobDecoder(), filters);

  return jobs.sort((a, b) => Number(b.createdAt - a.createdAt));
}

export async function getJob(rpc: Rpc, address: Address): Promise<JobRecord> {
  const account = await fetchMaybeJob(rpc, address);

  if (!account.exists) throw new Error(`No job found at ${address}`);

  return { ...account.data, address };
}

/** Every registered agent, most completed jobs first. */
export async function listAgents(rpc: Rpc): Promise<AgentRecord[]> {
  const filters = [discriminatorFilter(AGENT_PROFILE_DISCRIMINATOR)];
  const agents = await listAccounts(rpc, getAgentProfileDecoder(), filters);

  return agents.sort((a, b) => b.jobsCompleted - a.jobsCompleted);
}

/** The profile of the agent owned by `authority`, or undefined when it never registered. */
export async function getAgent(rpc: Rpc, authority: Address): Promise<AgentRecord | undefined> {
  const address = await findAgentPda(authority);
  const account = await fetchMaybeAgentProfile(rpc, address);

  return account.exists ? { ...account.data, address } : undefined;
}
