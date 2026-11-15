// Lists: things to do and things to buy, ticked off as you go.

import { store } from '../store.js';
import { h, icon, empty, confirmBtn, uid, toast } from '../util.js';

const KINDS = [
  { id: 'todo', label: 'To do', placeholder: 'Add something to do', none: 'Nothing to do', hint: 'Add tasks above and tick them off when they are done.' },
  { id: 'buy', label: 'To buy', placeholder: 'Add something to buy', none: 'Nothing to buy', hint: 'Add what you need above and tick it off as you shop.' },
];
let kind = 'todo';

export function render(root, ctx) {
  const data = store.data.lists;
  const k = KINDS.find(x => x.id === kind);
  const items = data[kind];
  const open = items.filter(it => !it.done);
  const done = items.filter(it => it.done);

  const input = h('input', { type: 'text', id: 'list-new', maxlength: '160', placeholder: k.placeholder, 'aria-label': k.placeholder, autocomplete: 'off' });
  const add = e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    items.push({ id: uid(), text, done: false });
    store.save('lists');
    ctx.refresh();
    const again = document.getElementById('list-new');
    if (again) again.focus();
  };

  const row = it => {
    const el = h('div', { class: 'row middle todo' + (it.done ? ' on' : '') },
      h('button', {
        class: 'todo-main', type: 'button', role: 'checkbox', 'aria-checked': String(it.done),
        onclick: () => { it.done = !it.done; store.save('lists'); ctx.refresh(); },
      }, h('span', { class: 'egg' }), h('span', { class: 'row-main' }, it.text)),
      confirmBtn([icon('trash', 18)], 'Delete?', () => {
        data[kind] = data[kind].filter(x => x !== it);
        store.save('lists');
        ctx.refresh();
      }, 'icon-btn danger'));
    return el;
  };

  root.append(
    h('div', { class: 'view-head' },
      h('h1', null, 'Lists'),
      h('div', { class: 'segs', role: 'group', 'aria-label': 'Which list' }, KINDS.map(x => {
        const left = data[x.id].filter(it => !it.done).length;
        return h('button', {
          class: 'seg wide' + (kind === x.id ? ' on' : ''), type: 'button', 'aria-pressed': String(kind === x.id),
          onclick: () => { kind = x.id; ctx.refresh(); },
        }, x.label, left > 0 && h('span', { class: 'count' }, left));
      }))),
    h('form', { class: 'add-row', onsubmit: add }, input, h('button', { class: 'btn primary', type: 'submit' }, 'Add')));

  if (!items.length) {
    root.append(empty(k.none, k.hint));
    return;
  }
  if (open.length) root.append(h('div', { class: 'list' }, open.map(row)));
  else root.append(h('p', { class: 'quiet center' }, 'Everything is ticked off.'));
  if (done.length) {
    root.append(h('section', { class: 'group' },
      h('h2', { class: 'group-title' }, 'Done', h('span', { class: 'count' }, done.length), h('span', { class: 'grow' }),
        h('button', {
          class: 'btn small quiet-btn', type: 'button',
          onclick: () => {
            data[kind] = data[kind].filter(it => !it.done);
            store.save('lists');
            toast('Cleared');
            ctx.refresh();
          },
        }, 'Clear done')),
      h('div', { class: 'list' }, done.map(row))));
  }
}
