// Meal plan: a few blocks of your own text, one per meal. Tick a block when you have eaten it.
// The ticks start fresh every day; the text stays until you edit it.

import { store } from '../store.js';
import { h, icon, sheet, field, empty, confirmBtn, today, monthDay, fmtTime, uid } from '../util.js';

// An earlier version planned each weekday separately. Carry the fullest day over as blocks.
function migrate(plan) {
  if (!plan.days) return;
  const fullest = Object.values(plan.days).sort((a, b) => b.length - a.length)[0] || [];
  if (!plan.blocks.length && fullest.length) {
    plan.blocks = fullest
      .slice().sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
      .map(it => ({ id: uid(), title: [it.time && fmtTime(it.time), it.title].filter(Boolean).join(' · '), text: it.note || '' }));
  }
  delete plan.days;
  store.save('plan');
}

// Today's ticks; anything ticked on an earlier day no longer counts.
function ticks(plan) {
  if (!plan.checked || plan.checked.date !== today()) plan.checked = { date: today(), ids: [] };
  return plan.checked.ids;
}

export function render(root, ctx) {
  const plan = store.data.plan;
  migrate(plan);
  const blocks = plan.blocks;
  const done = ticks(plan);

  root.append(h('div', { class: 'view-head' },
    h('h1', null, 'Meal plan'),
    h('button', { class: 'btn primary small', type: 'button', onclick: () => edit(null, ctx) }, icon('plus', 18), 'Add block')));

  if (!blocks.length) {
    root.append(empty('No meal plan yet',
      'Add a block for each meal and write what you plan to eat. Tick the blocks off through the day; they clear again tomorrow.'));
    return;
  }

  const summary = h('p', { class: 'quiet', 'aria-live': 'polite' });
  const drawSummary = () => {
    const n = blocks.filter(b => done.includes(b.id)).length;
    summary.textContent = `Today, ${monthDay(today())} · ${n === blocks.length ? 'all done' : `${n} of ${blocks.length} done`}`;
  };

  root.append(summary, ...blocks.map((b, i) => {
    const on = done.includes(b.id);
    const name = b.title || `Meal ${i + 1}`;
    const card = h('section', { class: 'block' + (on ? ' on' : '') });
    const tick = h('button', {
      class: 'block-tick', type: 'button', role: 'checkbox', 'aria-checked': String(on), 'aria-label': `${name} eaten`,
      onclick: () => {
        const ids = ticks(plan);
        const at = ids.indexOf(b.id);
        if (at >= 0) ids.splice(at, 1);
        else ids.push(b.id);
        store.save('plan');
        card.classList.toggle('on', at < 0);
        tick.setAttribute('aria-checked', String(at < 0));
        drawSummary();
      },
    }, h('span', { class: 'egg' }));
    card.append(
      h('div', { class: 'block-head' },
        tick,
        h('h2', null, name),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Edit ${name}`, onclick: () => edit(b, ctx) }, icon('pencil', 20))),
      b.text
        ? h('p', { class: 'block-text pre' }, b.text)
        : h('p', { class: 'block-text quiet' }, 'Nothing written yet. Tap the pencil to add your plan.'));
    return card;
  }));
  drawSummary();
}

function edit(block, ctx) {
  const plan = store.data.plan;
  const title = h('input', { type: 'text', id: 'block-title', maxlength: '80', placeholder: 'e.g. Breakfast', value: block ? block.title || '' : '' });
  const text = h('textarea', { id: 'block-text', rows: '12', placeholder: 'What you plan to eat, amounts, reminders…', value: block ? block.text || '' : '' });

  function save() {
    const fields = { title: title.value.trim(), text: text.value.replace(/\s+$/, '') };
    if (block) Object.assign(block, fields);
    else plan.blocks.push({ id: uid(), ...fields });
    store.save('plan');
    s.close();
  }
  function remove() {
    plan.blocks = plan.blocks.filter(b => b !== block);
    store.save('plan');
    s.close();
  }
  function move(by) {
    const i = plan.blocks.indexOf(block);
    const j = i + by;
    if (j < 0 || j >= plan.blocks.length) return;
    [plan.blocks[i], plan.blocks[j]] = [plan.blocks[j], plan.blocks[i]];
    store.save('plan');
    drawMoves();
  }
  const moves = h('div', { class: 'btn-row' });
  function drawMoves() {
    const i = plan.blocks.indexOf(block);
    moves.replaceChildren(
      h('button', { class: 'btn small', type: 'button', disabled: i === 0, onclick: () => move(-1) }, icon('up', 18), 'Move up'),
      h('button', { class: 'btn small', type: 'button', disabled: i === plan.blocks.length - 1, onclick: () => move(1) }, icon('down', 18), 'Move down'));
  }
  if (block) drawMoves();

  const s = sheet({
    title: block ? 'Edit block' : 'Add block',
    content: [
      field('Name', title, 'Optional.'),
      field('Plan', text),
      block && plan.blocks.length > 1 && moves,
    ],
    footer: [block && confirmBtn('Delete', 'Tap again to delete', remove), h('span', { class: 'grow' }),
      h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Save')],
    onclose: ctx.refresh,
  });
}
