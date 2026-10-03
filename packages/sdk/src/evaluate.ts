import {
  type EvaluateOptions,
  type Evaluation,
  evaluate,
  fetchVerified,
  parseSpec,
  type Spec,
} from '@agent-escrow/checks';
import type { Address, Signature, TransactionSigner } from '@solana/kit';
import { completeJob, rejectJob } from './actions.ts';
import type { Connection } from './connection.ts';
import { commitmentOf } from './format.ts';
import { JobStatus } from './generated/index.ts';
import { getJob, type JobRecord } from './read.ts';

export type Judgement = {
  verdict: Evaluation;
  action: 'completed' | 'rejected';
  signature: Signature;
};

/** The acceptance spec of a job, refused unless it matches the hash committed on-chain. */
export async function fetchJobSpec(job: JobRecord): Promise<Spec> {
  const { specUri, specHash } = commitmentOf(job);

  return parseSpec(await fetchVerified(specUri, specHash));
}

/**
 * Reproduces the verdict of a job from its on-chain commitments. Read-only: anyone can run it,
 * in Node or in a browser, and must reach the same result as the evaluator.
 */
export async function verifyJob(job: JobRecord, options?: EvaluateOptions): Promise<Evaluation> {
  if (!job.resultUri) throw new Error('This job has no submission to verify yet');

  return evaluate(commitmentOf(job), options);
}

function assertAwaitingVerdict(job: JobRecord): JobRecord {
  if (job.status !== JobStatus.Submitted) {
    throw new Error(`Job is ${JobStatus[job.status]}, not awaiting a verdict`);
  }

  return job;
}

/**
 * Runs the committed acceptance test and settles the job accordingly, as its evaluator.
 * Throws without settling when the deliverable is only temporarily unreachable.
 */
export async function evaluateJob(
  connection: Connection,
  signer: TransactionSigner,
  address: Address,
  options?: EvaluateOptions,
): Promise<Judgement> {
  const job = assertAwaitingVerdict(await getJob(connection.rpc, address));
  const verdict = await verifyJob(job, options);
  const settle = verdict.passed ? completeJob : rejectJob;
  const { signature } = await settle(connection, signer, job);

  return { verdict, action: verdict.passed ? 'completed' : 'rejected', signature };
}
