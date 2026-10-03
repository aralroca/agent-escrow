const FONTS =
  'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap';

const SHIELD = `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>`;

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; }
  body { height: 100vh; overflow: hidden; font-family: Geist, system-ui, sans-serif; background: #212121; color: #fff; }
  .mono { font-family: "Geist Mono", monospace; }
  .rise { opacity: 0; transform: translateY(24px); animation: rise .7s cubic-bezier(.2,.7,.2,1) forwards; }
  @keyframes rise { to { opacity: 1; transform: none; } }
  .mark { width: 96px; height: 96px; border-radius: 28px; background: #fff; color: #212121; display: grid; place-items: center; }
  mark { background: #1976d2; color: #fff; padding: 0 .16em .04em; border-radius: .16em; display: inline-block; transform: rotate(-1.5deg); }
`;

function page(body: string, css = ''): string {
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS}"><style>${BASE_CSS}${css}</style></head><body>${body}</body></html>`;
}

const CENTER_CSS = `
  body { display: grid; place-items: center; text-align: center; }
  .stack { display: flex; flex-direction: column; align-items: center; gap: 36px; max-width: 1500px; }
  h1 { font-size: 104px; line-height: 1.04; letter-spacing: -.045em; font-weight: 600; }
  p { font-size: 40px; color: #c3c7d0; }
  .small { font-size: 26px; color: #9aa0ab; }
  .cmd { font-size: 44px; padding: 26px 40px; border-radius: 24px; background: #2c2c2c; border: 1px solid #3a3a3a; }
`;

/** Opening card: the problem in one line. */
export function problemCard(): string {
  return page(
    `<div class="stack">
      <h1 class="rise">When agents trade,<br>somebody goes first.</h1>
      <p class="rise" style="animation-delay:1.1s">And gets burned.</p>
    </div>`,
    CENTER_CSS,
  );
}

/** Brand card: name and promise. */
export function brandCard(): string {
  return page(
    `<div class="stack">
      <div class="mark rise">${SHIELD}</div>
      <h1 class="rise" style="animation-delay:.25s">Agent Escrow</h1>
      <p class="rise" style="animation-delay:.6s;color:#fff">Let your agents hire any agent.<br>Pay only for <mark>work that passes.</mark></p>
    </div>`,
    CENTER_CSS,
  );
}

/** Closing card: how to start, and the honest status. */
export function outroCard(): string {
  return page(
    `<div class="stack">
      <div class="mark rise">${SHIELD}</div>
      <div class="cmd mono rise" style="animation-delay:.3s">npx agent-escrow-mcp</div>
      <p class="rise" style="animation-delay:.6s;color:#fff">aralroca.github.io/agent-escrow</p>
      <p class="small rise" style="animation-delay:.9s">Open source · USDC on Solana devnet · Not audited</p>
    </div>`,
    CENTER_CSS,
  );
}

const TERMINAL_CSS = `
  body { padding: 64px 72px; display: flex; flex-direction: column; gap: 36px; }
  header { display: flex; justify-content: space-between; align-items: baseline; }
  h2 { font-size: 52px; letter-spacing: -.035em; font-weight: 600; }
  header span { font-size: 24px; color: #9aa0ab; }
  .panes { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 28px; min-height: 0; }
  .pane { background: #2c2c2c; border: 1px solid #3a3a3a; border-radius: 28px; padding: 32px; display: flex; flex-direction: column; gap: 14px; overflow: hidden; }
  .who { display: flex; align-items: center; gap: 14px; font-size: 26px; font-weight: 600; padding-bottom: 12px; border-bottom: 1px solid #3a3a3a; }
  .dot { width: 14px; height: 14px; border-radius: 7px; background: #90caf9; }
  .seller .dot { background: #9be3bf; }
  .line { font-family: "Geist Mono", monospace; font-size: 27px; line-height: 1.5; opacity: 0; transform: translateY(8px); animation: rise .35s ease forwards; white-space: pre-wrap; overflow-wrap: anywhere; }
  .call { color: #90caf9; }
  .ok { color: #9be3bf; }
  .bad { color: #ff9c94; }
  .dim { color: #9aa0ab; }
`;

/** Two panes that the recorder fills with the real MCP tool calls as they happen. */
export function terminalCard(title: string): string {
  return page(
    `<header><h2 class="rise">${title}</h2><span class="rise">Every line is a real MCP tool call</span></header>
    <div class="panes">
      <section class="pane buyer"><div class="who"><i class="dot"></i>Buyer agent</div><div id="buyer"></div></section>
      <section class="pane seller"><div class="who"><i class="dot"></i>Seller agent</div><div id="seller"></div></section>
    </div>
    <script>
      window.addLine = (side, kind, text) => {
        const line = document.createElement('div');
        line.className = 'line ' + kind;
        line.textContent = text;
        document.getElementById(side).append(line);
      };
    </script>`,
    TERMINAL_CSS,
  );
}
