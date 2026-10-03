import type { Spec } from '@agent-escrow/checks';
import {
  type Activity,
  type AgentView,
  describeAgent,
  describeJob,
  fetchJobSpec,
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

type Entry = { value: Promise<unknown>; expires: number };

/** Lists change as agents trade, so they are shared between components only briefly. */
const LIST_TTL_MS = 10_000;
const cache = new Map<string, Entry>();

const toRow = (record: JobRecord): JobRow => ({ record, view: describeJob(record) });

/**
 * Shares one in-flight or recent load between every component that asks for the same key.
 * The public RPC is rate limited, so the page must not fetch the same list once per component.
 */
function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  const fresh = hit && hit.expires > Date.now() ? hit.value : undefined;
  const value = (fresh as Promise<T> | undefined) ?? load();

  // A failed load must not be served again.
  value.catch(() => cache.delete(key));
  if (!fresh) cache.set(key, { value, expires: Date.now() + ttlMs });

  return value;
}

export function loadJobs(): Promise<JobRow[]> {
  return cached('jobs', LIST_TTL_MS, async () => (await listJobs(rpc)).map(toRow));
}

export async function loadJob(address: string): Promise<JobRow> {
  return toRow(await getJob(rpc, address as Address));
}

export function loadAgents(): Promise<AgentView[]> {
  return cached('agents', LIST_TTL_MS, async () => (await listAgents(rpc)).map(describeAgent));
}

/** The history of a job. It only grows when the status changes, so that is the cache key. */
export function loadActivity({ address, status }: JobView): Promise<Activity[]> {
  return cached(`activity:${address}:${status}`, Number.POSITIVE_INFINITY, () =>
    listActivity(rpc, address),
  );
}

/** The acceptance spec of a job. Verified against its on-chain hash, so it never goes stale. */
export function loadSpec(job: JobRecord): Promise<Spec> {
  return cached(`spec:${job.specUri}`, Number.POSITIVE_INFINITY, () => fetchJobSpec(job));
}

/** Display names by wallet address, for the agents that registered one. */
export function namesOf(agents: AgentView[] = []): Map<string, string> {
  return new Map(agents.map((agent) => [agent.authority, agent.name]));
}
