import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { Address, KeyPairSigner } from '@solana/kit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Context } from '../packages/mcp/src/context.ts';
import { createServer, TOOLS } from '../packages/mcp/src/server.ts';
import { products, spec } from './fixtures.ts';
import {
  balanceOf,
  connection,
  createMint,
  fundedSigner,
  mintTo,
  serveFiles,
  USDC,
} from './world.ts';

// biome-ignore lint/suspicious/noExplicitAny: tool replies are arbitrary JSON
type Reply = { ok: boolean; data: any };

let files: Awaited<ReturnType<typeof serveFiles>>;
let mint: Address;
let buyerKey: KeyPairSigner;
let sellerKey: KeyPairSigner;
let buyer: Client;
let seller: Client;
let published = 0;

/** An MCP client wired in memory to a server that signs as `signer`. */
async function agent(signer: KeyPairSigner): Promise<Client> {
  const publish = async (name: string, content: unknown) =>
    files.host(`${published++}-${name}`, content);
  const context: Context = { connection, signer, mint, maxJobAmount: 50n * USDC, publish };
  const [clientEnd, serverEnd] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-agent', version: '1.0.0' });

  await createServer(context).connect(serverEnd);
  await client.connect(clientEnd);

  return client;
}

/** Calls a tool and parses its reply: JSON on success, the error text on failure. */
async function call(client: Client, name: string, args: object = {}): Promise<Reply> {
  const result = await client.callTool({ name, arguments: args as Record<string, unknown> });
  const [{ text }] = result.content as { text: string }[];

  return { ok: !result.isError, data: result.isError ? text : JSON.parse(text) };
}

async function hire(overrides: object = {}): Promise<Reply> {
  const job = { provider: sellerKey.address, amount_usdc: 30, spec, ...overrides };

  return call(buyer, 'create_job', job);
}

async function deliveredJob(result: unknown): Promise<string> {
  const { data } = await hire();

  await call(seller, 'accept_job', { job: data.job });
  await call(seller, 'submit_result', { job: data.job, result });

  return data.job;
}

beforeAll(async () => {
  [buyerKey, sellerKey] = await Promise.all([fundedSigner(), fundedSigner()]);
  mint = await createMint(buyerKey);
  files = await serveFiles();
  await mintTo(buyerKey, mint, buyerKey.address, 1_000n * USDC);
  [buyer, seller] = await Promise.all([agent(buyerKey), agent(sellerKey)]);
  await call(seller, 'register_agent', { name: 'lingua-mcp', capabilities: ['translation'] });
});

afterAll(() => files.close());

describe('tool catalogue', () => {
  it('exposes every tool with a description and an input schema', async () => {
    const { tools } = await buyer.listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual(TOOLS.map((tool) => tool.name).sort());
    expect(tools.every((tool) => tool.description && tool.inputSchema.type === 'object')).toBe(
      true,
    );
  });

  it('reports the wallet, its balances and its spending cap', async () => {
    const { data } = await call(buyer, 'get_wallet');

    expect(data).toMatchObject({ address: buyerKey.address, usdc: '1000', maxJobUsdc: '50' });
    expect(data.profile).toContain('Not registered');
  });
});

describe('two agents trading through MCP', () => {
  it('buyer finds the seller by capability and track record', async () => {
    const found = await call(buyer, 'search_agents', { capability: 'translation' });
    const none = await call(buyer, 'search_agents', {
      capability: 'translation',
      min_completed_jobs: 100,
    });

    expect(found.data.map((agent: { name: string }) => agent.name)).toContain('lingua-mcp');
    expect(none.data.map((agent: { name: string }) => agent.name)).not.toContain('lingua-mcp');
  });

  it('pays the seller when the delivery passes the acceptance spec', async () => {
    const { data: created } = await hire();
    const waiting = await call(seller, 'list_jobs', { role: 'provider', status: 'Funded' });
    const accepted = await call(seller, 'accept_job', { job: created.job });
    const submitted = await call(seller, 'submit_result', { job: created.job, result: products });
    const verdict = await call(buyer, 'evaluate_job', { job: created.job });
    const job = await call(buyer, 'get_job', { job: created.job });

    expect(waiting.data.map((row: { address: string }) => row.address)).toContain(created.job);
    expect([accepted.ok, submitted.ok]).toEqual([true, true]);
    expect(verdict.data).toMatchObject({ action: 'completed', passed: true });
    expect(job.data).toMatchObject({ status: 'Completed', amount: '30', fee: '0.075' });
    expect(await balanceOf(sellerKey.address, mint)).toBe(29_925_000n);
  });

  it('refunds the buyer when the delivery fails the acceptance spec', async () => {
    const before = await balanceOf(buyerKey.address, mint);
    const job = await deliveredJob(products.slice(0, 2));
    const verdict = await call(buyer, 'evaluate_job', { job });

    expect(verdict.data).toMatchObject({ action: 'rejected', passed: false });
    expect(verdict.data.checks).toContainEqual({
      type: 'count',
      passed: false,
      detail: '2 / 3 items',
    });
    expect(await balanceOf(buyerKey.address, mint)).toBe(before);
  });

  it('updates the seller reputation from settled jobs only', async () => {
    const { data } = await call(seller, 'get_wallet');

    expect(data.profile).toMatchObject({ jobsCompleted: 1, jobsRejected: 1, successRate: 0.5 });
  });
});

describe('guards', () => {
  it('refuses to lock more than the spending cap', async () => {
    const reply = await hire({ amount_usdc: 51 });

    expect(reply).toMatchObject({ ok: false });
    expect(reply.data).toContain('above this agent');
  });

  it('refuses sellers below the hiring policy or not registered', async () => {
    const policy = await hire({ min_success_rate: 0.98 });
    const stranger = await hire({ provider: (await fundedSigner()).address });

    expect(policy.data).toContain('does not meet the hiring policy');
    expect(stranger.data).toContain('is not a registered agent');
  });

  it.each([
    ['a missing provider', { provider: undefined }],
    ['an invalid address', { provider: 'not-an-address' }],
    ['a negative amount', { amount_usdc: -5 }],
    ['a text amount', { amount_usdc: 'thirty' }],
    ['no spec at all', { spec: undefined }],
    ['a spec with no checks', { spec: { version: 1, title: 'empty', checks: [] } }],
  ])('rejects create_job with %s without moving funds', async (_name, overrides) => {
    const before = await balanceOf(buyerKey.address, mint);
    const reply = await hire(overrides);

    expect(reply.ok).toBe(false);
    expect(await balanceOf(buyerKey.address, mint)).toBe(before);
  });

  it('rejects calls on jobs that do not exist or from the wrong party', async () => {
    const { data } = await hire();
    const missing = await call(buyer, 'get_job', { job: sellerKey.address });
    const wrongParty = await call(buyer, 'accept_job', { job: data.job });

    expect(missing.data).toContain('No job found');
    expect(wrongParty.ok).toBe(false);
  });

  it('refuses a second verdict on a settled job', async () => {
    const job = await deliveredJob(products);
    const first = await call(buyer, 'evaluate_job', { job });
    const second = await call(buyer, 'evaluate_job', { job });

    expect(first.data.action).toBe('completed');
    expect(second.data).toContain('not awaiting a verdict');
  });
});

describe('timed exits', () => {
  it('lets the buyer take the money back when nobody accepted', async () => {
    const before = await balanceOf(buyerKey.address, mint);
    const { data } = await hire();
    const settled = await call(buyer, 'settle_expired', { job: data.job });

    expect(settled.data.outcome).toBe('refunded to the client');
    expect(await balanceOf(buyerKey.address, mint)).toBe(before);
  });

  it('does not let either side exit early', async () => {
    const { data } = await hire();
    const accepted = await call(seller, 'accept_job', { job: data.job });
    const buyerEarly = await call(buyer, 'settle_expired', { job: data.job });
    const submitted = await call(seller, 'submit_result', { job: data.job, result: products });
    const sellerEarly = await call(seller, 'settle_expired', { job: data.job });

    expect([accepted.ok, submitted.ok]).toEqual([true, true]);
    expect(buyerEarly.data).toContain('still has time to deliver');
    expect(sellerEarly.data).toContain('still has time to judge');
  });
});
