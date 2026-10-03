import { address, getAddressDecoder } from '@solana/kit';
import { describe, expect, it } from 'vitest';
import { getJobEncoder, JobStatus } from '../src/generated/index.ts';
import { JOB_OFFSETS } from '../src/index.ts';

const job = {
  client: address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
  provider: address('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
  evaluator: address('SysvarC1ock11111111111111111111111111111111'),
  mint: address('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
  jobId: 1n,
  amount: 2n,
  deadline: 3n,
  reviewWindow: 4n,
  createdAt: 5n,
  submittedAt: 6n,
  settledAt: 7n,
  status: JobStatus.Rejected,
  bump: 0,
  vaultBump: 0,
  specHash: new Uint8Array(32),
  resultHash: new Uint8Array(32),
  specUri: 'https://example.com/spec.json',
  resultUri: '',
};

// RPC filters compare raw bytes at these offsets; a reordered field would silently break them.
describe('JOB_OFFSETS', () => {
  const bytes = getJobEncoder().encode(job);
  const addressAt = (offset: bigint) => getAddressDecoder().decode(bytes, Number(offset));

  it('point at the parties inside an encoded job', () => {
    expect(addressAt(JOB_OFFSETS.client)).toBe(job.client);
    expect(addressAt(JOB_OFFSETS.provider)).toBe(job.provider);
    expect(addressAt(JOB_OFFSETS.evaluator)).toBe(job.evaluator);
  });

  it('points at the status byte', () => {
    expect(bytes[Number(JOB_OFFSETS.status)]).toBe(JobStatus.Rejected);
  });
});
