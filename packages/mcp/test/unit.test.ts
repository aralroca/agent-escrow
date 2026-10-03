import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentView } from '@agent-escrow/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contextFromEnv } from '../src/context.ts';
import { publisher } from '../src/hosting.ts';
import { meetsPolicy } from '../src/tools/agents.ts';

const agent = {
  capabilities: ['translation'],
  jobsCompleted: 120,
  successRate: 0.99,
} as AgentView;

afterEach(() => vi.unstubAllGlobals());

describe('meetsPolicy', () => {
  it.each([
    [{}, true],
    [{ capability: 'translation' }, true],
    [{ capability: 'scraping' }, false],
    [{ min_completed_jobs: 100, min_success_rate: 0.98 }, true],
    [{ min_completed_jobs: 121 }, false],
    [{ min_success_rate: 0.995 }, false],
  ])('%j -> %s', (policy, expected) => {
    expect(meetsPolicy(agent, policy)).toBe(expected);
  });

  it('treats an agent with no history as failing any success-rate bar', () => {
    const newcomer = { ...agent, jobsCompleted: 0, successRate: undefined };

    expect(meetsPolicy(newcomer, { min_success_rate: 0.5 })).toBe(false);
    expect(meetsPolicy(newcomer, {})).toBe(true);
  });
});

describe('publisher', () => {
  it('explains how to host content when no token is configured', async () => {
    await expect(publisher()('spec.json', {})).rejects.toThrow('No hosting configured');
  });

  it('publishes a public gist and returns its raw URL', async () => {
    const raw_url = 'https://gist.githubusercontent.com/u/1/raw/spec.json';
    const fetchMock = vi.fn(async () => Response.json({ files: { 'spec.json': { raw_url } } }));

    vi.stubGlobal('fetch', fetchMock);

    const url = await publisher('token')('spec.json', { a: 1 });
    const [, request] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];

    expect(url).toBe(raw_url);
    expect(JSON.parse(request.body)).toMatchObject({ public: true });
  });

  it('surfaces the reason when GitHub refuses', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ message: 'Bad credentials' }));

    await expect(publisher('token')('spec.json', {})).rejects.toThrow('Bad credentials');
  });
});

describe('contextFromEnv', () => {
  const keypair = join(mkdtempSync(join(tmpdir(), 'agent-escrow-')), 'id.json');
  // A throwaway test key: 32-byte seed followed by its public key.
  const bytes = [
    174, 47, 154, 16, 202, 193, 206, 113, 199, 190, 53, 133, 169, 175, 31, 56, 222, 53, 138, 189,
    224, 216, 117, 173, 10, 149, 53, 45, 73, 251, 237, 246, 15, 185, 186, 82, 177, 240, 148, 69,
    241, 227, 167, 80, 141, 89, 240, 121, 121, 35, 172, 247, 68, 251, 226, 218, 48, 63, 176, 109,
    168, 89, 238, 135,
  ];

  writeFileSync(keypair, JSON.stringify(bytes));

  it('defaults to devnet USDC and a 50 USDC cap', async () => {
    const context = await contextFromEnv({ AGENT_ESCROW_KEYPAIR: keypair });

    expect(context.maxJobAmount).toBe(50_000_000n);
    expect(context.mint).toBe('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
    expect(context.signer.address).toBe('24PNhTaNtomHhoy3fTRaMhAFCRj4uHqhZEEoWrKDbR5p');
  });

  it('reads the spending cap from MAX_JOB_USDC', async () => {
    const context = await contextFromEnv({ AGENT_ESCROW_KEYPAIR: keypair, MAX_JOB_USDC: '7.5' });

    expect(context.maxJobAmount).toBe(7_500_000n);
  });

  it('fails clearly when the keypair file is missing', async () => {
    await expect(contextFromEnv({ AGENT_ESCROW_KEYPAIR: '/nope/id.json' })).rejects.toThrow(
      'ENOENT',
    );
  });
});
