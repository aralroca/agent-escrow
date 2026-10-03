/**
 * Runs inside the stage page and exposes `window.stage`, the remote control the recorder uses.
 * Kept as plain browser JavaScript: it is injected as a string, not bundled.
 */
export const STAGE_SCRIPT = `
  const X = { buyer: 330, program: 960, seller: 1590 };
  const TOP = 378, ROW = 100;
  const $ = (selector) => document.querySelector(selector);
  const flowLayer = $('#flow');
  let rows = 0;

  function addRow(left, width) {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.cssText = 'left:' + left + 'px;width:' + width + 'px;top:' + (TOP + ROW * rows++) + 'px';
    flowLayer.append(row);
    return row;
  }

  function countTo(element, target) {
    const from = Number(element.dataset.value || target);
    const started = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / 700);
      element.querySelector('span').textContent = (from + (target - from) * progress).toFixed(target % 1 ? 3 : 2).replace(/\\.?0+$/, '') || '0';
      if (progress < 1) requestAnimationFrame(tick);
    };
    element.classList.toggle('up', target > from);
    element.classList.toggle('down', target < from);
    element.dataset.value = target;
    requestAnimationFrame(tick);
    setTimeout(() => element.classList.remove('up', 'down'), 1600);
  }

  window.stage = {
    show(name) {
      document.querySelectorAll('.layer').forEach((layer) => layer.classList.toggle('on', layer.id === name));
    },
    beat(name) {
      document.querySelectorAll('.beat').forEach((beat) => beat.classList.toggle('on', beat.dataset.beat === name));
    },
    headline(text) {
      const headline = $('#headline');
      headline.classList.add('out');
      setTimeout(() => { headline.textContent = text; headline.classList.remove('out'); }, 280);
    },
    reset() {
      flowLayer.querySelectorAll('.row').forEach((row) => row.remove());
      rows = 0;
    },
    arrow(from, to, kind, label, note, coin) {
      const row = addRow(Math.min(X[from], X[to]), Math.abs(X[to] - X[from]));
      row.classList.add(X[to] > X[from] ? 'right' : 'left', kind);
      row.innerHTML = '<div class="label"></div><div class="line"></div><div class="note"></div>' + (coin ? '<img class="coin" src="' + $('#usdc').src + '">' : '');
      row.querySelector('.label').textContent = label;
      row.querySelector('.note').textContent = note || '';
    },
    self(lane, label) {
      const row = addRow(X[lane] + 26, 1200);
      row.innerHTML = '<div class="self"><span>↺</span><span></span></div>';
      row.querySelector('.self').lastChild.textContent = label;
    },
    chip(kind, text) {
      const chip = Object.assign(document.createElement('span'), { className: 'chip ' + kind, textContent: text });
      flowLayer.querySelector('.row:last-of-type .self').append(chip);
    },
    balance(lane, value) {
      countTo($('.lane.' + lane + ' .amount'), Number(value));
    },
    browse(url) {
      $('#address').textContent = url.replace(/^https?:\\/\\//, '');
      $('#site').src = url;
    },
    lines(count) {
      document.querySelectorAll('.install div').forEach((line, index) => line.classList.toggle('on', index < count));
    },
  };
`;
