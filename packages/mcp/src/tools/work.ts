import { fetchVerified, parseSpec, type Spec, toHex } from '@agent-escrow/checks';
import {
  acceptJob,
  claimTimeout,
  evaluateJob,
  getJob,
  type JobRecord,
  JobStatus,
  refundJob,
  submitResult,
} from '@agent-escrow/sdk';
import type { Address } from '@solana/kit';
import * as z from 'zod/v4';
import type { Context } from '../context.ts';
import { defineTool, jobSchema } from '../tool.ts';

/** The spec a seller is about to commit to, refused unless it matches the on-chain hash. */
async function committedSpec(job: JobRecord): Promise<Spec> {
  const bytes = await fetchVerified(job.specUri, toHex(job.specHash as Uint8Array)).catch(() => {
    throw new Error(
      `Refused: the spec at ${job.specUri} is unreachable or does not match the hash committed ` +
        'on-chain, so no delivery could ever pass. Do not accept this job.',
    );
  });

  return parseSpec(bytes);
}

export const acceptJobTool = defineTool({
  name: 'accept_job',
  description:
    'As the seller, commit to a funded job. The server first checks that the acceptance spec is ' +
    'reachable and matches its on-chain hash, and returns it: you are paid only if your delivery ' +
    'passes every check. Missing the deadline is recorded on your profile.',
  input: z.object({ job: jobSchema }),
  async run({ connection, signer }, { job }) {
    const spec = await committedSpec(await getJob(connection.rpc, job));
    const receipt = await acceptJob(connection, signer, job);

    return { ...receipt, spec };
  },
});

const submitInput = z.object({
  job: jobSchema,
  result: z
    .unknown()
    .optional()
    .describe('The deliverable as JSON. It is published at a public URL'),
  result_uri: z
    .string()
    .url()
    .optional()
    .describe('Public URL of the deliverable, instead of `result`'),
});

async function resolveResultUri(
  context: Context,
  args: z.infer<typeof submitInput>,
): Promise<string> {
  if (args.result_uri) return args.result_uri;
  if (args.result === undefined)
    throw new Error('Provide the deliverable as `result` or `result_uri`.');

  return context.publish('result.json', args.result);
}

export const submitResultTool = defineTool({
  name: 'submit_result',
  description:
    'As the seller, deliver the work. The deliverable is committed on-chain by hash, so it cannot ' +
    'be changed afterwards, and the evaluator review window starts.',
  input: submitInput,
  async run(context, args) {
    const resultUri = await resolveResultUri(context, args);
    const receipt = await submitResult(context.connection, context.signer, args.job, resultUri);

    return { ...receipt, resultUri };
  },
});

export const evaluateJobTool = defineTool({
  name: 'evaluate_job',
  description:
    'As the evaluator, run the committed acceptance spec against the delivery and settle the job: ' +
    'pay the seller if every check passes, refund the buyer otherwise. The verdict is ' +
    'deterministic and anyone can reproduce it from the on-chain hashes.',
  input: z.object({ job: jobSchema }),
  async run({ connection, signer }, { job }) {
    const { verdict, action, signature } = await evaluateJob(connection, signer, job);

    return { action, signature, passed: verdict.passed, checks: verdict.results };
  },
});

type Settlement = { settle: typeof refundJob; outcome: string };

/** Which timed exit, if any, is open to `who` on this job right now. */
function timedExit(job: JobRecord, who: Address, now: bigint): Settlement | string {
  const refund = { settle: refundJob, outcome: 'refunded to the client' };
  const reviewEnds = job.submittedAt + job.reviewWindow;
  const isClient = who === job.client;

  if (isClient && job.status === JobStatus.Funded) return refund;
  if (isClient && job.status === JobStatus.Accepted) {
    return now > job.deadline
      ? refund
      : 'The seller still has time to deliver before the deadline.';
  }
  if (who === job.provider && job.status === JobStatus.Submitted) {
    return now > reviewEnds
      ? { settle: claimTimeout, outcome: 'paid to the seller after the review window' }
      : 'The evaluator still has time to judge the delivery.';
  }

  return `Nothing to settle: the job is ${JobStatus[job.status]} and this agent has no timed exit on it.`;
}

export const settleExpiredTool = defineTool({
  name: 'settle_expired',
  description:
    'Recover funds when the other side went silent. As the buyer: take the payment back if nobody ' +
    'accepted, or if the seller missed the deadline. As the seller: collect the payment if the ' +
    'evaluator did not judge within the review window.',
  input: z.object({ job: jobSchema }),
  async run({ connection, signer }, { job }) {
    const record = await getJob(connection.rpc, job);
    const exit = timedExit(record, signer.address, BigInt(Math.floor(Date.now() / 1000)));

    if (typeof exit === 'string') throw new Error(exit);
    const receipt = await exit.settle(connection, signer, job);

    return { ...receipt, outcome: exit.outcome };
  },
});
