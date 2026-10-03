import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { type Connection, connect, DEVNET_RPC, parseAmount } from '@agent-escrow/sdk';
import { createKeyPairSignerFromBytes, type KeyPairSigner } from '@solana/kit';
import { type Publish, publisher } from './hosting.ts';

/** Everything a tool needs: who the agent is, where the chain is, and what it may spend. */
export type Context = {
  connection: Connection;
  signer: KeyPairSigner;
  /** Hard cap per job, in base units. The server refuses to sign above it. */
  maxJobAmount: bigint;
  publish: Publish;
};

type Env = Record<string, string | undefined>;

const DEFAULT_KEYPAIR = join(homedir(), '.config', 'solana', 'id.json');
const DEFAULT_MAX_JOB_USDC = '50';

async function loadSigner(path: string): Promise<KeyPairSigner> {
  const bytes = Uint8Array.from(JSON.parse(readFileSync(path, 'utf8')));

  return createKeyPairSignerFromBytes(bytes);
}

/** Builds the context from environment variables. See the README for each one. */
export async function contextFromEnv(env: Env = process.env): Promise<Context> {
  const rpcUrl = env.SOLANA_RPC_URL ?? DEVNET_RPC;

  return {
    connection: connect(rpcUrl),
    signer: await loadSigner(env.AGENT_ESCROW_KEYPAIR ?? DEFAULT_KEYPAIR),
    maxJobAmount: parseAmount(env.MAX_JOB_USDC ?? DEFAULT_MAX_JOB_USDC),
    publish: publisher(env.GITHUB_TOKEN),
  };
}
