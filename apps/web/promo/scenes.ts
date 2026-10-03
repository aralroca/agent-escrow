import { formatAmount, parseAmount } from '@agent-escrow/sdk';
import type { Client } from '@modelcontextprotocol/client';
import type { Page } from '@playwright/test';
import { call } from '../../../e2e/mcp-client.ts';
import { brandCard, outroCard, problemCard } from './cards.ts';
import { spec, translations } from './data.ts';
import { flowCard } from './flow-card.ts';
import { caption, click, flow, pause, scrollTo, showCard } from './stage.ts';

export type Agents = { buyer: Client; seller: Client; sellerAddress: string };
type Check = { type: string; passed: boolean; detail: string };
type Trade = { page: Page; agents: Agents; job: string };

const BEAT = 2_300;
const LOCKED = new Set(['Funded', 'Accepted', 'Submitted']);
const CHECK_NAMES: Record<string, string> = {
  'json-schema': 'schema',
  count: 'count',
  'contains-all': 'brand names',
};

const tx = (signature: string) => `tx ${signature.slice(0, 4)}…${signature.slice(-4)}`;

export async function intro(page: Page): Promise<void> {
  await showCard(page, 'problem', problemCard(), 3_400);
  await showCard(page, 'brand', brandCard(), 3_600);
}

export async function landing(page: Page, site: string): Promise<void> {
  await page.goto(site);
  await caption(page, 'One escrow per job. The money follows the test.');
  await pause(page, 3_000);
  await scrollTo(page, '#you');
  await caption(page, 'Bad work costs the buyer nothing. Good work always gets paid.');
  await pause(page, 3_200);
}

/** Reads the real balances after a step and shows them on the lanes. */
async function showBalances({ page, agents, job }: Trade): Promise<void> {
  const [buyer, seller] = await Promise.all(
    [agents.buyer, agents.seller].map((agent) => call(agent, 'get_wallet')),
  );
  const { data } = job ? await call(agents.buyer, 'get_job', { job }) : { data: undefined };
  const vault = data && LOCKED.has(data.status) ? data.amount : '0';

  await flow(page, 'balance', 'buyer', `wallet · ${buyer.data.usdc} USDC`);
  await flow(page, 'balance', 'program', `vault · ${vault} USDC`);
  await flow(page, 'balance', 'seller', `wallet · ${seller.data.usdc} USDC`);
}

async function step(trade: Trade, text: string): Promise<void> {
  await flow(trade.page, 'step', text);
  await showBalances(trade);
  await pause(trade.page, BEAT);
}

/** Step 1: the buyer commits the spec and locks the payment. */
async function lock(page: Page, agents: Agents): Promise<Trade> {
  const args = { provider: agents.sellerAddress, amount_usdc: 30, spec };
  const { data } = await call(agents.buyer, 'create_job', args);
  const trade = { page, agents, job: data.job as string };

  await flow(
    page,
    'arrow',
    'buyer',
    'program',
    'call',
    'create_job · spec hash + 30 USDC',
    tx(data.signature),
  );
  await step(trade, 'The buyer locks 30 USDC behind an acceptance test.');

  return trade;
}

/** Steps 2 and 3: the seller commits to the job, then commits its deliverable by hash. */
async function deliver(trade: Trade, result: unknown[]): Promise<void> {
  const { page, agents, job } = trade;
  const accepted = await call(agents.seller, 'accept_job', { job });

  await flow(page, 'arrow', 'seller', 'program', 'call', 'accept', tx(accepted.data.signature));
  await step(trade, 'The seller sees the money is there, and accepts.');
  const submitted = await call(agents.seller, 'submit_result', { job, result });

  await flow(
    page,
    'arrow',
    'seller',
    'program',
    'call',
    `submit · hash of ${result.length} translations`,
    tx(submitted.data.signature),
  );
  await step(trade, 'The delivery is committed by hash. It cannot be swapped.');
}

/** Step 4: the buyer runs the committed spec; each check appears with its real result. */
async function evaluate({ page, agents, job }: Trade) {
  const { data } = await call(agents.buyer, 'evaluate_job', { job });

  await flow(page, 'self', 'buyer', 'runs the committed spec');
  for (const check of data.checks as Check[]) {
    const mark = check.passed ? '✓' : '✗';

    await flow(page, 'chip', check.passed ? '' : 'bad', `${mark} ${CHECK_NAMES[check.type]}`);
    await pause(page, 450);
  }

  return data as { action: string; signature: string };
}

/** Step 5: the program pays whoever the test says, and the balances show it. */
async function settle(trade: Trade, verdict: { action: string; signature: string }) {
  const { page, agents, job } = trade;
  const { amount, fee } = (await call(agents.buyer, 'get_job', { job })).data;
  const paid = formatAmount(parseAmount(amount) - parseAmount(fee));
  const passed = verdict.action === 'completed';

  await flow(
    page,
    'arrow',
    'buyer',
    'program',
    passed ? 'call' : 'bad',
    passed ? 'complete' : 'reject',
    tx(verdict.signature),
  );
  await pause(page, 900);
  await flow(
    page,
    'arrow',
    'program',
    passed ? 'seller' : 'buyer',
    'money',
    passed ? `${paid} USDC` : `${amount} USDC`,
    passed ? `fee ${fee}` : 'refund',
  );
  await step(
    trade,
    passed
      ? 'Every check passed. The seller is paid.'
      : 'A check failed. The buyer gets everything back.',
  );
}

/** Scene: one real job, drawn as its sequence diagram. Returns the job address. */
export async function trade(page: Page, agents: Agents, title: string, result: unknown[]) {
  await showCard(page, `flow-${result.length}`, flowCard(title), 700);
  await showBalances({ page, agents, job: '' });
  await pause(page, 900);
  const job = await lock(page, agents);

  await deliver(job, result);
  await settle(job, await evaluate(job));
  await pause(page, 1_200);

  return job.job;
}

export const paidJob = (page: Page, agents: Agents) =>
  trade(page, agents, 'A buyer agent hires a seller agent', translations);

export const rejectedJob = (page: Page, agents: Agents) =>
  trade(page, agents, 'Now the seller cuts corners', translations.slice(0, 6));

/** Scene: the job page, where a visitor re-runs the acceptance test in the browser. */
export async function verify(page: Page, site: string, job: string, captions: [string, string]) {
  await page.goto(`${site}#/jobs/${job}`);
  await caption(page, captions[0]);
  await pause(page, 2_800);
  await click(page, page.getByRole('button', { name: 'Verify independently' }));
  await page.getByRole('status').waitFor();
  await scrollTo(page, '.verification', 200);
  await caption(page, captions[1]);
  await pause(page, 3_400);
}

export async function reputation(page: Page, site: string): Promise<void> {
  await page.goto(`${site}#/agents`);
  await caption(page, 'Reputation is the record of settled escrows. Nothing else.');
  await pause(page, 3_600);
}

export async function outro(page: Page): Promise<void> {
  await showCard(page, 'outro', outroCard(), 4_500);
}
