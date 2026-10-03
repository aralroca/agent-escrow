import {
  createJob,
  describeAgent,
  describeJob,
  formatAmount,
  getAgent,
  getJob,
  type JobView,
  listJobs,
  parseAmount,
} from '@agent-escrow/sdk';
import type { Address } from '@solana/kit';
import * as z from 'zod/v4';
import type { Context } from '../context.ts';
import { addressSchema, defineTool, jobSchema } from '../tool.ts';
import { meetsPolicy, type Policy } from './agents.ts';

const SECONDS_PER_MINUTE = 60;
const ROLES = ['client', 'provider', 'evaluator'] as const;
const STATUSES = [
  'Funded',
  'Accepted',
  'Submitted',
  'Completed',
  'Rejected',
  'Refunded',
  'Expired',
  'Claimed',
] as const;

const createJobInput = z.object({
  provider: addressSchema.describe('Address of the seller agent, from search_agents'),
  amount_usdc: z.number().positive().describe('Payment to lock, in USDC'),
  spec: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Acceptance spec: {"version":1,"title":"...","checks":[...]}. Check types: ' +
        '{"type":"json-schema","schema":{...}}, {"type":"count","equals":N,"path"?:"a.b"}, ' +
        '{"type":"contains-all","key":"id","field":"title","terms":{"<id>":["term"]}}, ' +
        '{"type":"sha256","equals":"<hex>"}. The deliverable must be JSON.',
    ),
  spec_uri: z.string().url().optional().describe('Public URL of the spec, instead of `spec`'),
  deadline_minutes: z
    .number()
    .int()
    .positive()
    .default(60)
    .describe('Time the seller has to deliver'),
  review_window_minutes: z
    .number()
    .int()
    .min(1)
    .default(60)
    .describe('Time the evaluator has to judge'),
  evaluator: addressSchema.optional().describe('Who judges the delivery. Defaults to this agent'),
  min_success_rate: z.number().min(0).max(1).optional().describe('Refuse sellers below this rate'),
  min_completed_jobs: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Refuse sellers below this count'),
});

type CreateJobArgs = z.infer<typeof createJobInput>;

function assertWithinCap(amount: bigint, cap: bigint): void {
  if (amount > cap) {
    throw new Error(
      `Refused: ${formatAmount(amount)} USDC is above this agent's cap of ${formatAmount(cap)} USDC per job (MAX_JOB_USDC).`,
    );
  }
}

async function assertMeetsPolicy({ connection }: Context, provider: Address, policy: Policy) {
  const agent = await getAgent(connection.rpc, provider);

  if (!agent) throw new Error(`Refused: ${provider} is not a registered agent.`);
  if (!meetsPolicy(describeAgent(agent), policy)) {
    throw new Error(`Refused: ${agent.name} does not meet the hiring policy you set.`);
  }
}

async function resolveSpecUri(context: Context, args: CreateJobArgs): Promise<string> {
  if (args.spec_uri) return args.spec_uri;
  if (!args.spec) throw new Error('Provide the acceptance spec as `spec` or `spec_uri`.');

  return context.publish('spec.json', args.spec);
}

export const createJobTool = defineTool({
  name: 'create_job',
  description:
    'Hire a seller agent: commit an acceptance spec by hash and lock the USDC in escrow, in one ' +
    'transaction. The money can only leave the vault to the seller if the delivery passes the ' +
    'spec, or back to you if it fails, is never accepted, or misses the deadline.',
  input: createJobInput,
  async run(context, args) {
    const amount = parseAmount(String(args.amount_usdc));
    const now = BigInt(Math.floor(Date.now() / 1000));
    const deadline = now + BigInt(args.deadline_minutes * SECONDS_PER_MINUTE);
    const reviewWindow = BigInt(args.review_window_minutes * SECONDS_PER_MINUTE);
    const { provider, evaluator } = args;

    assertWithinCap(amount, context.maxJobAmount);
    await assertMeetsPolicy(context, provider, args);
    const specUri = await resolveSpecUri(context, args);
    const input = {
      provider,
      evaluator,
      amount,
      specUri,
      deadline,
      reviewWindow,
    };

    return createJob(context.connection, context.signer, input);
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
    status: z.enum(STATUSES).optional(),
  }),
  async run({ connection, signer }, { role, status }) {
    const roles = role ? [role] : ROLES;
    const queries = roles.map((party) => listJobs(connection.rpc, { [party]: signer.address }));
    const jobs = uniqueByAddress((await Promise.all(queries)).flat().map(describeJob));

    return jobs.filter((job) => !status || job.status === status);
  },
});
