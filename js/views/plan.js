// Meal plan: what you intend to eat on each day of the week.

import { store } from '../store.js';
import { h, icon, sheet, field, empty, confirmBtn, fmtTime, today, weekdayIndex, uid, toast } from '../util.js';
import { allRecipes, findRecipe, openRecipe } from './recipes.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
let day = weekdayIndex(today());

const itemsFor = d => store.data.plan.days[d] || [];
const byTime = (a, b) => (a.time || '99').localeCompare(b.time || '99');

export function render(root, ctx) {
  const todayIdx = weekdayIndex(today());
  const items = itemsFor(day).slice().sort(byTime);

  root.append(
    h('div', { class: 'view-head' },
      h('h1', null, 'Meal plan'),
      h('button', { class: 'btn primary small', type: 'button', onclick: () => edit(null, ctx) }, icon('plus', 18), 'Add meal')),
    h('div', { class: 'week', role: 'group', 'aria-label': 'Day of the week' }, DAYS.map((name, i) =>
      h('button', {
        class: 'weekday' + (i === day ? ' on' : '') + (i === todayIdx ? ' today' : ''),
        type: 'button', 'aria-pressed': String(i === day),
        'aria-label': name + (i === todayIdx ? ' (today)' : '') + `, ${itemsFor(i).length} planned`,
        onclick: () => { day = i; ctx.refresh(); },
      },
        h('span', { class: 'weekday-name' }, name.slice(0, 3)),
        h('span', { class: 'dot' + (itemsFor(i).length ? ' full' : '') })))));

  if (!items.length) {
    root.append(empty(`Nothing planned for ${DAYS[day]}`, 'Add the meals you want to eat, with a time if you like.'));
    return;
  }

  root.append(
    h('div', { class: 'list' }, items.map(it => {
      const recipe = it.recipeId && findRecipe(it.recipeId);
      return h('button', { class: 'row', type: 'button', onclick: () => edit(it, ctx) },
        h('span', { class: 'row-time' }, it.time ? fmtTime(it.time) : '—'),
        h('span', { class: 'row-main' },
          h('span', null, it.title),
          it.note && h('span', { class: 'row-note pre' }, it.note),
          recipe && h('span', { class: 'row-note' }, `Recipe: ${recipe.title}`)));
    })),
    h('button', { class: 'btn quiet-btn', type: 'button', onclick: () => copyDay(ctx) }, icon('copy', 18), `Copy ${DAYS[day]} to other days`));
}

function edit(item, ctx) {
  const recipes = allRecipes();
  const time = h('input', { type: 'time', id: 'plan-time', value: item ? item.time || '' : '' });
  const title = h('input', { type: 'text', id: 'plan-title', maxlength: '120', placeholder: 'e.g. Raw milk with honey', value: item ? item.title : '' });
  const note = h('textarea', { id: 'plan-note', rows: '3', placeholder: 'Amounts, reminders…', value: item ? item.note || '' : '' });
  const recipe = recipes.length > 0 && h('select', { id: 'plan-recipe', value: item && findRecipe(item.recipeId) ? item.recipeId : '' },
    h('option', { value: '' }, 'None'),
    recipes.slice().sort((a, b) => a.title.localeCompare(b.title)).map(r => h('option', { value: r.id }, r.title)));
  const error = h('p', { class: 'error', role: 'alert', hidden: true }, 'Say what the meal is.');

  function save() {
    const t = title.value.trim();
    if (!t) {
      error.hidden = false;
      title.focus();
      return;
    }
    const fields = { time: time.value, title: t, note: note.value.trim(), recipeId: recipe ? recipe.value : (item && item.recipeId) || '' };
    if (item) Object.assign(item, fields);
    else (store.data.plan.days[day] ||= []).push({ id: uid(), ...fields });
    store.save('plan');
    s.close();
    ctx.refresh();
  }

  function remove() {
    store.data.plan.days[day] = itemsFor(day).filter(x => x !== item);
    store.save('plan');
    s.close();
    ctx.refresh();
  }

  const linked = item && findRecipe(item.recipeId);
  const s = sheet({
    title: item ? `Edit ${DAYS[day]} meal` : `Add to ${DAYS[day]}`,
    content: [
      field('Meal', title), error,
      field('Time', time, 'Leave empty if the time does not matter.'),
      field('Details', note),
      recipe && field('Recipe', recipe),
      linked && h('button', { class: 'btn', type: 'button', onclick: () => openRecipe(linked.id, ctx) }, icon('book', 18), 'Open recipe'),
    ],
    footer: [item && confirmBtn('Delete', 'Tap again to delete', remove), h('span', { class: 'grow' }),
      h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Save')],
  });
}

function copyDay(ctx) {
  const boxes = DAYS.map((name, i) => i !== day && h('label', { class: 'check' },
    h('input', { type: 'checkbox', id: `copy-day-${i}`, value: String(i), checked: true }), name)).filter(Boolean);

  function copy() {
    const targets = boxes.map(b => b.firstChild).filter(c => c.checked).map(c => c.value);
    if (!targets.length) return;
    for (const t of targets) {
      store.data.plan.days[t] = itemsFor(day).map(it => ({ ...it, id: uid() }));
    }
    store.save('plan');
    s.close();
    ctx.refresh();
    toast(`Copied to ${targets.length} ${targets.length === 1 ? 'day' : 'days'}`);
  }

  const s = sheet({
    title: `Copy ${DAYS[day]}`,
    content: [
      h('p', { class: 'quiet' }, `${DAYS[day]}'s meals replace whatever is planned on the days you pick.`),
      h('div', { class: 'checks' }, boxes),
    ],
    footer: [h('span', { class: 'grow' }), h('button', { class: 'btn primary', type: 'button', onclick: copy }, 'Copy')],
  });
}
