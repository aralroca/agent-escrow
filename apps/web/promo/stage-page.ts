import { readFileSync } from 'node:fs';
import { STAGE_CSS } from './stage-css.ts';
import { STAGE_SCRIPT } from './stage-script.ts';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap';

/** The public brand marks of the network and the token the product is built on. */
const asset = (name: string) =>
  `data:image/svg+xml;base64,${readFileSync(new URL(`./assets/${name}.svg`, import.meta.url)).toString('base64')}`;
const SOLANA = asset('solana');
const USDC = asset('usdc');

const SHIELD = (size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>`;
const ROBOT = (color: string) =>
  `<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V4M9 13v2M15 13v2M2 13v2M22 13v2"/><circle cx="12" cy="3.5" r="1"/></svg>`;

const RAILS = `<div class="rails rise d3">
  <span class="rail">Built on <img src="${SOLANA}" alt="Solana"> Solana</span>
  <span class="rail">Settles in <img src="${USDC}" alt="USDC"> USDC</span>
  <span class="rail">Speaks MCP</span>
</div>`;

const INTRO = `<section id="intro" class="layer cover">
  <div class="beat" data-beat="problem"><div>
    <h1 class="rise">When agents trade,<br><span class="strike">somebody goes first.</span></h1>
    <p class="rise d3">And gets burned.</p>
  </div></div>
  <div class="beat" data-beat="options"><div class="options">
    <div class="option rise"><span class="tag">Buyer loses</span><b>Pay first</b><span>Money sent to a stranger. If the output is junk, it is gone.</span></div>
    <div class="option rise d2"><span class="tag">Seller loses</span><b>Pay later</b><span>Compute burned on the job. The buyer just never pays.</span></div>
    <div class="option ours rise d4"><span class="tag">Nobody loses</span><b>Escrow with a test</b><span>The money is locked. A test both agreed on decides who gets it.</span></div>
  </div></div>
  <div class="beat" data-beat="brand"><div>
    <div class="mark bigmark rise">${SHIELD(70)}</div>
    <h1 class="rise d1">Agent Escrow</h1>
    <p class="rise d2" style="color:#fff">Let your agents hire any agent. Pay only for <mark>work that passes.</mark></p>
    ${RAILS}
  </div></div>
</section>`;

const lane = (name: string, x: number, icon: string, title: string, holds: string) =>
  `<div class="life" style="left:${x}px"></div>
   <div class="lane ${name}" style="left:${x}px"><div class="avatar">${icon}</div>
     <div><b>${title}</b><small>${holds}</small></div>
     <div class="amount"><img src="${USDC}" alt=""><span>0</span></div></div>`;

const FLOW = `<section id="flow" class="layer">
  ${lane('buyer', 330, ROBOT('#90caf9'), 'Buyer agent', 'wallet')}
  ${lane('program', 960, `<img src="${SOLANA}" alt="Solana">`, 'Escrow program', 'job vault')}
  ${lane('seller', 1590, ROBOT('#86efac'), 'Seller agent', 'wallet')}
  <div id="proof"></div>
</section>`;

const BROWSER = `<section id="browser" class="layer"><div class="window">
  <div class="chrome"><i></i><i></i><i></i><span id="address"></span></div>
  <iframe id="site" name="site"></iframe>
</div></section>`;

const INSTALL_LINES = [
  '{',
  '  <span class="k">"mcpServers"</span>: {',
  '    <span class="k">"agent-escrow"</span>: {',
  '      <span class="k">"command"</span>: <span class="s">"npx"</span>,',
  '      <span class="k">"args"</span>: [<span class="s">"-y"</span>, <span class="s">"agent-escrow-mcp"</span>],',
  '      <span class="k">"env"</span>: { <span class="k">"MAX_JOB_USDC"</span>: <span class="s">"50"</span> }',
  '    }',
  '  }',
  '}',
];
const INSTALL = `<section id="install" class="layer"><div class="install">${INSTALL_LINES.map((line) => `<div>${line}</div>`).join('')}</div></section>`;

const OUTRO = `<section id="outro" class="layer cover"><div class="beat" data-beat="outro"><div>
  <div class="mark bigmark rise">${SHIELD(70)}</div>
  <div class="cmd mono rise d1">npx agent-escrow-mcp</div>
  <p class="rise d2" style="color:#fff">aralroca.github.io/agent-escrow</p>
  ${RAILS}
  <p class="rise d4" style="font-size:26px;color:#8a909c">Open source · Live on Solana devnet · Not audited</p>
</div></div></section>`;

/** The whole recording stage. `proof` is the small line that says where the footage comes from. */
export function stagePage(network: string, proof: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS}"><style>${STAGE_CSS}</style></head><body>
  <header><div class="brand"><span class="mark">${SHIELD(28)}</span>Agent Escrow</div>
    <div class="net"><i></i><img class="logo" src="${SOLANA}" alt="">${network}</div></header>
  <div id="headline"></div>
  <img id="usdc" src="${USDC}" alt="" hidden>
  ${INTRO}${FLOW}${BROWSER}${INSTALL}${OUTRO}
  <script>${STAGE_SCRIPT}document.getElementById('proof').textContent = ${JSON.stringify(proof)};</script>
  </body></html>`;
}
