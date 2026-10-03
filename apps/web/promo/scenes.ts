import { formatAmount, parseAmount } from '@agent-escrow/sdk';
import type { Client } from '@modelcontextprotocol/client';
import type { Page } from '@playwright/test';
import type { Reply } from '../../../e2e/mcp-client.ts';
import { spec, translations } from './data.ts';
import { browse, click, pause, scene, scrollTo, stage } from './stage.ts';

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
type Trade = { page: Page; agents: Agents; job: string };

const BEAT = 2_400;
const INSTALL_LINES = 9;
const LOCKED = new Set(['Funded', 'Accepted', 'Submitted']);
const CHECK_NAMES: Record<string, string> = {
  'json-schema': 'schema',
  count: 'count',
  'contains-all': 'brand names',
};

const tx = (signature: string) => `tx ${signature.slice(0, 4)}…${signature.slice(-4)}`;

export async function intro(page: Page): Promise<void> {
  await stage(page, 'show', 'intro');
  await stage(page, 'beat', 'problem');
  await pause(page, 3_800);
  await stage(page, 'beat', 'options');
  await pause(page, 4_800);
  await stage(page, 'beat', 'brand');
  await pause(page, 4_600);
}

/** Reads the real balances after a step and animates them on the lanes. */
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

async function step(trade: Trade, text: string): Promise<void> {
  await stage(trade.page, 'headline', text);
  await showBalances(trade);
  await pause(trade.page, BEAT);
}

/** Step 1: the buyer commits the spec and locks the payment. */
async function lock(page: Page, agents: Agents): Promise<Trade> {
  const { amount, sellerAddress: provider } = agents;
  const args = { provider, amount_usdc: amount, spec };
  const { data } = await agents.call(agents.buyer, 'create_job', args);
  const label = `create_job · spec hash + ${amount} USDC`;
  const trade = { page, agents, job: data.job as string };

  await stage(page, 'arrow', 'buyer', 'program', 'call', label, tx(data.signature), true);
  await step(trade, `The buyer locks ${amount} USDC behind an acceptance test.`);

  return trade;
}

/** Steps 2 and 3: the seller commits to the job, then commits its deliverable by hash. */
async function deliver(trade: Trade, result: unknown[]): Promise<void> {
  const { page, agents, job } = trade;
  const label = `submit · hash of ${result.length} translations`;
  const accepted = await agents.call(agents.seller, 'accept_job', { job });

  await stage(page, 'arrow', 'seller', 'program', 'call', 'accept', tx(accepted.data.signature));
  await step(trade, 'The seller sees the money is there, and accepts.');
  const submitted = await agents.call(agents.seller, 'submit_result', { job, result });

  await stage(page, 'arrow', 'seller', 'program', 'call', label, tx(submitted.data.signature));
  await step(trade, 'The delivery is committed by hash. It cannot be swapped.');
}

/** Step 4: the buyer runs the committed spec; each check appears with its real result. */
async function evaluate({ page, agents, job }: Trade): Promise<Verdict> {
  const { data } = await agents.call(agents.buyer, 'evaluate_job', { job });

  await stage(page, 'headline', 'The buyer runs the test it committed to.');
  await stage(page, 'self', 'buyer', 'runs the committed spec');
  for (const check of data.checks as Check[]) {
    const mark = check.passed ? '✓' : '✗';

    await stage(page, 'chip', check.passed ? '' : 'bad', `${mark} ${CHECK_NAMES[check.type]}`);
    await pause(page, 500);
  }

  return data;
}

/** Step 5: the program pays whoever the test says, and the balances show it. */
async function settle(trade: Trade, verdict: Verdict): Promise<void> {
  const { page, agents, job } = trade;
  const { amount, fee } = (await agents.call(agents.buyer, 'get_job', { job })).data;
  const paid = formatAmount(parseAmount(amount) - parseAmount(fee));
  const passed = verdict.action === 'completed';
  const [verb, kind] = passed ? ['complete', 'call'] : ['reject', 'bad'];
  const payout = passed
    ? ['seller', `${paid} USDC`, `fee ${fee}`]
    : ['buyer', `${amount} USDC`, 'refund'];
  const ending = passed
    ? 'Every check passed. The seller is paid.'
    : 'A check failed. The buyer gets everything back.';

  await pause(page, 700);
  await stage(page, 'arrow', 'buyer', 'program', kind, verb, tx(verdict.signature));
  await pause(page, 900);
  await stage(page, 'arrow', 'program', payout[0], 'money', payout[1], payout[2], true);
  await step(trade, ending);
}

/** Scene: one real job, drawn as its sequence diagram. Returns the job address. */
async function trade(
  page: Page,
  agents: Agents,
  title: string,
  result: unknown[],
): Promise<string> {
  await stage(page, 'reset');
  await scene(page, 'flow', title);
  await showBalances({ page, agents, job: '' });
  await pause(page, 1_600);
  const locked = await lock(page, agents);

  await deliver(locked, result);
  await settle(locked, await evaluate(locked));
  await pause(page, 1_400);

  return locked.job;
}

export const paidJob = (page: Page, agents: Agents) =>
  trade(page, agents, 'A buyer agent hires a seller agent.', translations);

export const rejectedJob = (page: Page, agents: Agents) =>
  trade(page, agents, 'Now the seller cuts corners.', translations.slice(0, 6));

/** Scene: the live site. */
export async function site(page: Page, url: string, headline: string, holdMs: number) {
  await scene(page, 'browser', headline);
  await browse(page, url);
  await pause(page, holdMs);
}

/** Scene: the job page, where a visitor re-runs the acceptance test in the browser. */
export async function verify(page: Page, url: string, captions: [string, string]): Promise<void> {
  await scene(page, 'browser', captions[0]);
  const frame = await browse(page, url);

  await pause(page, 2_600);
  await click(page, frame.getByRole('button', { name: 'Verify independently' }));
  await frame.getByRole('status').waitFor();
  await scrollTo(frame, '.verification', 120);
  await stage(page, 'headline', captions[1]);
  await pause(page, 3_800);
}

/** Scene: the MCP configuration, revealed line by line. */
export async function install(page: Page): Promise<void> {
  await scene(page, 'install', 'One block in your MCP client. Your agent does the rest.');
  for (const count of Array.from({ length: INSTALL_LINES }, (_, index) => index + 1)) {
    await stage(page, 'lines', count);
    await pause(page, 240);
  }
  await pause(page, 2_400);
}

export async function outro(page: Page): Promise<void> {
  await stage(page, 'show', 'outro');
  await stage(page, 'beat', 'outro');
  await pause(page, 5_200);
}
