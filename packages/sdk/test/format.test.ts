import { describe, expect, it } from 'vitest';
import type { AgentRecord } from '../src/index.ts';
import {
  describeError,
  formatAmount,
  parseAmount,
  protocolFee,
  successRate,
} from '../src/index.ts';

describe('amounts', () => {
  it.each([
    [30_000_000n, '30'],
    [29_925_000n, '29.925'],
    [1n, '0.000001'],
    [0n, '0'],
  ])('formats %s base units as %s', (amount, text) => {
    expect(formatAmount(amount)).toBe(text);
    expect(parseAmount(text)).toBe(amount);
  });

  it.each(['', 'abc', '1.2.3', '-1', '0.0000001', '1e3'])('rejects the amount "%s"', (text) => {
    expect(() => parseAmount(text)).toThrow('Invalid amount');
  });

  it('charges 0.25% and rounds the fee down', () => {
    expect(protocolFee(30_000_000n)).toBe(75_000n);
    expect(protocolFee(399n)).toBe(0n);
  });
});

describe('successRate', () => {
  const record = (completed: number, rejected: number, expired: number) =>
    ({ jobsCompleted: completed, jobsRejected: rejected, jobsExpired: expired }) as AgentRecord;

  it('is the share of settled jobs that were paid', () => {
    expect(successRate(record(3, 1, 0))).toBe(0.75);
    expect(successRate(record(1, 0, 1))).toBe(0.5);
  });

  it('is undefined for an agent with no settled jobs', () => {
    expect(successRate(record(0, 0, 0))).toBeUndefined();
  });
});

describe('describeError', () => {
  it('joins the messages of nested errors', () => {
    const error = new Error('outer', { cause: new Error('inner') });

    expect(describeError(error)).toBe('outer: inner');
  });

  it('stringifies values that are not errors', () => {
    expect(describeError('boom')).toBe('boom');
  });
});
