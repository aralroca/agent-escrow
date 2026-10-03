import { describe, expect, it } from 'vitest';
import { type AgentView, JOB_STATUSES, meetsPolicy } from '../src/index.ts';

const agent = {
  capabilities: ['translation'],
  jobsCompleted: 120,
  successRate: 0.99,
} as AgentView;

describe('meetsPolicy', () => {
  it.each([
    [{}, true],
    [{ capability: 'translation' }, true],
    [{ capability: 'scraping' }, false],
    [{ minCompletedJobs: 100, minSuccessRate: 0.98 }, true],
    [{ minCompletedJobs: 121 }, false],
    [{ minSuccessRate: 0.995 }, false],
  ])('%j -> %s', (policy, expected) => {
    expect(meetsPolicy(agent, policy)).toBe(expected);
  });

  it('treats an agent with no history as failing any success-rate bar', () => {
    const newcomer = { ...agent, jobsCompleted: 0, successRate: undefined };

    expect(meetsPolicy(newcomer, { minSuccessRate: 0.5 })).toBe(false);
    expect(meetsPolicy(newcomer, {})).toBe(true);
  });
});

describe('JOB_STATUSES', () => {
  it('lists the program statuses by name, in order', () => {
    expect(JOB_STATUSES).toEqual([
      'Funded',
      'Accepted',
      'Submitted',
      'Completed',
      'Rejected',
      'Refunded',
      'Expired',
      'Claimed',
    ]);
  });
});
