// primal — boot, tabs and settings.

import { store } from './store.js';
import { h, icon, sheet, sheetOpen, closeTopSheet, toast, confirmBtn } from './util.js';
import * as update from './update.js';
import * as recipes from './views/recipes.js';
import * as plan from './views/plan.js';
import * as food from './views/food.js';
import * as habits from './views/habits.js';
import * as weight from './views/weight.js';
import * as lists from './views/lists.js';
import * as notes from './views/notes.js';

const TABS = [
  { id: 'recipes', label: 'Recipes', icon: 'book', view: recipes },
  { id: 'plan', label: 'Plan', icon: 'calendar', view: plan },
  { id: 'food', label: 'Food', icon: 'egg', view: food },
  { id: 'habits', label: 'Habits', icon: 'sun', view: habits },
  { id: 'weight', label: 'Weight', icon: 'trend', view: weight },
  { id: 'lists', label: 'Lists', icon: 'list', view: lists },
  { id: 'notes', label: 'Notes', icon: 'note', view: notes },
];
const PREF = 'primal-cookbook-ui:tab';
const PREF_PALETTE = 'primal-cookbook-ui:palette';

// ---------- colour themes, and light/dark following the phone ----------

// Each theme is a quiet tint with one soft accent; the swatch colour is that accent.
const PALETTES = [
  ['milk', 'Milk', '#F6C445'],
  ['sage', 'Sage', '#B5CDB0'],
  ['rose', 'Rose', '#E8B9B3'],
  ['sky', 'Sky', '#AFC8E0'],
  ['lavender', 'Lavender', '#C6B8E0'],
  ['sand', 'Sand', '#DCC49E'],
];
const rootEl = document.documentElement;

// The Android app's system bars sit outside the page, so tell it which colour to paint them.
function syncChrome() {
  if (!update.native || !update.native.setBackground) return;
  requestAnimationFrame(() => {
    const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g);
    if (m) update.native.setBackground('#' + m.slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join(''));
  });
}

function applyPalette(id) {
  const known = PALETTES.some(p => p[0] === id) ? id : 'milk';
  if (known === 'milk') delete rootEl.dataset.palette;
  else rootEl.dataset.palette = known;
  try {
    localStorage.setItem(PREF_PALETTE, known);
  } catch { /* only used to avoid a flash of the default theme on the next start */ }
  syncChrome();
}

// In a browser, light or dark comes from the system setting through CSS. Inside the Android
// app the native side reports it, now and whenever the phone switches.
function applyNativeTheme(mode) {
  rootEl.dataset.theme = mode === 'dark' ? 'dark' : 'light';
  syncChrome();
}
if (update.native && update.native.isNight) applyNativeTheme(update.native.isNight() ? 'dark' : 'light');
window.addEventListener('apptheme', e => applyNativeTheme(e.detail));
try {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncChrome);
} catch { /* older browsers */ }
try {
  applyPalette(localStorage.getItem(PREF_PALETTE));
} catch {
  applyPalette('milk');
}

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
    if (b.dataset.tab === id) {
      b.setAttribute('aria-current', 'page');
      b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); // the tab bar scrolls sideways
    } else b.removeAttribute('aria-current');
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
  applyPalette(store.data.settings.palette);
  show(current || initialTab());
}

// ---------- settings ----------

function openSettings() {
  const out = h('textarea', { id: 'backup-out', rows: '4', readonly: true, hidden: true, 'aria-label': 'Backup text' });
  const inp = h('textarea', { id: 'backup-in', rows: '4', placeholder: 'Paste a backup here', 'aria-label': 'Backup to restore' });
  const msg = h('p', { class: 'hint', role: 'status' });
  const fileIn = h('input', {
    type: 'file', id: 'backup-file', accept: 'application/json,.json,text/plain,.txt', hidden: true,
    onchange: async e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        inp.value = await file.text();
        msg.textContent = `${file.name} is loaded. Tap Restore to bring it in.`;
      } catch {
        msg.textContent = 'That file could not be read.';
      }
      e.target.value = '';
    },
  });

  // ---- the Android app: installed version and updates, or where to get it ----
  const appMsg = h('p', { class: 'hint', role: 'status' });
  const installed = update.installedVersion();
  async function checkNow() {
    appMsg.textContent = 'Checking…';
    try {
      const found = await update.findUpdate();
      if (!found) {
        appMsg.textContent = 'You have the latest version.';
        return;
      }
      s.close();
      offerUpdate(found);
    } catch {
      appMsg.textContent = 'Could not check right now. Make sure you are online and try again.';
    }
  }
  const appSection = installed
    ? h('section', { class: 'stack tight' },
      h('h3', null, 'App'),
      h('p', null, `Version ${installed.name}`),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick: checkNow }, 'Check for updates')),
      appMsg)
    : h('section', { class: 'stack tight' },
      h('h3', null, 'Android app'),
      h('p', { class: 'quiet' }, 'Install it once from the link below. After that it updates itself from inside the app.'),
      h('div', { class: 'btn-row' }, h('a', { class: 'btn', href: update.APK_URL, target: '_blank', rel: 'noopener' }, 'Download the APK')));

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

  const swatches = h('div', { class: 'swatches', role: 'group', 'aria-label': 'Theme' });
  function drawSwatches() {
    const current = store.data.settings.palette || 'milk';
    swatches.replaceChildren(...PALETTES.map(([id, label, color]) => h('button', {
      class: 'swatch' + (id === current ? ' on' : ''), type: 'button', 'aria-pressed': String(id === current),
      onclick: () => {
        store.data.settings.palette = id;
        store.save('settings');
        applyPalette(id);
        drawSwatches();
      },
    }, h('span', { class: 'swatch-dot', style: { background: color } }), label)));
  }
  drawSwatches();

  const s = sheet({
    title: 'Settings',
    content: [
      h('section', { class: 'stack tight' },
        h('h3', null, 'Theme'),
        swatches,
        h('p', { class: 'hint' }, 'Light and dark follow your phone\u2019s setting.')),
      h('section', { class: 'stack tight' },
        h('h3', null, 'Where your entries are kept'),
        h('p', null, store.mode === 'cloud'
          ? 'In your Claude account, private to you. They follow you to any device where you open this page signed in.'
          : 'In this browser, on this device only. Clearing the browser’s site data removes them, so keep a backup.')),
      h('section', { class: 'stack tight' },
        h('h3', null, 'Backup'),
        h('p', { class: 'quiet' }, 'A backup is one block of text holding everything except photos: weight, plan, habits, lists, notes, food log and recipes. Restoring replaces only the sections the backup contains.'),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick: copyBackup }, icon('copy', 18), 'Copy backup')),
        out,
        inp,
        fileIn,
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', type: 'button', onclick: () => fileIn.click() }, 'Choose a backup file'),
          confirmBtn('Restore', 'Tap again: this replaces current entries', restore)),
        msg),
      appSection,
      store.data.settings.recipeCode && h('section', { class: 'stack tight' },
        h('h3', null, 'Recipe code'),
        h('p', { class: 'code' }, store.data.settings.recipeCode),
        h('p', { class: 'quiet' }, 'Opens the recipe collection on a new device, such as the Android app. Keep it to yourself.')),
    ],
  });
}

// ---------- app updates (Android app only) ----------

const updateBar = document.getElementById('updatebar');
const updateText = document.getElementById('update-text');
const updateBtn = document.getElementById('update-btn');
let pendingUpdate = null;

function offerUpdate(release) {
  pendingUpdate = release;
  updateText.textContent = `Version ${release.name} is ready to install.`;
  updateBtn.hidden = false;
  updateBtn.disabled = false;
  updateBar.hidden = false;
}

updateBtn.addEventListener('click', () => {
  if (!pendingUpdate) return;
  updateBtn.disabled = true;
  updateText.textContent = 'Downloading the update…';
  update.install(pendingUpdate);
});

// Progress reports from the native side.
window.addEventListener('appupdate', e => {
  const { state, detail } = e.detail || {};
  if (state === 'progress') updateText.textContent = `Downloading the update… ${detail}%`;
  else if (state === 'permission') {
    updateText.textContent = 'Allow primal to install apps, then come back here.';
    updateBtn.disabled = false;
  } else if (state === 'installing') {
    updateText.textContent = 'Android is installing the update. Tap Update again if nothing opened.';
    updateBtn.disabled = false;
  } else if (state === 'error') {
    updateText.textContent = detail || 'The update did not work. Try again.';
    updateBtn.disabled = false;
  }
});

// Android's back button closes an open sheet before it leaves the app.
window.__back = closeTopSheet;

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
if (!window.claude && !update.native && 'serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot();
update.autoCheck().then(found => { if (found) offerUpdate(found); });
