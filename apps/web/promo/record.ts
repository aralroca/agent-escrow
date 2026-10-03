// Records the promo video: `pnpm promo`. Needs `anchor build`, the Solana CLI and ffmpeg.
// Everything on screen is the real product on a local validator; nothing is mocked.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { call, connectAgent } from '../../../e2e/mcp-client.ts';
import startValidator, { RPC_URL } from '../../../e2e/validator.ts';
import { fundedSigner, mintUsdc, serveFiles, USDC } from '../../../e2e/world.ts';
import {
  type Agents,
  intro,
  landing,
  outro,
  paidJob,
  rejectedJob,
  reputation,
  verify,
} from './scenes.ts';
import { prepare } from './stage.ts';

const SIZE = { width: 1920, height: 1080 };
const PORT = 4174;
const SITE = `http://localhost:${PORT}/agent-escrow/`;
const MEDIA = 'docs/media';
const WEB = ['--filter', '@agent-escrow/web'];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Builds the site against the local chain and serves it. */
async function startSite(): Promise<ChildProcess> {
  const env = { ...process.env, VITE_RPC_URL: RPC_URL };

  execFileSync('pnpm', [...WEB, 'build'], { env, stdio: 'ignore' });
  const server = spawn('pnpm', [...WEB, 'exec', 'vite', 'preview', '--port', `${PORT}`], { env });

  await wait(2_500);

  return server;
}

/** Two agents with their own wallets; the seller is registered, the buyer holds test USDC. */
async function createAgents(files: Awaited<ReturnType<typeof serveFiles>>): Promise<Agents> {
  const [buyerKey, sellerKey] = await Promise.all([fundedSigner(), fundedSigner()]);
  const publish = async (name: string, content: unknown) =>
    files.host(`${crypto.randomUUID()}-${name}`, content);
  const [buyer, seller] = await Promise.all(
    [buyerKey, sellerKey].map((key) => connectAgent(key, publish)),
  );

  await mintUsdc(buyerKey.address, 200n * USDC);
  await call(seller, 'register_agent', { name: 'lingua-7', capabilities: ['translation'] });

  return { buyer, seller, sellerAddress: sellerKey.address };
}

/** Plays every scene in one browser page while Playwright records it. Returns the raw video. */
async function film(agents: Agents): Promise<string> {
  const raw = mkdtempSync(join(tmpdir(), 'agent-escrow-video-'));
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: raw, size: SIZE },
  });
  const page = await context.newPage();

  await prepare(page);
  await intro(page);
  await landing(page, SITE);
  const paid = await paidJob(page, agents);
  await verify(page, SITE, paid, [
    'Every step is on-chain. So is the bar the work had to clear.',
    'Anyone can re-run the test. Here it runs in the browser.',
  ]);
  const rejected = await rejectedJob(page, agents);
  await verify(page, SITE, rejected, [
    'The buyer got the money back without asking anyone.',
    'And the failure is public and reproducible.',
  ]);
  await reputation(page, SITE);
  await outro(page);
  await context.close();
  await browser.close();

  return (await page.video()?.path()) as string;
}

/** Encodes the recording as an MP4, a short GIF teaser and a poster frame. */
function encode(raw: string): void {
  const input = ['-y', '-ss', '0.5', '-i', raw];
  const gif =
    'fps=12,scale=880:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse';
  const run = (args: string[]) => execFileSync('ffmpeg', [...input, ...args], { stdio: 'ignore' });

  run([
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '21',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '30',
    '-movflags',
    '+faststart',
    `${MEDIA}/promo.mp4`,
  ]);
  run(['-t', '13', '-vf', gif, `${MEDIA}/promo.gif`]);
  run(['-ss', '5', '-frames:v', '1', '-vf', 'scale=1280:-1', `${MEDIA}/promo-poster.png`]);
}

const stopValidator = await startValidator();
const files = await serveFiles();
const site = await startSite();
const raw = await film(await createAgents(files)).finally(() => {
  site.kill();
  files.close();
  stopValidator();
});

encode(raw);
console.log(`Promo written to ${MEDIA}/promo.mp4`);
process.exit(0);
