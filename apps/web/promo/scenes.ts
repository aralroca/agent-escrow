import type { Client } from '@modelcontextprotocol/client';
import type { Page } from '@playwright/test';
import { call } from '../../../e2e/mcp-client.ts';
import { brandCard, outroCard, problemCard, terminalCard } from './cards.ts';
import { spec, translations } from './data.ts';
import { caption, click, line, pause, scrollTo, showCard } from './stage.ts';

export type Agents = { buyer: Client; seller: Client; sellerAddress: string };
type Check = { type: string; passed: boolean; detail: string };

const short = (text: string) => `${text.slice(0, 4)}…${text.slice(-4)}`;

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
  await scrollTo(page, '#how');
  await caption(page, 'Five steps. Each one is a Solana transaction.');
  await pause(page, 3_000);
}

/** The buyer locks 30 USDC behind the spec and the seller commits to it. Returns the job. */
async function hire(page: Page, { buyer, seller, sellerAddress }: Agents): Promise<string> {
  const args = { provider: sellerAddress, amount_usdc: 30, spec };

  await line(page, 'buyer', 'call', '→ create_job({ amount_usdc: 30, spec: 3 checks })');
  const { data: created } = await call(buyer, 'create_job', args);
  await line(page, 'buyer', 'ok', `✓ 30 USDC locked in the vault · job ${short(created.job)}`);
  await line(page, 'seller', 'call', '→ accept_job()');
  await call(seller, 'accept_job', { job: created.job });
  await line(page, 'seller', 'ok', '✓ spec matches its on-chain hash · accepted');

  return created.job;
}

/** The seller delivers and the buyer runs the acceptance test, which settles the job. */
async function deliver(page: Page, agents: Agents, job: string, result: unknown[]) {
  await line(page, 'seller', 'call', `→ submit_result(${result.length} translations)`);
  await call(agents.seller, 'submit_result', { job, result });
  await line(page, 'seller', 'ok', '✓ deliverable committed by hash');
  await line(page, 'buyer', 'call', '→ evaluate_job()');

  return (await call(agents.buyer, 'evaluate_job', { job })).data as { checks: Check[] };
}

/** Scene: an honest delivery. Every line on screen is the result of a real tool call. */
export async function paidJob(page: Page, agents: Agents): Promise<string> {
  await showCard(page, 'paid', terminalCard('A buyer agent hires a seller agent'), 900);
  await line(page, 'buyer', 'call', '→ search_agents({ capability: "translation" })');
  const found = await call(agents.buyer, 'search_agents', { capability: 'translation' });
  await line(page, 'buyer', 'ok', `✓ found ${found.data[0].name}`);
  const job = await hire(page, agents);
  const { checks } = await deliver(page, agents, job, translations);
  const passed = checks.filter((check) => check.passed).length;

  await line(page, 'buyer', 'ok', `✓ ${passed} of ${checks.length} checks passed`);
  await line(page, 'buyer', 'ok', '✓ seller paid 29.925 USDC');
  await pause(page, 1_800);

  return job;
}

/** Scene: the seller returns too few items, the test fails and the buyer is refunded. */
export async function rejectedJob(page: Page, agents: Agents): Promise<string> {
  await showCard(page, 'rejected', terminalCard('Now the seller cuts corners'), 900);
  const job = await hire(page, agents);
  const { checks } = await deliver(page, agents, job, translations.slice(0, 6));
  const failed = checks.find((check) => !check.passed);

  await line(page, 'buyer', 'bad', `✗ ${failed?.type}: ${failed?.detail}`);
  await line(page, 'buyer', 'ok', '✓ rejected · 30 USDC back in the buyer wallet');
  await pause(page, 2_000);

  return job;
}

/** Scene: the job page, where a visitor re-runs the acceptance test in the browser. */
export async function verify(page: Page, site: string, job: string, captions: [string, string]) {
  await page.goto(`${site}#/jobs/${job}`);
  await caption(page, captions[0]);
  await pause(page, 3_200);
  await click(page, page.getByRole('button', { name: 'Verify independently' }));
  await page.getByRole('status').waitFor();
  await scrollTo(page, '.verification', 200);
  await caption(page, captions[1]);
  await pause(page, 3_600);
}

export async function reputation(page: Page, site: string): Promise<void> {
  await page.goto(`${site}#/agents`);
  await caption(page, 'Reputation is the record of settled escrows. Nothing else.');
  await pause(page, 3_600);
}

export async function outro(page: Page): Promise<void> {
  await showCard(page, 'outro', outroCard(), 4_500);
}
