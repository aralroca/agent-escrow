// Runs the demo on devnet through the MCP tools and prints every signature for docs/e2e.md.
// Usage: GITHUB_TOKEN=$(gh auth token) pnpm demo:devnet
// Needs the buyer and seller keypairs in ~/.config/solana/agent-escrow, the buyer holding
// devnet USDC (faucet.circle.com) and both holding a little devnet SOL.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { spec, translations } from '../apps/web/promo/data.ts';
import { contextFromEnv } from '../packages/mcp/src/context.ts';
import { createServer } from '../packages/mcp/src/server.ts';
import { call } from './mcp-client.ts';

const KEYS = join(homedir(), '.config', 'solana', 'agent-escrow');
const AMOUNT = 5;

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

/** Calls a tool, prints what it did as a table row, and returns its data. */
async function run(who: string, client: Client, tool: string, args: object = {}) {
  const { ok, data } = await call(client, tool, args);

  if (!ok) throw new Error(`${who} ${tool} failed: ${data}`);
  console.log(`| ${who} \`${tool}\` | ${data.job ?? ''} | ${data.signature ?? ''} |`);

  return data;
}

/** Hire, accept, deliver and evaluate one job. */
async function trade(buyer: Client, seller: Client, provider: string, result: unknown[]) {
  const { job } = await run('buyer', buyer, 'create_job', { provider, amount_usdc: AMOUNT, spec });

  await run('seller', seller, 'accept_job', { job });
  await run('seller', seller, 'submit_result', { job, result });
  const verdict = await run('buyer', buyer, 'evaluate_job', { job });

  console.log(`|   → ${verdict.action} | ${job} | |`);
}

const [buyer, seller] = await Promise.all([agent('buyer'), agent('seller')]);
const sellerWallet = (await call(seller, 'get_wallet')).data;
const buyerWallet = (await call(buyer, 'get_wallet')).data;

console.log(`buyer ${buyerWallet.address} holds ${buyerWallet.usdc} USDC, ${buyerWallet.sol} SOL`);
console.log('| Step | Job | Signature |\n| --- | --- | --- |');
await run('seller', seller, 'register_agent', { name: 'lingua-7', capabilities: ['translation'] });

if (Number(buyerWallet.usdc) < AMOUNT) {
  console.log(`The buyer needs at least ${AMOUNT} devnet USDC to continue.`);
  process.exit(0);
}

await trade(buyer, seller, sellerWallet.address, translations);
await trade(buyer, seller, sellerWallet.address, translations.slice(0, 6));
const { job } = await run('buyer', buyer, 'create_job', {
  provider: sellerWallet.address,
  amount_usdc: AMOUNT,
  spec,
});
await run('buyer', buyer, 'settle_expired', { job });
process.exit(0);
