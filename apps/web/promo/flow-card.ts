import { page } from './cards.ts';

/**
 * The sequence diagram of a job, drawn live: three lanes and one arrow per real call.
 * The recorder drives it through `window.flow` as each MCP tool call returns.
 */
const FLOW_CSS = `
  body { padding: 56px 0 0; }
  h2 { font-size: 54px; letter-spacing: -.035em; font-weight: 600; text-align: center; }
  .lane { position: absolute; top: 150px; width: 380px; margin-left: -190px; padding: 20px 24px; border-radius: 24px; background: #2c2c2c; border: 1px solid #3a3a3a; text-align: center; z-index: 2; }
  .lane b { display: block; font-size: 30px; font-weight: 600; }
  .lane span { display: block; margin-top: 6px; font: 500 24px "Geist Mono", monospace; color: #c3c7d0; transition: color .3s; }
  .lane span.pulse { color: #9be3bf; }
  .lane.program { background: #1976d2; border-color: #1976d2; }
  .lane.program span { color: #e3f2fd; }
  .life { position: absolute; top: 250px; bottom: 130px; width: 2px; margin-left: -1px; background: #3a3a3a; }
  .row { position: absolute; height: 96px; opacity: 0; animation: rise .4s ease forwards; }
  .label { position: absolute; left: 0; right: 0; top: 0; text-align: center; font: 500 27px "Geist Mono", monospace; white-space: nowrap; }
  .note { position: absolute; left: 0; right: 0; top: 66px; text-align: center; font: 20px "Geist Mono", monospace; color: #9aa0ab; }
  .line { position: absolute; left: 0; right: 0; top: 52px; height: 4px; border-radius: 2px; background: currentColor; transform: scaleX(0); animation: draw .6s .15s cubic-bezier(.3,.7,.2,1) forwards; }
  .right .line { transform-origin: left; } .left .line { transform-origin: right; }
  .line::after { content: ""; position: absolute; top: -8px; border: 10px solid transparent; }
  .right .line::after { right: -4px; border-left-color: currentColor; border-right-width: 0; }
  .left .line::after { left: -4px; border-right-color: currentColor; border-left-width: 0; }
  @keyframes draw { to { transform: scaleX(1); } }
  .call { color: #90caf9; } .money { color: #9be3bf; } .bad { color: #ff9c94; }
  .self { display: flex; align-items: center; gap: 14px; height: 60px; font: 500 27px "Geist Mono", monospace; color: #fff; white-space: nowrap; }
  .chip { padding: 8px 16px; border-radius: 999px; font-size: 22px; background: #1d3a2c; color: #9be3bf; opacity: 0; animation: rise .35s ease forwards; }
  .chip.bad { background: #472320; color: #ff9c94; }
  #step { position: absolute; left: 0; right: 0; bottom: 48px; text-align: center; font-size: 40px; font-weight: 500; transition: opacity .25s; }
`;

const FLOW_SCRIPT = `
  const X = { buyer: 330, program: 960, seller: 1590 };
  const TOP = 300, ROW = 100;
  let rows = 0;

  function addRow(left, width) {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.cssText = 'left:' + left + 'px;width:' + width + 'px;top:' + (TOP + ROW * rows++) + 'px';
    document.body.append(row);
    return row;
  }

  window.flow = {
    arrow(from, to, kind, label, note) {
      const row = addRow(Math.min(X[from], X[to]), Math.abs(X[to] - X[from]));
      row.classList.add(X[to] > X[from] ? 'right' : 'left', kind);
      row.innerHTML = '<div class="label"></div><div class="line"></div><div class="note"></div>';
      row.firstChild.textContent = label;
      row.lastChild.textContent = note || '';
    },
    self(lane, label) {
      const row = addRow(X[lane] + 26, 1200);
      row.innerHTML = '<div class="self"><span>↺</span><span></span></div>';
      row.firstChild.lastChild.textContent = label;
    },
    chip(kind, text) {
      const chip = Object.assign(document.createElement('span'), { className: 'chip ' + kind, textContent: text });
      document.querySelector('.row:last-of-type .self').append(chip);
    },
    balance(lane, text) {
      const value = document.querySelector('.lane.' + lane + ' span');
      if (value.textContent !== text) value.classList.add('pulse');
      value.textContent = text;
      setTimeout(() => value.classList.remove('pulse'), 1400);
    },
    step(text) { document.getElementById('step').textContent = text; },
  };
`;

const lane = (name: string, x: number, title: string, holds: string) =>
  `<div class="life" style="left:${x}px"></div>
   <div class="lane ${name}" style="left:${x}px"><b>${title}</b><span>${holds}</span></div>`;

export function flowCard(title: string): string {
  return page(
    `<h2 class="rise">${title}</h2>
    ${lane('buyer', 330, 'Buyer agent', 'wallet · … USDC')}
    ${lane('program', 960, 'Escrow program', 'vault · 0 USDC')}
    ${lane('seller', 1590, 'Seller agent', 'wallet · … USDC')}
    <div id="step"></div>
    <script>${FLOW_SCRIPT}</script>`,
    FLOW_CSS,
  );
}
