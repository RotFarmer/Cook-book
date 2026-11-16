// Food log: what you ate and when, with an amount if you want one: grams for most foods,
// a count for eggs. No calories, no macros.

import { store } from '../store.js';
import { h, icon, sheet, field, dateNav, empty, confirmBtn, today, nowTime, fmtTime, dayName, uid } from '../util.js';
import { FOOD_GROUPS } from '../data/foods.js';

let date = today();
const keyFor = d => 'log-' + d.slice(0, 7);

export function render(root, ctx) {
  const key = keyFor(date);
  const head = h('div', { class: 'view-head' },
    h('h1', null, 'Food log'),
    h('button', { class: 'btn primary small', type: 'button', onclick: () => edit(null, ctx) }, icon('plus', 18), 'Log food'));
  root.append(head, dateNav(date, d => { date = d; ctx.refresh(); }));

  if (!store.has(key)) {
    const note = h('p', { class: 'quiet center' }, 'Opening this month…');
    root.append(note);
    const wanted = date;
    store.ensure(key).then(
      () => { if (head.isConnected && date === wanted) ctx.refresh(); },
      () => {
        if (!head.isConnected) return;
        note.replaceWith(h('div', { class: 'empty' },
          h('p', { class: 'empty-title' }, 'This month could not be opened'),
          h('p', { class: 'empty-text' }, 'Check your connection, then try again.'),
          h('button', { class: 'btn', type: 'button', onclick: ctx.refresh }, 'Try again')));
      });
    return;
  }

  const entries = (store.data[key].days[date] || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  if (!entries.length) {
    root.append(empty(
      `Nothing logged for ${dayName(date).toLowerCase()}`,
      'Log each meal with the time you ate it.'));
    return;
  }
  root.append(h('div', { class: 'list' }, entries.map(e =>
    h('button', { class: 'row', type: 'button', onclick: () => edit(e, ctx) },
      h('span', { class: 'row-time' }, fmtTime(e.time)),
      h('span', { class: 'row-main' },
        h('span', null, e.foods.map(f => withGrams(e, f)).join(' · ')),
        e.note && h('span', { class: 'row-note' }, e.note))))));
}

// Eggs are counted, not weighed: "Raw eggs", "Egg yolks", "Duck eggs", and any food of your
// own with "egg" or "yolk" in its name.
const isCounted = food => /\b(eggs?|yolks?)\b/i.test(food);

// "Raw milk 250 g" or "Raw eggs ×3" when an amount was logged, otherwise just the name.
// An egg entry made before eggs were counted keeps the grams it was logged with.
function withGrams(entry, food) {
  if (entry.counts && entry.counts[food]) return `${food} ×${entry.counts[food]}`;
  if (entry.grams && entry.grams[food]) return `${food} ${entry.grams[food]} g`;
  return food;
}

// Most-logged foods in the months that are open, for quick picking.
function recentFoods() {
  const counts = new Map();
  for (const [key, doc] of Object.entries(store.data)) {
    if (!key.startsWith('log-')) continue;
    for (const list of Object.values(doc.days)) {
      for (const e of list) for (const f of e.foods) counts.set(f, (counts.get(f) || 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f]) => f);
}

function edit(entry, ctx) {
  const key = keyFor(date);
  const settings = store.data.settings;
  const draft = entry
    ? { time: entry.time, foods: [...entry.foods], note: entry.note || '', grams: { ...(entry.grams || {}) }, counts: { ...(entry.counts || {}) } }
    : { time: date === today() ? nowTime() : '12:00', foods: [], note: '', grams: {}, counts: {} };
  let q = '';

  const timeIn = h('input', { type: 'time', id: 'food-time', value: draft.time });
  const noteIn = h('input', { type: 'text', id: 'food-note', maxlength: '200', placeholder: 'Optional', value: draft.note });
  const searchIn = h('input', {
    type: 'search', id: 'food-search', placeholder: 'Search foods', autocomplete: 'off', 'aria-label': 'Search foods',
    oninput: e => { q = e.target.value.trim(); drawPicker(); },
  });
  const selectedEl = h('div', { class: 'stack tight' });
  const pickerEl = h('div', { class: 'picker' });
  const saveBtn = h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Save');

  function toggle(name) {
    const i = draft.foods.indexOf(name);
    if (i >= 0) draft.foods.splice(i, 1);
    else draft.foods.push(name);
    drawSelected();
    drawPicker();
  }

  function drawSelected() {
    // One line per chosen food: its name, an optional amount, and a way to take it off again.
    // The amount is grams, except for eggs, which are counted.
    selectedEl.replaceChildren(...(draft.foods.length
      ? draft.foods.map((f, i) => {
        const counted = isCounted(f);
        const amounts = counted ? draft.counts : draft.grams;
        const unit = counted ? (/yolk/i.test(f) ? 'yolks' : 'eggs') : 'g';
        return h('div', { class: 'sel-row' },
          h('span', { class: 'sel-name' }, f),
          h('input', {
            type: 'number', class: 'grams', id: `food-grams-${i}`, inputmode: 'numeric', min: '0', max: counted ? '99' : '9999', step: '1',
            placeholder: unit, 'aria-label': counted ? `Number of ${unit} (optional)` : `Grams of ${f} (optional)`, value: amounts[f] || '',
            oninput: e => {
              const n = Math.round(parseFloat(e.target.value));
              if (n > 0) amounts[f] = n;
              else delete amounts[f];
              if (counted && n > 0) delete draft.grams[f]; // a count replaces grams logged earlier
            },
          }),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Remove ${f}`, onclick: () => toggle(f) }, icon('x', 18)));
      })
      : [h('span', { class: 'quiet' }, 'Tap foods below to add them. Amounts are optional: grams, or a count for eggs.')]));
    saveBtn.disabled = !draft.foods.length;
  }

  function drawPicker() {
    const ql = q.toLowerCase();
    const groups = [];
    const recent = ql ? [] : recentFoods();
    if (recent.length) groups.push({ name: 'Often logged', foods: recent });
    if (settings.customFoods.length) groups.push({ name: 'My foods', foods: settings.customFoods });
    groups.push(...FOOD_GROUPS);

    const out = [];
    let exact = false;
    for (const g of groups) {
      const foods = ql ? g.foods.filter(f => f.toLowerCase().includes(ql)) : g.foods;
      if (!foods.length) continue;
      if (foods.some(f => f.toLowerCase() === ql)) exact = true;
      out.push(h('section', { class: 'picker-group' },
        h('h3', null, g.name),
        h('div', { class: 'chips' }, foods.map(f => {
          const on = draft.foods.includes(f);
          return h('button', { class: 'chip' + (on ? ' on' : ''), type: 'button', 'aria-pressed': String(on), onclick: () => toggle(f) }, f);
        }))));
    }
    if (ql && !exact) {
      out.push(h('button', { class: 'chip add', type: 'button', onclick: addCustom }, icon('plus', 14), `Add “${q}” to my foods`));
    }
    pickerEl.replaceChildren(...out);
  }

  function addCustom() {
    const name = q.charAt(0).toUpperCase() + q.slice(1);
    if (!settings.customFoods.includes(name)) {
      settings.customFoods.push(name);
      store.save('settings');
    }
    q = '';
    searchIn.value = '';
    if (!draft.foods.includes(name)) draft.foods.push(name);
    drawSelected();
    drawPicker();
  }

  function save() {
    const doc = store.data[key];
    const time = timeIn.value || draft.time;
    const note = noteIn.value.trim();
    const grams = {};
    const counts = {};
    for (const f of draft.foods) {
      if (draft.grams[f] > 0) grams[f] = draft.grams[f];
      if (draft.counts[f] > 0) counts[f] = draft.counts[f];
    }
    if (entry) Object.assign(entry, { time, foods: draft.foods, note, grams, counts });
    else (doc.days[date] ||= []).push({ id: uid(), time, foods: draft.foods, note, grams, counts });
    store.save(key);
    s.close();
    ctx.refresh();
  }

  function remove() {
    const doc = store.data[key];
    const left = (doc.days[date] || []).filter(e => e.id !== entry.id);
    if (left.length) doc.days[date] = left;
    else delete doc.days[date];
    store.save(key);
    s.close();
    ctx.refresh();
  }

  const s = sheet({
    title: entry ? 'Edit entry' : 'Log food',
    content: [
      h('div', { class: 'field-row' }, field('Time', timeIn), field('Note', noteIn)),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'What you ate'), selectedEl),
      searchIn,
      pickerEl,
    ],
    footer: [entry && confirmBtn('Delete', 'Tap again to delete', remove), h('span', { class: 'grow' }), saveBtn],
  });
  drawSelected();
  drawPicker();
}
