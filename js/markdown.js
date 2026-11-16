// A small Markdown renderer for notes. It builds page elements directly (never HTML text), so
// whatever is typed in a note can only ever show up as text.
//
// Supported, as in standard Markdown:
//   # / ## / ### heading      headings (the # marks are not shown)
//   **bold**   *italic*       also nested, and ***both***
//   ---                       a divider line (*** and ___ work too)
//   * item   - item   + item  bullet lists; indent a line to nest it
//   1. item                   numbered lists
// Anything else is a paragraph; single line breaks inside a paragraph are kept.

import { h } from './util.js';

const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^(\s*)[*\-+]\s+(.*)$/;
const NUMBER = /^(\s*)(\d{1,4})[.)]\s+(.*)$/;
// ***both***, then **bold**, then *italic*; an asterisk with a space after it is just an asterisk.
const INLINE = /\*\*\*(\S(?:[\s\S]*?\S)?)\*\*\*|\*\*(\S(?:[\s\S]*?\S)?)\*\*|\*([^\s*](?:[^*]*?[^\s*])?)\*/g;

/** Text with **bold** and *italic* turned into elements. Returns a list of nodes and strings. */
export function inline(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(h('strong', null, h('em', null, inline(m[1]))));
    else if (m[2] !== undefined) out.push(h('strong', null, inline(m[2])));
    else out.push(h('em', null, inline(m[3])));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** The note as page elements. */
export function renderMarkdown(text) {
  const blocks = [];
  let para = null; // lines of the paragraph being collected
  let list = null; // {el, ordered} for the list being collected

  const endPara = () => {
    if (!para) return;
    const kids = [];
    para.forEach((line, i) => {
      if (i) kids.push(h('br'));
      kids.push(...inline(line));
    });
    blocks.push(h('p', null, kids));
    para = null;
  };
  const endList = () => { list = null; };
  const item = (ordered, indent, content, start) => {
    endPara();
    if (!list || list.ordered !== ordered) {
      const el = h(ordered ? 'ol' : 'ul', ordered && start !== 1 ? { start: String(start) } : null);
      blocks.push(el);
      list = { el, ordered };
    }
    const depth = Math.min(4, Math.floor(indent.replace(/\t/g, '  ').length / 2));
    list.el.append(h('li', depth ? { class: 'md-nest', style: { '--depth': String(depth) } } : null, inline(content)));
  };

  for (const line of String(text || '').split('\n')) {
    let m;
    if (!line.trim()) {
      endPara();
      endList();
    } else if (RULE.test(line)) {
      endPara();
      endList();
      blocks.push(h('hr'));
    } else if ((m = line.match(HEADING))) {
      endPara();
      endList();
      // The sheet's own title is an h2, so note headings start one level below it.
      const level = Math.min(3, m[1].length);
      blocks.push(h('h' + (level + 2), { class: 'md-h' + level }, inline(m[2])));
    } else if ((m = line.match(BULLET))) {
      item(false, m[1], m[2]);
    } else if ((m = line.match(NUMBER))) {
      item(true, m[1], m[3], Number(m[2]));
    } else {
      endList();
      (para ||= []).push(line.trim());
    }
  }
  endPara();
  return blocks;
}

/** The same text with the formatting marks taken out, for titles and short previews. */
export function plainText(text) {
  return String(text || '').split('\n').map(line => {
    if (RULE.test(line)) return '';
    let m;
    if ((m = line.match(HEADING))) line = m[2];
    else if ((m = line.match(BULLET))) line = '• ' + m[2];
    return line.replace(INLINE, (all, both, bold, italic) => plainText(both !== undefined ? both : bold !== undefined ? bold : italic));
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
