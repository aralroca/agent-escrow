import type { Spec } from '@agent-escrow/checks';
import {
  acceptJob,
  claimTimeout,
  evaluateJob,
  fetchJobSpec,
  getJob,
  type JobRecord,
  refundJob,
  submitResult,
} from '@agent-escrow/sdk';
import type { Address } from '@solana/kit';
import * as z from 'zod/v4';
import { resolveUri } from '../hosting.ts';
import { defineTool, jobSchema } from '../tool.ts';

/** The spec a seller is about to commit to, refused unless it matches the on-chain hash. */
async function committedSpec(job: JobRecord): Promise<Spec> {
  return fetchJobSpec(job).catch((cause) => {
    throw new Error('Refused: no delivery could pass this job. Do not accept it', { cause });
  });
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

export const submitResultTool = defineTool({
  name: 'submit_result',
  description:
    'As the seller, deliver the work. The deliverable is committed on-chain by hash, so it cannot ' +
    'be changed afterwards, and the evaluator review window starts.',
  input: z.object({
    job: jobSchema,
    result: z.unknown().optional().describe('The deliverable as JSON. It is published at a URL'),
    result_uri: z.string().url().optional().describe('Public URL of it, instead of `result`'),
  }),
  async run({ connection, signer, publish }, { job, result, result_uri }) {
    const deliverable = { uri: result_uri, content: result, name: 'result.json', what: 'result' };
    const resultUri = await resolveUri(publish, deliverable);
    const receipt = await submitResult(connection, signer, job, resultUri);

    return { ...receipt, resultUri };
  },
});

export const evaluateJobTool = defineTool({
  name: 'evaluate_job',
  description:
    'As the evaluator, run the committed acceptance spec against the delivery and settle the job: ' +
    'pay the seller if every check passes, refund the buyer otherwise. The verdict is ' +
    'deterministic and anyone can reproduce it. If the deliverable is only temporarily ' +
    'unreachable the call fails without settling, so retry it; a verdict cannot be undone.',
  input: z.object({
    job: jobSchema,
    reject_if_unreachable: z
      .boolean()
      .default(false)
      .describe('After retrying, rule an unreachable deliverable as failed and refund the buyer'),
  }),
  async run({ connection, signer }, { job, reject_if_unreachable: unreachableFails }) {
    const judgement = await evaluateJob(connection, signer, job, { unreachableFails });
    const { verdict, action, signature } = judgement;

    return { action, signature, passed: verdict.passed, checks: verdict.results };
  },
});

/**
 * Which timed exit belongs to `who`. Whether it is open yet is the program's call: it knows the
 * chain clock, and its refusal already says why ("the review window is still open").
 */
function timedExit(job: JobRecord, who: Address) {
  if (who === job.client) return { settle: refundJob, outcome: 'refunded to the client' };
  if (who === job.provider) {
    return { settle: claimTimeout, outcome: 'paid to the seller after the review window' };
  }

  throw new Error('Only the buyer or the seller of a job can settle it.');
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
    const { settle, outcome } = timedExit(record, signer.address);
    const receipt = await settle(connection, signer, record);

    return { ...receipt, outcome };
  },
});
