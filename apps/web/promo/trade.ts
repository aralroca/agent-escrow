import { formatAmount, parseAmount } from '@agent-escrow/sdk';
import type { Client } from '@modelcontextprotocol/client';
import type { Page } from '@playwright/test';
import type { Reply } from '../../../e2e/mcp-client.ts';
import { spec, translations } from './data.ts';
import { pause, scene, stage } from './stage.ts';
import { say } from './voice.ts';

export type Agents = {
  buyer: Client;
  seller: Client;
  sellerAddress: string;
  /** USDC locked per job. */
  amount: number;
  call: (client: Client, tool: string, args?: object) => Promise<Reply>;
};
type Check = { type: string; passed: boolean };
type Verdict = { action: string; signature: string; checks: Check[] };
/** `story` picks the narration: the lines of the paid job or of the rejected one. */
type Trade = { page: Page; agents: Agents; story: string; job: string };

const LOCKED = new Set(['Funded', 'Accepted', 'Submitted']);
const CHECK_NAMES: Record<string, string> = {
  'json-schema': 'schema',
  count: 'count',
  'contains-all': 'brand names',
};

const tx = (signature: string) => `tx ${signature.slice(0, 4)}…${signature.slice(-4)}`;

/** Reads the real balances and animates them on the lanes. */
async function showBalances({ page, agents, job }: Trade): Promise<void> {
  const { buyer, seller, call } = agents;
  const [buyerWallet, sellerWallet, { data }] = await Promise.all([
    call(buyer, 'get_wallet'),
    call(seller, 'get_wallet'),
    job ? call(buyer, 'get_job', { job }) : { data: undefined },
  ]);
  const vault = data && LOCKED.has(data.status) ? data.amount : '0';

  await stage(page, 'balance', 'buyer', buyerWallet.data.usdc);
  await stage(page, 'balance', 'program', vault);
  await stage(page, 'balance', 'seller', sellerWallet.data.usdc);
}

/** One narrated step: the line starts, the work happens on-chain, the balances follow. */
async function act(trade: Trade, cue: string, text: string, work: () => Promise<void>) {
  const said = say(`${trade.story}.${cue}`);

  await stage(trade.page, 'headline', text);
  await work();
  await showBalances(trade);
  await said();
}

/** Step 1: the buyer commits the spec and locks the payment. */
async function lock(trade: Trade): Promise<void> {
  const { page, agents } = trade;
  const { amount, sellerAddress: provider } = agents;
  const label = `create_job · spec hash + ${amount} USDC`;

  await act(
    trade,
    'lock',
    `The buyer locks ${amount} USDC behind an acceptance test.`,
    async () => {
      const { data } = await agents.call(agents.buyer, 'create_job', {
        provider,
        amount_usdc: amount,
        spec,
      });

      trade.job = data.job;
      await stage(page, 'arrow', 'buyer', 'program', 'call', label, tx(data.signature), true);
    },
  );
}

/** Steps 2 and 3: the seller commits to the job, then commits its deliverable by hash. */
async function deliver(trade: Trade, result: unknown[]): Promise<void> {
  const { page, agents, job } = trade;
  const label = `submit · hash of ${result.length} translations`;

  await act(trade, 'accept', 'The seller sees the money is there, and accepts.', async () => {
    const { data } = await agents.call(agents.seller, 'accept_job', { job });

    await stage(page, 'arrow', 'seller', 'program', 'call', 'accept', tx(data.signature));
  });
  await act(
    trade,
    'submit',
    'The delivery is committed by hash. It cannot be swapped.',
    async () => {
      const { data } = await agents.call(agents.seller, 'submit_result', { job, result });

      await stage(page, 'arrow', 'seller', 'program', 'call', label, tx(data.signature));
    },
  );
}

/** Step 4: the buyer runs the committed spec; each check appears with its real result. */
async function evaluate({ page, agents, story, job }: Trade): Promise<Verdict> {
  const said = say(`${story}.evaluate`);

  await stage(page, 'headline', 'The buyer runs the test it committed to.');
  const { data } = await agents.call(agents.buyer, 'evaluate_job', { job });

  await stage(page, 'self', 'buyer', 'runs the committed spec');
  for (const check of data.checks as Check[]) {
    const mark = check.passed ? '✓' : '✗';

    await stage(page, 'chip', check.passed ? '' : 'bad', `${mark} ${CHECK_NAMES[check.type]}`);
    await pause(page, 500);
  }
  await said();

  return data;
}

/** Step 5: the program pays whoever the test says, and the balances show it. */
async function settle(trade: Trade, verdict: Verdict): Promise<void> {
  const { page, agents, job } = trade;
  const { amount, fee } = (await agents.call(agents.buyer, 'get_job', { job })).data;
  const paid = formatAmount(parseAmount(amount) - parseAmount(fee));
  const passed = verdict.action === 'completed';
  const [verb, kind, stamp] = passed ? ['complete', 'call', 'Paid'] : ['reject', 'bad', 'Refunded'];
  const payout = passed
    ? ['seller', `${paid} USDC`, `fee ${fee}`]
    : ['buyer', `${amount} USDC`, 'refund'];
  const ending = passed
    ? 'Every check passed. The seller is paid.'
    : 'A check failed. The buyer gets everything back.';

  await act(trade, 'settle', ending, async () => {
    await stage(page, 'arrow', 'buyer', 'program', kind, verb, tx(verdict.signature));
    await pause(page, 900);
    await stage(page, 'arrow', 'program', payout[0], 'money', payout[1], payout[2], true);
    await pause(page, 1_100);
    await stage(page, 'stamp', kind, stamp, passed ? 'buyer' : 'seller');
  });
}

/** Scene: one real job, drawn as its sequence diagram. Returns the job address. */
async function runTrade(
  page: Page,
  agents: Agents,
  story: string,
  title: string,
  result: unknown[],
) {
  const trade = { page, agents, story, job: '' };
  const said = say(`${story}.title`);

  await stage(page, 'reset');
  await scene(page, 'flow', title);
  await showBalances(trade);
  await said();
  await lock(trade);
  await deliver(trade, result);
  await settle(trade, await evaluate(trade));
  await pause(page, 2_000);

  return trade.job;
}

export const paidJob = (page: Page, agents: Agents) =>
  runTrade(page, agents, 'paid', 'A buyer agent hires a seller agent.', translations);

export const rejectedJob = (page: Page, agents: Agents) =>
  runTrade(page, agents, 'rejected', 'Now the seller cuts corners.', translations.slice(0, 6));
