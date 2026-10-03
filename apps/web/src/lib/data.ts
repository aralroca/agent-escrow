import { fetchVerified, parseSpec, type Spec, toHex } from '@agent-escrow/checks';
import {
  type AgentView,
  describeAgent,
  describeJob,
  getJob,
  type JobRecord,
  type JobView,
  listActivity,
  listAgents,
  listJobs,
} from '@agent-escrow/sdk';
import type { Address } from '@solana/kit';
import { rpc } from './chain.ts';

export type JobRow = { record: JobRecord; view: JobView };

const toRow = (record: JobRecord): JobRow => ({ record, view: describeJob(record) });
const specs = new Map<string, Promise<Spec>>();

export async function loadJobs(): Promise<JobRow[]> {
  return (await listJobs(rpc)).map(toRow);
}

export async function loadJob(address: string): Promise<JobRow> {
  return toRow(await getJob(rpc, address as Address));
}

export async function loadAgents(): Promise<AgentView[]> {
  return (await listAgents(rpc)).map(describeAgent);
}

export function loadActivity(address: string) {
  return listActivity(rpc, address as Address);
}

/** The acceptance spec of a job, refused unless it matches the hash committed on-chain. */
export function loadSpec({ specUri, specHash }: JobRecord): Promise<Spec> {
  const load = () => fetchVerified(specUri, toHex(specHash as Uint8Array)).then(parseSpec);
  const cached = specs.get(specUri) ?? load();

  specs.set(specUri, cached);

  return cached;
}

/** Display names by wallet address, for the agents that registered one. */
export function namesOf(agents: AgentView[] = []): Map<string, string> {
  return new Map(agents.map((agent) => [agent.authority as string, agent.name]));
}
