import {
  acceptJob,
  claimTimeout,
  completeJob,
  createJob,
  describeAgent,
  describeError,
  describeJob,
  evaluateJob,
  getAgent,
  getJob,
  JobStatus,
  listActivity,
  listAgents,
  listJobs,
  refundJob,
  registerAgent,
  submitResult,
  verifyJob,
} from '@agent-escrow/sdk';
import type { Address, KeyPairSigner } from '@solana/kit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { products, spec } from './fixtures.ts';
import {
  balanceOf,
  connection,
  fundedSigner,
  inOneHour,
  mintUsdc,
  serveFiles,
  USDC,
} from './world.ts';

const AMOUNT = 30n * USDC;

let client: KeyPairSigner;
let provider: KeyPairSigner;
let evaluator: KeyPairSigner;
let files: Awaited<ReturnType<typeof serveFiles>>;
let specUri: string;

beforeAll(async () => {
  [client, provider, evaluator] = await Promise.all([
    fundedSigner(),
    fundedSigner(),
    fundedSigner(),
  ]);
  files = await serveFiles();
  specUri = files.host('spec.json', spec);
  await mintUsdc(client.address, 1_000n * USDC);
  await registerAgent(connection, provider, { name: 'lingua-7', capabilities: ['translation'] });
}, 60_000);

afterAll(() => files.close());

function newJob() {
  const input = {
    provider: provider.address,
    evaluator: evaluator.address,
    amount: AMOUNT,
    specUri,
  };

  return createJob(connection, client, { ...input, deadline: inOneHour() });
}

async function submittedJob(name: string, result: unknown): Promise<Address> {
  const { job } = await newJob();

  await acceptJob(connection, provider, job);
  await submitResult(connection, provider, job, files.host(name, result));

  return job;
}

describe('job lifecycle through the SDK', () => {
  it('pays the provider when the deliverable passes the committed test', async () => {
    const before = await balanceOf(provider.address);
    const job = await submittedJob('good.json', products);
    const judgement = await evaluateJob(connection, evaluator, job);
    const settled = await getJob(connection.rpc, job);

    expect(judgement.action).toBe('completed');
    expect(judgement.verdict.results.every((result) => result.passed)).toBe(true);
    expect(settled.status).toBe(JobStatus.Completed);
    expect((await balanceOf(provider.address)) - before).toBe(AMOUNT - 75_000n);
  });

  it('refunds the client when the deliverable fails the committed test', async () => {
    const before = await balanceOf(client.address);
    const job = await submittedJob('short.json', products.slice(0, 2));
    const judgement = await evaluateJob(connection, evaluator, job);
    const settled = await getJob(connection.rpc, job);

    expect(judgement.action).toBe('rejected');
    expect(judgement.verdict.results.find((result) => result.type === 'count')?.passed).toBe(false);
    expect(settled.status).toBe(JobStatus.Rejected);
    expect(await balanceOf(client.address)).toBe(before);
  });

  it('lists the transactions of a job, labelled by instruction', async () => {
    const job = await submittedJob('activity.json', products);

    await evaluateJob(connection, evaluator, job);
    const activity = await listActivity(connection.rpc, job);

    expect(activity.map((entry) => entry.instruction)).toEqual([
      'complete',
      'submit',
      'accept',
      'create_job',
    ]);
    expect(activity.every((entry) => !entry.failed && entry.time)).toBe(true);
  });

  it('lets anyone reproduce the verdict from the on-chain commitments', async () => {
    const job = await getJob(connection.rpc, await submittedJob('again.json', products));

    expect((await verifyJob(job)).passed).toBe(true);
  });

  it('lets the client cancel a job nobody accepted', async () => {
    const before = await balanceOf(client.address);
    const { job } = await newJob();

    await refundJob(connection, client, job);

    expect((await getJob(connection.rpc, job)).status).toBe(JobStatus.Refunded);
    expect(await balanceOf(client.address)).toBe(before);
  });
});

describe('guards', () => {
  it('refuses to create a job whose spec is not a valid acceptance spec', async () => {
    const input = { provider: provider.address, amount: AMOUNT, deadline: inOneHour() };
    const badSpec = files.host('bad-spec.json', { hello: 'world' });

    await expect(createJob(connection, client, { ...input, specUri: badSpec })).rejects.toThrow(
      'Invalid acceptance spec',
    );
  });

  it('explains program errors in plain words', async () => {
    const job = await submittedJob('guard.json', products);
    const stranger = await fundedSigner();
    const asStranger = await completeJob(connection, stranger, job).catch(describeError);
    const tooEarly = await claimTimeout(connection, provider, job).catch(describeError);

    expect(asStranger).toBe('The signer is not allowed to perform this action on the job');
    expect(tooEarly).toBe('The review window is still open');
  });

  it('refuses to evaluate a job that has no submission', async () => {
    const { job } = await newJob();

    await expect(evaluateJob(connection, evaluator, job)).rejects.toThrow('not awaiting a verdict');
  });
});

describe('reading the chain', () => {
  it('lists jobs by party and agents with their track record', async () => {
    const jobs = await listJobs(connection.rpc, { provider: provider.address });
    const agent = await getAgent(connection.rpc, provider.address);
    const view = describeJob(jobs[0]);

    expect(jobs.length).toBeGreaterThanOrEqual(5);
    expect(jobs.every((job) => job.provider === provider.address)).toBe(true);
    expect(await listJobs(connection.rpc, { client: provider.address })).toEqual([]);
    expect(view).toMatchObject({ amount: '30', fee: '0.075', specUri });
    expect(describeAgent(agent as NonNullable<typeof agent>)).toMatchObject({
      name: 'lingua-7',
      capabilities: ['translation'],
      jobsCompleted: 2,
      jobsRejected: 1,
      volumeSettled: '60',
      successRate: 2 / 3,
    });
    expect((await listAgents(connection.rpc)).map((row) => row.name)).toContain('lingua-7');
  });
});
