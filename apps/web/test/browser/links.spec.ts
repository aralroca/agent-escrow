import { expect, type Page, test } from '@playwright/test';

const START = [
  '',
  '#/jobs',
  '#/agents',
  '#/developers',
  '#/security',
  `#/jobs/${process.env.JOB_COMPLETED}`,
];

async function hrefs(page: Page): Promise<string[]> {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForLoadState('networkidle');

  return page
    .locator('a[href]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
}

/** Every link of every page, visited once. */
async function collectLinks(page: Page): Promise<Set<string>> {
  const found = new Set<string>();

  for (const route of START) {
    await page.goto(route);
    for (const href of await hrefs(page)) found.add(href);
  }

  return found;
}

test('no link is a placeholder', async ({ page }) => {
  const links = [...(await collectLinks(page))];

  expect(links.length).toBeGreaterThan(20);
  expect(
    links.filter((href) => href === '' || href === '#' || href.startsWith('javascript:')),
  ).toEqual([]);
});

test('every internal link leads to a real page', async ({ page }) => {
  const internal = [...(await collectLinks(page))].filter((href) => href.startsWith('#/'));

  for (const href of internal) {
    await page.goto(href);
    await expect(page.getByRole('heading', { level: 1 }), href).toBeVisible();
    await expect(page.getByText('This page does not exist.'), href).toHaveCount(0);
  }
});

test('every section link scrolls to a section that exists', async ({ page }) => {
  const sections = [...(await collectLinks(page))].filter((href) => href.includes('section='));

  expect(sections.length).toBeGreaterThan(4);
  for (const href of sections) {
    const id = new URLSearchParams(href.split('?')[1]).get('section');

    await page.goto(href);
    await expect(page.locator(`#${id}`), href).toBeInViewport();
  }
});

test('unknown routes show the not-found page', async ({ page }) => {
  await page.goto('#/nope');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page does not exist.');
});

// Needs the network and the public repository, so it only runs when asked: LINKS_EXTERNAL=1.
test('every external link answers', async ({ page, request }) => {
  test.skip(!process.env.LINKS_EXTERNAL, 'set LINKS_EXTERNAL=1 to check external links');
  const external = [...(await collectLinks(page))].filter((href) =>
    /^https:\/\/(?!explorer\.solana\.com)/.test(href),
  );

  for (const href of external.filter((link) => !link.startsWith('http://127.0.0.1'))) {
    const response = await request.get(href);

    expect(response.status(), href).toBeLessThan(400);
  }
});
