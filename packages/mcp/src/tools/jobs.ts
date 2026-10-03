import {
  createJob,
  describeAgent,
  describeJob,
  formatAmount,
  getAgent,
  getJob,
  JOB_STATUSES,
  JobStatus,
  type JobView,
  listJobs,
  meetsPolicy,
  type NewJob,
  nowSeconds,
  parseAmount,
} from '@agent-escrow/sdk';
import * as z from 'zod/v4';
import type { Context } from '../context.ts';
import { resolveUri } from '../hosting.ts';
import { addressSchema, defineTool, jobSchema } from '../tool.ts';
import { recordShape, toPolicy } from './agents.ts';

const SECONDS_PER_MINUTE = 60;
const ROLES = ['client', 'provider', 'evaluator'] as const;
const SPEC_HELP =
  'Acceptance spec: {"version":1,"title":"...","checks":[...]}. Check types: ' +
  '{"type":"json-schema","schema":{...}}, {"type":"count","equals":N,"path"?:"a.b"}, ' +
  '{"type":"contains-all","key":"id","field":"title","terms":{"<id>":["term"]}}, ' +
  '{"type":"sha256","equals":"<hex>"}. The deliverable must be JSON.';

const minutes = (text: string) => z.number().int().positive().default(60).describe(text);

const createJobInput = z.object({
  provider: addressSchema.describe('Address of the seller agent, from search_agents'),
  amount_usdc: z.number().positive().describe('Payment to lock, in USDC'),
  spec: z.record(z.string(), z.unknown()).optional().describe(SPEC_HELP),
  spec_uri: z.string().url().optional().describe('Public URL of the spec, instead of `spec`'),
  deadline_minutes: minutes('Time the seller has to deliver'),
  review_window_minutes: minutes('Time the evaluator has to judge'),
  evaluator: addressSchema.optional().describe('Who judges the delivery. Defaults to this agent'),
  ...recordShape,
});

type CreateJobArgs = z.infer<typeof createJobInput>;

function assertWithinCap(amount: bigint, cap: bigint): bigint {
  if (amount > cap) {
    throw new Error(
      `Refused: ${formatAmount(amount)} USDC is above this agent's cap of ${formatAmount(cap)} USDC per job (MAX_JOB_USDC).`,
    );
  }

  return amount;
}

async function assertMeetsPolicy({ connection }: Context, args: CreateJobArgs): Promise<void> {
  const agent = await getAgent(connection.rpc, args.provider);

  if (!agent) throw new Error(`Refused: ${args.provider} is not a registered agent.`);
  if (!meetsPolicy(describeAgent(agent), toPolicy(args))) {
    throw new Error(`Refused: ${agent.name} does not meet the hiring policy you set.`);
  }
}

function toNewJob(args: CreateJobArgs, amount: bigint, specUri: string): NewJob {
  return {
    provider: args.provider,
    evaluator: args.evaluator,
    amount,
    specUri,
    deadline: nowSeconds() + BigInt(args.deadline_minutes * SECONDS_PER_MINUTE),
    reviewWindow: BigInt(args.review_window_minutes * SECONDS_PER_MINUTE),
  };
}

export const createJobTool = defineTool({
  name: 'create_job',
  description:
    'Hire a seller agent: commit an acceptance spec by hash and lock the USDC in escrow, in one ' +
    'transaction. The money can only leave the vault to the seller if the delivery passes the ' +
    'spec, or back to you if it fails, is never accepted, or misses the deadline.',
  input: createJobInput,
  async run(context, args) {
    const amount = assertWithinCap(parseAmount(String(args.amount_usdc)), context.maxJobAmount);
    const spec = { uri: args.spec_uri, content: args.spec, name: 'spec.json', what: 'spec' };

    // Checked before publishing, so a refused hire leaves nothing behind.
    await assertMeetsPolicy(context, args);
    const specUri = await resolveUri(context.publish, spec);

    return createJob(context.connection, context.signer, toNewJob(args, amount, specUri));
  },
});

export const getJobTool = defineTool({
  name: 'get_job',
  description:
    'Read a job: status, parties, amount, deadline, and the spec and result URIs with their committed hashes.',
  input: z.object({ job: jobSchema }),
  async run({ connection }, { job }) {
    return describeJob(await getJob(connection.rpc, job));
  },
});

function uniqueByAddress(jobs: JobView[]): JobView[] {
  return [...new Map(jobs.map((job) => [job.address, job])).values()];
}

export const listJobsTool = defineTool({
  name: 'list_jobs',
  description:
    'List the jobs this agent takes part in. Sellers: use role "provider" and status "Funded" to ' +
    'find jobs waiting for you to accept. Evaluators: status "Submitted" are waiting for a verdict.',
  input: z.object({
    role: z.enum(ROLES).optional().describe('Only jobs where this agent has this role'),
    status: z.enum(JOB_STATUSES).optional(),
  }),
  async run({ connection: { rpc }, signer }, { role, status }) {
    const filter = { status: status && JobStatus[status] };
    const roles = role ? [role] : ROLES;
    const found = await Promise.all(
      roles.map((party) => listJobs(rpc, { ...filter, [party]: signer.address })),
    );

    return uniqueByAddress(found.flat().map(describeJob));
  },
});
