// Small DOM, date and UI helpers shared by every view.

const pad = n => String(n).padStart(2, '0');

function add(el, kids) {
  for (const k of kids) {
    if (k == null || k === false || k === '') continue;
    if (Array.isArray(k)) add(el, k);
    else el.append(k.nodeType ? k : String(k));
  }
}

/** h('button', {class: 'btn', onclick: fn}, 'Save') */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'value') value = v;
    else if (k === 'style') for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  add(el, kids);
  if (value !== undefined) el.value = value; // after children, so <select> finds its option
  return el;
}

const ICONS = {
  book: '<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19"/><path d="M9 8.5h6"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="3.5"/><path d="M4 10.5h16M8.5 3.5v4M15.5 3.5v4"/>',
  egg: '<path d="M12 3.5c3.2 0 6 5.2 6 9.4a6 6 0 0 1-12 0c0-4.2 2.8-9.4 6-9.4z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  trend: '<path d="M4 15.5l5-5 4 3.5 7-8"/><path d="M4 20h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  chevL: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  chevR: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
  up: '<path d="M5.5 14.5 12 8l6.5 6.5"/>',
  down: '<path d="M5.5 9.5 12 16l6.5-6.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7"/>',
  sliders: '<path d="M4 8h8M18 8h2M4 16h2M12 16h8"/><circle cx="15" cy="8" r="2.5"/><circle cx="9" cy="16" r="2.5"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
};

export function icon(name, size = 22) {
  const t = document.createElement('template');
  t.innerHTML =
    `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  return t.content.firstChild;
}

// ---------- dates & times (always the device's local calendar) ----------

export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const parseYmd = s => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s, n) => {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
export const nowTime = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** Monday = 0 … Sunday = 6 */
export const weekdayIndex = s => (parseYmd(s).getDay() + 6) % 7;

const fmt = opts => new Intl.DateTimeFormat(undefined, opts);
const F = {
  weekday: fmt({ weekday: 'long' }),
  monthDay: fmt({ month: 'long', day: 'numeric' }),
  short: fmt({ month: 'short', day: 'numeric' }),
  full: fmt({ weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
  time: fmt({ hour: 'numeric', minute: '2-digit' }),
};
export const dayName = s => {
  const t = today();
  if (s === t) return 'Today';
  if (s === addDays(t, -1)) return 'Yesterday';
  if (s === addDays(t, 1)) return 'Tomorrow';
  return F.weekday.format(parseYmd(s));
};
export const monthDay = s => F.monthDay.format(parseYmd(s));
export const shortDate = s => F.short.format(parseYmd(s));
export const fullDate = s => F.full.format(parseYmd(s));
export const fmtTime = hm => {
  if (!hm) return '';
  const [hh, mm] = hm.split(':').map(Number);
  return F.time.format(new Date(2000, 0, 1, hh, mm));
};

export const uid = () => Math.random().toString(36).slice(2, 10);

// ---------- shared UI pieces ----------

export function field(label, control, hint) {
  return h('div', { class: 'field' },
    h('label', { for: control.id }, label),
    control,
    hint && h('p', { class: 'hint' }, hint));
}

const stack = [];
export const sheetOpen = () => stack.length > 0;

/** Bottom sheet on phones, centered dialog on wider screens. */
export function sheet({ title, content, footer, onclose }) {
  const prevFocus = document.activeElement;
  const body = h('div', { class: 'sheet-body' }, content);
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-head' },
      h('h2', null, title),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => api.close() }, icon('x'))),
    body,
    footer && h('div', { class: 'sheet-foot' }, footer));
  const scrim = h('div', { class: 'scrim', onclick: e => { if (e.target === scrim) api.close(); } }, panel);
  const api = {
    body,
    panel,
    close() {
      const i = stack.indexOf(api);
      if (i < 0) return;
      stack.splice(i, 1);
      scrim.remove();
      if (!stack.length) document.documentElement.classList.remove('has-sheet');
      if (prevFocus && prevFocus.isConnected) prevFocus.focus();
      if (onclose) onclose();
    },
  };
  stack.push(api);
  if (toastEl) toastEl.classList.remove('show');
  document.documentElement.classList.add('has-sheet');
  document.body.append(scrim);
  return api;
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close();
});

let toastEl;
let toastTimer;
export function toast(msg) {
  if (!toastEl) {
    toastEl = h('div', { class: 'toast', role: 'status' });
    document.body.append(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

/** A button that needs a second tap before it runs (stands in for confirm()). */
export function confirmBtn(label, confirmLabel, fn, cls = 'btn danger') {
  let armed = false;
  let timer;
  const b = h('button', {
    class: cls,
    type: 'button',
    onclick: () => {
      if (armed) {
        clearTimeout(timer);
        fn();
        return;
      }
      armed = true;
      b.replaceChildren(confirmLabel);
      b.classList.add('armed');
      timer = setTimeout(() => {
        armed = false;
        b.replaceChildren(...[].concat(label));
        b.classList.remove('armed');
      }, 3500);
    },
  }, label);
  return b;
}

/** ‹  Today / November 15  ›  — tapping the label opens the native date picker. */
export function dateNav(date, onchange) {
  const input = h('input', {
    type: 'date',
    class: 'datenav-input',
    id: 'datenav-pick',
    'aria-label': 'Pick a date',
    value: date,
    onchange: e => { if (e.target.value) onchange(e.target.value); },
    onclick: e => { try { e.target.showPicker(); } catch { /* the plain input still works */ } },
  });
  return h('div', { class: 'datenav' },
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Previous day', onclick: () => onchange(addDays(date, -1)) }, icon('chevL')),
    h('div', { class: 'datenav-label' },
      h('span', { class: 'datenav-main' }, dayName(date)),
      h('span', { class: 'datenav-sub' }, monthDay(date)),
      input),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Next day', onclick: () => onchange(addDays(date, 1)) }, icon('chevR')));
}

export function empty(title, text, action) {
  return h('div', { class: 'empty' },
    h('div', { class: 'egg big', 'aria-hidden': 'true' }),
    h('p', { class: 'empty-title' }, title),
    text && h('p', { class: 'empty-text' }, text),
    action);
}
