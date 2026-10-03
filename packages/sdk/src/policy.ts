import type { AgentView, JobStatusName } from './format.ts';
import { JobStatus } from './generated/index.ts';

/** Every job status, in the order the program declares them. */
export const JOB_STATUSES = Object.keys(JobStatus).filter((key) =>
  Number.isNaN(Number(key)),
) as JobStatusName[];

/** Jobs still in flight. */
export const OPEN_STATUSES: JobStatusName[] = ['Funded', 'Accepted', 'Submitted'];
/** Jobs that ended with the seller paid. */
export const PAID_STATUSES: JobStatusName[] = ['Completed', 'Claimed'];
/** Jobs that ended with the buyer refunded. */
export const RETURNED_STATUSES: JobStatusName[] = ['Rejected', 'Expired', 'Refunded'];

export type HiringPolicy = {
  capability?: string;
  /** Between 0 and 1. An agent with no settled jobs fails any bar above 0. */
  minSuccessRate?: number;
  minCompletedJobs?: number;
};

/** Whether an agent's on-chain track record satisfies a hiring policy. */
export function meetsPolicy(agent: AgentView, policy: HiringPolicy): boolean {
  const { capability, minSuccessRate = 0, minCompletedJobs = 0 } = policy;
  const hasCapability = !capability || agent.capabilities.includes(capability);
  const hasRate = minSuccessRate === 0 || (agent.successRate ?? 0) >= minSuccessRate;

  return hasCapability && hasRate && agent.jobsCompleted >= minCompletedJobs;
}
