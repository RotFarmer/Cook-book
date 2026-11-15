// Primal Cookbook — boot, tabs and settings.

import { store } from './store.js';
import { h, icon, sheet, sheetOpen, toast, confirmBtn } from './util.js';
import * as recipes from './views/recipes.js';
import * as plan from './views/plan.js';
import * as food from './views/food.js';
import * as habits from './views/habits.js';
import * as weight from './views/weight.js';

const TABS = [
  { id: 'recipes', label: 'Recipes', icon: 'book', view: recipes },
  { id: 'plan', label: 'Plan', icon: 'calendar', view: plan },
  { id: 'food', label: 'Food', icon: 'egg', view: food },
  { id: 'habits', label: 'Habits', icon: 'sun', view: habits },
  { id: 'weight', label: 'Weight', icon: 'trend', view: weight },
];
const PREF = 'primal-cookbook-ui:tab';

const main = document.getElementById('view');
const savebar = document.getElementById('savebar');
let current = null;
let ready = false;

const ctx = { refresh: render, go: show };

function render() {
  if (!ready || !current) return;
  main.replaceChildren();
  TABS.find(t => t.id === current).view.render(main, ctx);
}

function show(id, { fromHash = false } = {}) {
  if (!TABS.some(t => t.id === id)) return;
  const changed = current !== id;
  current = id;
  for (const b of document.querySelectorAll('.tab')) {
    if (b.dataset.tab === id) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  try {
    localStorage.setItem(PREF, id);
  } catch { /* remembering the tab is only a convenience */ }
  if (!fromHash && location.hash.slice(1) !== id) {
    try {
      history.replaceState(null, '', '#' + id);
    } catch {
      location.hash = id;
    }
  }
  render();
  if (changed) {
    main.classList.remove('enter');
    void main.offsetWidth;
    main.classList.add('enter');
    window.scrollTo(0, 0);
  }
}

function buildDock() {
  document.body.append(h('nav', { class: 'dock', 'aria-label': 'Sections' },
    h('div', { class: 'dock-in' }, TABS.map(t => {
      const b = h('button', { class: 'tab', type: 'button', onclick: () => show(t.id) },
        h('span', { class: 'blob' }, icon(t.icon)), t.label);
      b.dataset.tab = t.id;
      return b;
    }))));
}

function initialTab() {
  const fromHash = location.hash.slice(1);
  if (TABS.some(t => t.id === fromHash)) return fromHash;
  try {
    const saved = localStorage.getItem(PREF);
    if (TABS.some(t => t.id === saved)) return saved;
  } catch { /* fall through */ }
  return 'food';
}

async function boot() {
  main.replaceChildren(h('p', { class: 'quiet center boot' }, 'Opening your notebook…'));
  try {
    await store.init();
  } catch {
    main.replaceChildren(h('div', { class: 'empty' },
      h('div', { class: 'egg big', 'aria-hidden': 'true' }),
      h('p', { class: 'empty-title' }, 'Your saved entries could not be reached'),
      h('p', { class: 'empty-text' }, 'Check your connection, then try again. Nothing has been lost.'),
      h('button', { class: 'btn primary', type: 'button', onclick: boot }, 'Try again')));
    return;
  }
  ready = true;
  show(current || initialTab());
}

// ---------- settings ----------

function openSettings() {
  const out = h('textarea', { id: 'backup-out', rows: '4', readonly: true, hidden: true, 'aria-label': 'Backup text' });
  const inp = h('textarea', { id: 'backup-in', rows: '4', placeholder: 'Paste a backup here', 'aria-label': 'Backup to restore' });
  const msg = h('p', { class: 'hint', role: 'status' });

  async function copyBackup() {
    msg.textContent = 'Collecting your entries…';
    let text;
    try {
      text = JSON.stringify(await store.exportAll());
    } catch {
      msg.textContent = 'The backup could not be made. Check your connection and try again.';
      return;
    }
    out.value = text;
    out.hidden = false;
    try {
      await navigator.clipboard.writeText(text);
      msg.textContent = 'Backup copied. Paste it somewhere safe, like a note or an email to yourself.';
    } catch {
      out.focus();
      out.select();
      msg.textContent = 'Copy the selected text and keep it somewhere safe.';
    }
  }

  function restore() {
    try {
      const n = store.importAll(JSON.parse(inp.value));
      s.close();
      render();
      toast(`Restored ${n} ${n === 1 ? 'section' : 'sections'}`);
    } catch (e) {
      msg.textContent = e instanceof SyntaxError ? 'That text is not a complete backup. Paste the whole thing.' : e.message;
    }
  }

  const s = sheet({
    title: 'Settings',
    content: [
      h('section', { class: 'stack tight' },
        h('h3', null, 'Where your entries are kept'),
        h('p', null, store.mode === 'cloud'
          ? 'In your Claude account, private to you. They follow you to any device where you open this page signed in.'
          : 'In this browser, on this device only. Clearing the browser’s site data removes them, so keep a backup.')),
      h('section', { class: 'stack tight' },
        h('h3', null, 'Backup'),
        h('p', { class: 'quiet' }, 'A backup is one block of text holding everything: weight, plan, habits, food log and your own recipes.'),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick: copyBackup }, icon('copy', 18), 'Copy backup')),
        out,
        inp,
        h('div', { class: 'btn-row' }, confirmBtn('Restore from backup', 'Tap again: this replaces current entries', restore)),
        msg),
    ],
  });
}

// ---------- wiring ----------

buildDock();
document.getElementById('settings-btn').addEventListener('click', openSettings);
document.getElementById('save-retry').addEventListener('click', () => store.flush());
store.onstatus(failing => { savebar.hidden = !failing; });

window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (ready && id !== current) show(id, { fromHash: true });
});

document.addEventListener('visibilitychange', async () => {
  store.flush();
  if (document.hidden || !ready) return;
  if (await store.refresh(() => !sheetOpen())) render();
});
window.addEventListener('online', () => store.flush());
window.addEventListener('pagehide', () => store.flush());

// Redraw the weight chart when the width changes (not when a phone keyboard changes the height).
let lastWidth = window.innerWidth;
let resizeTimer;
window.addEventListener('resize', () => {
  if (window.innerWidth === lastWidth) return;
  lastWidth = window.innerWidth;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (current === 'weight' && !sheetOpen()) render(); }, 200);
});

// Offline support when served as a normal website (service workers do not run inside an artifact).
if (!window.claude && 'serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot();
