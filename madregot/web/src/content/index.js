import { GRADE7 } from './grade7.js';
import { GRADE8 } from './grade8.js';
import { parseNum, near, plainNum } from './util.js';

export const TOPICS = [...GRADE7, ...GRADE8];
export const TOPIC = Object.fromEntries(TOPICS.map((t) => [t.id, t]));
export const topicsFor = (grade) => TOPICS.filter((t) => t.grade === String(grade));

/** Generate one item for a topic level, with bookkeeping fields attached. */
export function makeItem(topicId, level, avoidKey) {
  const t = TOPIC[topicId];
  const L = t.levels[Math.min(Math.max(level, 1), t.levels.length) - 1];
  let it; let guard = 0;
  do { it = L.gen(); } while (avoidKey && it.key === avoidKey && guard++ < 10);
  // A misconception can only be diagnosed for an answer that is actually wrong.
  const diag = (u) => (isCorrect(it, u) ? null : it.diag(u));
  return { ...it, diag, topic: topicId, level, levelTitle: L.title };
}

/** Which answer slots an item needs. */
export const slotsFor = (it) => (it.form === 'pt' ? ['x', 'y'] : it.form === 'line' ? ['m', 'b'] : it.form === 'mc' ? [] : ['v']);

/** Read the typed slots into a value; null when something is missing or unreadable. */
export function readAnswer(it, slots) {
  if (it.form === 'mc') return Number.isInteger(slots.choice) ? slots.choice : null;
  if (it.form === 'pt') { const x = parseNum(slots.x); const y = parseNum(slots.y); return x == null || y == null ? null : [x, y]; }
  if (it.form === 'line') { const m = parseNum(slots.m); const b = parseNum(slots.b); return m == null || b == null ? null : { m, b }; }
  return parseNum(slots.v);
}

export function isCorrect(it, u) {
  if (u == null) return false;
  if (it.form === 'mc') return u === it.answer;
  if (it.form === 'pt') return near(u[0], it.answer[0]) && near(u[1], it.answer[1]);
  if (it.form === 'line') return near(u.m, it.answer.m, 0.01) && near(u.b, it.answer.b, 0.01);
  return near(u, it.answer, 0.01);
}

/** Answers as plain text, for the screen and for the AI. */
export function answerText(it, u = it.answer) {
  if (u == null) return '';
  if (it.form === 'mc') { const c = it.choices[u]; return c ? (c.text || c.tex) : ''; }
  if (it.form === 'pt') return `(${plainNum(u[0])}, ${plainNum(u[1])})`;
  if (it.form === 'line') {
    const b = u.b === 0 ? '' : u.b > 0 ? ` + ${plainNum(u.b)}` : ` - ${plainNum(-u.b)}`;
    return `y = ${plainNum(u.m)}x${b}`;
  }
  return plainNum(u);
}

/** The exercise as one line of text for the AI and the teacher. */
export function itemPlain(it) {
  const strip = (s) => String(s || '').replace(/\$/g, '');
  const fig = it.fig?.type === 'table' ? ` [טבלה: ${it.fig.rows.map((r) => r.join(' → ')).join('; ')}]` : '';
  const choices = it.form === 'mc' ? ` אפשרויות: ${it.choices.map((c) => c.text || c.tex).join(' / ')}` : '';
  return `${strip(it.text)}${it.display ? ` ${it.display}` : ''}${fig}${choices}`.trim();
}

export const COLORS = ['cyan', 'magenta', 'orange', 'green', 'violet', 'ochre'];
