// Recipes: the built-in collection plus the ones you add, grouped by category.

import { store } from '../store.js';
import { h, icon, sheet, field, empty, confirmBtn, uid } from '../util.js';
import { RECIPES } from '../data/recipes.js';

let q = '';
let cat = 'all';

export const allRecipes = () => [...RECIPES, ...store.data.recipes.mine];
export const findRecipe = id => allRecipes().find(r => r.id === id);
const isMine = r => store.data.recipes.mine.includes(r);
const isSaved = r => store.data.recipes.saved.includes(r.id);
const lines = s => s.split('\n').map(x => x.trim()).filter(Boolean);

function categories() {
  const seen = [];
  for (const r of allRecipes()) if (r.category && !seen.includes(r.category)) seen.push(r.category);
  return seen;
}

export function render(root, ctx) {
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
    searchIn, chipsEl, listEl);

  function draw() {
    const all = allRecipes();
    const cats = categories();
    if (cat !== 'all' && cat !== 'saved' && !cats.includes(cat)) cat = 'all';

    const chip = (id, label) => h('button', {
      class: 'chip' + (cat === id ? ' on' : ''), type: 'button', 'aria-pressed': String(cat === id),
      onclick: () => { cat = id; draw(); },
    }, label);
    chipsEl.replaceChildren(chip('all', `All ${all.length}`), chip('saved', 'Saved'), ...cats.map(c => chip(c, c)));
    chipsEl.hidden = !all.length;
    searchIn.hidden = !all.length;

    if (!all.length) {
      listEl.replaceChildren(empty(
        'No recipes yet',
        'The recipes from your PDFs have not been added yet. You can add your own in the meantime.'));
      return;
    }

    const ql = q.toLowerCase();
    const shown = all.filter(r =>
      (cat === 'all' || (cat === 'saved' ? isSaved(r) : r.category === cat)) &&
      (!ql || r.title.toLowerCase().includes(ql) || (r.ingredients || []).some(i => i.toLowerCase().includes(ql))));

    if (!shown.length) {
      listEl.replaceChildren(h('p', { class: 'quiet center' },
        ql ? `Nothing matches “${q}”.` : cat === 'saved' ? 'Tap the heart on a recipe to keep it here.' : 'Nothing here yet.'));
      return;
    }

    const row = (r, showCat) => h('button', { class: 'row', type: 'button', onclick: () => openRecipe(r.id, ctx) },
      h('span', { class: 'row-main' },
        h('span', null, r.title),
        (showCat || isMine(r)) && h('span', { class: 'row-note' },
          [showCat && r.category, isMine(r) && 'My recipe'].filter(Boolean).join(' · '))),
      isSaved(r) && h('span', { class: 'row-mark', 'aria-label': 'Saved' }, icon('heart', 18)));

    const sorted = list => list.slice().sort((a, b) => a.title.localeCompare(b.title));
    if (cat === 'all' && !ql) {
      listEl.replaceChildren(...cats.concat(shown.some(r => !r.category) ? [''] : []).map(c => {
        const inCat = sorted(shown.filter(r => (r.category || '') === c));
        return inCat.length && h('section', { class: 'group' },
          h('h2', { class: 'group-title' }, c || 'Uncategorized', h('span', { class: 'count' }, inCat.length)),
          h('div', { class: 'list' }, inCat.map(r => row(r, false))));
      }).filter(Boolean));
    } else {
      listEl.replaceChildren(h('div', { class: 'list' }, sorted(shown).map(r => row(r, cat === 'saved' || !!ql))));
    }
  }
  draw();
}

export function openRecipe(id, ctx) {
  const r = findRecipe(id);
  if (!r) return;
  const saved = store.data.recipes.saved;
  const heart = h('button', { class: 'btn', type: 'button', onclick: toggleSaved });
  function drawHeart() {
    const on = saved.includes(r.id);
    heart.classList.toggle('on', on);
    heart.setAttribute('aria-pressed', String(on));
    heart.replaceChildren(icon('heart', 18), on ? 'Saved' : 'Save');
  }
  function toggleSaved() {
    const i = saved.indexOf(r.id);
    if (i >= 0) saved.splice(i, 1);
    else saved.push(r.id);
    store.save('recipes');
    drawHeart();
  }
  drawHeart();

  const meta = [r.category, r.source && (r.page ? `${r.source}, p. ${r.page}` : r.source), isMine(r) && 'My recipe']
    .filter(Boolean).join(' · ');
  const method = r.method || [];
  const s = sheet({
    title: r.title,
    content: [
      meta && h('p', { class: 'quiet' }, meta),
      r.yield && h('p', null, r.yield),
      r.ingredients && r.ingredients.length > 0 && h('section', { class: 'recipe-part' },
        h('h3', null, 'Ingredients'),
        h('ul', { class: 'ingredients' }, r.ingredients.map(i => h('li', null, i)))),
      method.length > 0 && h('section', { class: 'recipe-part' },
        h('h3', null, 'Method'),
        method.length > 1 ? h('ol', { class: 'method' }, method.map(m => h('li', null, m))) : h('p', null, method[0])),
      r.notes && h('section', { class: 'recipe-part' }, h('h3', null, 'Notes'), h('p', { class: 'pre' }, r.notes)),
    ],
    footer: [
      isMine(r) && confirmBtn('Delete', 'Tap again to delete', () => {
        const d = store.data.recipes;
        d.mine = d.mine.filter(x => x !== r);
        d.saved = d.saved.filter(x => x !== r.id);
        store.save('recipes');
        s.close();
      }),
      isMine(r) && h('button', { class: 'btn', type: 'button', onclick: () => { s.close(); editRecipe(r, ctx); } }, 'Edit'),
      h('span', { class: 'grow' }),
      heart,
    ],
    onclose: ctx.refresh,
  });
}

function editRecipe(r, ctx) {
  const title = h('input', { type: 'text', id: 'recipe-title', maxlength: '120', value: r ? r.title : '' });
  const category = h('input', { type: 'text', id: 'recipe-category', maxlength: '60', list: 'recipe-cats', placeholder: 'e.g. Meat dishes', value: r ? r.category || '' : '' });
  const ingredients = h('textarea', { id: 'recipe-ingredients', rows: '5', placeholder: 'One per line', value: r ? (r.ingredients || []).join('\n') : '' });
  const method = h('textarea', { id: 'recipe-method', rows: '5', placeholder: 'One step per line', value: r ? (r.method || []).join('\n') : '' });
  const notes = h('textarea', { id: 'recipe-notes', rows: '3', value: r ? r.notes || '' : '' });
  const error = h('p', { class: 'error', role: 'alert', hidden: true }, 'Give the recipe a name.');

  function save() {
    const t = title.value.trim();
    if (!t) {
      error.hidden = false;
      title.focus();
      return;
    }
    const fields = {
      title: t,
      category: category.value.trim(),
      ingredients: lines(ingredients.value),
      method: lines(method.value),
      notes: notes.value.trim(),
    };
    if (r) Object.assign(r, fields);
    else store.data.recipes.mine.push({ id: 'my-' + uid(), ...fields });
    store.save('recipes');
    s.close();
  }

  const s = sheet({
    title: r ? 'Edit recipe' : 'Add recipe',
    content: [
      field('Name', title), error,
      field('Category', category),
      h('datalist', { id: 'recipe-cats' }, categories().map(c => h('option', { value: c }))),
      field('Ingredients', ingredients),
      field('Method', method),
      field('Notes', notes),
    ],
    footer: [h('span', { class: 'grow' }), h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Save')],
    onclose: ctx.refresh,
  });
}
