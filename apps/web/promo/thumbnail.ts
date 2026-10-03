// Renders the video thumbnail (1280×720) to apps/web/public/promo-thumbnail.png, the one file
// the landing page serves and YouTube shows.
// Usage: pnpm exec tsx apps/web/promo/thumbnail.ts
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const asset = (name: string) =>
  `data:image/svg+xml;base64,${readFileSync(new URL(`./assets/${name}.svg`, import.meta.url)).toString('base64')}`;

const HTML = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@500;600;700&display=swap">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1280px; height: 720px; overflow: hidden; color: #fff; font-family: Geist, system-ui, sans-serif; padding: 64px 72px;
    background: radial-gradient(900px 560px at 88% 108%, rgba(25,118,210,.6), transparent 70%), #141414; }
  body::before { content: ""; position: absolute; inset: 0; opacity: .5;
    background-image: radial-gradient(rgba(255,255,255,.1) 1.4px, transparent 1.6px); background-size: 28px 28px; }
  .brand { position: relative; display: flex; align-items: center; gap: 18px; font-size: 40px; font-weight: 600; letter-spacing: -.02em; }
  .mark { width: 68px; height: 68px; border-radius: 20px; background: #fff; color: #141414; display: grid; place-items: center; }
  h1 { position: relative; margin-top: 54px; font-size: 112px; line-height: .98; letter-spacing: -.05em; font-weight: 700; }
  mark { background: #1976d2; color: #fff; padding: 0 .14em .04em; border-radius: .14em; display: inline-block; transform: rotate(-1.5deg); }
  .rails { position: absolute; left: 72px; bottom: 60px; display: flex; gap: 16px; font-size: 30px; font-weight: 500; }
  .rail { display: flex; align-items: center; gap: 12px; padding: 14px 26px; border-radius: 999px; background: rgba(20,20,20,.7); border: 1px solid rgba(255,255,255,.22); }
  .rail img { height: 32px; }
  .stamp { position: absolute; right: 84px; bottom: 150px; padding: 6px 44px; border-radius: 22px; border: 8px solid #86efac; color: #86efac;
    font-size: 96px; font-weight: 700; letter-spacing: .05em; transform: rotate(-8deg); background: rgba(20,20,20,.55); }
</style>
<div class="brand"><span class="mark"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg></span>Agent Escrow</div>
<h1>AI agents pay<br>only for work<br><mark>that passes.</mark></h1>
<div class="stamp">PAID</div>
<div class="rails">
  <span class="rail"><img src="${asset('solana')}" alt=""> Solana</span>
  <span class="rail"><img src="${asset('usdc')}" alt=""> USDC</span>
  <span class="rail">MCP</span>
</div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.setContent(HTML);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'apps/web/public/promo-thumbnail.png' });
await browser.close();
