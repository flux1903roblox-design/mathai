import { GRADE7 } from './grade7.js';
import { GRADE8 } from './grade8.js';
import { parseNum, near, plainNum, linText } from './util.js';
import { LESSONS } from './lessons.js';
import { manipCorrect, manipText, manipPlain, panWords, tilesWords, rayText, areaTex } from './manip.js';

import { NEW_CATS } from '@/learn/content/index.ts';

// Each topic's misconception names include those the 2.0 teaching content adds.
export const TOPICS = [...GRADE7, ...GRADE8].map((t) => ({ ...t, cats: { ...t.cats, ...(NEW_CATS[t.id] || {}) }, lesson: t.lesson || LESSONS[t.id] || null }));
export const TOPIC = Object.fromEntries(TOPICS.map((t) => [t.id, t]));
export const topicsFor = (grade) => TOPICS.filter((t) => t.grade === String(grade));
/**
 * Two optional flags a topic may carry:
 *   placement: false   the first-day placement test skips it (it is taught later in the school year, so a new student
 *                      would only meet questions never taught); it starts at stair 1, and the unit jump test is there
 *                      for a student who already knows it
 *   alsoFor: ['8']     Exam Rescue offers it to that grade too (a grade 8 test can revise grade 7 equations)
 */
export const placementTopicsFor = (grade) => topicsFor(grade).filter((t) => t.placement !== false);
/** The topics Exam Rescue offers a grade: its own, then those of another grade that are revised in it. */
export const rescueTopicsFor = (grade) => [...topicsFor(grade), ...TOPICS.filter((t) => t.grade !== String(grade) && (t.alsoFor || []).includes(String(grade)))];

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

// Answer forms: 'num' (one number), 'pt' (a point), 'line' (y = mx + b), 'lin' (an expression kx + c: two typed
// slots, the coefficient and the constant; item.var is the letter, x by default), 'mc' (a choice), 'manip' (an object).
/** Which answer slots an item needs. */
export const slotsFor = (it) => (it.form === 'pt' ? ['x', 'y'] : it.form === 'line' ? ['m', 'b'] : it.form === 'lin' ? ['k', 'c'] : it.form === 'mc' || it.form === 'manip' ? [] : ['v']);

/** Read the typed slots into a value; null when something is missing or unreadable. */
export function readAnswer(it, slots) {
  if (it.form === 'mc') return Number.isInteger(slots.choice) ? slots.choice : null;
  if (it.form === 'pt') { const x = parseNum(slots.x); const y = parseNum(slots.y); return x == null || y == null ? null : [x, y]; }
  if (it.form === 'line') { const m = parseNum(slots.m); const b = parseNum(slots.b); return m == null || b == null ? null : { m, b }; }
  if (it.form === 'lin') { const k = parseNum(slots.k); const c = parseNum(slots.c); return k == null || c == null ? null : { k, c }; }
  return parseNum(slots.v);
}

export function isCorrect(it, u) {
  if (u == null) return false;
  if (it.form === 'manip') return manipCorrect(it, u);
  if (it.form === 'mc') return u === it.answer;
  if (it.form === 'pt') return near(u[0], it.answer[0]) && near(u[1], it.answer[1]);
  if (it.form === 'line') return near(u.m, it.answer.m, 0.01) && near(u.b, it.answer.b, 0.01);
  if (it.form === 'lin') return typeof u === 'object' && near(u.k, it.answer.k, 0.01) && near(u.c, it.answer.c, 0.01);
  return near(u, it.answer, 0.01);
}

/** Answers as plain text, for the screen and for the AI. */
export function answerText(it, u = it.answer) {
  if (u == null) return '';
  if (it.form === 'manip') return manipText(it, u);
  if (it.form === 'mc') { const c = it.choices[u]; return c ? (c.text || c.tex) : ''; }
  if (it.form === 'pt') return `(${plainNum(u[0])}, ${plainNum(u[1])})`;
  // Statistics answers are means and medians: they read as decimals, as in the worked solution.
  if (it.form === 'line') {
    const b = u.b === 0 ? '' : u.b > 0 ? ` + ${plainNum(u.b)}` : ` - ${plainNum(-u.b)}`;
    return `y = ${plainNum(u.m)}x${b}`;
  }
  // an expression as a student writes it: 5x + 4, x - 3, -x, 7
  if (it.form === 'lin') return linText(u, it.var || 'x');
  return plainNum(u, { decimal: it.topic === 'stats' });
}

/** A display that states something itself (an equation, an inequality, a system) is shown as it is. */
const STATES = /=|<|>|\\(?:le|ge|ne|leq|geq|neq|begin)\b/;
/** The question's maths as shown: "3 + (-5) = ?" asks for a value; "3x + 5 = x + 11" and choices stand alone. */
export const displayTex = (it) => (!it.display ? '' : it.form === 'mc' || STATES.test(it.display) ? it.display : `${it.display} = \\,?`);

/** The exercise as one line of text for the AI and the teacher. */
/** The drawing in words, so the AI (and an answer key) sees every number the student saw. */
export function figPlain(f) {
  if (!f) return '';
  const pt = (p) => `${p.label || ''}(${p.x}, ${p.y})`;
  const kinds = { corresponding: 'מתאימות', alternate: 'מתחלפות', cointerior: 'חד־צדדיות' };
  switch (f.type) {
    case 'table': return `טבלה: ${f.rows.map((r) => r.join(' → ')).join('; ')}`;
    case 'coord': return [
      f.points?.length ? `נקודות: ${f.points.map(pt).join(', ')}` : '',
      f.line ? `ישר y = ${f.line.m}x + ${f.line.b}` : '',
      f.polygon ? `מצולע: ${f.polygon.map(([x, y]) => `(${x}, ${y})`).join(' ')}` : '',
    ].filter(Boolean).join('; ');
    case 'linear': return `זוויות צמודות: זווית נתונה ${f.a}°`;
    case 'cross': return `ישרים נחתכים: זווית נתונה ${f.a}°, הזווית המבוקשת ${f.target === 'vertical' ? 'קודקודית לה' : 'צמודה לה'}`;
    case 'parallel': return `ישרים מקבילים וחותך: זווית נתונה ${f.a}°, הזווית המבוקשת ${kinds[f.kind] || ''} לה`;
    case 'triangle': return `משולש${f.iso ? ' שווה־שוקיים' : ''}: ${f.angles.map((x, i) => (f.show[i] ? `${x}°` : '?')).join(', ')}${f.exterior ? '; מבקשים זווית חיצונית ליד הזווית החסרה' : ''}`;
    case 'right': return `משולש ישר־זווית: ניצב ${f.a}, ניצב ${f.b}, יתר ${f.c}`;
    case 'ladder': return `סולם: גובה על הקיר ${f.wall}, מרחק מהקיר ${f.foot}, אורך הסולם ${f.len}`;
    case 'scale': return `מאזניים: בכף השמאלית ${panWords(f.left.x, f.left.n)}, בכף הימנית ${panWords(f.right.x, f.right.n)}; ${!f.tilt ? 'המאזניים מאוזנים' : f.tilt < 0 ? 'הכף השמאלית למטה' : 'הכף הימנית למטה'}`;
    case 'area': return `מלבן: גובה ${f.a}, אורך ${f.b ? `x ועוד ${f.b}` : 'x'}${f.areas ? `; שטחי החלקים ${plainNum(f.a)}x ו־${plainNum(f.a * f.b)}, השטח כולו ${areaTex(f)}` : ''}`;
    case 'ray': return `ציר מספרים: עיגול ${f.closed ? 'מלא' : 'ריק'} ב־${plainNum(f.at)} וקרן ${f.dir > 0 ? 'ימינה' : 'שמאלה'} (${rayText(f)})`;
    case 'tiles': return `אריחים: ${tilesWords(f)}`;
    default: return '';
  }
}

/** The question as the app shows it, for people: text with $...$ math, the expression, the drawing in words. */
export function itemMath(it) {
  const desc = figPlain(it.fig);
  return `${it.text || ''}${it.display ? ` $${it.display}$` : ''}${desc ? ` [${desc}]` : ''}`.trim();
}

export function itemPlain(it) {
  const strip = (s) => String(s || '').replace(/[$\u2066\u2069]/g, '');
  const desc = figPlain(it.fig);
  const fig = desc ? ` [${desc}]` : '';
  const choices = it.form === 'mc' ? ` אפשרויות: ${it.choices.map((c) => c.text || c.tex).join(' / ')}` : '';
  const manip = it.form === 'manip' ? ` ${manipPlain(it)}` : '';
  return `${strip(it.text)}${it.display ? ` ${it.display}` : ''}${fig}${choices}${manip}`.trim();
}

export const COLORS = ['sky', 'fuchsia', 'petrol', 'cobalt', 'violet'];
