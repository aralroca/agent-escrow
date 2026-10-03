import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PROGRAM_ID = '98UQvVXX8Zm3AGt9V3uiYYTWYFtDUbvEt6MwK2izLhmd';
const PROGRAM_PATH = 'target/deploy/agent_escrow.so';
const RPC_URL = 'http://127.0.0.1:8899';
const STARTUP_ATTEMPTS = 60;
const POLL_MS = 500;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function isHealthy(): Promise<boolean> {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' });
  const headers = { 'content-type': 'application/json' };

  return fetch(RPC_URL, { method: 'POST', headers, body })
    .then((response) => response.json())
    .then((json) => json.result === 'ok')
    .catch(() => false);
}

async function waitUntilHealthy(attempt = 0): Promise<void> {
  if (await isHealthy()) return;
  if (attempt >= STARTUP_ATTEMPTS) throw new Error('solana-test-validator did not start');
  await wait(POLL_MS);

  return waitUntilHealthy(attempt + 1);
}

function startValidator(): ChildProcess {
  const ledger = mkdtempSync(join(tmpdir(), 'agent-escrow-ledger-'));
  const args = [
    '--reset',
    '--quiet',
    '--ledger',
    ledger,
    '--bpf-program',
    PROGRAM_ID,
    PROGRAM_PATH,
  ];

  return spawn('solana-test-validator', args, { stdio: 'ignore' });
}

/** Vitest global setup: runs a local validator with the program loaded for the whole e2e run. */
export default async function setup() {
  const validator = startValidator();

  await waitUntilHealthy();

  return () => {
    validator.kill();
  };
}
