// Recipes: the collection that ships with the app plus the ones you add. Every recipe can be
// edited or deleted, and can carry photos.

import { store } from '../store.js';
import { h, icon, sheet, field, empty, confirmBtn, uid, toast, fileToPhoto } from '../util.js';
import { unlock, packCount } from '../unlock.js';
import { RECIPES } from '../data/recipes.js';

let q = '';
let cat = 'all';
const MAX_PHOTOS = 4;

// Built-in recipes, the book collection, then your own. Items are copies tagged with where
// they are kept (_key); use locate() to reach the stored recipe itself.
export const allRecipes = () => [
  ...RECIPES,
  ...store.libraryRecipes(),
  ...store.data.recipes.mine.map(r => ({ ...r, _key: 'recipes' })),
];
export const findRecipe = id => allRecipes().find(r => r.id === id);

function locate(id) {
  const mine = store.data.recipes.mine;
  const index = mine.findIndex(r => r.id === id);
  if (index >= 0) return { key: 'recipes', items: mine, index };
  return store.findLibraryRecipe(id);
}

const isSaved = r => store.data.recipes.saved.includes(r.id); // a favourite
const triedIds = () => (store.data.recipes.tried ||= []);
const isTried = r => triedIds().includes(r.id);
const TRIED = '@tried'; // views of the recipes you have, and have not yet, tried
const UNTRIED = '@untried';
const lines = s => s.split('\n').map(x => x.trim()).filter(Boolean);

const CATEGORY_ORDER = [
  'Basics & preparations', 'Drinks & shakes', 'Dairy & cheese', 'Sauces & dressings', 'Red meat', 'Poultry',
  'Fish & seafood', 'Organs & marrow', 'Soups & broths', 'Raw starch', 'Salads & pickles', 'Sweets & desserts',
  'Baby food', 'Remedies & beauty',
];

const AILMENTS = '@ailments'; // the "Ailments" view; the @ keeps it apart from a category of that name
const same = (a, b) => a.toLowerCase() === b.toLowerCase();

// Categories you added yourself (Recipes → + Category, or "New category…" when editing).
const ownCategories = () => (store.data.recipes.categories ||= []);

// The categories shown on the Recipes screen: those in use plus your own, built-in ones first
// in a fixed order.
function categories() {
  const seen = [];
  for (const r of allRecipes()) if (r.category && !seen.includes(r.category)) seen.push(r.category);
  for (const c of ownCategories()) if (!seen.includes(c)) seen.push(c);
  const rank = c => (CATEGORY_ORDER.includes(c) ? CATEGORY_ORDER.indexOf(c) : CATEGORY_ORDER.length);
  return seen.map((c, i) => [c, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([c]) => c);
}

// Every category a recipe can be filed under: all the built-in ones, your own, and any in use.
function categoryOptions() {
  const out = [...CATEGORY_ORDER];
  for (const c of categories()) if (!out.includes(c)) out.push(c);
  return out;
}

/** Adds a category of your own. Returns the name as stored, or the existing one it matches. */
function addCategory(name) {
  const existing = categoryOptions().find(c => same(c, name));
  if (existing) return existing;
  ownCategories().push(name);
  store.save('recipes');
  return name;
}

// What recipes are "good for": every ailment you have written on a recipe, A to Z.
function ailments() {
  const seen = [];
  for (const r of allRecipes()) for (const a of r.goodFor || []) if (!seen.some(x => same(x, a))) seen.push(a);
  return seen.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

// "common cold,  Sore throat , common Cold" → ['common cold', 'Sore throat'], reusing the
// spelling of an ailment you already have so the same one is not listed twice.
function parseAilments(text) {
  const known = ailments();
  const out = [];
  for (const raw of text.split(/[,\n]/)) {
    const name = raw.trim().replace(/\s+/g, ' ');
    if (!name || out.some(x => same(x, name))) continue;
    out.push(known.find(x => same(x, name)) || name);
  }
  return out;
}

// The recipe collection ships locked; this card opens it with the owner's code.
function unlockCard(ctx) {
  const input = h('input', {
    type: 'text', id: 'recipe-code', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
    placeholder: 'XXXX-XXXX-XXXX', 'aria-label': 'Recipe code',
  });
  const msg = h('p', { class: 'error', role: 'alert', hidden: true });
  const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Unlock');
  const form = h('form', {
    class: 'add-row',
    onsubmit: async e => {
      e.preventDefault();
      if (!input.value.trim()) return;
      btn.disabled = true;
      btn.textContent = 'Unlocking…';
      msg.hidden = true;
      try {
        store.importAll(await unlock(input.value));
        store.data.settings.unlocked = true;
        store.save('settings');
        toast(`${packCount} recipes unlocked`);
        ctx.refresh();
      } catch {
        msg.textContent = 'That code did not work. Check it and try again.';
        msg.hidden = false;
        btn.disabled = false;
        btn.textContent = 'Unlock';
      }
    },
  }, input, btn);
  return h('section', { class: 'card' },
    h('h2', null, `${packCount} recipes are waiting`),
    h('p', { class: 'quiet' }, 'Enter your recipe code to open them. You only need to do this once on each device.'),
    form, msg);
}

export function render(root, ctx) {
  const locked = packCount > 0 && !store.data.settings.unlocked && !store.libraryRecipes().length;
  const chipsEl = h('div', { class: 'chips scroll' });
  const listEl = h('div', { class: 'stack' });
  const searchIn = h('input', {
    type: 'search', id: 'recipe-search', placeholder: 'Search recipes or ingredients', autocomplete: 'off',
    'aria-label': 'Search recipes', value: q,
    oninput: e => { q = e.target.value.trim(); draw(); },
  });

  root.append(
    h('div', { class: 'view-head' },
      h('h1', null, 'Recipes'),
      h('button', { class: 'btn primary small', type: 'button', onclick: () => editRecipe(null, ctx) }, icon('plus', 18), 'Add recipe')),
    ...(locked ? [unlockCard(ctx)] : []), // plain DOM append would print a bare `false`
    searchIn, chipsEl, listEl);

  function draw() {
    const all = allRecipes();
    const cats = categories();
    if (!['all', 'saved', TRIED, UNTRIED, AILMENTS].includes(cat) && !cats.includes(cat)) cat = 'all';

    const chip = (id, label) => h('button', {
      class: 'chip' + (cat === id ? ' on' : ''), type: 'button', 'aria-pressed': String(cat === id),
      onclick: () => { cat = id; draw(); },
    }, label);
    chipsEl.replaceChildren(chip('all', `All ${all.length}`), chip('saved', 'Favorites'), chip(TRIED, 'Tried'), chip(UNTRIED, 'To try'),
      chip(AILMENTS, 'Ailments'),
      ...cats.map(c => chip(c, c)),
      h('button', { class: 'chip add', type: 'button', onclick: () => manageCategories(ctx) }, icon('plus', 14), 'Category'));
    chipsEl.hidden = !all.length;
    searchIn.hidden = !all.length;

    if (!all.length) {
      listEl.replaceChildren(...(locked ? [] : [empty('No recipes yet', 'Add your first one with the button above.')]));
      return;
    }

    const ql = q.toLowerCase();
    // A search looks at the name, the ingredients and what the recipe is good for.
    const matchesText = r => !ql || r.title.toLowerCase().includes(ql) ||
      (r.ingredients || []).some(i => i.toLowerCase().includes(ql));
    const matches = r => matchesText(r) || (r.goodFor || []).some(a => a.toLowerCase().includes(ql));
    const inView = r => cat === 'all' ? true
      : cat === 'saved' ? isSaved(r)
        : cat === TRIED ? isTried(r)
          : cat === UNTRIED ? !isTried(r)
            : r.category === cat;
    const shown = cat === AILMENTS ? [] : all.filter(r => inView(r) && matches(r));

    if (cat !== AILMENTS && !shown.length) {
      const none = {
        saved: 'No favorites yet. Tap the heart next to a recipe to add it.',
        [TRIED]: 'Nothing ticked as tried yet. Open a recipe and tick “Tried it”.',
        [UNTRIED]: 'You have tried every recipe.',
      };
      listEl.replaceChildren(h('p', { class: 'quiet center' }, ql ? `Nothing matches “${q}”.` : none[cat] || 'Nothing here yet.'));
      return;
    }

    // A row opens the recipe; the heart at its end adds it to, or takes it out of, favorites.
    const row = (r, showCat) => {
      const sub = [showCat && r.category, r._key === 'recipes' && 'My recipe'].filter(Boolean).join(' · ');
      const fav = isSaved(r);
      return h('div', { class: 'row recipe' },
        h('button', { class: 'row-open', type: 'button', onclick: () => openRecipe(r.id, ctx) },
          h('span', { class: 'row-main' }, h('span', null, r.title), sub && h('span', { class: 'row-note' }, sub)),
          r.photos && r.photos.length > 0 && h('span', { class: 'row-mark quiet-mark', 'aria-label': 'Has photos' }, icon('image', 18)),
          isTried(r) && h('span', { class: 'row-mark tried-mark', 'aria-label': 'Tried' }, icon('check', 18))),
        h('button', {
          class: 'fav' + (fav ? ' on' : ''), type: 'button', 'aria-pressed': String(fav),
          'aria-label': fav ? `Remove ${r.title} from favorites` : `Add ${r.title} to favorites`,
          onclick: () => {
            const saved = store.data.recipes.saved;
            const i = saved.indexOf(r.id);
            if (i >= 0) saved.splice(i, 1);
            else saved.push(r.id);
            store.save('recipes');
            draw();
          },
        }, icon('heart', 20)));
    };

    const sorted = list => list.slice().sort((a, b) => a.title.localeCompare(b.title));
    if (cat === AILMENTS) {
      // One group per ailment, listing the recipes you marked as good for it. A search keeps
      // an ailment whose own name matches, or the recipes under it whose name or ingredients do.
      const groups = ailments()
        .map(a => [a, sorted(all.filter(r => (r.goodFor || []).some(x => same(x, a)) && (a.toLowerCase().includes(ql) || matchesText(r))))])
        .filter(([, list]) => list.length);
      listEl.replaceChildren(...(groups.length
        ? groups.map(([a, list]) => h('section', { class: 'group' },
          h('h2', { class: 'group-title' }, a, h('span', { class: 'count' }, list.length)),
          h('div', { class: 'list' }, list.map(r => row(r, true)))))
        : [h('p', { class: 'quiet center' }, ql
          ? `Nothing matches “${q}”.`
          : 'No ailments yet. Open a recipe, tap Edit and fill in “Good for”; it will be listed here.')]));
    } else if (cat === 'all' && !ql) {
      listEl.replaceChildren(...cats.concat(shown.some(r => !r.category) ? [''] : []).map(c => {
        const inCat = sorted(shown.filter(r => (r.category || '') === c));
        return inCat.length && h('section', { class: 'group' },
          h('h2', { class: 'group-title' }, c || 'Uncategorized', h('span', { class: 'count' }, inCat.length)),
          h('div', { class: 'list' }, inCat.map(r => row(r, false))));
      }).filter(Boolean));
    } else {
      listEl.replaceChildren(h('div', { class: 'list' }, sorted(shown).map(r => row(r, !cats.includes(cat) || !!ql))));
    }
  }
  draw();
}

// Your own categories: add new ones, or remove ones you added.
function manageCategories(ctx) {
  const own = ownCategories();
  const listEl = h('div');
  const input = h('input', { type: 'text', id: 'category-new', maxlength: '60', placeholder: 'New category', 'aria-label': 'New category', autocomplete: 'off' });
  const msg = h('p', { class: 'error', role: 'alert', hidden: true }, 'That category already exists.');
  const count = c => allRecipes().filter(r => r.category === c).length;

  function draw() {
    listEl.className = own.length ? 'list' : '';
    listEl.replaceChildren(...(own.length
      ? own.map((c, i) => h('div', { class: 'row middle' },
        h('span', { class: 'row-main' }, h('span', null, c),
          h('span', { class: 'row-note' }, count(c) === 1 ? '1 recipe' : `${count(c)} recipes`)),
        confirmBtn([icon('trash', 18)], 'Remove?', () => {
          own.splice(i, 1);
          store.save('recipes');
          draw();
        }, 'icon-btn danger')))
      : [h('p', { class: 'quiet' }, 'You have not added any categories of your own yet.')]));
  }

  function add(e) {
    e.preventDefault();
    const name = input.value.trim().replace(/\s+/g, ' ');
    if (!name) return;
    if (categoryOptions().some(c => same(c, name))) {
      msg.hidden = false;
      return;
    }
    msg.hidden = true;
    addCategory(name);
    input.value = '';
    draw();
    input.focus();
  }

  draw();
  sheet({
    title: 'Categories',
    content: [
      h('p', { class: 'quiet' }, 'Add your own categories. They join the built-in ones in the category list when you add or edit a recipe.'),
      h('form', { class: 'add-row', onsubmit: add }, input, h('button', { class: 'btn primary', type: 'submit' }, 'Add')),
      msg,
      listEl,
      h('p', { class: 'hint' }, 'Removing a category here does not change recipes already filed under it.'),
    ],
    onclose: ctx.refresh,
  });
}

// A photo that fills itself in once it has been fetched from storage.
function photoEl(id, cls) {
  const box = h('div', { class: cls });
  store.photoGet(id).then(
    url => { if (url) box.append(h('img', { src: url, alt: 'Recipe photo' })); else box.classList.add('missing'); },
    () => box.classList.add('missing'));
  return box;
}

export function openRecipe(id, ctx) {
  const r = findRecipe(id);
  if (!r) return;
  const saved = store.data.recipes.saved;
  const heart = h('button', { class: 'btn fav-btn', type: 'button', onclick: toggleSaved });
  function drawHeart() {
    const on = saved.includes(r.id);
    heart.classList.toggle('on', on);
    heart.setAttribute('aria-pressed', String(on));
    heart.replaceChildren(icon('heart', 18), on ? 'Favorited' : 'Favorite');
  }
  function toggleSaved() {
    const i = saved.indexOf(r.id);
    if (i >= 0) saved.splice(i, 1);
    else saved.push(r.id);
    store.save('recipes');
    drawHeart();
  }
  drawHeart();

  // "Tried it": a tick you set once you have made the recipe.
  const tried = triedIds();
  const triedLabel = h('span');
  const triedBtn = h('button', {
    class: 'tried', type: 'button', role: 'checkbox',
    onclick: () => {
      const i = tried.indexOf(r.id);
      if (i >= 0) tried.splice(i, 1);
      else tried.push(r.id);
      store.save('recipes');
      drawTried();
    },
  }, h('span', { class: 'egg' }), triedLabel);
  function drawTried() {
    const on = tried.includes(r.id);
    triedBtn.classList.toggle('on', on);
    triedBtn.setAttribute('aria-checked', String(on));
    triedLabel.textContent = on ? 'Tried it' : 'Not tried yet';
  }
  drawTried();

  function remove() {
    const loc = locate(r.id);
    if (!loc) return;
    loc.items.splice(loc.index, 1);
    store.save(loc.key);
    const d = store.data.recipes;
    d.saved = d.saved.filter(x => x !== r.id);
    d.tried = triedIds().filter(x => x !== r.id);
    store.save('recipes');
    if (loc.key !== 'recipes') {
      store.data.settings.unlocked = true; // an emptied collection should not ask for the code again
      store.save('settings');
    }
    for (const p of r.photos || []) store.photoDelete(p);
    s.close();
    toast('Recipe deleted');
  }

  const editable = !!r._key;

  // Photos, with a button to add one straight from here (Edit can also remove them).
  const photosEl = h('div', { class: 'stack tight' });
  const photoMsg = h('p', { class: 'hint', role: 'status' });
  const photoIn = h('input', {
    type: 'file', id: 'detail-photo', accept: 'image/*', hidden: true,
    onchange: async e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      photoMsg.textContent = 'Adding the photo…';
      let url;
      try {
        url = await fileToPhoto(file);
      } catch {
        photoMsg.textContent = 'That file is not a photo this app can read.';
        return;
      }
      const loc = locate(r.id);
      if (!loc) return;
      const photoId = uid();
      try {
        await store.photoPut(photoId, url);
      } catch {
        photoMsg.textContent = 'The photo could not be saved. Check your connection or free up space, then try again.';
        return;
      }
      const stored = loc.items[loc.index];
      stored.photos = [...(stored.photos || []), photoId];
      store.save(loc.key);
      r.photos = stored.photos;
      photoMsg.textContent = '';
      drawPhotos();
    },
  });
  function drawPhotos() {
    const list = r.photos || [];
    photosEl.replaceChildren(...[
      list.length > 0 && h('div', { class: 'photos' + (list.length === 1 ? ' single' : '') }, list.map(p => photoEl(p, 'photo'))),
      editable && list.length < MAX_PHOTOS && h('div', { class: 'btn-row' },
        h('button', { class: 'btn small', type: 'button', onclick: () => photoIn.click() }, icon('image', 18), list.length ? 'Add another photo' : 'Add a photo')),
    ].filter(Boolean));
  }
  drawPhotos();

  const meta = [r.category, r.source && (r.page ? `${r.source}, PDF page ${r.page}` : r.source), r._key === 'recipes' && 'My recipe']
    .filter(Boolean).join(' · ');
  const method = r.method || [];
  const s = sheet({
    title: r.title,
    content: [
      photosEl, photoIn, photoMsg,
      meta && h('p', { class: 'quiet' }, meta),
      triedBtn,
      r.yield && h('p', null, r.yield),
      r.goodFor && r.goodFor.length > 0 && h('section', { class: 'recipe-part' },
        h('h3', null, 'Good for'),
        h('div', { class: 'chips' }, r.goodFor.map(a => h('span', { class: 'chip tag' }, a)))),
      r.ingredients && r.ingredients.length > 0 && h('section', { class: 'recipe-part' },
        h('h3', null, 'Ingredients'),
        h('ul', { class: 'ingredients' }, r.ingredients.map(i => h('li', null, i)))),
      method.length > 0 && h('section', { class: 'recipe-part' },
        h('h3', null, 'Method'),
        method.length > 1 ? h('ol', { class: 'method' }, method.map(m => h('li', null, m))) : h('p', null, method[0])),
      r.notes && h('section', { class: 'recipe-part' }, h('h3', null, 'Notes'), h('p', { class: 'pre' }, r.notes)),
    ],
    footer: [
      editable && confirmBtn('Delete', 'Tap again to delete', remove),
      editable && h('button', { class: 'btn', type: 'button', onclick: () => { s.close(); editRecipe(r, ctx); } }, 'Edit'),
      h('span', { class: 'grow' }),
      heart,
    ],
    onclose: ctx.refresh,
  });
}

function editRecipe(r, ctx) {
  const title = h('input', { type: 'text', id: 'recipe-title', maxlength: '120', value: r ? r.title : '' });
  // Category: a real drop-down, so every option shows whatever is already chosen. The last
  // option lets you name a new one. A new recipe starts in the category you were looking at.
  const NEW = '@new';
  const options = categoryOptions();
  const current = r ? r.category || '' : (options.includes(cat) ? cat : '');
  const categoryNew = h('input', { type: 'text', id: 'recipe-category-new', maxlength: '60', placeholder: 'Name the new category', 'aria-label': 'New category name', hidden: true });
  const category = h('select', {
    id: 'recipe-category', value: current,
    onchange: () => {
      categoryNew.hidden = category.value !== NEW;
      if (!categoryNew.hidden) categoryNew.focus();
    },
  },
  h('option', { value: '' }, 'No category'),
  options.map(c => h('option', { value: c }, c)),
  h('option', { value: NEW }, 'New category…'));

  // Good for: ailments, separated by commas. Ones you have used before are offered as chips.
  const goodFor = h('input', { type: 'text', id: 'recipe-goodfor', maxlength: '300', placeholder: 'e.g. common cold, sore throat', autocomplete: 'off', value: r ? (r.goodFor || []).join(', ') : '' });
  const ailmentChips = h('div', { class: 'chips' });
  function drawAilmentChips() {
    const have = parseAilments(goodFor.value);
    const others = ailments().filter(a => !have.some(x => same(x, a)));
    ailmentChips.replaceChildren(...others.map(a => h('button', {
      class: 'chip', type: 'button', 'aria-label': `Add ${a}`,
      onclick: () => { goodFor.value = [...parseAilments(goodFor.value), a].join(', '); drawAilmentChips(); },
    }, icon('plus', 14), a)));
    ailmentChips.hidden = !others.length;
  }
  goodFor.addEventListener('input', drawAilmentChips);
  drawAilmentChips();
  const ingredients = h('textarea', { id: 'recipe-ingredients', rows: '6', placeholder: 'One per line', value: r ? (r.ingredients || []).join('\n') : '' });
  const method = h('textarea', { id: 'recipe-method', rows: '6', placeholder: 'One step per line', value: r ? (r.method || []).join('\n') : '' });
  const notes = h('textarea', { id: 'recipe-notes', rows: '3', value: r ? r.notes || '' : '' });
  const error = h('p', { class: 'error', role: 'alert', hidden: true }, 'Give the recipe a name.');
  const categoryError = h('p', { class: 'error', role: 'alert', hidden: true }, 'Name the new category, or pick another one.');
  const saveBtn = h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Save');

  // Photos: {id, url} for ones already stored, {url} for ones picked just now.
  const photos = (r && r.photos ? r.photos : []).map(id => ({ id }));
  const removed = [];
  const photoMsg = h('p', { class: 'hint', role: 'status' });
  const thumbs = h('div', { class: 'thumbs' });
  const fileIn = h('input', {
    type: 'file', id: 'recipe-photo', accept: 'image/*', hidden: true,
    onchange: async e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      photoMsg.textContent = 'Preparing the photo…';
      try {
        photos.push({ url: await fileToPhoto(file) });
        photoMsg.textContent = '';
      } catch {
        photoMsg.textContent = 'That file is not a photo this app can read.';
      }
      drawPhotos();
    },
  });
  function drawPhotos() {
    thumbs.replaceChildren(
      ...photos.map((p, i) => {
        const box = p.id ? photoEl(p.id, 'thumb') : h('div', { class: 'thumb' }, h('img', { src: p.url, alt: 'New photo' }));
        box.append(h('button', {
          class: 'thumb-x', type: 'button', 'aria-label': 'Remove photo',
          onclick: () => { if (p.id) removed.push(p.id); photos.splice(i, 1); drawPhotos(); },
        }, icon('x', 14)));
        return box;
      }),
      photos.length < MAX_PHOTOS && h('button', { class: 'thumb add', type: 'button', onclick: () => fileIn.click() },
        icon('image', 22), h('span', null, 'Add photo')));
  }

  async function save() {
    const t = title.value.trim();
    if (!t) {
      error.hidden = false;
      title.focus();
      return;
    }
    const newName = categoryNew.value.trim().replace(/\s+/g, ' ');
    if (category.value === NEW && !newName) {
      categoryError.hidden = false;
      categoryNew.focus();
      return;
    }
    saveBtn.disabled = true;
    const ids = [];
    try {
      for (const p of photos) {
        if (!p.id) {
          p.id = uid();
          await store.photoPut(p.id, p.url);
        }
        ids.push(p.id);
      }
    } catch {
      photoMsg.textContent = 'A photo could not be saved. Check your connection or free up space, then try again.';
      for (const p of photos) if (!ids.includes(p.id)) delete p.id;
      saveBtn.disabled = false;
      return;
    }
    const fields = {
      title: t,
      category: category.value === NEW ? addCategory(newName) : category.value,
      goodFor: parseAilments(goodFor.value),
      ingredients: lines(ingredients.value),
      method: lines(method.value),
      notes: notes.value.trim(),
      photos: ids,
    };
    const loc = r && locate(r.id);
    if (loc) {
      Object.assign(loc.items[loc.index], fields);
      store.save(loc.key);
    } else {
      store.data.recipes.mine.push({ id: 'my-' + uid(), ...fields });
      store.save('recipes');
    }
    for (const id of removed) store.photoDelete(id);
    s.close();
  }

  drawPhotos();
  const s = sheet({
    title: r ? 'Edit recipe' : 'Add recipe',
    content: [
      field('Name', title), error,
      field('Category', category), categoryNew, categoryError,
      field('Good for', goodFor, 'Ailments this helps with, separated by commas. They are listed under Ailments on the Recipes screen.'),
      ailmentChips,
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Photos'), thumbs, fileIn, photoMsg),
      field('Ingredients', ingredients),
      field('Method', method),
      field('Notes', notes),
    ],
    footer: [h('span', { class: 'grow' }), saveBtn],
    onclose: ctx.refresh,
  });
}
