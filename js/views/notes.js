// Notes: free text you want to keep, newest edit first.

import { store } from '../store.js';
import { h, icon, sheet, field, empty, confirmBtn, uid, shortDate, ymd } from '../util.js';

const editedOn = note => (note.updated ? `Edited ${shortDate(ymd(new Date(note.updated)))}` : '');

export function render(root, ctx) {
  const notes = store.data.notes.items.slice().sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));

  root.append(h('div', { class: 'view-head' },
    h('h1', null, 'Notes'),
    h('button', { class: 'btn primary small', type: 'button', onclick: () => edit(null, ctx) }, icon('plus', 18), 'Add note')));

  if (!notes.length) {
    root.append(empty('No notes yet', 'Keep anything here: what worked, what to try next, questions for later.'));
    return;
  }

  root.append(...notes.map(note => {
    // An untitled note is headed by its first line.
    const lines = (note.text || '').split('\n');
    const title = note.title || lines[0] || 'Untitled';
    const body = note.title ? note.text : lines.slice(1).join('\n').trim();
    return h('button', { class: 'note-card', type: 'button', onclick: () => edit(note, ctx) },
      h('span', { class: 'note-title' }, title),
      body && h('span', { class: 'note-text' }, body),
      h('span', { class: 'hint' }, editedOn(note)));
  }));
}

function edit(note, ctx) {
  const data = store.data.notes;
  const title = h('input', { type: 'text', id: 'note-title', maxlength: '100', placeholder: 'Optional', value: note ? note.title || '' : '' });
  const text = h('textarea', { id: 'note-text', rows: '14', placeholder: 'Write your note…', value: note ? note.text || '' : '' });

  function save() {
    const fields = { title: title.value.trim(), text: text.value.replace(/\s+$/, ''), updated: new Date().toISOString() };
    if (!fields.title && !fields.text) {
      if (note) data.items = data.items.filter(n => n !== note); // emptied: nothing left to keep
      else return s.close();
    } else if (note) Object.assign(note, fields);
    else data.items.push({ id: uid(), ...fields });
    store.save('notes');
    s.close();
  }
  function remove() {
    data.items = data.items.filter(n => n !== note);
    store.save('notes');
    s.close();
  }

  const s = sheet({
    title: note ? 'Edit note' : 'Add note',
    content: [field('Title', title), field('Note', text)],
    footer: [note && confirmBtn('Delete', 'Tap again to delete', remove), h('span', { class: 'grow' }),
      h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Save')],
    onclose: ctx.refresh,
  });
}
