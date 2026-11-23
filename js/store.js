// Where everything you enter is kept.
//
// Two homes, one interface:
//  - "local": this browser's localStorage (how the app runs from GitHub Pages or a file).
//  - "cloud": when the page is opened as a Claude artifact, each person's entries go to
//    their own private documents (data/users/<id>/…), so phone and tablet stay in step.
//
// Data is split into a few small documents: settings, weights, plan, habits, recipes,
// one food-log document per month (log-YYYY-MM), and up to four recipe collections
// imported from books (library-1 … library-4).

import { recipeToMetric } from './metric.js';
import { applyCorrections, CORRECTIONS_REV } from './data/corrections.js';

const NS = 'primal-cookbook:';
const LIBRARY = ['library-1', 'library-2', 'library-3', 'library-4'];
const FIXED = ['settings', 'weights', 'plan', 'habits', 'recipes', 'lists', 'notes', ...LIBRARY];
const LOG_KEY = /^log-\d{4}-\d{2}$/;

const DEFAULTS = {
  settings: () => ({ unit: 'lb', customFoods: [], palette: 'milk' }),
  weights: () => ({ entries: [] }), // [{date: 'YYYY-MM-DD', kg: number}]
  // Meal blocks keep their text; the ticks belong to one day and start fresh on the next.
  plan: () => ({ blocks: [], checked: { date: '', ids: [] } }), // blocks: [{id, title, text}]
  habits: () => ({
    list: [{ id: 'sunlight', name: 'Get sunlight', emoji: '☀️' }, { id: 'walk', name: 'Walk', emoji: '🚶' }],
    done: {}, // {'YYYY-MM-DD': [habitId]}
  }),
  recipes: () => ({ mine: [], saved: [], categories: [] }), // categories: ones you added yourself
  lists: () => ({ todo: [], buy: [] }), // [{id, text, done}]
  notes: () => ({ items: [] }), // [{id, title, text, updated}]
};

const clone = o => JSON.parse(JSON.stringify(o));
const fresh = key => {
  if (LOG_KEY.test(key)) return { days: {} };
  // A book's recipes: {source, author, items: [{id, title, category, page, ingredients, method, …}]}
  if (LIBRARY.includes(key)) return { source: '', author: '', items: [] };
  return DEFAULTS[key]();
};
const normalize = (key, v) => Object.assign(fresh(key), v && typeof v === 'object' ? v : {});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const within = (p, ms) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

function lsGet(key) {
  try {
    const raw = localStorage.getItem(NS + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function lsSet(key, value) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// The browser database that holds photos when entries stay on this device.
function idb(mode, run) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('primal-cookbook', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('photos');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('photos', mode);
      const req = run(tx.objectStore('photos'));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    };
  });
}

export const store = {
  mode: 'local',
  failing: false, // true while changes are not reaching storage
  data: {},
  _col: null,
  _loading: {},
  _timers: {},
  _chain: {},
  _dirty: new Set(),
  _carry: new Set(),
  _subs: new Set(),
  _loadedAt: 0,
  _photos: new Map(),

  onstatus(fn) {
    this._subs.add(fn);
  },
  _setFailing(v) {
    if (this.failing === v) return;
    this.failing = v;
    for (const fn of this._subs) fn(v);
  },

  async init() {
    if (window.claude && typeof window.claude.use === 'function' && !this._col) {
      try {
        const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
        const id = user ? await user.id() : null;
        if (db && id) {
          this._col = db.collection('data/users/' + id);
          this.mode = 'cloud';
        }
      } catch {
        // No store in this view: keep entries in the browser instead.
      }
    }
    await Promise.all(FIXED.map(k => this.ensure(k)));
    this._loadedAt = Date.now();
    this.metricLibrary();
  },

  /**
   * The book recipes were written in ounces and pounds; rewrite them once as grams. Each
   * collection is marked when done (metric: 2), so edits made afterwards are left alone.
   * A collection marked `true` was converted by the first version, which gave jar sizes in
   * millilitres; those are turned into grams as well.
   */
  metricLibrary() {
    for (const key of LIBRARY) {
      const doc = this.data[key];
      if (!doc || doc.metric === 2 || !doc.items.length) continue;
      for (const recipe of doc.items) recipeToMetric(recipe, doc.metric === true);
      doc.metric = 2;
      this.save(key);
    }
    // Then the corrections from re-checking the cards against the books, once per collection.
    for (const key of LIBRARY) {
      const doc = this.data[key];
      if (!doc || !doc.items.length || (doc.rev || 0) >= CORRECTIONS_REV) continue;
      applyCorrections(doc.items);
      doc.rev = CORRECTIONS_REV;
      this.save(key);
    }
  },

  has(key) {
    return key in this.data;
  },

  /** Recipes imported from books, each tagged with the book it came from. */
  libraryRecipes() {
    return LIBRARY.flatMap(key => {
      const doc = this.data[key];
      return doc ? doc.items.map(r => ({ ...r, source: r.source || doc.source, _key: key })) : [];
    });
  },

  /** Where a book recipe is kept, so it can be edited or deleted: {key, items, index}. */
  findLibraryRecipe(id) {
    for (const key of LIBRARY) {
      const doc = this.data[key];
      const index = doc ? doc.items.findIndex(r => r.id === id) : -1;
      if (index >= 0) return { key, items: doc.items, index };
    }
    return null;
  },

  // ---------- photos ----------
  // Kept apart from the other documents because they are big: one cloud document per photo,
  // or the browser's IndexedDB when entries stay on the device. Not part of backups.

  async photoPut(id, dataUrl) {
    if (this.mode === 'cloud') await within(this._col.doc('photo-' + id).set({ data: dataUrl }), 20000);
    else await idb('readwrite', s => s.put(dataUrl, id));
    this._photos.set(id, dataUrl);
  },

  async photoGet(id) {
    if (this._photos.has(id)) return this._photos.get(id);
    let url = null;
    if (this.mode === 'cloud') {
      const snap = await within(this._col.doc('photo-' + id).get(), 20000);
      url = snap.exists ? snap.data().data : null;
    } else {
      url = (await idb('readonly', s => s.get(id))) || null;
    }
    if (url) this._photos.set(id, url);
    return url;
  },

  async photoDelete(id) {
    this._photos.delete(id);
    try {
      if (this.mode === 'cloud') await within(this._col.doc('photo-' + id).delete(), 20000);
      else await idb('readwrite', s => s.delete(id));
    } catch {
      // an orphaned photo is harmless
    }
  },

  /** Load a document if it is not in memory yet. Rejects if the cloud cannot be reached. */
  ensure(key) {
    if (key in this.data) return Promise.resolve(this.data[key]);
    if (!this._loading[key]) {
      this._loading[key] = this._read(key).then(
        v => {
          delete this._loading[key];
          this.data[key] = normalize(key, v);
          if (this._carry.delete(key)) this.save(key);
          return this.data[key];
        },
        e => {
          delete this._loading[key];
          throw e;
        });
    }
    return this._loading[key];
  },

  async _read(key) {
    if (this.mode !== 'cloud') return lsGet(key);
    const snap = await within(this._col.doc(key).get(), 12000);
    if (snap.exists) return clone(snap.data());
    // Nothing in the cloud yet: carry over anything this browser saved earlier.
    const local = lsGet(key);
    if (local) this._carry.add(key);
    return local;
  },

  /** Call after changing store.data[key]. */
  save(key) {
    if (this.mode !== 'cloud') {
      this._setFailing(!lsSet(key, this.data[key]));
      return;
    }
    this._dirty.add(key);
    clearTimeout(this._timers[key]);
    this._timers[key] = setTimeout(() => this._push(key), 500);
  },

  // One write at a time per document, and only when it changed.
  _push(key) {
    clearTimeout(this._timers[key]);
    const run = async () => {
      if (!this._dirty.has(key)) return;
      this._dirty.delete(key);
      const body = clone(this.data[key]);
      try {
        await this._write(key, body);
        if (!this._dirty.size) this._setFailing(false);
      } catch {
        this._dirty.add(key);
        this._setFailing(true);
      }
    };
    this._chain[key] = (this._chain[key] || Promise.resolve()).then(run);
    return this._chain[key];
  },

  async _write(key, body) {
    const ref = this._col.doc(key);
    try {
      await within(ref.set(body), 12000);
    } catch (e) {
      const code = e && e.code;
      if (code === 'invalid_argument' || code === 'quota_exceeded' || code === 'revoked') throw e;
      await sleep(900 + Math.random() * 900);
      await within(ref.set(body), 12000);
    }
  },

  /** Send anything still waiting (leaving the page, coming back online, tapping Retry). */
  flush() {
    return Promise.all([...this._dirty].map(k => this._push(k)));
  },

  /** Pick up changes made on another device. `ok()` is asked just before swapping data in. */
  async refresh(ok = () => true) {
    if (this.mode !== 'cloud' || this._dirty.size || Date.now() - this._loadedAt < 20000) return false;
    this._loadedAt = Date.now();
    const next = {};
    try {
      await Promise.all(Object.keys(this.data).map(async key => {
        const snap = await within(this._col.doc(key).get(), 12000);
        next[key] = normalize(key, snap.exists ? clone(snap.data()) : null);
      }));
    } catch {
      return false;
    }
    if (this._dirty.size || !ok()) return false;
    let changed = false;
    for (const [key, value] of Object.entries(next)) {
      if (JSON.stringify(value) !== JSON.stringify(this.data[key])) {
        this.data[key] = value;
        changed = true;
      }
    }
    return changed;
  },

  /** Everything, including food-log months that are not open right now. */
  async exportAll() {
    const out = {};
    if (this.mode === 'cloud') {
      const all = await within(this._col.get(), 15000);
      for (const d of all.docs) if (!d.id.startsWith('photo-')) out[d.id] = clone(d.data());
    } else {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(NS)) out[k.slice(NS.length)] = JSON.parse(localStorage.getItem(k));
        }
      } catch {
        // fall through with what is in memory
      }
    }
    for (const k of Object.keys(this.data)) out[k] = clone(this.data[k]);
    return { app: 'primal-cookbook', version: 1, exported: new Date().toISOString(), data: out };
  },

  /** Replace current data with a backup made by exportAll(). Returns how many documents were restored. */
  importAll(dump) {
    if (!dump || dump.app !== 'primal-cookbook' || !dump.data || typeof dump.data !== 'object') {
      throw new Error('That does not look like a Primal backup.');
    }
    let n = 0;
    for (const [key, value] of Object.entries(dump.data)) {
      if (!FIXED.includes(key) && !LOG_KEY.test(key)) continue;
      this.data[key] = normalize(key, value);
      this.save(key);
      n++;
    }
    this.metricLibrary();
    return n;
  },
};
