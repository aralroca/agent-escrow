import { toHex } from '@agent-escrow/checks';
import { USDC_DECIMALS } from './constants.ts';
import { FEE_BPS, JobStatus } from './generated/index.ts';
import type { AgentRecord, JobRecord } from './read.ts';

export type JobStatusName = keyof typeof JobStatus;

const BPS = 10_000n;
const UNSET_HASH = '0'.repeat(64);

/** The protocol fee as text, e.g. "0.25%". */
export const FEE_PERCENT = `${Number(FEE_BPS) / 100}%`;

/** Base units to a decimal string, e.g. 30_000_000n -> "30". */
export function formatAmount(amount: bigint, decimals = USDC_DECIMALS): string {
  const unit = 10n ** BigInt(decimals);
  const fraction = (amount % unit).toString().padStart(decimals, '0').replace(/0+$/, '');

  return fraction ? `${amount / unit}.${fraction}` : `${amount / unit}`;
}

/** A decimal string to base units, e.g. "30.5" -> 30_500_000n. */
export function parseAmount(amount: string, decimals = USDC_DECIMALS): bigint {
  const [, whole, fraction = ''] = /^(\d+)(?:\.(\d+))?$/.exec(amount.trim()) ?? [];

  if (whole === undefined || fraction.length > decimals) {
    throw new Error(`Invalid amount: ${amount}`);
  }

  return BigInt(whole + fraction.padEnd(decimals, '0'));
}

export function protocolFee(amount: bigint): bigint {
  return (amount * FEE_BPS) / BPS;
}

/** Share of settled jobs that were paid out, between 0 and 1. Undefined with no history. */
export function successRate(agent: AgentRecord): number | undefined {
  const settled = agent.jobsCompleted + agent.jobsRejected + agent.jobsExpired;

  return settled ? agent.jobsCompleted / settled : undefined;
}

export function nowSeconds(): bigint {
  return BigInt(Math.floor(Date.now() / 1000));
}

/** Unix seconds to an ISO string. Zero, the program's "not yet", becomes undefined. */
export function isoTime(seconds: bigint | number): string | undefined {
  return seconds ? new Date(Number(seconds) * 1000).toISOString() : undefined;
}

/** What a job committed on-chain: where the spec and the deliverable live, and their hashes. */
export function commitmentOf(job: JobRecord) {
  return {
    specUri: job.specUri,
    specHash: toHex(job.specHash),
    resultUri: job.resultUri,
    resultHash: toHex(job.resultHash),
  };
}

function timeline(job: JobRecord) {
  return {
    deadline: isoTime(job.deadline),
    reviewWindowSeconds: Number(job.reviewWindow),
    createdAt: isoTime(job.createdAt),
    submittedAt: isoTime(job.submittedAt),
    settledAt: isoTime(job.settledAt),
  };
}

/** A JSON-friendly view of a job: no bigints, hashes as hex, status as a word. */
export function describeJob(job: JobRecord) {
  const { address, client, provider, evaluator } = job;
  const { resultUri, resultHash, ...spec } = commitmentOf(job);

  return {
    address,
    status: JobStatus[job.status] as JobStatusName,
    client,
    provider,
    evaluator,
    amount: formatAmount(job.amount),
    fee: formatAmount(protocolFee(job.amount)),
    ...spec,
    resultUri: resultUri || undefined,
    resultHash: resultHash === UNSET_HASH ? undefined : resultHash,
    ...timeline(job),
  };
}

export type JobView = ReturnType<typeof describeJob>;

/** A JSON-friendly view of an agent and its track record. */
export function describeAgent(agent: AgentRecord) {
  const capabilities = agent.capabilities.split(',').map((tag) => tag.trim());

  return {
    authority: agent.authority,
    name: agent.name,
    capabilities: capabilities.filter(Boolean),
    uri: agent.uri || undefined,
    jobsCompleted: agent.jobsCompleted,
    jobsRejected: agent.jobsRejected,
    jobsExpired: agent.jobsExpired,
    volumeSettled: formatAmount(agent.volumeSettled),
    successRate: successRate(agent),
    registeredAt: isoTime(agent.registeredAt),
  };
}

export type AgentView = ReturnType<typeof describeAgent>;
