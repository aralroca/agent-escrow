import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Frame, Locator, Page } from '@playwright/test';
import { stagePage } from './stage-page.ts';

type Method =
  | 'show'
  | 'beat'
  | 'headline'
  | 'reset'
  | 'arrow'
  | 'self'
  | 'chip'
  | 'stamp'
  | 'balance'
  | 'browse'
  | 'lines';
type Remote = { stage: Record<Method, (...args: unknown[]) => void> };

const MOVE_STEPS = 30;

/**
 * Recorded video has no mouse pointer, so the site draws one itself. The site is also laid out
 * for reading, not for video: it is enlarged so it stays legible inside the browser window.
 */
const SITE_OVERLAY = `
  addEventListener('DOMContentLoaded', () => {
    const site = document.getElementById('root');
    if (!site) return;
    const cursor = document.createElement('div');
    cursor.style.cssText = 'position:fixed;z-index:99999;left:0;top:0;width:26px;height:26px;margin:-4px 0 0 -4px;pointer-events:none;opacity:0;' +
      "background:url(\\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4 2l15 11h-8l-3 8z' fill='%23212121' stroke='%23fff' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E\\") no-repeat";
    site.style.zoom = '1.25';
    document.body.append(cursor);
    addEventListener('mousemove', (event) => {
      cursor.style.transform = 'translate(' + event.clientX + 'px,' + event.clientY + 'px)';
      cursor.style.opacity = '1';
    });
  });
`;

export const pause = (page: Page, ms: number) => page.waitForTimeout(ms);

/** Opens the stage in the page that is being recorded. */
export async function openStage(page: Page, network: string, proof: string): Promise<void> {
  const file = join(mkdtempSync(join(tmpdir(), 'agent-escrow-stage-')), 'stage.html');

  writeFileSync(file, stagePage(network, proof));
  await page.addInitScript(SITE_OVERLAY);
  await page.goto(`file://${file}`);
  await page.evaluate(() => document.fonts.ready);
}

/** Calls one method of the stage, e.g. `stage(page, 'arrow', 'buyer', 'program', ...)`. */
export async function stage(page: Page, method: Method, ...args: unknown[]): Promise<void> {
  await page.evaluate(
    ([name, values]) => (window as never as Remote).stage[name as Method](...(values as unknown[])),
    [method, args] as const,
  );
}

/** Switches scene: a new layer with its headline. */
export async function scene(page: Page, layer: string, headline: string): Promise<void> {
  await stage(page, 'show', layer);
  await stage(page, 'headline', headline);
}

/** Loads a URL in the browser window of the stage and returns its frame once it rendered. */
export async function browse(page: Page, url: string): Promise<Frame> {
  await stage(page, 'browse', url);
  const frame = page.frame({ name: 'site' }) as Frame;

  await frame.waitForURL(url);
  await frame.locator('h1').first().waitFor();

  return frame;
}

/** Moves the visible pointer to an element, like a person would, and clicks it. */
export async function click(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  const [x, y] = box ? [box.x + box.width / 2, box.y + box.height / 2] : [0, 0];

  await page.mouse.move(x, y, { steps: MOVE_STEPS });
  await pause(page, 350);
  await target.click();
}

export async function scrollTo(frame: Frame, selector: string, offset: number): Promise<void> {
  await frame.evaluate(
    ([target, gap]) => {
      const top = document.querySelector(target as string)?.getBoundingClientRect().top ?? 0;

      window.scrollTo({ top: window.scrollY + top - (gap as number), behavior: 'smooth' });
    },
    [selector, offset],
  );
}
