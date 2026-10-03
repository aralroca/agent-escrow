import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AGENT_ESCROW_PROGRAM_ADDRESS, USDC_DEVNET_MINT } from '@agent-escrow/sdk';

const PROGRAM_PATH = 'target/deploy/agent_escrow.so';
// The program only accepts USDC, so the local chain gets a USDC mint at the real address,
// controlled by the test key in world.ts.
const USDC_FIXTURE = 'e2e/usdc-mint.json';
export const RPC_URL = 'http://127.0.0.1:8899';
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
  const program = ['--bpf-program', AGENT_ESCROW_PROGRAM_ADDRESS, PROGRAM_PATH];
  const usdc = ['--account', USDC_DEVNET_MINT, USDC_FIXTURE];
  const args = ['--reset', '--quiet', '--ledger', ledger, ...program, ...usdc];

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
