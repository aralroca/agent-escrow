// Runs the demo on devnet through the MCP tools and prints every signature for docs/e2e.md.
// Usage: GITHUB_TOKEN=$(gh auth token) pnpm demo:devnet
// Needs the buyer and seller keypairs in ~/.config/solana/agent-escrow, the buyer holding
// devnet USDC (faucet.circle.com) and both holding a little devnet SOL.
// It can be run again after a failure: steps already on-chain are skipped.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { spec, translations } from '../apps/web/promo/data.ts';
import { contextFromEnv } from '../packages/mcp/src/context.ts';
import { createServer } from '../packages/mcp/src/server.ts';
import { call } from './mcp-client.ts';

type Agents = { buyer: Client; seller: Client; provider: string };

const KEYS = join(homedir(), '.config', 'solana', 'agent-escrow');
const AMOUNT = 5;
const RETRIES = 6;
const BACKOFF_MS = 12_000;
/** The public devnet RPC allows few requests per second; the demo is in no hurry. */
const PACE_MS = 2_500;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** An MCP client for one of the demo wallets, talking to devnet. */
async function agent(name: 'buyer' | 'seller'): Promise<Client> {
  const env = {
    ...process.env,
    AGENT_ESCROW_KEYPAIR: join(KEYS, `${name}.json`),
    MAX_JOB_USDC: '10',
  };
  const [clientEnd, serverEnd] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: `demo-${name}`, version: '1.0.0' });

  await createServer(await contextFromEnv(env)).connect(serverEnd);
  await client.connect(clientEnd);

  return client;
}

/** Calls a tool, waiting and retrying while the RPC is rate limiting. */
async function patient(client: Client, tool: string, args: object, attempt = 0) {
  const reply = await call(client, tool, args);
  const throttled = !reply.ok && String(reply.data).includes('429') && attempt < RETRIES;

  await wait(throttled ? BACKOFF_MS : PACE_MS);

  return throttled ? patient(client, tool, args, attempt + 1) : reply;
}

/** Calls a tool, prints what it did as a table row, and returns its data. */
async function run(who: string, client: Client, tool: string, args: object = {}) {
  const { ok, data } = await patient(client, tool, args);

  if (!ok) throw new Error(`${who} ${tool} failed: ${data}`);
  if (data.signature) console.log(`| ${who} \`${tool}\` | ${data.job ?? ''} | ${data.signature} |`);

  return data;
}

/** A job created by an earlier, interrupted run that is still waiting for the seller. */
async function pendingJob({ seller }: Agents): Promise<string | undefined> {
  const waiting = await run('seller', seller, 'list_jobs', { role: 'provider', status: 'Funded' });

  return waiting[0]?.address;
}

async function hire({ buyer, provider }: Agents): Promise<string> {
  const { job } = await run('buyer', buyer, 'create_job', { provider, amount_usdc: AMOUNT, spec });

  return job;
}

/** Hire (or resume), accept, deliver and evaluate one job. */
async function trade(agents: Agents, result: unknown[]): Promise<void> {
  const job = (await pendingJob(agents)) ?? (await hire(agents));

  await run('seller', agents.seller, 'accept_job', { job });
  await run('seller', agents.seller, 'submit_result', { job, result });
  const verdict = await run('buyer', agents.buyer, 'evaluate_job', { job });

  console.log(`|   → ${verdict.action} | ${job} | |`);
}

async function cancelledJob(agents: Agents): Promise<void> {
  const job = (await pendingJob(agents)) ?? (await hire(agents));

  await run('buyer', agents.buyer, 'settle_expired', { job });
}

const [buyer, seller] = await Promise.all([agent('buyer'), agent('seller')]);
const buyerWallet = await run('buyer', buyer, 'get_wallet');
const registered = (await run('seller', seller, 'get_wallet')).profile.name
  ? undefined
  : await run('seller', seller, 'register_agent', {
      name: 'lingua-7',
      capabilities: ['translation'],
    });
const sellerWallet = await run('seller', seller, 'get_wallet');
const agents = { buyer, seller, provider: sellerWallet.address };
const record = sellerWallet.profile;
const refunded = await run('buyer', buyer, 'list_jobs', { role: 'client', status: 'Refunded' });

console.log(`buyer ${buyerWallet.address} holds ${buyerWallet.usdc} USDC, ${buyerWallet.sol} SOL`);
console.log(`seller record: ${JSON.stringify(record)}${registered ? ' (just registered)' : ''}`);
console.log('| Step | Job | Signature |\n| --- | --- | --- |');

if (record.jobsCompleted === 0) await trade(agents, translations);
if (record.jobsRejected === 0) await trade(agents, translations.slice(0, 6));
if (refunded.length === 0) await cancelledJob(agents);
console.log(`final: ${JSON.stringify((await run('seller', seller, 'get_wallet')).profile)}`);
process.exit(0);
