// Records the product video. Needs ffmpeg; nothing on screen is mocked.
//   PIPER_VOICE=voice.onnx adds the voice-over (needs `piper`) and music.
//   PROMO_MUSIC=file uses that track instead of the synthesized pad.
//   pnpm promo                          local validator (needs `anchor build` and the Solana CLI)
//   PROMO_NETWORK=devnet pnpm promo     live program and site on devnet, with the demo wallets
//                                       (set GITHUB_TOKEN so specs and deliverables can be published)
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { callPatiently, devnetAgent } from '../../../e2e/devnet-agents.ts';
import { call, connectAgent } from '../../../e2e/mcp-client.ts';
import startValidator, { RPC_URL } from '../../../e2e/validator.ts';
import { fundedSigner, mintUsdc, serveFiles, USDC } from '../../../e2e/world.ts';
import { soundtrack } from './audio.ts';
import { install, intro, outro, site, verify } from './scenes.ts';
import { openStage } from './stage.ts';
import { type Agents, paidJob, rejectedJob } from './trade.ts';
import { prepareVoice, spokenCues, startTrack } from './voice.ts';

type Setup = { agents: Agents; site: string; network: string; proof: string; stop: () => void };
type Take = { raw: string; seconds: number; diagram: [start: number, end: number] };

const SIZE = { width: 1920, height: 1080 };
const PORT = 4174;
const MEDIA = 'docs/media';
const WEB = ['--filter', '@agent-escrow/web'];
const LIVE_SITE = 'https://aralroca.github.io/agent-escrow/';
const PROOF = 'Every arrow is a real transaction. Recorded';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Builds the site against the local chain and serves it. */
async function startSite(): Promise<ChildProcess> {
  const env = { ...process.env, VITE_RPC_URL: RPC_URL };

  execFileSync('pnpm', [...WEB, 'build'], { env, stdio: 'ignore' });
  const server = spawn('pnpm', [...WEB, 'exec', 'vite', 'preview', '--port', `${PORT}`], { env });

  await wait(2_500);

  return server;
}

/** A throwaway world: local validator, two fresh wallets, the site built against it. */
async function localSetup(): Promise<Setup> {
  const stopValidator = await startValidator();
  const files = await serveFiles();
  const server = await startSite();
  const [buyerKey, sellerKey] = await Promise.all([fundedSigner(), fundedSigner()]);
  const publish = async (name: string, content: unknown) =>
    files.host(`${crypto.randomUUID()}-${name}`, content);
  const [buyer, seller] = await Promise.all(
    [buyerKey, sellerKey].map((key) => connectAgent(key, publish)),
  );
  const agents = { buyer, seller, sellerAddress: sellerKey.address as string, amount: 30, call };

  await mintUsdc(buyerKey.address, 200n * USDC);
  await call(seller, 'register_agent', { name: 'lingua-7', capabilities: ['translation'] });

  return {
    agents,
    site: `http://localhost:${PORT}/agent-escrow/`,
    network: 'Local Solana validator',
    proof: `${PROOF} on a local Solana validator.`,
    stop: () => [server.kill(), files.close(), stopValidator()],
  };
}

/** The deployed program, the public site and the two demo wallets on devnet. */
async function devnetSetup(): Promise<Setup> {
  const [buyer, seller] = await Promise.all([devnetAgent('buyer'), devnetAgent('seller')]);
  const sellerAddress = (await callPatiently(seller, 'get_wallet')).data.address;

  return {
    agents: { buyer, seller, sellerAddress, amount: 2, call: callPatiently },
    site: LIVE_SITE,
    network: 'Live on Solana devnet',
    proof: `${PROOF} live on Solana devnet.`,
    stop: () => undefined,
  };
}

/** The scenes after the intro. Returns when the first diagram, used as the teaser, ended. */
async function story(page: Parameters<typeof intro>[0], setup: Setup, seconds: () => number) {
  const jobUrl = (job: string) => `${setup.site}#/jobs/${job}`;
  const paid = await paidJob(page, setup.agents);
  const diagramEnd = seconds();

  await verify(page, jobUrl(paid), 'paid', [
    'Every step is on-chain. So is the bar the work had to clear.',
    'Anyone can re-run the test. Here it runs in the browser.',
  ]);
  await verify(page, jobUrl(await rejectedJob(page, setup.agents)), 'rejected', [
    'The buyer got the money back without asking anyone.',
    'And the failure is public and reproducible.',
  ]);
  await site(
    page,
    `${setup.site}#/agents`,
    'agents',
    'Reputation is the record of settled escrows.',
  );
  await install(page);
  await outro(page);

  return diagramEnd;
}

/** Plays every scene in one browser page while Playwright records it. */
async function film(setup: Setup): Promise<Take> {
  const raw = mkdtempSync(join(tmpdir(), 'agent-escrow-video-'));
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: raw, size: SIZE },
  });
  const page = await context.newPage();
  const started = Date.now();
  const seconds = () => (Date.now() - started) / 1000;

  startTrack();
  await openStage(page, setup.network, setup.proof);
  await intro(page);
  const diagramStart = seconds();
  const diagramEnd = await story(page, setup, seconds);
  const length = seconds();

  await context.close();
  await browser.close();

  return {
    raw: (await page.video()?.path()) as string,
    seconds: length,
    diagram: [diagramStart, diagramEnd],
  };
}

/** Encodes the recording as an MP4, a GIF teaser of the first diagram and a poster frame. */
function encode({ raw, seconds, diagram: [start, end] }: Take): void {
  const run = (args: string[]) => execFileSync('ffmpeg', ['-y', ...args], { stdio: 'ignore' });
  const gif =
    'fps=12,scale=880:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse';
  const h264 = [
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '30',
  ];
  const sound = soundtrack(spokenCues(), seconds);
  const film = ['-i', raw, ...sound.inputs, ...sound.output, ...h264];

  run([...film, '-movflags', '+faststart', `${MEDIA}/promo.mp4`]);
  run(['-ss', `${start}`, '-t', `${end - start}`, '-i', raw, '-vf', gif, `${MEDIA}/promo.gif`]);
  run([
    '-ss',
    `${start - 1}`,
    '-i',
    raw,
    '-frames:v',
    '1',
    '-vf',
    'scale=1280:-1',
    `${MEDIA}/promo-poster.png`,
  ]);
}

prepareVoice();
const setup = await (process.env.PROMO_NETWORK === 'devnet' ? devnetSetup() : localSetup());
const take = await film(setup).finally(setup.stop);

encode(take);
console.log(
  `Promo written to ${MEDIA}/promo.mp4 (diagram ${take.diagram.map(Math.round).join('–')} s)`,
);
process.exit(0);
