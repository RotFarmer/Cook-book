// Body weight over time: one entry per day, a line chart, and the list behind it.

import { store } from '../store.js';
import { h, icon, empty, confirmBtn, today, addDays, parseYmd, shortDate, fullDate, toast } from '../util.js';

const KG_PER_LB = 0.45359237;
const RANGES = [['1m', '1 month', 31], ['3m', '3 months', 92], ['1y', '1 year', 366], ['all', 'All', 0]];
let range = '3m';

export function render(root, ctx) {
  const settings = store.data.settings;
  const unit = settings.unit === 'kg' ? 'kg' : 'lb';
  const inUnit = kg => (unit === 'kg' ? kg : kg / KG_PER_LB);
  const show = kg => inUnit(kg).toFixed(1);
  const entries = store.data.weights.entries.slice().sort((a, b) => a.date.localeCompare(b.date));

  const unitBtn = u => h('button', {
    class: 'seg' + (unit === u ? ' on' : ''), type: 'button', 'aria-pressed': String(unit === u),
    onclick: () => { settings.unit = u; store.save('settings'); ctx.refresh(); },
  }, u);
  root.append(h('div', { class: 'view-head' },
    h('h1', null, 'Body weight'),
    h('div', { class: 'segs', role: 'group', 'aria-label': 'Unit' }, unitBtn('lb'), unitBtn('kg'))));

  // ---- add / replace an entry ----
  const dateIn = h('input', { type: 'date', id: 'weight-date', 'aria-label': 'Date', value: today(), max: today() });
  const valueIn = h('input', {
    type: 'number', id: 'weight-value', inputmode: 'decimal', step: '0.1', min: '1', max: '1500',
    placeholder: 'Weight', 'aria-label': `Weight in ${unit}`,
  });
  const form = h('form', {
    class: 'add-row weight-form',
    onsubmit: e => {
      e.preventDefault();
      const v = parseFloat(valueIn.value);
      const d = dateIn.value;
      if (!d || !(v > 0)) {
        valueIn.focus();
        return;
      }
      const kg = unit === 'kg' ? v : v * KG_PER_LB;
      const list = store.data.weights.entries;
      const existing = list.find(x => x.date === d);
      if (existing) existing.kg = kg;
      else list.push({ date: d, kg });
      list.sort((a, b) => a.date.localeCompare(b.date));
      store.save('weights');
      toast(existing ? 'Updated' : 'Saved');
      ctx.refresh();
    },
  }, dateIn, valueIn, h('button', { class: 'btn primary', type: 'submit' }, 'Save'));

  if (!entries.length) {
    root.append(form, empty('No weigh-ins yet', 'Add today’s weight above. Your chart appears once you have a couple of entries.'));
    return;
  }

  // ---- headline + chart ----
  const cutoff = RANGES.find(r => r[0] === range)[2];
  const from = cutoff ? addDays(today(), -cutoff) : '';
  const inRange = entries.filter(e => e.date >= from);
  const latest = entries[entries.length - 1];
  const first = inRange[0];

  let change = 'One entry in this period';
  if (!inRange.length) change = 'No entries in this period';
  else if (inRange.length > 1) {
    const diff = inUnit(latest.kg) - inUnit(first.kg);
    const sign = diff > 0.05 ? '+' : diff < -0.05 ? '−' : '';
    change = sign
      ? `${sign}${Math.abs(diff).toFixed(1)} ${unit} since ${shortDate(first.date)}`
      : `No change since ${shortDate(first.date)}`;
  }

  root.append(
    h('div', { class: 'hero' },
      h('div', { class: 'hero-num' }, show(latest.kg), h('span', { class: 'hero-unit' }, unit)),
      h('div', { class: 'quiet' }, `${latest.date === today() ? 'Today' : fullDate(latest.date)} · ${change}`)),
    h('div', { class: 'chips', role: 'group', 'aria-label': 'Period' }, RANGES.map(([id, label]) =>
      h('button', {
        class: 'chip' + (range === id ? ' on' : ''), type: 'button', 'aria-pressed': String(range === id),
        onclick: () => { range = id; ctx.refresh(); },
      }, label))));

  if (inRange.length) {
    const width = Math.max(260, Math.min(root.clientWidth || 320, 720));
    root.append(chart(inRange.map(e => ({ date: e.date, v: inUnit(e.kg) })), width, unit));
  }

  // ---- the entries themselves (also the table view of the chart) ----
  root.append(
    form,
    h('p', { class: 'hint' }, 'One entry per day. Saving the same day again replaces it.'),
    h('section', { class: 'group' },
      h('h2', { class: 'group-title' }, 'History', h('span', { class: 'count' }, entries.length)),
      h('div', { class: 'list' }, entries.slice().reverse().map(e =>
        h('div', { class: 'row middle' },
          h('span', { class: 'row-main' }, fullDate(e.date)),
          h('span', { class: 'num' }, `${show(e.kg)} ${unit}`),
          confirmBtn([icon('trash', 18)], 'Delete?', () => {
            const d = store.data.weights;
            d.entries = d.entries.filter(x => x.date !== e.date);
            store.save('weights');
            ctx.refresh();
          }, 'icon-btn danger'))))));
}

function niceTicks(lo, hi, n) {
  if (hi - lo < 1) {
    const mid = (hi + lo) / 2;
    lo = mid - 1;
    hi = mid + 1;
  }
  const raw = (hi - lo) / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
  const ticks = [];
  for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + step / 2; v += step) {
    ticks.push(+v.toFixed(6));
  }
  return ticks;
}

function chart(pts, W, unit) {
  const H = 200;
  const m = { t: 16, r: 48, b: 28, l: 42 }; // right margin holds the latest value's label
  const time = d => parseYmd(d).getTime();
  const t0 = time(pts[0].date);
  const t1 = time(pts[pts.length - 1].date);
  const ticks = niceTicks(Math.min(...pts.map(p => p.v)), Math.max(...pts.map(p => p.v)), 3);
  const d0 = ticks[0];
  const d1 = ticks[ticks.length - 1];
  const x = d => (t1 === t0 ? (m.l + W - m.r) / 2 : m.l + ((time(d) - t0) / (t1 - t0)) * (W - m.l - m.r));
  const y = v => m.t + (1 - (v - d0) / (d1 - d0)) * (H - m.t - m.b);
  const xy = pts.map(p => [x(p.date), y(p.v)]);
  const r1 = n => n.toFixed(1);
  const line = xy.map(([px, py], i) => `${i ? 'L' : 'M'}${r1(px)} ${r1(py)}`).join('');
  const base = H - m.b;
  const last = xy[xy.length - 1];
  const tickLabel = v => (Number.isInteger(v) ? String(v) : v.toFixed(1));

  let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Line chart of body weight in ${unit}, ` +
    `${pts.length} entries from ${shortDate(pts[0].date)} to ${shortDate(pts[pts.length - 1].date)}">`;
  for (const t of ticks) {
    svg += `<line class="ch-grid" x1="${m.l}" x2="${W - m.r}" y1="${r1(y(t))}" y2="${r1(y(t))}"/>` +
      `<text class="ch-tick" x="${m.l - 8}" y="${r1(y(t) + 4)}" text-anchor="end">${tickLabel(t)}</text>`;
  }
  if (pts.length > 1) {
    svg += `<path class="ch-area" d="${line}L${r1(last[0])} ${base}L${r1(xy[0][0])} ${base}Z"/>` +
      `<path class="ch-line" d="${line}"/>` +
      `<text class="ch-tick" x="${m.l}" y="${H - 8}" text-anchor="start">${shortDate(pts[0].date)}</text>` +
      `<text class="ch-tick" x="${W - m.r}" y="${H - 8}" text-anchor="end">${shortDate(pts[pts.length - 1].date)}</text>`;
    if (pts.length <= 40) {
      for (const [px, py] of xy.slice(0, -1)) svg += `<circle class="ch-dot" cx="${r1(px)}" cy="${r1(py)}" r="3.5"/>`;
    }
  } else {
    svg += `<text class="ch-tick" x="${r1(last[0])}" y="${H - 8}" text-anchor="middle">${shortDate(pts[0].date)}</text>`;
  }
  svg += `<line class="ch-cross" x1="0" x2="0" y1="${m.t - 8}" y2="${base}" visibility="hidden"/>` +
    `<circle class="ch-dot end" cx="${r1(last[0])}" cy="${r1(last[1])}" r="5"/>` +
    `<text class="ch-value" x="${r1(last[0] + 10)}" y="${r1(last[1] + 4.5)}" text-anchor="start">${pts[pts.length - 1].v.toFixed(1)}</text>` +
    `<circle class="ch-dot hover" cx="0" cy="0" r="5" visibility="hidden"/>` +
    '</svg>';

  const tip = h('div', { class: 'chart-tip', hidden: true });
  const box = h('div', { class: 'chart' });
  box.innerHTML = svg;
  box.append(tip);
  const cross = box.querySelector('.ch-cross');
  const dot = box.querySelector('.ch-dot.hover');

  function point(e) {
    const rect = box.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < xy.length; i++) if (Math.abs(xy[i][0] - px) < Math.abs(xy[best][0] - px)) best = i;
    const [bx, by] = xy[best];
    cross.setAttribute('x1', bx);
    cross.setAttribute('x2', bx);
    cross.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', bx);
    dot.setAttribute('cy', by);
    dot.setAttribute('visibility', 'visible');
    tip.replaceChildren(h('strong', null, `${pts[best].v.toFixed(1)} ${unit}`), h('span', null, fullDate(pts[best].date)));
    tip.hidden = false;
    const scale = rect.width / W;
    const half = tip.offsetWidth / 2;
    tip.style.left = Math.max(half, Math.min(bx * scale, rect.width - half)) + 'px';
  }
  function leave() {
    cross.setAttribute('visibility', 'hidden');
    dot.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  }
  box.addEventListener('pointermove', point);
  box.addEventListener('pointerdown', point);
  box.addEventListener('pointerleave', leave);
  box.addEventListener('pointercancel', leave);
  return box;
}
