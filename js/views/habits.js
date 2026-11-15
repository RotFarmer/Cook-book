// Daily habits: tick them off, one egg per habit.

import { store } from '../store.js';
import { h, icon, sheet, dateNav, empty, confirmBtn, today, addDays, weekdayIndex, shortDate, parseYmd, uid } from '../util.js';

let date = today();
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long' });

function doneCount(d) {
  const { list, done } = store.data.habits;
  const ids = done[d] || [];
  return list.filter(x => ids.includes(x.id)).length;
}

export function render(root, ctx) {
  const { list, done } = store.data.habits;
  root.append(
    h('div', { class: 'view-head' },
      h('h1', null, 'Habits'),
      h('button', { class: 'btn small', type: 'button', onclick: () => editHabits(ctx) }, 'Edit habits')),
    dateNav(date, d => { date = d; ctx.refresh(); }));

  if (!list.length) {
    root.append(empty('No habits yet', 'Add the things you want to do every day, like getting sunlight or going for a walk.',
      h('button', { class: 'btn primary', type: 'button', onclick: () => editHabits(ctx) }, 'Add habits')));
    return;
  }

  // The week around the chosen day: the yolk grows with how much of that day is done.
  const monday = addDays(date, -weekdayIndex(date));
  const eggs = {};
  const week = h('div', { class: 'week', role: 'group', 'aria-label': 'This week' }, LETTERS.map((letter, i) => {
    const d = addDays(monday, i);
    const egg = eggs[d] = h('span', { class: 'egg mini', style: { '--fill': String(doneCount(d) / list.length) } });
    return h('button', {
      class: 'weekday' + (d === date ? ' on' : '') + (d === today() ? ' today' : ''),
      type: 'button', 'aria-pressed': String(d === date),
      'aria-label': `${dayFmt.format(parseYmd(d))} ${shortDate(d)}: ${doneCount(d)} of ${list.length} done`,
      onclick: () => { date = d; ctx.refresh(); },
    }, h('span', { class: 'weekday-name' }, letter), egg);
  }));

  const summary = h('p', { class: 'quiet center', 'aria-live': 'polite' });
  const drawSummary = () => {
    const n = doneCount(date);
    summary.textContent = n === list.length ? `All ${list.length} done` : `${n} of ${list.length} done`;
    eggs[date].style.setProperty('--fill', String(n / list.length));
  };

  const rows = list.map(habit => {
    const on = (done[date] || []).includes(habit.id);
    const row = h('button', {
      class: 'row habit' + (on ? ' on' : ''), type: 'button', role: 'checkbox', 'aria-checked': String(on),
      onclick: () => {
        const ids = done[date] ||= [];
        const i = ids.indexOf(habit.id);
        if (i >= 0) ids.splice(i, 1);
        else ids.push(habit.id);
        if (!ids.length) delete done[date];
        store.save('habits');
        row.classList.toggle('on', i < 0);
        row.setAttribute('aria-checked', String(i < 0));
        drawSummary();
      },
    }, h('span', { class: 'egg' }), habit.emoji && h('span', { class: 'emoji', 'aria-hidden': 'true' }, habit.emoji),
      h('span', { class: 'row-main' }, habit.name));
    return row;
  });

  root.append(week, h('div', { class: 'list' }, rows), summary);
  drawSummary();
}

function editHabits(ctx) {
  const data = store.data.habits;
  const listEl = h('div', { class: 'stack tight' });
  const emojiIn = h('input', { type: 'text', class: 'emoji-in', id: 'habit-new-emoji', maxlength: '8', placeholder: '🙂', 'aria-label': 'Emoji for the new habit' });
  const nameIn = h('input', { type: 'text', id: 'habit-new', maxlength: '60', placeholder: 'New habit', 'aria-label': 'New habit' });

  function move(i, by) {
    const j = i + by;
    if (j < 0 || j >= data.list.length) return;
    [data.list[i], data.list[j]] = [data.list[j], data.list[i]];
    store.save('habits');
    draw();
  }

  function draw() {
    listEl.replaceChildren(...data.list.map((habit, i) => h('div', { class: 'edit-row' },
      h('input', {
        type: 'text', class: 'emoji-in', id: `habit-emoji-${habit.id}`, maxlength: '8', placeholder: '🙂',
        'aria-label': `Emoji for ${habit.name}`, value: habit.emoji || '',
        onchange: e => {
          habit.emoji = e.target.value.trim();
          store.save('habits');
        },
      }),
      h('input', {
        type: 'text', id: `habit-${habit.id}`, maxlength: '60', 'aria-label': 'Habit name', value: habit.name,
        onchange: e => {
          const v = e.target.value.trim();
          if (v) habit.name = v;
          else e.target.value = habit.name;
          store.save('habits');
        },
      }),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Move ${habit.name} up`, disabled: i === 0, onclick: () => move(i, -1) }, icon('up', 18)),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Move ${habit.name} down`, disabled: i === data.list.length - 1, onclick: () => move(i, 1) }, icon('down', 18)),
      confirmBtn([icon('trash', 18)], 'Delete?', () => {
        data.list.splice(i, 1);
        store.save('habits');
        draw();
      }, 'icon-btn danger'))));
    if (!data.list.length) listEl.append(h('p', { class: 'quiet' }, 'No habits yet. Add your first one below.'));
  }

  function addHabit(e) {
    e.preventDefault();
    const v = nameIn.value.trim();
    if (!v) return;
    data.list.push({ id: uid(), name: v, emoji: emojiIn.value.trim() });
    store.save('habits');
    nameIn.value = '';
    emojiIn.value = '';
    draw();
    nameIn.focus();
  }

  draw();
  sheet({
    title: 'Edit habits',
    content: [
      h('p', { class: 'quiet' }, 'The small box in front of each habit is for an emoji of your choice.'),
      listEl,
      h('form', { class: 'add-row', onsubmit: addHabit }, emojiIn, nameIn, h('button', { class: 'btn primary', type: 'submit' }, 'Add')),
    ],
    onclose: ctx.refresh,
  });
}
