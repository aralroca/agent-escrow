import { type Commitment, type Evaluation, evaluate, toHex } from '@agent-escrow/checks';
import type { Address, Signature, TransactionSigner } from '@solana/kit';
import { completeJob, rejectJob } from './actions.ts';
import type { Connection } from './connection.ts';
import { JobStatus } from './generated/index.ts';
import { getJob, type JobRecord } from './read.ts';

export type Judgement = {
  verdict: Evaluation;
  action: 'completed' | 'rejected';
  signature: Signature;
};

function commitmentOf(job: JobRecord): Commitment {
  return {
    specUri: job.specUri,
    specHash: toHex(job.specHash as Uint8Array),
    resultUri: job.resultUri,
    resultHash: toHex(job.resultHash as Uint8Array),
  };
}

/**
 * Reproduces the verdict of a job from its on-chain commitments. Read-only: anyone can run it,
 * in Node or in a browser, and must reach the same result as the evaluator.
 */
export async function verifyJob(job: JobRecord): Promise<Evaluation> {
  if (!job.resultUri) throw new Error('This job has no submission to verify yet');

  return evaluate(commitmentOf(job));
}

/** Runs the committed acceptance test and settles the job accordingly, as its evaluator. */
export async function evaluateJob(
  connection: Connection,
  signer: TransactionSigner,
  address: Address,
): Promise<Judgement> {
  const job = await getJob(connection.rpc, address);
  const awaitingVerdict = job.status === JobStatus.Submitted;
  const verdict = awaitingVerdict ? await verifyJob(job) : undefined;
  const settle = verdict?.passed ? completeJob : rejectJob;

  if (!verdict) throw new Error(`Job is ${JobStatus[job.status]}, not awaiting a verdict`);
  const { signature } = await settle(connection, signer, address);

  return { verdict, action: verdict.passed ? 'completed' : 'rejected', signature };
}
