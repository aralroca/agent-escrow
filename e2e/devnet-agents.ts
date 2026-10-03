import { homedir } from 'node:os';
import { join } from 'node:path';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { contextFromEnv } from '../packages/mcp/src/context.ts';
import { createServer } from '../packages/mcp/src/server.ts';
import { call, type Reply } from './mcp-client.ts';

const KEYS = join(homedir(), '.config', 'solana', 'agent-escrow');
const RETRIES = 6;
const BACKOFF_MS = 12_000;
/** The public devnet RPC allows few requests per second; scripted runs are in no hurry. */
const PACE_MS = 1_500;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * An MCP client for one of the demo wallets in ~/.config/solana/agent-escrow, talking to devnet.
 * With GITHUB_TOKEN set, inline specs and deliverables are published as public gists.
 */
export async function devnetAgent(name: 'buyer' | 'seller'): Promise<Client> {
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
export async function callPatiently(
  client: Client,
  tool: string,
  args: object = {},
  attempt = 0,
): Promise<Reply> {
  const reply = await call(client, tool, args);
  const throttled = !reply.ok && String(reply.data).includes('429') && attempt < RETRIES;

  await wait(throttled ? BACKOFF_MS : PACE_MS);

  return throttled ? callPatiently(client, tool, args, attempt + 1) : reply;
}
