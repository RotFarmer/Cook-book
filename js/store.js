// Where everything you enter is kept.
//
// Two homes, one interface:
//  - "local": this browser's localStorage (how the app runs from GitHub Pages or a file).
//  - "cloud": when the page is opened as a Claude artifact, each person's entries go to
//    their own private documents (data/users/<id>/…), so phone and tablet stay in step.
//
// Data is split into a few small documents: settings, weights, plan, habits, recipes,
// and one food-log document per month (log-YYYY-MM).

const NS = 'primal-cookbook:';
const FIXED = ['settings', 'weights', 'plan', 'habits', 'recipes'];
const LOG_KEY = /^log-\d{4}-\d{2}$/;

const DEFAULTS = {
  settings: () => ({ unit: 'lb', customFoods: [] }),
  weights: () => ({ entries: [] }), // [{date: 'YYYY-MM-DD', kg: number}]
  plan: () => ({ days: {} }), // {'0'…'6' (Mon…Sun): [{id, time, title, note, recipeId}]}
  habits: () => ({
    list: [{ id: 'sunlight', name: 'Get sunlight' }, { id: 'walk', name: 'Walk' }],
    done: {}, // {'YYYY-MM-DD': [habitId]}
  }),
  recipes: () => ({ mine: [], saved: [] }),
};

const clone = o => JSON.parse(JSON.stringify(o));
const fresh = key => (LOG_KEY.test(key) ? { days: {} } : DEFAULTS[key]());
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
  },

  has(key) {
    return key in this.data;
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
      for (const d of all.docs) out[d.id] = clone(d.data());
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
      throw new Error('That does not look like a Primal Cookbook backup.');
    }
    let n = 0;
    for (const [key, value] of Object.entries(dump.data)) {
      if (!FIXED.includes(key) && !LOG_KEY.test(key)) continue;
      this.data[key] = normalize(key, value);
      this.save(key);
      n++;
    }
    return n;
  },
};
