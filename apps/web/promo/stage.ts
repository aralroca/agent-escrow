import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';

const CARDS = mkdtempSync(join(tmpdir(), 'agent-escrow-promo-'));
const MOVE_STEPS = 30;

/** Recorded video has no mouse pointer or narration, so the page draws both itself. */
const OVERLAY = `
  addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = \`
      #promo-cursor { position: fixed; z-index: 99999; left: 0; top: 0; width: 26px; height: 26px; margin: -4px 0 0 -4px; pointer-events: none; opacity: 0;
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4 2l15 11h-8l-3 8z' fill='%23212121' stroke='%23fff' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat; }
      #promo-caption { position: fixed; z-index: 99998; left: 50%; bottom: 44px; transform: translateX(-50%); max-width: 1500px; padding: 18px 30px; border-radius: 20px;
        background: rgba(33,33,33,.94); color: #fff; font: 500 30px/1.3 Geist, system-ui, sans-serif; text-align: center; box-shadow: 0 16px 40px rgba(0,0,0,.28); transition: opacity .3s; }
      #promo-caption:empty { opacity: 0; }
    \`;
    const cursor = Object.assign(document.createElement('div'), { id: 'promo-cursor' });
    const caption = Object.assign(document.createElement('div'), { id: 'promo-caption' });

    // The site is laid out for reading, not for video: enlarge it so it fills a 1080p frame.
    const site = document.getElementById('root');

    if (site) site.style.zoom = '1.5';
    document.head.append(style);
    document.body.append(cursor, caption);
    addEventListener('mousemove', (event) => {
      cursor.style.transform = 'translate(' + event.clientX + 'px,' + event.clientY + 'px)';
      cursor.style.opacity = '1';
    });
    window.setCaption = (text) => { caption.textContent = text; };
  });
`;

export async function prepare(page: Page): Promise<void> {
  await page.addInitScript(OVERLAY);
}

export const pause = (page: Page, ms: number) => page.waitForTimeout(ms);

export async function caption(page: Page, text: string): Promise<void> {
  await page.evaluate((value) => (window as never as Stage).setCaption(value), text);
}

type Flow = Record<'arrow' | 'self' | 'chip' | 'balance' | 'step', (...args: string[]) => void>;
type Stage = { setCaption: (text: string) => void; flow: Flow };

/** Shows a full-screen card and waits for its fonts and entrance animations. */
export async function showCard(page: Page, name: string, html: string, holdMs: number) {
  const file = join(CARDS, `${name}.html`);

  writeFileSync(file, html);
  await page.goto(`file://${file}`);
  await page.evaluate(() => document.fonts.ready);
  await pause(page, holdMs);
}

/** Calls one method of the flow card, e.g. `flow(page, 'arrow', 'buyer', 'program', ...)`. */
export async function flow(page: Page, method: keyof Flow, ...args: string[]): Promise<void> {
  await page.evaluate(
    ([name, values]) =>
      (window as never as Stage).flow[name as keyof Flow](...(values as string[])),
    [method, args] as const,
  );
}

/** Moves the visible pointer to an element, like a person would, and clicks it. */
export async function click(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  const [x, y] = box ? [box.x + box.width / 2, box.y + box.height / 2] : [0, 0];

  await page.mouse.move(x, y, { steps: MOVE_STEPS });
  await pause(page, 350);
  await target.click();
}

export async function scrollTo(page: Page, selector: string, offset = 90): Promise<void> {
  await page.evaluate(
    ([target, gap]) => {
      const top = document.querySelector(target as string)?.getBoundingClientRect().top ?? 0;

      window.scrollTo({ top: window.scrollY + top - (gap as number), behavior: 'smooth' });
    },
    [selector, offset],
  );
  await pause(page, 1_300);
}
