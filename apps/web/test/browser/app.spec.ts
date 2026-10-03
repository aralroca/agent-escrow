import { expect, test } from '@playwright/test';

const job = (name: 'COMPLETED' | 'REJECTED' | 'FUNDED') => `#/jobs/${process.env[`JOB_${name}`]}`;

test.describe('landing', () => {
  test('leads with the three-line hero and the human benefits', async ({ page }) => {
    await page.goto('');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Pay only for work that passes.',
    );
    await expect(
      page.getByText('Funds sit in a Solana program vault, never with us'),
    ).toBeVisible();
    await expect(page.getByText('USDC escrow that releases when the buyer')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bad work costs you nothing.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Good work always gets paid.' })).toBeVisible();
  });

  test('plays the product video only when asked', async ({ page }) => {
    await page.goto('');

    await expect(page.locator('.video iframe')).toHaveCount(0);
    await page.getByRole('button', { name: 'Play the video' }).click();
    await expect(page.locator('.video iframe')).toHaveAttribute('src', /youtube-nocookie\.com/);
  });

  test('shows live numbers read from the chain, not invented ones', async ({ page }) => {
    await page.goto('');

    const live = page.locator('.live');
    await expect(live).toContainText('3 jobs created');
    await expect(live).toContainText('30 USDC released to sellers');
    await expect(live).toContainText('30 USDC returned to buyers');
    await expect(page.locator('.agent-card')).toContainText('lingua-7');
  });

  test('does not scroll sideways', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('.live')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('custom RPC', () => {
  // Same validator, different host name: a different endpoint as far as the page can tell.
  const custom = '?rpc=http://localhost:8899';

  test('says so when a link chooses the data source, and does not remember it', async ({
    page,
  }) => {
    await page.goto(`${custom}#/jobs`);
    await expect(page.getByRole('note')).toContainText('read from http://localhost:8899');

    await page.goto('#/jobs');
    await page.reload();
    await expect(page.getByRole('note')).toHaveCount(0);
  });
});

test.describe('main menu', () => {
  const current = '.header-links a[aria-current="page"]';

  test('marks only the section that was opened', async ({ page }) => {
    await page.goto('');
    await expect(page.locator(current)).toHaveCount(0);

    await page.locator('.header-links').getByRole('link', { name: 'Protocol' }).click();
    await expect(page.locator(current)).toHaveText(['Protocol']);

    await page.locator('.header-links').getByRole('link', { name: 'Verification' }).click();
    await expect(page.locator(current)).toHaveText(['Verification']);
  });

  test('keeps the page link current on its sub-pages', async ({ page }) => {
    await page.goto(job('COMPLETED'));

    await expect(page.locator(current)).toHaveText(['Jobs']);
  });
});

test.describe('jobs explorer', () => {
  test('lists the seeded jobs with titles from their specs and filters by outcome', async ({
    page,
  }) => {
    await page.goto('#/jobs');

    await expect(
      page.getByRole('link', { name: 'Translate 3 product titles EN → ES' }),
    ).toHaveCount(3);
    await page.getByRole('button', { name: 'Paid' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody tr')).toContainText('Completed');
    await expect(page.locator('tbody tr')).toContainText('shop-ops → lingua-7');
  });

  test('opens a job from the list', async ({ page }) => {
    await page.goto('#/jobs');
    await page.getByRole('button', { name: 'Returned' }).click();
    await page.getByRole('link', { name: 'Translate 3 product titles EN → ES' }).click();

    await expect(page).toHaveURL(new RegExp(job('REJECTED')));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Translate 3 product titles EN → ES',
    );
  });
});

test.describe('verify independently', () => {
  test('reproduces a passing verdict in the browser', async ({ page }) => {
    await page.goto(job('COMPLETED'));
    await page.getByRole('button', { name: 'Verify independently' }).click();

    await expect(page.getByRole('status')).toHaveText(
      '3 of 3 checks passed in your browser. This matches the on-chain verdict (Completed).',
    );
    await expect(page.locator('.check-row .icon-good')).toHaveCount(3);
  });

  test('reproduces a failing verdict and shows which check failed', async ({ page }) => {
    await page.goto(job('REJECTED'));
    await page.getByRole('button', { name: 'Verify independently' }).click();

    await expect(page.getByRole('status')).toHaveText(
      '1 of 3 checks passed in your browser. This matches the on-chain verdict (Rejected).',
    );
    await expect(page.locator('.check-row', { hasText: 'Exactly 3 items' })).toContainText(
      '2 / 3 items',
    );
  });

  test('has nothing to verify before a submission', async ({ page }) => {
    await page.goto(job('FUNDED'));

    await expect(page.getByRole('button', { name: 'Verify independently' })).toBeDisabled();
    await expect(page.getByText('the seller has not submitted a deliverable')).toBeVisible();
  });

  test('shows amounts, parties and the on-chain history of a settled job', async ({ page }) => {
    await page.goto(job('COMPLETED'));

    await expect(page.locator('.money')).toContainText('29.925');
    await expect(page.locator('.money')).toContainText('0.075');
    await expect(page.locator('.activity li')).toHaveCount(4);
    await expect(page.locator('.activity')).toContainText('create_job');
    await expect(page.locator('.activity')).toContainText('complete');
    await expect(page.getByText('The buyer is its own evaluator here.')).toBeVisible();
  });

  test('survives a reload on an inner route', async ({ page }) => {
    await page.goto(job('COMPLETED'));
    await page.reload();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Translate 3 product titles EN → ES',
    );
  });

  test('says so when the address is not a job', async ({ page }) => {
    await page.goto('#/jobs/11111111111111111111111111111111');

    await expect(page.getByRole('alert')).toContainText('No job found');
  });
});

test.describe('agents', () => {
  test('filters by hiring policy and shows the equivalent tool call', async ({ page }) => {
    await page.goto('#/agents');

    await expect(page.locator('tbody tr', { hasText: 'lingua-7' })).toContainText('50.0%');
    await page
      .getByRole('group', { name: 'Min success rate' })
      .getByRole('button', { name: '98%' })
      .click();
    await expect(page.locator('pre')).toHaveText('search_agents({ min_success_rate: 0.98 })');
    await expect(page.getByText('No registered agent meets this policy yet')).toBeVisible();
  });
});
