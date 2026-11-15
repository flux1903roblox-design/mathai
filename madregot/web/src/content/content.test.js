import { describe, it, expect, afterAll } from 'vitest';
import katex from 'katex';
import { TOPICS, TOPIC, topicsFor, makeItem, isCorrect, answerText, itemPlain, readAnswer, answerInput, fairForCheck, testItem, figPlain, namesOf } from './index.js';
import { manipCorrect, manipSolution, manipWrong } from './manip.js';
import { SCENERY } from '@/components/map/Scenery.jsx';
import { parseNum, plainNum, gcd } from './util.js';
import { factsItem } from './frac.js';
import { holds, identical, texToExpr, texRelation, seeded, evaluate, same } from '@/learn/expr.ts';
import { slipOf } from '@/learn/misconceptions.ts';
import * as AW from './area.js';
// the grid object's rules (they register with content/manip.js as the file loads)
import { polyArea, boundsOf, movedPts } from './grid.js';
// boxes and prisms (stage 2, MEASURE-3): their practice layer, and the net object's rules and words it draws with
import * as SW from './solid.js';
import * as CW from './circle.js';
import * as PW from './space.js';
import { PI_AFTER } from './util.js';
import { solidLabels } from './net.js';

/**
 * The maths a student sees, checked as displayed (not from the generator's parameters), for every topic:
 * a number answer whose display is an equation in one letter solves it; an expression answer (form 'lin') equals the
 * expression displayed; a point answer satisfies every equation of a displayed system (\\begin{cases} … \\end{cases}).
 * An item whose display is something else (a table written in TeX, say) sets checkDisplay: false.
 */
function checkDisplayMaths(item) {
  const d = item.display;
  if (!d || item.checkDisplay === false || item.form === 'mc') return;
  const v = item.var || 'x';
  const cases = d.match(/^\\begin\{cases\}([\s\S]*)\\end\{cases\}$/);
  if (cases && item.form === 'pt') {
    for (const row of cases[1].split('\\\\')) expect(holds(row, { x: item.answer[0], y: item.answer[1] }), `${item.key}: (${item.answer}) in ${row}`).toBe(true);
    return;
  }
  // one unknown of a system asked: the item carries the pair (pair, ask), which solves every row, and the answer is its part
  if (cases && item.form === 'num') {
    expect(item.pair, `${item.key}: a system asked for a number needs its pair`).toBeTruthy();
    for (const row of cases[1].split('\\\\')) expect(holds(row, { x: item.pair[0], y: item.pair[1] }), `${item.key}: (${item.pair}) in ${row}`).toBe(true);
    expect(item.answer, item.key).toBe(item.pair[item.ask]);
    return;
  }
  // how many of the listed numbers solve the inequality shown (among), or how many whole numbers solve all of them (whole)
  // (or, with sum, the sum of those that solve it)
  if (item.among) {
    const yes = item.among.filter((n) => holds(d, { x: n }));
    expect(item.sum ? yes.reduce((a, b) => a + b, 0) : yes.length, `${item.key}: ${d} among ${item.among}`).toBe(item.answer);
  }
  if (item.whole) {
    let n = 0; for (let v = -100; v <= 100; v += 1) if (item.whole.every((w) => holds(w, { x: v }))) n += 1;
    expect(n, `${item.key}: whole numbers solving ${item.whole.join(' and ')}`).toBe(item.answer);
  }
  if (item.form === 'num' && /=/.test(d) && !/[<>]|\\(le|ge)/.test(d) && new RegExp(`(^|[^a-z\\\\])${v}([^a-z]|$)`).test(d)) {
    expect(texRelation(d).rel, item.key).toBe('=');
    expect(holds(d, { [v]: item.answer }), `${item.key}: ${v} = ${item.answer} does not solve ${d}`).toBe(true);
  }
  if (item.form === 'lin' && !/[=<>]/.test(d)) {
    expect(identical(texToExpr(d).replace(new RegExp(v, 'g'), 'x'), `${item.answer.k}*x + ${item.answer.c}`), `${item.key}: ${d} is not ${item.answer.k}${v} + ${item.answer.c}`).toBe(true);
  }
}

const RUNS = 300;

// Collect every $...$ chunk and the display expression so KaTeX can check them.
const texChunks = (it) => {
  const out = [];
  const grab = (s) => String(s || '').replace(/\$([^$]+)\$/g, (_, t) => { out.push(t); return ''; });
  grab(it.text); grab(it.hint); (it.solution || []).forEach(grab);
  if (it.display) out.push(it.display);
  (it.choices || []).forEach((c) => c.tex && out.push(c.tex));
  return out;
};

describe('generators', () => {
  for (const t of TOPICS) {
    t.levels.forEach((L, i) => {
      it(`${t.id} level ${i + 1}: ${L.title}`, () => {
        for (let r = 0; r < RUNS; r++) {
          const item = makeItem(t.id, i + 1);
          expect(item.key).toBeTruthy();
          expect(item.hint).toBeTruthy();
          expect(item.solution?.length).toBeGreaterThan(0);
          // The exact answer must be accepted and must not be diagnosed as a mistake (a fraction answer as typed: n and d).
          expect(isCorrect(item, answerInput(item))).toBe(true);
          expect(item.diag(answerInput(item))).toBeNull();
          if (item.form === 'num') {
            expect(Number.isFinite(item.answer)).toBe(true);
            // What we print as the answer parses back to the same value.
            // (an answer with π after its slot is written 25π: the number before π is the answer)
            expect(Math.abs(parseNum(item.after ? answerText(item).replace(/π$/, '') : answerText(item)) - item.answer)).toBeLessThan(0.01);
            // a whole answer is stored whole, and never printed as a fraction over 1 ("3/1")
            if (Math.abs(item.answer - Math.round(item.answer)) < 1e-9) expect(Number.isInteger(item.answer), `${item.key}: ${item.answer}`).toBe(true);
            expect(answerText(item), item.key).not.toMatch(/\/1$/);
          }
          if (item.form === 'mc') expect(item.choices[item.answer]).toBeTruthy();
          // a choice in words is shown as plain text (only `tex` choices are maths), so $...$ in it would show raw
          if (item.form === 'mc') item.choices.forEach((c) => c.text && expect(c.text, item.key).not.toMatch(/\$/));
          checkDisplayMaths(item);
          if (item.form === 'lin') {
            // an expression answer: both parts are numbers, typing them is accepted, and the printed answer is maths
            expect(Number.isFinite(item.answer.k) && Number.isFinite(item.answer.c)).toBe(true);
            expect(isCorrect(item, readAnswer(item, { k: plainNum(item.answer.k), c: plainNum(item.answer.c) }))).toBe(true);
            expect(() => katex.renderToString(answerText(item), { throwOnError: true })).not.toThrow();
          }
          for (const tex of texChunks(item)) {
            expect(() => katex.renderToString(tex, { throwOnError: true })).not.toThrow();
          }
          expect(itemPlain(item).length).toBeGreaterThan(3);
          expect(itemPlain(item)).not.toMatch(/undefined|NaN|\[object/);
          if (item.fig) expect(itemPlain(item)).toMatch(/\[.+\]/);
          // Every diagnosis category the generator can return has Hebrew text.
          const wrong = item.form === 'num' ? item.answer + 1 : null;
          if (wrong != null) { const c = item.diag(wrong); if (c) expect(t.cats[c]).toBeTruthy(); }
        }
      });
    });
  }
});

// Found by the full check of every exercise (November 2026): each case stays fixed.
describe('worked solutions are written as a textbook writes them', () => {
  it('no "1x", no "+ 0" and no fraction over 1 in the linear-function solutions and hints', () => {
    for (const level of [1, 6, 8]) {
      for (let r = 0; r < 400; r += 1) {
        const it = makeItem('line', level);
        const text = [...it.solution, it.hint].join(' ');
        expect(text, it.key).not.toMatch(/(^|[^\d.])1x/);
        expect(text, it.key).not.toMatch(/[+-] 0(?![\d.])/);
        expect(text, it.key).not.toMatch(/\\frac\{[^}]*\}\{1\}/);
      }
    }
  });
  it('every point a figure draws is on its grid', () => {
    TOPICS.forEach((t) => t.levels.forEach((_, i) => {
      for (let r = 0; r < 300; r += 1) {
        const it = makeItem(t.id, i + 1); const f = it.fig;
        if (!f || f.type !== 'coord') continue;
        const pts = [...(f.points || []).map((q) => [q.x, q.y]), ...(f.polygon || []), ...(f.segments || []).flat()];
        pts.forEach(([x, y]) => expect(Math.abs(x) <= f.range && Math.abs(y) <= f.range, `${it.key}: (${x}, ${y})`).toBe(true));
      }
    }));
  });
});

describe('worked solutions say what happened', () => {
  const many = (topic, level, n = 2000) => Array.from({ length: n }, () => makeItem(topic, level));
  it('equal numbers are not "to the left" of each other', () => {
    for (const it of many('signed', 2)) {
      const m = it.key.match(/^sn2:(-?\d+):(-?\d+)$/);
      if (m && m[1] === m[2]) expect(it.solution[0]).not.toMatch(/משמאל/);
    }
  });
  it('a number plus its opposite is zero, with no "sign of the farther one"', () => {
    for (const it of many('signed', 1)) if (it.answer === 0) expect(it.solution.join(' ')).not.toMatch(/הרחוק יותר/);
  });
  it('every rectangle vertex is on the drawn grid', () => {
    for (const lv of [4, 5]) for (const it of many('coord', lv)) {
      const pts = (it.fig?.polygon || []).concat((it.fig?.points || []).map((p) => [p.x, p.y]));
      pts.forEach(([x, y]) => expect(Math.abs(x) <= 6 && Math.abs(y) <= 6, `${it.key}: (${x}, ${y})`).toBe(true));
      if (it.form === 'pt') expect(Math.max(Math.abs(it.answer[0]), Math.abs(it.answer[1])), it.key).toBeLessThanOrEqual(6);
    }
  });
  it('"is it right-angled?" always asks about sides that make a triangle, and its answer is the one the sides give', () => {
    const right = (s) => { const [p, q, r] = [...s].sort((a, b) => a - b); return p * p + q * q === r * r; };
    for (const it of many('pyth', 3)) {
      const sets = it.key.split(':')[1].split(';').map((x) => x.split(',').map(Number));
      expect(sets, it.key).toHaveLength(4);
      sets.forEach((s) => { const [p, q, r] = [...s].sort((a, b) => a - b); expect(p + q > r && q < r, it.key).toBe(true); });
      if (it.key.startsWith('py3w:')) {
        // which one is right-angled: exactly the answer's triangle, or none of them (the fifth choice)
        expect(sets.filter(right).length, it.key).toBe(it.answer === 4 ? 0 : 1);
        if (it.answer < 4) expect(right(sets[it.answer]), it.key).toBe(true);
      } else expect(sets.filter(right).length, it.key).toBe(it.answer); // how many are right-angled
    }
  });
  it('setting the last bar to the mean is "wrote the mean", not "forgot to divide"', () => {
    for (const it of many('stats', 3)) {
      if (!it.key.startsWith('st3b:')) continue;
      const mean = Number(it.key.split(':')[2]);
      if (mean !== it.answer) expect(it.diag(mean), it.key).toBe('mean-as-answer');
    }
  });
});

describe('math checks', () => {
  it('pythagoras answers satisfy a^2 + b^2 = c^2: whole, or a root that is not whole rounded to tenths, or its estimate', () => {
    let roots = 0;
    for (let r = 0; r < RUNS; r++) {
      const h = makeItem('pyth', 1);
      if (h.form === 'manip') expect(h.answer.a ** 2 + h.answer.b ** 2).toBe(h.answer.c ** 2);
      else if (h.key.startsWith('py1e:')) {
        // between which two whole numbers: the smaller one
        const { a, b } = h.fig; const n = a * a + b * b;
        expect(h.answer ** 2 < n && (h.answer + 1) ** 2 > n, h.key).toBe(true);
      } else {
        const { a, b } = h.fig;
        expect(h.exact ** 2).toBeCloseTo(a * a + b * b, 9);
        expect(Math.abs(h.answer - h.exact)).toBeLessThanOrEqual(0.05);
        if (Number.isInteger(h.exact)) expect(h.answer).toBe(h.exact); else { roots += 1; expect(h.answer).toBe(Math.round(h.exact * 10) / 10); }
      }
      const l = makeItem('pyth', 2);
      expect(l.fig.a ** 2 + l.exact ** 2).toBeCloseTo(l.fig.c ** 2, 9);
      expect(Math.abs(l.answer - l.exact)).toBeLessThanOrEqual(0.05);
    }
    expect(roots).toBeGreaterThan(0); // the roots that are not whole really come up
  });
  const pointsIn = (text) => [...text.matchAll(/\((-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  const lineIn = (text) => { const m = text.match(/= (-?\d*)x(?: ([+-]) (\d+))?/); if (!m) return null; const k = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]); return { m: k, b: m[2] ? (m[2] === '-' ? -1 : 1) * Number(m[3]) : 0 }; };
  it('linear: table value is y = mx + b', () => {
    for (let r = 0; r < RUNS; r++) { const t = makeItem('line', 1); if (t.form === 'manip') continue; const L = lineIn(t.text); const x = Number(t.text.match(/x = (-?\d+)\$\?/)[1]); expect(L.m * x + L.b).toBe(t.answer); }
  });
  it('linear: slope from the graph matches the two marked points', () => {
    for (let r = 0; r < RUNS; r++) { const s3 = makeItem('line', 3); const [A, B] = s3.fig.points; expect(Math.abs((B.y - A.y) / (B.x - A.x) - s3.answer)).toBeLessThan(1e-9); }
  });
  it('linear: slope between two points', () => {
    for (let r = 0; r < RUNS; r++) { const s4 = makeItem('line', 4); const [[x1, y1], [x2, y2]] = pointsIn(s4.text); expect(Math.abs((y2 - y1) / (x2 - x1) - s4.answer)).toBeLessThan(1e-9); }
  });
  it('linear: the line passes through the given points', () => {
    for (let r = 0; r < RUNS; r++) { const it2 = makeItem('line', 5); for (const [x, y] of pointsIn(it2.text)) expect(it2.answer.m * x + it2.answer.b).toBe(y); }
  });
  it('linear: axis points lie on the line and on an axis', () => {
    for (let r = 0; r < RUNS; r++) {
      const a = makeItem('line', 6); const L = lineIn(a.text); const [x, y] = a.answer;
      expect(Math.abs(L.m * x + L.b - y)).toBeLessThan(1e-9); expect(x === 0 || y === 0).toBe(true);
    }
  });
  it('linear: triangle area with the axes', () => {
    for (let r = 0; r < RUNS; r++) { const t = makeItem('line', 7); const [, [x0], [, b]] = t.fig.polygon; expect(t.answer).toBe(Math.abs(x0 * b) / 2); }
  });
  it('linear: the meeting point is on both lines', () => {
    for (let r = 0; r < RUNS; r++) {
      const e = makeItem('line', 8); const eqs = [...e.text.matchAll(/y = (-?\d*)x(?: ([+-]) (\d+))?/g)].map((m) => ({ m: m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]), b: m[2] ? (m[2] === '-' ? -1 : 1) * Number(m[3]) : 0 }));
      expect(eqs.length).toBe(2); for (const L of eqs) expect(L.m * e.answer[0] + L.b).toBe(e.answer[1]);
    }
  });
  it('triangle angles sum to 180', () => {
    for (let r = 0; r < RUNS; r++) {
      const t = makeItem('angles', 3);
      if (t.form === 'manip') continue; // the draggable triangle: checked in manip.test.js
      if (t.fig.type === 'triangle') { expect(t.fig.angles.reduce((x, y) => x + y, 0)).toBe(180); continue; }
      // the class's split triangle (CLASSROOM-11): the big triangle ABC as drawn, its angle at C right, all three 180°
      const P = t.fig.pts; const at = (v, p, q) => { const a = [P[p][0] - P[v][0], P[p][1] - P[v][1]]; const b = [P[q][0] - P[v][0], P[q][1] - P[v][1]]; return (Math.acos((a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b))) * 180) / Math.PI; };
      expect(at('C', 'A', 'B'), t.key).toBeCloseTo(90, 6);
      expect(at('A', 'B', 'C') + at('B', 'C', 'A') + at('C', 'A', 'B'), t.key).toBeCloseTo(180, 6);
    }
  });
  it('parses student input', () => {
    expect(parseNum('−3')).toBe(-3);
    expect(parseNum('3/4')).toBe(0.75);
    expect(parseNum('-3/4')).toBe(-0.75);
    expect(parseNum('2,5')).toBe(2.5);
    expect(parseNum('1/0')).toBeNull();
    expect(parseNum('abc')).toBeNull();
  });
});

describe('right-to-left text and answers', () => {
  const LRI = '⁦'; const PDI = '⁩';
  it('lists of numbers in a Hebrew sentence keep their order (left-to-right isolate)', () => {
    let lists = 0;
    for (let r = 0; r < RUNS; r++) {
      for (const [topic, level] of [['stats', 1], ['stats', 2], ['stats', 3], ['stats', 5], ['pyth', 3], ['expr', 1], ['expr', 2], ['sys', 5]]) {
        const it = makeItem(topic, level);
        const list = it.text.match(/\$-?[\d.]+\$(, \$-?[\d.]+\$)+/);
        if (list) { lists += 1; expect(it.text).toContain(LRI + list[0] + PDI); }
        expect(itemPlain(it)).not.toContain(LRI); // the isolate marks never reach the AI text
        expect(itemPlain(it)).not.toContain(PDI);
      }
    }
    expect(lists).toBeGreaterThan(RUNS); // the check really saw lists
  });
  it('statistics answers are shown as decimals, not fractions', () => {
    for (let r = 0; r < RUNS; r++) {
      for (const level of [1, 2, 3, 5]) {
        const it = makeItem('stats', level);
        if (it.form === 'num') expect(answerText(it)).not.toContain('/');
      }
    }
  });
  it('a point answer is named in its question (the answer row shows that letter)', () => {
    let points = 0;
    for (let r = 0; r < 100; r++) {
      for (const t of TOPICS) {
        t.levels.forEach((L, i) => {
          const it = makeItem(t.id, i + 1);
          // a point of a system has no letter (label ''): the answer row is (x, y)
          if (it.form === 'pt' && it.label !== '') { points += 1; expect(it.text).toContain(`$${it.label}$`); }
        });
      }
    }
    expect(points).toBeGreaterThan(100);
  });
});

describe('the displayed maths is checked as the student sees it', () => {
  it('catches an answer that does not solve its equation, or an expression that is not the answer', () => {
    const ok = (it) => expect(() => checkDisplayMaths({ key: 't', ...it })).not.toThrow();
    const bad = (it) => expect(() => checkDisplayMaths({ key: 't', ...it })).toThrow();
    ok({ form: 'num', display: '3x + 5 = x + 11', answer: 3 });
    bad({ form: 'num', display: '3x + 5 = x + 11', answer: 8 });
    ok({ form: 'num', display: '\\frac{x + 1}{3} = 7', answer: 20 });
    ok({ form: 'num', display: 'x : 4 = 3', answer: 12 });
    bad({ form: 'num', display: 'x : 4 = 3', answer: 0.75 }); // dividing again
    ok({ form: 'num', display: '7 - x = 3', answer: 4 });
    bad({ form: 'num', display: '7 - x = 3', answer: -4 }); // the hidden minus
    ok({ form: 'num', display: '-6 - (-9)', answer: 3 }); // not an equation: nothing to check here
    ok({ form: 'lin', display: '2x + 3x + 4', answer: { k: 5, c: 4 } });
    bad({ form: 'lin', display: '9 - 3x + 2x', answer: { k: -5, c: 9 } }); // detachment
    ok({ form: 'lin', display: '4 + 3(n - 1)', var: 'n', answer: { k: 3, c: 1 } });
    ok({ form: 'pt', display: '\\begin{cases} y = 2x - 1 \\\\ x + y = 5 \\end{cases}', answer: [2, 3], label: '' });
    ok({ form: 'num', display: '\\begin{cases} y = 2x - 1 \\\\ x + y = 5 \\end{cases}', answer: 3, pair: [2, 3], ask: 1 });
    bad({ form: 'num', display: '\\begin{cases} y = 2x - 1 \\\\ x + y = 5 \\end{cases}', answer: 2, pair: [2, 3], ask: 1 }); // the other unknown
    bad({ form: 'num', display: '\\begin{cases} y = 2x - 1 \\\\ x + y = 5 \\end{cases}', answer: 3 }); // no pair to check
    ok({ form: 'num', display: '-2x > 6', answer: 2, among: [-5, -4, -3, -2, -1, 0] });
    bad({ form: 'num', display: '-2x > 6', answer: 3, among: [-5, -4, -3, -2, -1, 0] }); // the boundary counted
    ok({ form: 'num', display: 'x > -2,\\quad x \\le 3', answer: 5, whole: ['x > -2', 'x \\le 3'] });
    bad({ form: 'num', display: 'x > -2,\\quad x \\le 3', answer: 6, whole: ['x > -2', 'x \\le 3'] });
    bad({ form: 'pt', display: '\\begin{cases} y = 2x - 1 \\\\ x + y = 5 \\end{cases}', answer: [3, 2], label: '' });
  });
});

describe('expr:1: a typed answer and a chosen one name the same readings of ax (FOLLOWUP-36)', () => {
  const real = Math.random;
  it('the typed questions name plus (3 + x) and coef (x alone), and never a slip of the hand', () => {
    Math.random = seeded(3611);
    const named = new Set();
    try {
      for (let n = 0; n < 4000; n += 1) {
        const it = makeItem('expr', 1);
        const [k, f, a, b, ...rest] = String(it.key).split(':');
        if (k !== 'ex1' && k !== 'ex1t') continue;
        const x = Number(rest.at(-1)); const F = Number(f); const A = Number(a); const B = Number(b);
        const at = (prod) => (F === 1 ? B - prod : B + prod);
        const ans = at(A * x);
        expect(it.answer).toBe(ans);
        for (const [cat, v] of [['plus', at(A + x)], ['coef', at(x)]]) {
          if (v === ans) continue;
          const got = it.diag(v);
          // a number a slip of the hand also gives (6x + 5 at x = 1 read as 1 + 5 is one off) names nothing
          if (slipOf(v, ans)) { expect(got, `${it.key} ${v}`).toBe(null); continue; }
          if (got === cat) named.add(cat);
          // another error may predict the same number first; never a name that does not predict it
          if (got) expect(['concat', 'order', 'neg-sub', 'plus', 'coef']).toContain(got);
        }
      }
    } finally { Math.random = real; }
    expect([...named].sort()).toEqual(['coef', 'plus']);
  });

  it('the choice question never offers −(10a + |x|) for a negative x: every wrong choice is a real reading, and a minus gives nothing away', () => {
    Math.random = seeded(3612);
    let neg = 0;
    try {
      for (let n = 0; n < 3000; n += 1) {
        const it = makeItem('expr', 1);
        if (!String(it.key).startsWith('ex1m:')) continue;
        const [, a, x] = it.key.split(':').map(Number);
        const read = { concat: 10 * a + x, plus: a + x, 'neg-sub': -a * x, coef: x };
        for (const c of it.choices.filter((ch) => !ch.ok)) {
          expect(Number(c.tex), `${it.key} ${c.bug}`).toBe(read[c.bug]);
          if (c.bug === 'concat') expect(x >= 1 && x <= 9, it.key).toBe(true);
        }
        if (x < 0) {
          neg += 1;
          expect(it.choices.filter((ch) => !ch.ok).map((ch) => ch.bug)).toContain('neg-sub');
          // the answer (negative) is never the only choice with a minus
          expect(it.choices.filter((ch) => Number(ch.tex) < 0).length, it.key).toBeGreaterThanOrEqual(2);
        }
      }
    } finally { Math.random = real; }
    expect(neg).toBeGreaterThan(100);
  });
});

describe('a choice is not given away by its look', () => {
  // surface rules a student could use without the maths, each measured over the generators (the council's list):
  // none may pick the right choice much more often than a guess between two
  const plain = (c) => String(c.tex ?? c.text);
  const numOf = (c) => Number(plain(c));
  const pairOf = (c) => plain(c).replace(/[()]/g, '').split(',').map(Number);
  const real = Math.random;
  it('the middle number, the only minus, the swapped twin, the extreme choice, a number tied to the others', () => {
    Math.random = seeded(2611);
    const tally = {}; const add = (k, ok) => { (tally[k] ||= [0, 0]); tally[k][1] += 1; if (ok) tally[k][0] += 1; };
    // a rule that names several choices picks one of them at random (its expected share is counted)
    const share = (k, win, ans) => { (tally[k] ||= [0, 0]); tally[k][1] += 1; if (win.includes(ans)) tally[k][0] += 1 / win.length; };
    // expr:1's three readings of ax side by side (FOLLOWUP-36): where the right one stands among them, by size
    const rankOf = (it) => {
      const v = it.choices.map(numOf); const s = [...v].sort((a, b) => a - b);
      add('expr:1 the smallest', v[it.answer] === s[0]); add('expr:1 the middle number', v[it.answer] === s[1]); add('expr:1 the largest', v[it.answer] === s[2]);
    };
    try {
      for (let i = 0; i < 8000; i += 1) {
        const L = 1 + (i % 5);
        for (const topic of ['expr', 'eq', 'sys']) {
          const it = makeItem(topic, L); const k = String(it.key).split(':')[0];
          if (it.form !== 'mc') continue;
          if (k === 'ex1m') rankOf(it);
          if (k === 'ex2m') { const m = it.choices.map((c) => plain(c).includes('-')); share('expr:2 a choice with a minus', m.some(Boolean) ? m.map((x, j) => (x ? j : -1)).filter((j) => j >= 0) : it.choices.map((_, j) => j), it.answer); }
          if (k === 'eq1w' && !/^x\^2|^x\(/.test(it.display)) {
            const v = it.choices.map(numOf); const sc = v.map((x) => (v.includes(-x) && x !== 0 ? 1 : 0) + (v.includes(x + 2) ? 1 : 0) + (v.includes(x - 2) ? 1 : 0));
            const best = Math.max(...sc); share('eq:1 the number whose negative or ±2 is offered', sc.map((s, j) => (s === best ? j : -1)).filter((j) => j >= 0), it.answer);
          }
          if (k === 'sy2w') {
            const ps = it.choices.map(pairOf); const tw = ps.map((p, j) => (ps.some((q) => q[0] === p[1] && q[1] === p[0]) ? j : -1)).filter((j) => j >= 0);
            const d = (j) => ps.reduce((a, q, m) => a + (m === j ? 0 : Math.abs(ps[j][0] - q[0])), 0); const b = Math.min(...tw.map(d));
            share('sys:2 the swapped twin whose x is nearest the others', tw.filter((j) => d(j) === b), it.answer);
          }
          if (k === 'sy5m' || k === 'sy5g') { const v = it.choices.map(numOf); share('sys:5 the largest or the smallest choice', v.map((x, j) => (x === Math.max(...v) || x === Math.min(...v) ? j : -1)).filter((j) => j >= 0), it.answer); }
        }
      }
      // and more of expr:1's choices on their own, so its three ranks are measured on a sample large enough for the
      // tighter limit below (with only the loop's few hundred, one order of the run could pass and another fail)
      for (let i = 0; i < 6000; i += 1) { const it = makeItem('expr', 1); if (String(it.key).startsWith('ex1m:')) rankOf(it); }
    } finally { Math.random = real; }
    Object.entries(tally).forEach(([rule, [ok, n]]) => {
      expect(n, rule).toBeGreaterThan(100);
      const said = `${rule}: ${(100 * ok / n).toFixed(1)}% of ${n}`;
      // the answer of expr:1 is the smallest, the middle or the largest of its three choices about as often each: none
      // of the three ranks is a rule to follow (over 40%), and none is a rule to avoid (under 25%)
      if (rule.startsWith('expr:1 ')) { expect(ok / n, said).toBeLessThan(0.40); expect(ok / n, said).toBeGreaterThan(0.25); return; }
      expect(ok / n, said).toBeLessThan(0.55);
    });
  });
  it('the same question every time is practice only, never a check', () => {
    expect(fairForCheck({ key: 'sy4l:0', fixed: true, topic: 'sys' })).toBe(false);
    expect(fairForCheck({ key: 'eq4f:10x = 3(x + 7)', fixed: true, topic: 'eq' })).toBe(false);
    for (let i = 0; i < 400; i += 1) { expect(testItem('sys', 4).fixed).toBeFalsy(); expect(testItem('eq', 4).fixed).toBeFalsy(); }
  });
});

// STUDENT-1: every unit has its own colour and drawings, and two units side by side never share a colour.
describe('each unit has its own identity', () => {
  const COLOURS = ['sky', 'petrol', 'violet', 'fuchsia', 'cobalt'];
  it('every topic has a unit colour from the five families', () => {
    for (const t of TOPICS) expect(COLOURS, `${t.id}: ${t.color}`).toContain(t.color);
  });
  it('neighbouring units on a grade\'s path have different colours', () => {
    for (const grade of ['7', '8']) {
      const list = topicsFor(grade);
      expect(list.length, `grade ${grade} has units`).toBeGreaterThan(1);
      for (let i = 1; i < list.length; i += 1) expect(list[i].color, `grade ${grade}: ${list[i - 1].id} then ${list[i].id}`).not.toBe(list[i - 1].color);
    }
    // this year's ח׳ path climbs the transformations after percent and the data unit (ALSO_ON_PATH), before the
    // functions: cobalt, violet, fuchsia; and on the ז׳ path they sit between the angles and the expressions
    const g8 = topicsFor('8');
    const at = g8.findIndex((t) => t.id === 'transf');
    expect(g8.slice(at - 2, at + 2).map((t) => `${t.id} ${t.color}`)).toEqual(['pct petrol', 'data cobalt', 'transf violet', 'func fuchsia']);
    const g7 = topicsFor('7');
    const at7 = g7.findIndex((t) => t.id === 'transf');
    expect(g7.slice(at7 - 1, at7 + 2).map((t) => `${t.id} ${t.color}`)).toEqual(['angles petrol', 'transf violet', 'expr cobalt']);
    // ח׳'s congruence and similarity, between statistics and the systems: fuchsia, cobalt, sky, petrol
    const c = g8.findIndex((t) => t.id === 'congr');
    expect(g8.slice(c - 1, c + 3).map((t) => `${t.id} ${t.color}`)).toEqual(['stats fuchsia', 'congr cobalt', 'sim sky', 'sys petrol']);
  });
  it('functions are fuchsia, unlike percent before them (petrol) and linear functions after them (cobalt)', () => {
    expect([TOPIC.pct.color, TOPIC.func.color, TOPIC.line.color]).toEqual(['petrol', 'fuchsia', 'cobalt']);
    expect(SCENERY.func.map((piece) => piece.name)).toEqual(['WalkGraph', 'Stopwatch', 'Candle']);
  });
  // DATA-6: probability (fuchsia) follows systems (petrol); violet would clash with a violet unit after it. Stage 2's
  // Pythagoras in space (May, sky) is the last unit of ח׳, right after it
  it('probability is fuchsia, between systems and Pythagoras in space on the ח׳ path, unlike both', () => {
    const list = topicsFor('8').map((t) => t.id);
    expect(list.slice(-3)).toEqual(['sys', 'prob', 'space']);
    expect(TOPIC.prob.color).toBe('fuchsia');
    expect(TOPIC.sys.color).not.toBe('fuchsia');
    expect(TOPIC.space.color).not.toBe('fuchsia');
  });
  // DATA-4: data's colour is one its neighbours leave. On the ז׳ path it sits between boxes and prisms (stage 2, petrol)
  // and equations (violet), and this year on the ח׳ path between percent (petrol) and the transformations (stage 4,
  // violet; the functions, fuchsia, come after them): sky, fuchsia and cobalt are left. It is cobalt, the colour the
  // stage-3 spec set for the merged paths (it was sky while expressions, cobalt, came right before it; the tally pin of
  // Madi's wardrobe is drawn in the same colour).
  it('data is cobalt, a colour its four neighbours leave, on both paths', () => {
    const near = (g) => { const ids = topicsFor(g).map((x) => x.id); const i = ids.indexOf('data'); return [ids[i - 1], ids[i + 1]]; };
    expect(near('7')).toEqual(['solid', 'eq']);
    expect(near('8')).toEqual(['pct', 'transf']);
    const taken = new Set([...near('7'), ...near('8')].map((id) => TOPIC[id].color));
    expect(COLOURS.filter((c) => !taken.has(c))).toEqual(['sky', 'fuchsia', 'cobalt']);
    expect(TOPIC.data.color).toBe('cobalt');
  });
  it('every topic has three drawings: its emblem and two for beside the path', () => {
    for (const t of TOPICS) {
      expect(SCENERY[t.id], `${t.id} has drawings`).toBeTruthy();
      expect(SCENERY[t.id].length, `${t.id} has three drawings`).toBe(3);
      for (const piece of SCENERY[t.id]) expect(typeof piece, `${t.id}: a drawing is a component`).toBe('function');
    }
  });
});

/**
 * The fractions floor: every answer is the computation its question shows, read back from the TeX the student sees with
 * learn/expr.ts texToExpr (2\frac{1}{2} is a mixed number, 2 + 1/2). A display with no "=" is the answer itself; an
 * equation with a box (\frac{2}{3} = \frac{\square}{12}) holds with the answer in the box; "how much is a/b of N" is
 * a/b · N; a number to put on a line, or a point marked on one, is the answer; the answer of "the largest" is the
 * largest listed number; "larger or smaller than N" agrees with N · x or N : x; the bar's common parts are those of its
 * marks. Returns false when the question shows no computation (nothing to read back).
 */
function checkFracMaths(it) {
  const value = (tex) => evaluate(texToExpr(tex));
  const firstMath = (text) => (String(text || '').match(/\$([^$]+)\$/) || [])[1];
  const listed = (s) => (s.includes('/') ? Number(s.split('/')[0]) / Number(s.split('/')[1]) : Number(s));
  const kind = it.key.split(':')[0];
  if (it.display && it.form !== 'mc') {
    if (it.display.includes('\\square')) expect(holds(it.display.replace('\\square', String(it.answer)), {}), `${it.key}: ${it.display} with ${it.answer}`).toBe(true);
    else expect(same(value(it.display), it.answer), `${it.key}: ${it.display} is ${value(it.display)}, not ${it.answer}`).toBe(true);
    return true;
  }
  const of = String(it.text).match(/^כמה הם \$([^$]+)\$ מ־\$(\d+)\$\?/);
  if (of) { expect(same(value(of[1]) * Number(of[2]), it.answer), `${it.key}: ${of[1]} of ${of[2]} is not ${it.answer}`).toBe(true); return true; }
  if (kind === 'fr4g') {
    const [N] = it.key.split(':').slice(1).map(Number);
    const larger = value(firstMath(it.text)) > N;
    expect(it.choices[it.answer].text.startsWith(larger ? 'גדולה' : 'קטנה'), `${it.key}: ${firstMath(it.text)} against ${N}`).toBe(true);
    return true;
  }
  if (kind === 'fr2b') {
    const list = it.key.slice(5).split(',');
    expect(same(Math.max(...list.map(listed)), it.answer), `${it.key}: the largest is not ${it.answer}`).toBe(true);
    return true;
  }
  if (kind === 'fr2p') {
    const [A, B] = it.key.slice(5).split(',').map(listed);
    expect(it.answer, `${it.key}: which is larger`).toBe(same(A, B) ? 2 : A > B ? 0 : 1);
    return true;
  }
  if (kind === 'fr1r') { expect(same(it.fig.marks[0].x, it.answer), `${it.key}: A is not at ${it.answer}`).toBe(true); return true; }
  if (kind === 'fr1p') { expect(same(value(firstMath(it.text)), it.answer), `${it.key}: ${firstMath(it.text)} is not ${it.answer}`).toBe(true); return true; }
  if (kind === 'fr2o') {
    it.manip.labels.forEach((l, i) => expect(same(value(l), it.answer[i]), `${it.key}: ${l} is not at ${it.answer[i]}`).toBe(true));
    return true;
  }
  if (kind === 'fr3c') {
    expect(it.manip.marks.map((x) => Math.round(1 / x)), `${it.key}: the marks are not 1/${it.answer.of.join(' and 1/')}`).toEqual(it.answer.of);
    return true;
  }
  // signed:6, between which two whole numbers: the chosen pair is consecutive and holds the number asked about
  if (kind === 'sn6b') {
    const v = value(firstMath(it.text)); const [lo, hi] = it.choices[it.answer].tex.match(/-?\d+/g).map(Number);
    expect(hi - lo === 1 && lo < v && v < hi, `${it.key}: ${v} is not between ${lo} and ${hi}`).toBe(true);
    return true;
  }
  if (kind === 'sn6p') { expect(same(value(firstMath(it.text)), it.answer), `${it.key}: ${firstMath(it.text)} is not ${it.answer}`).toBe(true); return true; }
  return false;
}

describe('fractions: every answer is the computation its question shows', () => {
  it('frac:1-4, every kind of question', () => {
    const kinds = new Set(); const checked = new Set();
    for (const level of [1, 2, 3, 4]) {
      for (let r = 0; r < 600; r += 1) {
        const it = makeItem('frac', level); const kind = it.key.split(':')[0];
        kinds.add(kind);
        if (checkFracMaths(it)) checked.add(kind);
      }
    }
    expect([...kinds].filter((k) => !checked.has(k)), 'kinds whose answer nothing reads back').toEqual([]);
    expect(kinds.size).toBeGreaterThanOrEqual(15);
  });
  it('signed:6 (signed fractions and decimals), every kind of question', () => {
    const kinds = new Set(); const checked = new Set();
    for (let r = 0; r < 800; r += 1) {
      const it = makeItem('signed', 6); const kind = it.key.split(':')[0];
      kinds.add(kind);
      if (checkFracMaths(it)) checked.add(kind);
    }
    expect([...kinds].sort()).toEqual(['sn6a', 'sn6b', 'sn6m', 'sn6p', 'sn6s']);
    expect([...kinds].filter((k) => !checked.has(k))).toEqual([]);
  });
  it('catches an answer that is not the computation shown', () => {
    const ok = (it) => expect(() => checkFracMaths({ key: 'x:1', ...it })).not.toThrow();
    const bad = (it) => expect(() => checkFracMaths({ key: 'x:1', ...it })).toThrow();
    ok({ form: 'num', display: '\\frac{1}{3} + \\frac{1}{4}', answer: 7 / 12 });
    bad({ form: 'num', display: '\\frac{1}{3} + \\frac{1}{4}', answer: 2 / 7 }); // tops and bottoms added
    ok({ form: 'num', display: '2\\frac{1}{2} + 1\\frac{3}{4}', answer: 4.25 });
    bad({ form: 'num', display: '2\\frac{1}{2} + 1\\frac{3}{4}', answer: 2.75 }); // 2·½ + 1·¾ read as products
    ok({ form: 'num', display: '\\frac{3}{4} : \\frac{3}{8}', answer: 2 });
    bad({ form: 'num', display: '\\frac{3}{4} : \\frac{3}{8}', answer: 0.5 }); // divided the other way
    ok({ form: 'num', display: '\\frac{2}{3} = \\frac{\\square}{12}', answer: 8 });
    bad({ form: 'num', display: '\\frac{2}{3} = \\frac{\\square}{12}', answer: 11 }); // the same number added
    ok({ form: 'num', text: 'כמה הם $\\frac{3}{4}$ מ־$20$?', answer: 15 });
    bad({ form: 'num', text: 'כמה הם $\\frac{3}{4}$ מ־$20$?', answer: 5 });
    ok({ key: 'fr4g:12:0.8:mul', form: 'mc', text: '$12 \\cdot 0.8$: התוצאה גדולה מ־$12$ או קטנה ממנו?', choices: [{ text: 'גדולה מ־12' }, { text: 'קטנה מ־12' }], answer: 1 });
    bad({ key: 'fr4g:12:0.8:mul', form: 'mc', text: '$12 \\cdot 0.8$: התוצאה גדולה מ־$12$ או קטנה ממנו?', choices: [{ text: 'גדולה מ־12' }, { text: 'קטנה מ־12' }], answer: 0 });
  });
});

describe('a whole answer is a whole number', () => {
  it('fraction division with a whole answer (3/5 : 1/5) stores 3, and the answer row says 3, not 3/1', () => {
    let wholeDiv = 0;
    for (let r = 0; r < 4000; r += 1) {
      const it = makeItem('frac', 4);
      if (it.form !== 'num') continue;
      const whole = Math.abs(it.answer - Math.round(it.answer)) < 1e-9;
      if (whole && it.key.startsWith('fr4v')) wholeDiv += 1;
      if (whole) expect(Number.isInteger(it.answer), `${it.key}: ${it.answer}`).toBe(true);
      expect(answerText(it), it.key).not.toMatch(/\/1$/);
    }
    expect(wholeDiv, 'some divisions came out whole').toBeGreaterThan(0);
  });
  it('plainNum and answerText print a number a hair off a whole number as that whole number', () => {
    expect(plainNum(2.9999999999999996)).toBe('3');
    expect(plainNum(5.000000000000001)).toBe('5');
    expect(plainNum(-0.0000000000001)).toBe('0');
    expect(plainNum(2.9999999999999996, { decimal: true })).toBe('3');
    expect(answerText({ form: 'num', topic: 'frac', answer: 2.9999999999999996 })).toBe('3');
    expect(answerText({ form: 'frac', topic: 'frac', answer: 3 })).toBe('3');
    expect(answerText({ form: 'frac', topic: 'frac', answer: 0.75 })).toBe('3/4');
    expect(answerText({ form: 'frac', topic: 'frac', answer: 3 }, { n: 6, d: 2 })).toBe('6/2'); // what the student typed stays as typed
    expect(plainNum(1.5)).toBe('3/2');
  });
});

describe('multiplication facts (the floor check and /facts)', () => {
  it('a·b or ab : a with a and b from 3 to 9, and every answer is the computation shown', () => {
    const seen = new Set();
    for (let r = 0; r < 600; r += 1) {
      const it = factsItem();
      const [tag, a, b, op] = it.key.split(':');
      expect(tag).toBe('facts');
      expect(Number(a)).toBeGreaterThanOrEqual(3); expect(Number(a)).toBeLessThanOrEqual(9);
      expect(Number(b)).toBeGreaterThanOrEqual(3); expect(Number(b)).toBeLessThanOrEqual(9);
      expect(['mul', 'div']).toContain(op);
      seen.add(op);
      expect(it).toMatchObject({ topic: 'facts', level: 0, form: 'num' });
      expect(same(evaluate(texToExpr(it.display)), it.answer), `${it.key}: ${it.display} is not ${it.answer}`).toBe(true);
      expect(it.answer).toBe(op === 'mul' ? Number(a) * Number(b) : Number(b));
      // every equation in the worked solution is true
      it.solution.forEach((line) => (line.match(/\$([^$]+)\$/g) || []).map((m) => m.slice(1, -1)).filter((m) => m.includes('=')).forEach((m) => expect(holds(m, {}), `${it.key}: ${m}`).toBe(true)));
      expect(isCorrect(it, it.answer)).toBe(true);
      expect(it.diag(it.answer + 1)).toBeNull(); // a missed fact names no misconception
      expect(() => katex.renderToString(it.display, { throwOnError: true })).not.toThrow();
    }
    expect([...seen].sort()).toEqual(['div', 'mul']);
  });
  it('never repeats the question it is asked to avoid', () => {
    for (let r = 0; r < 200; r += 1) { const a = factsItem(); expect(factsItem(a.key).key).not.toBe(a.key); }
  });
});

// Ratio and scale (ratio:1-4): every share adds up to the amount shared and is in the stated ratio, every scale answer
// converts back to the distance given, the legs of "add the same to both" are never equal (equal legs keep 1 : 1), and
// every equation of every worked solution is true (a ratio statement 12 : 18 = 2 : 3 is an equality of quotients).
describe('ratio and scale: the numbers of every question', () => {
  const nums = (key) => key.split(':').slice(1).map(Number);
  const all = (level, n = 800) => Array.from({ length: n }, () => makeItem('ratio', level));
  const unTeX = (m) => m.replace(/\{,\}/g, '').replace(/\\cdot/g, '*');
  let checked = 0;
  const solutionHolds = (it) => it.solution.forEach((line) => (line.match(/\$([^$]+)\$/g) || []).map((m) => unTeX(m.slice(1, -1))).filter((m) => m.includes('=') && !/[a-zA-Z□]|\\square/.test(m.replace(/\\frac/g, ''))).forEach((m) => {
    m.split('=').reduce((a, b) => { expect(same(evaluate(texToExpr(a)), evaluate(texToExpr(b))), `${it.key}: ${m}`).toBe(true); checked += 1; return b; });
  }));
  afterAll(() => expect(checked).toBeGreaterThan(2000));

  it('every share sums to the total and has the stated ratio', () => {
    for (const it of all(2)) {
      const kind = it.key.split(':')[0];
      if (kind === 'ra2s') { const [m, n, T] = nums(it.key); const other = T - it.answer; expect(it.answer * n, it.key).toBe(other * m); expect(it.answer + other).toBe(T); }
      if (kind === 'ra2r') {
        const [m, n, P] = nums(it.key); const half = P / 2; const short = half - it.answer;
        expect(it.answer * Math.min(m, n), it.key).toBe(short * Math.max(m, n)); expect(2 * (it.answer + short)).toBe(P);
      }
      if (kind === 'ra2p') { const [X, Y, P] = nums(it.key); const other = P - it.answer; expect(it.answer * Y, it.key).toBe(other * X); }
      if (kind === 'ra2t') {
        const [m, n, T] = nums(it.key); expect(T % (m + n), it.key).toBe(0); expect(it.choices[it.answer].tex).toBe(`\\frac{${m}}{${m + n}}`);
        expect(m < n, it.key).toBe(true); // every choice is a part smaller than the whole
      }
      solutionHolds(it);
    }
    // ratio:1: the completed ratio is the one in the story, in the order asked, in lowest terms
    for (const it of all(1)) {
      if (it.key.startsWith('ra1:')) {
        const [a, b] = nums(it.key); const p = Number(it.text.match(/\$(\d+) : \\square\$/)[1]);
        expect(a * it.answer, it.key).toBe(b * p); expect(gcd(p, it.answer), it.key).toBe(1);
      }
      if (it.key.startsWith('ra1b:')) { const [n, a, b] = nums(it.key); expect(n % (a + b)).toBe(0); expect(it.answer.value * n).toBeCloseTo((n / (a + b)) * a, 9); }
      solutionHolds(it);
    }
  });

  it('every proportion keeps one ratio, and a table\'s missing value is never printed in it', () => {
    for (const it of all(3)) {
      const kind = it.key.split(':')[0];
      if (kind === 'ra3m') { const [b, a, c] = nums(it.key); expect(it.answer * b, it.key).toBeCloseTo(a * c, 9); }
      if (kind === 'ra3t') {
        const rows = it.fig.rows; const u = rows[0][1] / rows[0][0];
        expect(rows[1][1] / rows[1][0]).toBeCloseTo(u, 9); expect(it.answer).toBeCloseTo(u * rows[2][0], 9);
        expect(rows.flat().filter((v) => v !== '?')).not.toContain(it.answer);
      }
      if (kind === 'ra3p') {
        const per100 = it.fig.rows.map((r) => (r[2] * 100) / r[1]);
        const odd = per100.findIndex((v, i) => per100.filter((w) => same(w, v)).length === 1 && i >= 0);
        expect(odd, it.key).toBe(it.answer);
      }
      solutionHolds(it);
    }
  });

  it('every scale answer converts back to the distance given', () => {
    for (const it of all(4)) {
      const kind = it.key.split(':')[0];
      if (kind === 'ra4r') { const [S, d] = nums(it.key); expect((it.answer * 100) / S, it.key).toBe(d); }
      if (kind === 'ra4m') { const [S, D] = nums(it.key); expect((it.answer * S) / 100, it.key).toBe(D); }
      if (kind === 'ra4f') { const [d, D] = nums(it.key); expect((d * it.answer) / 100000, it.key).toBe(D); }
      if (kind === 'ra4a') { const [k] = nums(it.key); expect(it.answer).toBe(k * k); }
      if (kind === 'ra4b') { const [B, t] = nums(it.key); expect(it.answer).toBe(t); expect((t * B) / 10).toBe((t * it.manip.bottom.max) / it.manip.top.max); }
      // a number of 10,000 or more is written with its thousands grouped: 50{,}000, never 50000
      expect(`${it.text} ${it.solution.join(' ')}`, it.key).not.toMatch(/\d{5,}/);
      solutionHolds(it);
    }
  });

  it('"add the same to both legs" never draws equal legs, so its answer (the ratio changes) is always true', () => {
    let n = 0;
    for (const it of all(1, 2000)) {
      if (!it.key.startsWith('ra1a:')) continue;
      n += 1;
      const [p, q, k] = nums(it.key);
      expect(p, it.key).not.toBe(q);
      expect(p * (q + k), it.key).not.toBe(q * (p + k)); // p : q and (p + k) : (q + k) differ
      expect(it.choices[it.answer].text).toMatch(/^כן/);
    }
    expect(n).toBeGreaterThan(100);
  });
});

// Percent (pct:1-5): every answer is the computation from the numbers the student sees, read back out of the question's
// text (and its table), not from the generator's parameters; and every equation of every worked solution is true (a
// percent is read as hundredths: 35% = 0.35).
describe('percent: every answer from the numbers shown', () => {
  /** The numbers of a question's maths, in order: 35\% is 35, \frac{7}{20} is 0.35, 12{,}000 is 12000. */
  const shown = (text) => (text.match(/\$([^$]+)\$/g) || []).map((m) => {
    const t = m.slice(1, -1).replace(/\\%/g, '').replace(/\{,\}/g, '').trim();
    const f = t.match(/^\\frac\{(\d+)\}\{(\d+)\}$/);
    return f ? Number(f[1]) / Number(f[2]) : Number(t);
  });
  const all = (level, n = 800) => Array.from({ length: n }, () => makeItem('pct', level));
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  let checked = 0;
  const solutionHolds = (it) => it.solution.forEach((line) => (line.match(/\$([^$]+)\$/g) || [])
    .map((m) => m.slice(1, -1).replace(/\{,\}/g, '').replace(/\\cdot/g, '*').replace(/(\d+(?:\.\d+)?)\\%/g, '($1/100)'))
    .filter((m) => m.includes('=') && !/[a-zA-Z□]|\\square/.test(m.replace(/\\frac/g, '')))
    .forEach((m) => {
      m.split('=').reduce((a, b) => { expect(same(evaluate(texToExpr(a)), evaluate(texToExpr(b))), `${it.key}: ${m}`).toBe(true); checked += 1; return b; });
    }));
  afterAll(() => expect(checked).toBeGreaterThan(3000));

  it('pct:1: a fraction or a decimal as a percent, the bar shaded, the vote, a number above 1', () => {
    for (const it of all(1)) {
      const kind = it.key.split(':')[0]; const n = shown(it.text);
      if (kind === 'pc1f' || kind === 'pc1d') { expect(n).toHaveLength(1); expect(it.answer, it.key).toBeCloseTo(100 * n[0], 9); expect(it.unit).toBe('%'); }
      if (kind === 'pc1s') { const [den, p] = n; expect(it.answer.value, it.key).toBeCloseTo(p / 100, 9); expect(Number.isInteger((p * den) / 100), it.key).toBe(true); expect(it.manip.start.den).toBe(den); }
      if (kind === 'pc1e') { const [, p] = n; expect(it.choices[it.answer].text, it.key).toBe(p < 50 ? 'קצת פחות מחצי' : 'קצת יותר מחצי'); expect(p).not.toBe(50); }
      if (kind === 'pc1o') { const [x] = n; expect(it.choices[it.answer].tex, it.key).toBe(`${Math.round(100 * x)}\\%`); }
      solutionHolds(it);
    }
  });

  it('pct:2: p% of N, in the head, and the two classes', () => {
    for (const it of all(2)) {
      const kind = it.key.split(':')[0]; const n = shown(it.text);
      if (kind === 'pc2' || kind === 'pc2m') { const [p, N] = n; expect(it.answer, it.key).toBeCloseTo((p * N) / 100, 9); expect(Number.isInteger(it.answer), it.key).toBe(true); }
      if (kind === 'pc2c') {
        const [n1, p1, n2, p2] = n; const c1 = (n1 * p1) / 100; const c2 = (n2 * p2) / 100;
        expect(Number.isInteger(c1) && Number.isInteger(c2), it.key).toBe(true);
        expect(it.answer, it.key).toBe(c1 > c2 ? 0 : c2 > c1 ? 1 : 2);
      }
      if (kind === 'pc1e') { const [, p] = n; expect(it.choices[it.answer].text).toBe(p < 50 ? 'קצת פחות מחצי' : 'קצת יותר מחצי'); }
      solutionHolds(it);
    }
  });

  it('pct:3: what percent, from the table of volunteers, and this year against last', () => {
    for (const it of all(3)) {
      const kind = it.key.split(':')[0]; const n = shown(it.text);
      if (kind === 'pc3') { const [A, B] = n; expect(it.answer, it.key).toBeCloseTo((100 * A) / B, 9); }
      if (kind === 'pc3g') { const [A, B] = n; expect(A > B, it.key).toBe(true); expect(it.answer).toBeCloseTo((100 * A) / B, 9); expect(it.answer).toBeGreaterThan(100); }
      if (kind === 'pc3t') {
        const [T] = n; const rows = it.fig.rows; const place = rows.find(([name]) => it.text.includes(`ב${name}?`));
        expect(rows.reduce((a, r) => a + r[1], 0), it.key).toBe(T); // the table adds up to everyone
        expect(place, it.key).toBeTruthy();
        expect(it.answer, it.key).toBeCloseTo((100 * place[1]) / T, 9);
      }
      expect(Number.isInteger(it.answer), it.key).toBe(true);
      solutionHolds(it);
    }
  });

  it('pct:4: the whole, from p% and the part (and stretched on the double line)', () => {
    for (const it of all(4)) {
      const kind = it.key.split(':')[0]; const n = shown(it.text);
      const [p, A] = n;
      expect(it.answer, it.key).toBeCloseTo((100 * A) / p, 9);
      expect((p * it.answer) / 100, it.key).toBeCloseTo(A, 9); // the check: p% of the whole is the part
      if (kind === 'pc4s') {
        expect(it.manip.fixT).toBe(p);
        expect(Math.abs((it.answer - it.manip.start.max) % it.manip.bottom.step), it.key).toBe(0);
        expect(it.manip.start.max).not.toBe(it.answer);
        expect(it.answer).toBeLessThanOrEqual(it.manip.bottom.max);
      }
      solutionHolds(it);
    }
  });

  it('pct:5: one change, a rise then a fall, by what percent, and the change from its multiplier', () => {
    let twice = 0;
    for (const it of all(5)) {
      const kind = it.key.split(':')[0]; const n = shown(it.text);
      if (kind === 'pc5') {
        const [N, p] = n; const up = /התייקר ב־/.test(it.text); expect(up || /הוזל ב־/.test(it.text), it.key).toBe(true);
        expect(it.answer, it.key).toBeCloseTo(N * (1 + (up ? p : -p) / 100), 9);
      }
      if (kind === 'pc5w') {
        twice += 1; const [N, p, q] = n; expect(p).toBe(q);
        expect(it.answer, it.key).toBeCloseTo(N * (1 + p / 100) * (1 - p / 100), 9);
        expect(it.answer).toBeLessThan(N); // never the price again
      }
      if (kind === 'pc5b') {
        const [N, M] = n; const up = /בכמה אחוזים התייקר/.test(it.text);
        expect(up, it.key).toBe(M > N);
        expect(it.answer, it.key).toBeCloseTo((100 * Math.abs(M - N)) / N, 9);
      }
      if (kind === 'pc5m') {
        const [m] = n; const right = it.choices[it.answer].text;
        expect(right, it.key).toBe(`${m > 1 ? 'התייקרות' : 'הוזלה'} של ${Math.round(Math.abs(m - 1) * 100)}%`);
      }
      if (it.form === 'num') expect(Number.isInteger(it.answer), it.key).toBe(true);
      solutionHolds(it);
    }
    expect(twice).toBeGreaterThan(80);
  });
});

// Functions (stage5.md FUNC-2): every answer recomputed from what the student sees, the graph in words (figPlain: its
// points, its marked point and its band, as a screen reader reads them) and the numbers of the text, never from the
// generator's parameters.
// Motion problems (eq:6, stage5.md FUNC-3): every answer recomputed from the numbers the student reads (the text, and
// the graph as figPlain writes it), the mover's noun and words agreeing with its speed, and every numeric line of the
// worked solution true.
describe('motion problems (eq:6): every answer from the text\'s own numbers', () => {
  /** The numbers of the text's maths, in order. */
  const shown = (text) => (text.match(/\$([^$]+)\$/g) || []).map((m) => Number(m.slice(1, -1).trim()));
  /** The hours after "כעבור": "שעה" 1, "שעתיים" 2, "$h$ שעות" h. */
  const headStart = (text) => { const m = text.match(/כעבור (שעה|שעתיים|\$(\d+)\$ שעות) יצאה/); return m[2] ? Number(m[2]) : m[1] === 'שעה' ? 1 : 2; };
  /** Every chain "$a = b = c$" of plain arithmetic in the worked solution holds (':' is division). */
  const solutionHolds = (it) => it.solution.forEach((line) => (line.match(/\$([^$]+)\$/g) || []).map((m) => m.slice(1, -1).replace(/\\cdot/g, '*').replace(/:/g, '/'))
    .filter((m) => m.includes('=') && !/[a-zA-Z(]/.test(m.replace(/\\cdot/g, ''))).forEach((m) => { const v = m.split('=').map((x) => evaluate(x)); v.forEach((x) => expect(same(x, v[0]), `${it.key}: ${m}`).toBe(true)); }));

  it('the meeting, the catching up, the round trip, the minutes, the graph and the table', () => {
    const kinds = {};
    for (let i = 0; i < 2000; i += 1) {
      const it = makeItem('eq', 6);
      const [p, kind] = it.key.split(':'); const k = p === 'eq6' ? `eq6:${kind}` : p; kinds[k] = (kinds[k] || 0) + 1;
      const n = shown(it.text);
      if (k === 'eq6:toward') {
        // D first, then the first one's speed and the second's; both movers of one kind, the words agreeing with it
        const [D, v1, v2] = n; const t = D / (v1 + v2);
        expect(Number.isInteger(t) && D <= 450, it.key).toBe(true);
        const bike = v1 <= 30;
        expect(bike === (v2 <= 30), `${it.key}: two movers of one kind`).toBe(true);
        expect(it.text, it.key).toMatch(bike ? /^שני רוכבי אופניים יוצאים .* זה לקראת זה\./ : /^שתי מכוניות יוצאות .* זו לקראת זו\./);
        if (/כעבור כמה שעות ייפגשו\?$/.test(it.text)) { expect(it.answer, it.key).toBe(t); expect(it.unit).toBe('שעות'); }
        else { expect(it.text, it.key).toMatch(bike ? /מהכפר של הראשון ייפגשו\?$/ : /מהעיר של הראשונה ייפגשו\?$/); expect(it.answer, it.key).toBe(v1 * t); expect(it.unit).toBe('ק״מ'); }
      }
      if (k === 'eq6:catch') {
        // a cyclist (up to 30 km/h) or a lorry (40 to 80) first; the car after it, at most 110 km/h
        const [v1, v2] = n.length === 3 ? [n[0], n[2]] : n; const h = headStart(it.text); const t = (v1 * h) / (v2 - v1);
        expect(Number.isInteger(t) && t > 0 && v2 <= 110 && v2 >= 40, it.key).toBe(true);
        expect(it.text, it.key).toMatch(v1 <= 30 ? /^רוכב אופניים יצא .* יצאה אחריו מכונית .* תשיג אותו\?$/ : /^משאית יצאה .* יצאה אחריה מכונית .* תשיג אותה\?$/);
        if (v1 > 30) expect(v1 >= 40 && v1 <= 80, it.key).toBe(true);
        expect(it.answer, it.key).toBe(/כעבור כמה שעות מיציאתה/.test(it.text) ? t : v2 * t);
        expect(it.text, `${it.key}: "$1$ שעות"`).not.toMatch(/\$1\$ שעות/);
      }
      if (k === 'eq6:trip') {
        // there at v1, back at v2, T hours in all: the way one way is T·v1·v2 / (v1 + v2); the verb follows the speed
        const [v1, v2, T] = n; const d = (T * v1 * v2) / (v1 + v2);
        expect(it.answer, it.key).toBe(d);
        expect(Number.isInteger(d / v1) && Number.isInteger(d / v2), it.key).toBe(true);
        expect(it.text.startsWith(v1 <= 6 ? 'הלכו ' : v1 <= 30 ? 'רכבו על אופניים ' : 'נסעו '), it.key).toBe(true);
        expect((v1 <= 6) === (v2 <= 6) && (v1 <= 30) === (v2 <= 30), `${it.key}: one way of moving`).toBe(true);
        if (v1 <= 6) expect(d, `${it.key}: a walk of at most 15 km`).toBeLessThanOrEqual(15);
      }
      if (k === 'eq6u') {
        const [v, t] = n; expect(it.answer, it.key).toBe((v * t) / 60); expect(Number.isInteger(it.answer), it.key).toBe(true);
      }
      if (k === 'eq6g') {
        // the two lines as figPlain writes them; where they cross is a whole hour, on a grid line of distance
        const words = figPlain(it.fig);
        const lines = [...words.matchAll(/מכונית [אב]: \((\d+), (\d+)\) → \((\d+), (\d+)\)/g)].map((m) => m.slice(1).map(Number));
        expect(lines, it.key).toHaveLength(2);
        const [[a0, ay0, a1, ay1], [b0, by0, b1, by1]] = lines;
        const sa = (ay1 - ay0) / (a1 - a0); const sb = (by1 - by0) / (b1 - b0);
        const x = (by0 - ay0) / (sa - sb);
        expect([a0, b0, ay0], it.key).toEqual([0, 0, 0]);
        expect(it.answer, it.key).toBe(x);
        expect(Number.isInteger(x) && x < a1, `${it.key}: they meet at a whole hour inside the graph`).toBe(true);
        expect(Number.isInteger((sa * x) / it.fig.y.step), `${it.key}: the meeting is on a grid line`).toBe(true);
        expect(by1 >= 0 && ay1 <= by0, `${it.key}: both cars still on the road`).toBe(true);
        expect(words, `${it.key}: the words do not say where they meet`).not.toMatch(/נפגשים/);
      }
      if (k === 'eq6t') {
        // exactly one equation holds at the story's x, the right one; the reversed relation is tagged rel-speed
        const ok = it.choices.filter((c) => holds(c.tex, { x: it.solve }));
        expect(ok.length, it.key).toBe(1);
        expect(it.choices[it.answer], it.key).toBe(ok[0]);
        expect(it.choices.filter((c) => c.bug === 'rel-speed'), it.key).toHaveLength(1);
        it.choices.forEach((c, j) => expect(it.diag(j), `${it.key}: ${c.tex}`).toBe(c.bug || null));
      }
      expect(fairForCheck(it), it.key).toBe(k !== 'eq6t');
      if (it.solution) solutionHolds(it);
    }
    // every kind was drawn, in about the spec's mix (50%, 25%, 10%, 15%)
    expect(Object.keys(kinds).sort()).toEqual(['eq6:catch', 'eq6:toward', 'eq6:trip', 'eq6g', 'eq6t', 'eq6u']);
    const motion = (kinds['eq6:toward'] + kinds['eq6:catch'] + kinds['eq6:trip']) / 2000;
    expect(motion > 0.44 && motion < 0.56, `motion ${motion}`).toBe(true);
    expect(kinds.eq6u / 2000).toBeGreaterThan(0.2);
  });
});

// Equations with denominators and proportion (eq:7, stage5.md FUNC-4): every answer substituted back into the equation
// displayed (learn/expr.ts holds), and no other number near it solves it; the mistakes' numbers do not; x in a
// denominator is whole and never a number of the equation; the smallest common denominator is the right choice.
describe('equations with denominators (eq:7): every answer solves the equation displayed', () => {
  it('two fractions, x and a fraction of it, two numerators with a minus, a proportion, x in a denominator, the LCD', () => {
    const kinds = {};
    for (let i = 0; i < 1500; i += 1) {
      const it = makeItem('eq', 7);
      const k = it.key.startsWith('eq7:') ? it.key.split(':').slice(0, 2).join(':') : it.key.split(':')[0]; kinds[k] = (kinds[k] || 0) + 1;
      if (it.form === 'num') {
        expect(holds(it.display, { x: it.answer }), `${it.key}: x = ${it.answer} in ${it.display}`).toBe(true);
        for (const d of [-1, 1, 0.5]) expect(holds(it.display, { x: it.answer + d }), `${it.key}: x = ${it.answer + d} also solves ${it.display}`).toBe(false);
        expect(Number.isInteger(it.answer), it.key).toBe(true);
        // the displayed equation's own numbers are never the answer
        const shown = (it.display.match(/\d+/g) || []).map(Number);
        expect(shown, `${it.key}: the answer is a number of the equation`).not.toContain(it.answer);
        // a mistake's number does not solve the equation (it is a different number)
        for (let u = it.answer - 60; u <= it.answer + 300; u += 1) if (u !== it.answer && it.diag(u)) expect(holds(it.display, { x: u }), `${it.key}: ${u}`).toBe(false);
        expect(fairForCheck(it), it.key).toBe(true);
      }
      if (k === 'eq7:0') expect(it.display, it.key).toMatch(/^\\frac\{x\}\{\d\} \+ \\frac\{x\}\{\d\} = \d+$/);
      if (k === 'eq7:1') expect(it.display, it.key).toMatch(/^x \+ \\frac\{x\}\{\d\} = \d+$/);
      if (k === 'eq7:2') expect(it.display, it.key).toMatch(/^\\frac\{x \+ \d\}\{\d\} - \\frac\{x - \d\}\{\d\} = \d$/);
      if (k === 'eq7p') {
        const [a, b, c, d] = it.key.split(':').slice(1).map(Number);
        expect(it.diag((a + c) / (b - d)), `${it.key}: only x multiplied`).toBe('partial-dist');
      }
      if (k === 'eq7x') {
        // a/x = b/c with b/c in lowest terms, so a/x is not b/c reduced and x is no number printed
        const [a, b, c] = it.key.split(':').slice(1).map(Number);
        expect(gcd(b, c), it.key).toBe(1);
        expect(it.answer, it.key).toBe((a * c) / b);
        expect([a, b, c], it.key).not.toContain(it.answer);
      }
      if (k === 'eq7l') {
        // four different numbers: the lcm (right), the product, the sum and the larger denominator
        const [a, b] = it.key.split(':').slice(1).map(Number); const L = (a * b) / gcd(a, b);
        const vals = it.choices.map((c) => Number(c.tex));
        expect(new Set(vals).size, it.key).toBe(4);
        expect(vals.sort((x, y) => x - y), it.key).toEqual([b, a + b, L, a * b].sort((x, y) => x - y));
        expect(Number(it.choices[it.answer].tex), it.key).toBe(L);
        expect(it.practiceOnly, it.key).toBe(true);
      }
    }
    // every kind was drawn, in about the spec's mix (55%, 20%, 15%, 10%)
    expect(Object.keys(kinds).sort()).toEqual(['eq7:0', 'eq7:1', 'eq7:2', 'eq7l', 'eq7p', 'eq7x']);
    const e7 = (kinds['eq7:0'] + kinds['eq7:1'] + kinds['eq7:2']) / 1500;
    expect(e7 > 0.48 && e7 < 0.62, `e7 ${e7}`).toBe(true);
    expect(kinds.eq7p / 1500).toBeGreaterThan(0.15);
  }, 60_000);
});

describe('functions: every answer from the graph and the text', () => {
  /** The numbers of the text's maths, in order ("18^\circ" is 18). */
  const shown = (text) => (text.match(/\$([^$]+)\$/g) || []).map((m) => Number(m.slice(1, -1).replace(/\^\\circ/g, '').trim()));
  /** The graph as figPlain writes it: its series' points, its lettered point and its band. */
  function read(it) {
    const words = figPlain(it.fig).split('; ');
    const line = words.find((w) => w.includes('→') || w.startsWith('נקודות '));
    const pts = [...line.matchAll(/\((-?[\d.]+), (-?[\d.]+)\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    const mark = words.map((w) => w.match(/^הנקודה A ב־\((-?[\d.]+), (-?[\d.]+)\)$/)).find(Boolean);
    const band = words.map((w) => w.match(/^מסומן על ציר x מ־([\d.]+) עד ([\d.]+)$/)).find(Boolean);
    const every = words.filter((w) => /^ציר [xy] /.test(w)).map((w) => /מספר כל/.test(w));
    return { pts, mark: mark && [Number(mark[1]), Number(mark[2])], band: band && [Number(band[1]), Number(band[2])], every, dots: line.startsWith('נקודות ') };
  }
  /** The y of the polyline at x. */
  const at = (pts, x) => { for (let i = 1; i < pts.length; i += 1) { const [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i]; if (x >= x0 && x <= x1) return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0); } return null; };
  /** Every "$a - b = c$" a solution writes holds. */
  const solutionHolds = (it) => it.solution.forEach((line) => (line.match(/\$([^$]+)\$/g) || []).map((m) => m.slice(1, -1).replace(/\\cdot/g, '*').replace(/:/g, '/'))
    .filter((m) => m.includes('=') && !/[a-zA-Z]/.test(m)).forEach((m) => { const [a, b] = m.split('='); expect(same(evaluate(a), evaluate(b)), `${it.key}: ${m}`).toBe(true); }));
  const all = (n = 1500) => Array.from({ length: n }, () => makeItem('func', 1));
  const kinds = {};

  it('func:1: the walk, the day\'s temperatures, the flat part, the point A and the story drawn', () => {
    for (const it of all()) {
      const kind = it.key.split(':')[0]; kinds[kind] = (kinds[kind] || 0) + 1;
      if (kind === 'fu1') {
        const { pts, every } = read(it); const n = shown(it.text);
        expect(pts, it.key).toHaveLength(4);
        expect(every, `${it.key}: both axes write a number on every second line`).toEqual([true, true]);
        const [[, y0], [x1, y1], [x2, y2], [x3, y3]] = pts;
        expect([y0, y3, y1 === y2, y1 > 0], it.key).toEqual([0, 0, true, true]); // out, a rest, home
        if (/^כמה מטרים/.test(it.text.split('. ').pop())) { expect(n).toHaveLength(1); expect(it.answer, it.key).toBe(at(pts, n[0])); expect(it.unit).toBe('מטרים'); }
        else if (/במקום\?$/.test(it.text)) { expect(n).toHaveLength(0); expect(it.answer, it.key).toBe(x2 - x1); }
        else { expect(it.text, it.key).toMatch(/הדרך חזרה\?$/); expect(it.answer, it.key).toBe(x3 - x2); }
      }
      if (kind === 'fu1d') {
        const { pts, dots } = read(it); const n = shown(it.text); const T = (h) => pts.find(([x]) => x === h)?.[1];
        expect(dots && pts.length === 8 && pts.every(([x], i) => x === 6 + 2 * i), it.key).toBe(true);
        if (/עלתה מהשעה/.test(it.text)) { const [a, b] = n; expect(it.answer, it.key).toBe(T(b) - T(a)); expect(it.answer).toBeGreaterThan(0); }
        else {
          const [V] = n; const hours = pts.filter(([, y]) => y === V).map(([x]) => x);
          expect(hours, `${it.key}: exactly two hours at ${V}`).toHaveLength(2);
          expect(it.answer, it.key).toBe(hours[1] - hours[0]);
        }
      }
      if (kind === 'fu1f') {
        const { pts, band } = read(it); const n = shown(it.text);
        expect(band, it.key).toEqual(n);
        expect(at(pts, band[0]), `${it.key}: the band is the flat part`).toBe(at(pts, band[1]));
        expect(at(pts, (band[0] + band[1]) / 2), it.key).toBe(at(pts, band[0]));
        expect(it.choices[it.answer].text, it.key).toMatch(/^עמדה? במקום$/);
      }
      if (kind === 'fu1p') {
        const { pts, mark } = read(it);
        // which of the five parts A lies on: inside a segment, never at a corner
        const seg = pts.findIndex((p, i) => i > 0 && mark[0] > pts[i - 1][0] && mark[0] < p[0]);
        expect(seg, it.key).toBeGreaterThan(0);
        expect(at(pts, mark[0]), `${it.key}: A is on the graph`).toBe(mark[1]);
        const right = it.choices[it.answer].text;
        expect(right, it.key).toMatch([/בדרך לחנות$/, /בחנות$/, /בדרך מהחנות אל /, /אצל /, /בדרך חזרה הביתה$/][seg - 1]);
        expect([2, 4].includes(seg) === (pts[seg - 1][1] === pts[seg][1]), `${it.key}: the stops are the flat parts`).toBe(true);
      }
      if (kind === 'fu1s') {
        // the story's parts in order, each with its minutes ("התרחקה מהבית במשך $10$ דקות"): two segments of 5 minutes
        // that go the same way are one part of 10, never the same clause twice in a row
        const parts = [...it.text.matchAll(/(התרחקה?|עמדה? במקום|התקרבה?)[^$]*\$(\d+)\$ דקות/g)]
          .map((m) => ({ d: /במקום/.test(m[1]) ? 'flat' : /התקרב/.test(m[1]) ? 'down' : 'up', n: Number(m[2]) / 5 }));
        expect(parts.length, it.key).toBeGreaterThanOrEqual(2);
        parts.forEach((p, j) => { if (j) expect(p.d, `${it.key}: one part told twice in a row`).not.toBe(parts[j - 1].d); });
        expect(parts.reduce((n, p) => n + p.n, 0), it.key).toBe(3);
        expect(it.answer.shape, it.key).toEqual(parts.flatMap((p) => Array(p.n).fill(p.d)));
        expect(it.text, it.key).toMatch(/^קודם /);
        expect(manipCorrect(it, manipSolution(it)), it.key).toBe(true);
        expect(manipCorrect(it, it.manip.start), `${it.key}: starts on the goal`).toBe(false);
        expect(it.practiceOnly, it.key).toBe(true);
      }
      if (['fu1', 'fu1d'].includes(kind)) { expect(Number.isInteger(it.answer), it.key).toBe(true); expect(fairForCheck(it), it.key).toBe(true); }
      else expect(fairForCheck(it), `${it.key}: a choice or a named shape is practice only`).toBe(false);
      solutionHolds(it);
    }
    // every kind was drawn, in about the spec's mix (55%, 20%, 10%, 10%, 5%)
    expect(Object.keys(kinds).sort()).toEqual(['fu1', 'fu1d', 'fu1f', 'fu1p', 'fu1s']);
    expect(kinds.fu1 / 1500).toBeGreaterThan(0.45);
  });

  /** A table as figPlain writes it: its rows, each [x, y]. */
  const rowsOf = (fig) => figPlain(fig).replace(/^טבלה: /, '').split('; ').map((r) => r.split(' → ').map(Number));
  /** A TeX table x | y as the choices write it: its xs and ys. */
  const texRows = (tex) => { const [xr, yr] = tex.replace(/\\(begin|end)\{array\}(\{[^}]*\})?/g, '').split('\\\\ \\hline'); const cells = (r) => r.split('&').slice(1).map((v) => Number(v.trim())); return [cells(xr), cells(yr)]; };

  it('func:2: the price rule, Fahrenheit, a table, which table is a function, and a table drawn', () => {
    const kinds2 = {};
    for (let i = 0; i < 1500; i += 1) {
      const it = makeItem('func', 2);
      const kind = it.key.split(':')[0]; kinds2[kind] = (kinds2[kind] || 0) + 1;
      if (kind === 'fu2') {
        // the rule as the text writes it, and the number asked about (the last number of the text)
        const [, m, b] = it.text.match(/\$y = (\d+)x \+ (\d+)\$/).map(Number); const n = shown(it.text).filter(Number.isFinite).pop();
        if (/כמה (עולה|עולים) /.test(it.text)) { expect(it.answer, it.key).toBe(m * n + b); expect(it.unit).toBe('ש״ח'); }
        else { expect(it.text, it.key).toMatch(/(עלה|עלתה|שילמו) \$\d+\$ ש״ח/); expect(m * it.answer + b, it.key).toBe(n); expect(Number.isInteger(it.answer) && it.answer > 0).toBe(true); }
      }
      if (kind === 'fu2c') {
        expect(it.text, it.key).toContain('$F = 1.8C + 32$');
        const n = shown(it.text).filter(Number.isFinite).pop();
        if (/כמה מעלות פרנהייט/.test(it.text)) expect(same(it.answer, 1.8 * n + 32), it.key).toBe(true);
        else expect(same(1.8 * it.answer + 32, n), it.key).toBe(true);
        expect(Number.isInteger(it.answer), it.key).toBe(true);
      }
      if (kind === 'fu2t') {
        const rows = rowsOf(it.fig); const n = Number(it.text.match(/\$x = (\d+)\$/)[1]);
        expect(rows.map(([x]) => x), it.key).toEqual([0, 1, 2, 3]);
        const d = rows[1][1] - rows[0][1];
        expect(rows.every(([x, y]) => y === rows[0][1] + d * x), `${it.key}: the table is of y = mx + b`).toBe(true);
        expect(it.answer, it.key).toBe(rows[0][1] + d * n);
        expect([...rows.flat(), n], `${it.key}: the answer is printed`).not.toContain(it.answer);
      }
      if (kind === 'fu2i') {
        // exactly one table gives an x two values, and it is the answer; the constant one is tagged when chosen
        const tables = it.choices.map((c) => texRows(c.tex));
        const notFunction = tables.map(([xs]) => new Set(xs).size < xs.length);
        expect(notFunction.filter(Boolean), it.key).toHaveLength(1);
        expect(notFunction[it.answer], it.key).toBe(true);
        const constant = tables.findIndex(([xs, ys]) => new Set(xs).size === xs.length && ys.every((y) => y === ys[0]));
        expect(constant, it.key).toBeGreaterThanOrEqual(0);
        expect(it.diag(constant), it.key).toBe('const-not-function');
        expect(tables.every(([xs, ys]) => xs.length === 4 && ys.length === 4 && [...xs, ...ys].every(Number.isFinite)), it.key).toBe(true);
      }
      if (kind === 'fu2d') {
        const [xs, ys] = texRows(it.display);
        expect(xs, it.key).toEqual([0, 1, 2, 3]);
        expect(it.answer.values, it.key).toEqual(ys);
        expect(manipCorrect(it, manipSolution(it)), it.key).toBe(true);
        expect(manipCorrect(it, it.manip.start), `${it.key}: starts on the goal`).toBe(false);
      }
      if (['fu2', 'fu2c', 'fu2t'].includes(kind)) expect(fairForCheck(it), it.key).toBe(true);
      else expect(fairForCheck(it), `${it.key}: a choice or a table to copy is practice only`).toBe(false);
      solutionHolds(it);
    }
    // every kind was drawn, in about the spec's mix (45%, 15%, 15%, 15%, 10%)
    expect(Object.keys(kinds2).sort()).toEqual(['fu2', 'fu2c', 'fu2d', 'fu2i', 'fu2t']);
    expect(kinds2.fu2 / 1500).toBeGreaterThan(0.38);
  });

  /** The pieces of a polyline left to right: [from, to, 'up' | 'down' | 'flat']. */
  const pieces = (pts) => pts.slice(1).map(([x, y], i) => [pts[i][0], x, y > pts[i][1] ? 'up' : y < pts[i][1] ? 'down' : 'flat']);
  const DIRS = { עולה: 'up', יורדת: 'down', קבועה: 'flat', יורד: 'down', קבוע: 'flat' };

  it('func:3: a graph\'s intervals, a table\'s hours, which way between two x\'s, and a shape drawn', () => {
    const kinds3 = {};
    for (let i = 0; i < 1500; i += 1) {
      const it = makeItem('func', 3);
      const kind = it.key.split(':')[0]; kinds3[kind] = (kinds3[kind] || 0) + 1;
      if (kind === 'fu3') {
        // the direction asked, and the length of the x axis where the graph goes that way, read left to right
        const { pts } = read(it); const dir = DIRS[it.text.match(/הפונקציה (עולה|יורדת|קבועה)\?$/)[1]];
        const parts = pieces(pts).filter(([, , d]) => d === dir);
        expect(parts, `${it.key}: one interval goes ${dir}`).toHaveLength(1);
        expect(it.answer, it.key).toBe(parts[0][1] - parts[0][0]);
        // the axis is named when a square is more than one unit: the question asks in the x axis's own unit
        const xAxis = figPlain(it.fig).split('; ')[0];
        const unit = xAxis.match(/לפי זמן \((.+)\)$/)?.[1];
        if (unit) expect(it.text, it.key).toContain(`כמה ${unit} `); else expect(it.text, it.key).toContain('כמה יחידות על ציר $x$');
      }
      if (kind === 'fu3t') {
        const rows = rowsOf(it.fig); const hours = rows.map(([h]) => h); const temps = rows.map(([, t]) => t);
        expect(hours.every((h, k) => k === 0 || h > hours[k - 1]), `${it.key}: the hours grow down the table`).toBe(true);
        const k = temps.indexOf(Math.max(...temps));
        expect(temps.every((t, j) => j === 0 || (j <= k ? t > temps[j - 1] : t < temps[j - 1])), `${it.key}: up to one peak, then down`).toBe(true);
        expect(it.answer, it.key).toBe(/עלתה/.test(it.text) ? hours[k] - hours[0] : hours[hours.length - 1] - hours[k]);
        expect(rows.flat(), `${it.key}: the answer is a number of the table`).not.toContain(it.answer);
      }
      if (kind === 'fu3w') {
        const { pts, band } = read(it); const n = [...it.text.matchAll(/\$x = (\d+)\$/g)].map((m) => Number(m[1]));
        expect(band, it.key).toEqual(n);
        const part = pieces(pts).find(([a, b]) => a === band[0] && b === band[1]);
        expect(part, `${it.key}: the band is one piece of the graph`).toBeTruthy();
        expect(DIRS[it.choices[it.answer].text], it.key).toBe(part[2]);
        const swapped = { up: 'down', down: 'up' }[part[2]];
        it.choices.forEach((c, j) => expect(it.diag(j), `${it.key}: ${c.text}`).toBe(DIRS[c.text] === swapped ? 'rtl-read' : null));
      }
      if (kind === 'fu3s') {
        // "עולה עד $x = 2$, קבוע עד $x = 4$, ויורד עד $x = 6$": each part's direction up to its x
        const parts = [...it.text.matchAll(/(עולה|יורד|קבוע) עד \$x = (\d)\$/g)].map((m) => [DIRS[m[1]], Number(m[2])]);
        const shape = parts.flatMap(([d, to], j) => Array(to - (j ? parts[j - 1][1] : 0)).fill(d));
        expect(it.answer.shape, it.key).toEqual(shape);
        expect(manipCorrect(it, manipSolution(it)), it.key).toBe(true);
        expect(manipCorrect(it, it.manip.start), `${it.key}: starts on the goal`).toBe(false);
      }
      if (['fu3', 'fu3t'].includes(kind)) { expect(Number.isInteger(it.answer), it.key).toBe(true); expect(fairForCheck(it), it.key).toBe(true); }
      else expect(fairForCheck(it), `${it.key}: a choice or a named shape is practice only`).toBe(false);
      solutionHolds(it);
    }
    // every kind was drawn, in about the spec's mix (50%, 20%, 15%, 15%)
    expect(Object.keys(kinds3).sort()).toEqual(['fu3', 'fu3s', 'fu3t', 'fu3w']);
    expect(kinds3.fu3 / 1500).toBeGreaterThan(0.42);
  });

  it('func:4: the pot, the candle, which table is uniform, who is faster, and a rate continued', () => {
    const kinds4 = {};
    /** The minutes or hours a text names after "אחרי": "דקה אחת" and "שעה" are one. */
    const after = (text, unit) => [...text.matchAll(unit === 'min' ? /אחרי (?:\$(\d+)\$ דקות|דקה אחת)/g : /אחרי (?:\$(\d+)\$ שעות|שעה)/g)].map((m) => Number(m[1] || 1));
    for (let i = 0; i < 1500; i += 1) {
      const it = makeItem('func', 4);
      const kind = it.key.split(':')[0]; kinds4[kind] = (kinds4[kind] || 0) + 1;
      if (kind === 'fu4') {
        // s° at the start, v° after T minutes, in the text's own words; every temperature at most 95° (a pot of water)
        const [s, v] = [...it.text.matchAll(/\$(\d+)\^\\circ\$/g)].map((m) => Number(m[1])); const [T, t] = after(it.text, 'min');
        const rate = (v - s) / T;
        expect(Number.isInteger(rate) && rate > 0, it.key).toBe(true);
        if (/בכל דקה\?$/.test(it.text)) expect(it.answer, it.key).toBe(rate);
        else { expect(it.text, it.key).toMatch(/מה תהיה הטמפרטורה אחרי/); expect(it.answer, it.key).toBe(s + rate * t); }
        expect(Math.max(s, v, it.answer), `${it.key}: water in a pot`).toBeLessThanOrEqual(95);
        expect(it.unit).toBe('מעלות');
        expect(it.text, `${it.key}: "$1$ דקות"`).not.toMatch(/\$1\$ דקות/);
      }
      if (kind === 'fu4c') {
        const [h0, h1] = [...it.text.matchAll(/\$(\d+)\$ ס״מ/g)].map((m) => Number(m[1])); const [T] = after(it.text, 'hour');
        const rate = (h0 - h1) / T;
        expect(it.answer, it.key).toBe(h0 / rate);
        expect(Number.isInteger(it.answer) && it.answer > T, it.key).toBe(true);
        expect(it.text, `${it.key}: "$1$ שעות"`).not.toMatch(/\$1\$ שעות/);
      }
      if (kind === 'fu4u') {
        // exactly one table has equal differences in y, and it is the answer
        const tables = it.choices.map((c) => texRows(c.tex));
        const uniform = tables.map(([xs, ys]) => { const d = ys.slice(1).map((y, k) => y - ys[k]); return xs.every((x, k) => x === k) && d.every((v) => v === d[0]); });
        expect(uniform.filter(Boolean), it.key).toHaveLength(1);
        expect(uniform[it.answer], it.key).toBe(true);
        expect(new Set(tables.map(([, ys]) => ys.join())).size, `${it.key}: four different tables`).toBe(4);
      }
      if (kind === 'fu4f') {
        // the right choice names the runner whose line is steeper, and that line is the lower one all the way; the
        // graph in words names both runners
        const rise = (s) => (s.pts[1][1] - s.pts[0][1]) / (s.pts[1][0] - s.pts[0][0]);
        const [steep, flat] = [...it.fig.series].sort((a, b) => rise(b) - rise(a));
        expect(rise(steep) > rise(flat), it.key).toBe(true);
        expect(steep.pts.every(([, y], k) => y < flat.pts[k][1]), `${it.key}: the steeper line is the lower one`).toBe(true);
        expect(figPlain(it.fig), it.key).toMatch(/A[^;]*\(0, \d+\)/);
        expect(it.choices[it.answer].text, it.key).toBe(`הרץ ${steep.label}: הקו שלו תלול יותר`);
        it.choices.forEach((c, j) => expect(it.diag(j), `${it.key}: ${c.text}`).toBe(c.text === `הרץ ${flat.label}: הקו שלו גבוה יותר` ? 'height-for-slope' : null));
      }
      if (kind === 'fu4n') {
        // the two minutes the text names are the fixed points; the rest continue at the same rate, at most 95°
        const [v0, v1] = [...it.text.matchAll(/\$(\d+)\^\\circ\$/g)].map((m) => Number(m[1]));
        expect(it.manip.start.slice(0, 2), it.key).toEqual([v0, v1]);
        expect(it.answer.values, it.key).toEqual([0, 1, 2, 3, 4, 5].map((k) => v0 + k * (v1 - v0)));
        expect(Math.max(...it.answer.values), it.key).toBeLessThanOrEqual(95);
        expect(manipCorrect(it, manipSolution(it)), it.key).toBe(true);
        expect(manipCorrect(it, it.manip.start), `${it.key}: starts on the goal`).toBe(false);
      }
      if (['fu4', 'fu4c'].includes(kind)) expect(fairForCheck(it), it.key).toBe(true);
      else expect(fairForCheck(it), `${it.key}: a choice or a rate the text gives is practice only`).toBe(false);
      solutionHolds(it);
    }
    // every kind was drawn, in about the spec's mix (45%, 25%, 15%, 10%, 5%)
    expect(Object.keys(kinds4).sort()).toEqual(['fu4', 'fu4c', 'fu4f', 'fu4n', 'fu4u']);
    expect(kinds4.fu4 / 1500).toBeGreaterThan(0.38);
  });

  it('catches an answer that is not the graph\'s', () => {
    // a seeded source, so the run is the same every time: seed 36 draws the story to draw first (fu1s, a graph the
    // student draws, with no figure to read), which an unseeded single draw met about one run in twenty. Only the items
    // that show a graph are read, and every point they write lies on the line read back.
    const real = Math.random;
    try {
      Math.random = seeded(36);
      const drawn = Array.from({ length: 40 }, () => makeItem('func', 1));
      expect(drawn[0].key, 'the seed starts with the story to draw').toMatch(/^fu1s:/);
      const shown = drawn.filter((it) => it.fig?.type === 'sgraph');
      expect(shown.length).toBeGreaterThan(20);
      for (const it of shown) { const { pts } = read(it); expect(pts.length, it.key).toBeGreaterThan(1); pts.forEach(([x, y]) => expect(at(pts, x), it.key).toBe(y)); }
    } finally { Math.random = real; }
    expect(() => { expect(at([[0, 0], [10, 600], [25, 600], [45, 0]], 5)).toBe(200); }).toThrow();
  });
});

// Areas and perimeters (stage 2, MEASURE-2): the practice and diagnosis layer, tested on the topic object itself
// (content/area.js), the same object GRADE7 puts on the path. Every check reads the question as the student sees it.
describe('areas and perimeters: every practice kind, from the numbers in its text', () => {
  const { AREA, KIND_KEYS, UNIT } = AW;
  /** An item as makeItem gives it: an answer that is right is never a mistake. */
  const areaItem = (level) => {
    const L = AREA.levels[level - 1]; const it = L.gen();
    return { ...it, diag: (u) => (isCorrect(it, u) ? null : it.diag(u)), topic: 'area', level, levelTitle: L.title };
  };
  const all = (level, n = RUNS) => Array.from({ length: n }, () => areaItem(level));
  /** A test that counts how often something is drawn runs on a seeded Math.random, so it never fails by chance. */
  const seededRun = (seed, fn) => () => { const real = Math.random; Math.random = seeded(seed); try { fn(); } finally { Math.random = real; } };
  const kindOf = (it) => it.key.split(':')[0];
  /** Every number of the text's maths, in order: $AB = 6$ is 6, $\sphericalangle B = 90^\circ$ is 90, $2.3$ is 2.3. */
  const shown = (text) => (text.match(/\$([^$]+)\$/g) || []).flatMap((m) => (m.match(/\d+(?:\.\d+)?/g) || []).map(Number));
  /** The corners of a shape on the grid, from the drawing's words (what the screen reader and the tutor read). */
  const corners = (it) => [...figPlain(it.fig).matchAll(/\((\d+), (\d+)\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  const close = (a, b) => Math.abs(a - b) < 1e-9;
  const AREA_UNITS = [UNIT.cm2, UNIT.m2];
  const LENGTH_UNITS = [UNIT.cm, UNIT.m];
  let checked = 0;
  /** Every equation of a worked solution with numbers only holds (a × written \cdot, a division :). */
  const solutionHolds = (it) => it.solution.forEach((line) => (line.match(/\$([^$]+)\$/g) || [])
    .map((m) => m.slice(1, -1).replace(/\\cdot/g, '*').replace(/\\[;,]|\/\{[^}]*\}\d+/g, ' '))
    .filter((m) => m.includes('=') && !/[a-zA-Z□]/.test(m.replace(/\\frac|\\sqrt/g, '')))
    .forEach((m) => {
      m.split('=').reduce((a, b) => { expect(same(evaluate(texToExpr(a)), evaluate(texToExpr(b))), `${it.key}: ${m}`).toBe(true); checked += 1; return b; });
    }));
  afterAll(() => expect(checked).toBeGreaterThan(2000));

  /** The answer computed from the text (and, on a grid, from the corners the drawing's words list). */
  function fromText(it) {
    const n = shown(it.text); const t = it.text;
    switch (kindOf(it)) {
      case 'ar1r': { const [a, b] = n; expect(a >= b, it.key).toBe(true); return /שטח/.test(t) ? a * b : 2 * (a + b); }
      case 'ar1m': { const [X, a] = n; expect(a > it.answer, it.key).toBe(true); return t.startsWith('שטח') ? X / a : X / 2 - a; }
      case 'ar1s': { const [v] = n; return /^מה שטח/.test(t) ? v * v : /^מה היקף/.test(t) ? 4 * v : /^שטח/.test(t) ? Math.sqrt(v) : v / 4; }
      case 'ar2l': { const [ang, a, b] = n; expect(ang).toBe(90); return (a * b) / 2; }
      case 'ar2t': { const [ang, a, b, c] = n; expect(ang).toBe(90); expect(a * a + b * b, it.key).toBe(c * c); return (a * b) / 2; }
      case 'ar2x': {
        const [ang, a, ...rest] = n; const S = rest[rest.length - 1]; const x = (2 * S) / a; expect(ang).toBe(90);
        if (rest.length === 2) expect(a * a + x * x, it.key).toBe(rest[0] * rest[0]); // a hypotenuse is written only when it is whole
        return x;
      }
      case 'ar2g': { const [b, h, s] = n; expect(s > h, it.key).toBe(true); return (b * h) / 2; }
      case 'ar2q': case 'ar3g': { expect(n).toEqual([1]); return polyArea(corners(it)); }
      case 'ar3l': { const [W, H, w, h] = n; return W * H - w * h; }
      case 'ar3t': { const [W, H, p, q] = n; return W * H - (p * q) / 2; }
      case 'ar3k': { const [d1, d2] = n; return (d1 * d2) / 2; }
      case 'ar3u': { const [a, b, t2] = n; expect((100 * a) % t2 + (100 * b) % t2, it.key).toBe(0); return ((100 * a) / t2) * ((100 * b) / t2); }
      case 'ar4p': { const [a, h, s] = n; expect(s >= h, it.key).toBe(true); return a * h; }
      case 'ar4t': { const [a, b, h, s] = n; expect((a - b) ** 2 + h * h, it.key).toBe(s * s); return ((a + b) * h) / 2; }
      case 'ar4i': { if (/מקבילית/.test(t)) { const [S, a] = n; return S / a; } const [S, a, b] = n; return (2 * S) / (a + b); }
      case 'ar5l': { const [W, H] = n; return 2 * (W + H); }
      case 'ar5p': {
        if (/משולש/.test(t)) { const [p, q] = n; return p + q + Math.sqrt(p * p + q * q); }
        const [a, b, h] = n; return a + b + h + Math.sqrt((a - b) ** 2 + h * h);
      }
      case 'ar5u': { const [a, b] = n; return 2 * (100 * a + b); }
      case 'ar5x': { const [P] = n; return (P / 4) ** 2; }
      default: return null;
    }
  }
  /** The answer's unit for each kind that types a number. */
  const unitOf = (it) => {
    const k = kindOf(it);
    if (k === 'ar1r') return /שטח/.test(it.text) ? UNIT.cm2 : UNIT.cm;
    if (k === 'ar1s') return /^מה שטח/.test(it.text) ? UNIT.cm2 : UNIT.cm;
    if (['ar1m', 'ar2x', 'ar4i', 'ar5l', 'ar5p', 'ar5u'].includes(k)) return UNIT.cm;
    if (k === 'ar3t') return UNIT.m2;
    if (k === 'ar3u') return UNIT.tiles;
    return UNIT.cm2;
  };

  for (let level = 1; level <= 5; level += 1) {
    it(`area:${level}: ${RUNS} draws, every kind; right answers are right, the words and the maths render`, () => {
      const kinds = new Set();
      for (const item of all(level)) {
        kinds.add(kindOf(item));
        expect(item.key).toBeTruthy();
        expect(item.hint).toBeTruthy();
        expect(item.solution?.length).toBeGreaterThan(0);
        expect(isCorrect(item, answerInput(item)), item.key).toBe(true);
        expect(item.diag(answerInput(item))).toBeNull();
        if (item.form === 'manip') expect(isCorrect(item, manipWrong(item)), item.key).toBe(false);
        if (item.form === 'num') {
          expect(Number.isFinite(item.answer)).toBe(true);
          expect(Math.abs(parseNum(answerText(item)) - item.answer)).toBeLessThan(0.01);
          if (Math.abs(item.answer - Math.round(item.answer)) < 1e-9) expect(Number.isInteger(item.answer), item.key).toBe(true);
          expect(answerText(item), item.key).not.toMatch(/\//); // a measure is written as a decimal, never 13/2
        }
        if (item.form === 'mc') {
          expect(item.choices[item.answer]).toBeTruthy();
          expect(item.practiceOnly, item.key).toBe(true);
          item.choices.forEach((c) => c.text && expect(c.text, item.key).not.toMatch(/\$/));
        }
        if (item.form === 'manip') expect(item.practiceOnly, item.key).toBe(true);
        for (const tex of texChunks(item)) expect(() => katex.renderToString(tex, { throwOnError: true }), `${item.key}: ${tex}`).not.toThrow();
        // units sit outside the maths: no Hebrew inside $…$
        for (const s of [item.text, item.hint, ...item.solution]) (s.match(/\$[^$]+\$/g) || []).forEach((m) => expect(m, item.key).not.toMatch(/[\u0590-\u05ff]/));
        expect(itemPlain(item)).not.toMatch(/undefined|NaN|\[object/);
        expect([item.text, item.hint, ...item.solution].join(' ')).not.toMatch(/undefined|NaN/);
        // every mistake a diag can name has Hebrew words in the topic
        const wrong = item.form === 'num' ? item.answer + 1 : null;
        if (wrong != null) { const c = item.diag(wrong); if (c) expect(AREA.cats[c]).toBeTruthy(); }
        solutionHolds(item);
      }
      expect([...kinds].sort()).toEqual([...KIND_KEYS[level]].sort());
    });
  }

  it('every area answer is the computation from the numbers in its text (on a grid, from the corners its drawing lists)', () => {
    let n = 0;
    for (let level = 1; level <= 5; level += 1) {
      for (const it of all(level)) {
        const want = fromText(it);
        if (want != null) { expect(it.answer, it.key).toBeCloseTo(want, 9); n += 1; }
        const k = kindOf(it); const v = shown(it.text);
        if (k === 'ar1u') expect((/השטח/.test(it.text) ? AREA_UNITS : LENGTH_UNITS).includes(it.choices[it.answer].text), it.key).toBe(true);
        if (k === 'ar2w') {
          // the right segment ends straight below A: it is perpendicular to BC's line
          const right = it.choices[it.answer].tex.slice(1); expect(it.fig.pts[right][0], it.key).toBe(it.fig.pts.A[0]);
          expect(it.fig.pts[right][0] < 0, it.key).toBe(true); // outside the triangle, on BC's extension
        }
        if (k === 'ar3m') { const [W, H, w, h] = v; expect(evaluate(texToExpr(it.choices[it.answer].tex.replace(/\\cdot/g, '*'))), it.key).toBe(W * H - w * h); }
        if (k === 'ar5c') {
          const [w1, h1, w2, h2] = v; expect(w1 + h1, it.key).toBe(w2 + h2); expect(w1 * h1).not.toBe(w2 * h2);
          expect(it.answer, it.key).toBe(w1 * h1 > w2 * h2 ? 0 : 1);
        }
        if (k === 'ar1b') { const [S, P] = v; expect(it.answer, it.key).toEqual({ mode: 'rect', area: S, perim: P }); }
        if (k === 'ar5b') { const [P] = v; expect(it.answer, it.key).toEqual({ mode: 'maxArea', perim: P }); }
        if (k === 'ar4c') {
          // the piece moved by the answer fills the gap: the shape and the piece make the rectangle around them
          const pts = [...it.manip.shape, ...movedPts(it.manip, it.answer)]; const b = boundsOf(pts);
          expect(polyArea(it.manip.shape) + polyArea(it.manip.piece.pts), it.key).toBe((b.x1 - b.x0) * (b.y1 - b.y0));
        }
      }
    }
    expect(n).toBeGreaterThan(1000);
  });

  it('every typed answer has its unit, the unit of what is asked', () => {
    for (let level = 1; level <= 5; level += 1) {
      for (const it of all(level)) {
        if (it.form !== 'num') continue;
        expect(typeof it.unit === 'string' && it.unit.length > 0, it.key).toBe(true);
        expect(it.unit, it.key).toBe(unitOf(it));
      }
    }
  });

  it('no question\'s answer is a number its text prints, and every number a drawing writes is in the text', () => {
    for (let level = 1; level <= 5; level += 1) {
      for (const it of all(level)) {
        const printed = shown(it.text);
        if (it.form === 'num') expect(printed.some((v) => close(v, it.answer)), `${it.key}: ${it.answer} is printed`).toBe(false);
        if (!it.fig || it.fig.grid) continue;
        const labels = [...(it.fig.segs || []).map((s) => s.label), ...(it.fig.words || []).map((w) => w.text)].filter((l) => l != null && /^\d+(\.\d+)?$/.test(l));
        labels.forEach((l) => expect(printed, `${it.key}: the drawing writes ${l}`).toContain(Number(l)));
      }
    }
  });

  it('every mistake a kind is built to name, it names (and only those)', seededRun(7121, () => {
    const WANT = {
      ar1r: ['perimeter', 'add-sides', 'area-for-perim', 'two-sides'], ar1m: ['one-side-perim', 'perim-as-area'], ar1s: ['perimeter', 'area-for-perim'], ar1u: ['unit-mix'], ar1b: [],
      ar2l: ['no-half', 'add-sides'], ar2t: ['no-half', 'hyp-as-height'], ar2x: ['no-half', 'half-twice', 'hyp-as-height'], ar2g: ['no-half', 'slant-as-height'], ar2q: ['no-half'], ar2w: ['inside-height'],
      ar3l: ['no-subtract', 'double-count'], ar3t: ['no-subtract', 'no-half'], ar3k: ['diag-no-half'], ar3u: ['div-by-side'], ar3g: ['no-subtract'], ar3m: ['double-count'],
      ar4p: ['slant-as-height', 'half-para'], ar4t: ['no-half', 'one-base', 'slant-as-height'], ar4i: ['half-para', 'no-half'], ar4c: [],
      ar5l: ['missing-sides', 'area-for-perim'], ar5p: ['missing-sides', 'add-legs'], ar5u: ['no-convert', 'two-sides'], ar5x: [], ar5c: ['same-perim-same-area'], ar5b: [],
    };
    const got = {};
    for (let level = 1; level <= 5; level += 1) {
      for (const it of all(level, 200)) { const k = kindOf(it); got[k] ||= new Set(); namesOf(it, WANT[k]).forEach((c) => got[k].add(c)); }
    }
    for (const [k, ids] of Object.entries(WANT)) expect([...(got[k] || [])].sort(), k).toEqual([...ids].sort());
    // together, every mistake the topic has a name for
    expect([...new Set(Object.values(WANT).flat())].sort()).toEqual(Object.keys(AREA.cats).sort());
  }), 30_000); // 200 draws a level and every wrong answer each mistake gives: a second alone, more beside the full suite

  it('a grid triangle whose area ends in a half is written 6.5, not 13/2', () => {
    let found = 0;
    for (let i = 0; i < 4000 && found < 3; i += 1) {
      const it = areaItem(3);
      if (kindOf(it) !== 'ar3g' || Number.isInteger(it.answer)) continue;
      found += 1;
      expect(answerText(it)).toBe(String(it.answer));
      expect(isCorrect(it, it.answer)).toBe(true);
    }
    expect(found).toBe(3);
    // the triangle (0, 0), (5, 1), (2, 3): the box 5 by 3 less 2.5, 3 and 3 is 6.5
    const half = { ...areaItem(3), key: 'ar3g:0:0:5:1:2:3', form: 'num', answer: 6.5, topic: 'area' };
    expect(answerText(half)).toBe('6.5');
  });

  it('the class\'s right triangle (CLASSROOM-13): the formula names the legs at the square, never the notebook\'s pairs', seededRun(7122, () => {
    const seen = new Set();
    for (const it of all(2, 2000)) {
      const k = kindOf(it); if (k !== 'ar2x' && k !== 'ar2l' && k !== 'ar2t') continue;
      const at = it.key.split(':').pop(); seen.add(at);
      const legs = AW.LEGS[at];
      expect(it.text, it.key).toContain(`\\sphericalangle ${at} = 90^\\circ`);
      expect(it.solution.join(' '), it.key).toContain(`\\frac{${legs[0]} \\cdot ${legs[1]}}{2}`);
      expect(it.fig.angles[0], it.key).toMatchObject({ at, right: true });
      if (k === 'ar2x') {
        const [a, S] = it.key.split(':').slice(1).map(Number);
        expect([[10, 45], [7, 21]].some(([p, q]) => p === a && q === S), it.key).toBe(false);
        expect(it.solution[2], it.key).toContain('\\;/{\\cdot}2');
        expect(it.solution[3], it.key).toContain(`\\;/{:}${a}`);
      }
    }
    expect([...seen].sort()).toEqual(['A', 'B', 'C']);
    // the triples reach CLASSROOM-13's 16, 30, 34
    let big = false; for (const it of all(2, 3000)) if (kindOf(it) === 'ar2t' && it.key.split(':')[3] === '34') big = true;
    expect(big).toBe(true);
  }));

  it('a grid triangle on area:2 sometimes has its height outside its base, and its solution says so only then; one on area:3 has no side on a grid line', seededRun(7123, () => {
    let outside = 0; let atEnd = 0;
    for (const it of all(2, 1500)) {
      if (kindOf(it) !== 'ar2q') continue;
      const t = Number(it.key.split(':')[3]); const b = Number(it.key.split(':')[1]);
      // the worked solution says where the height falls: outside the base only when it is (t < 0 or t > b); above an end
      // of the base (a right triangle) the height is the side standing there; inside, nothing more is said
      const said = it.solution[0];
      if (t < 0 || t > b) { outside += 1; expect(said, it.key).toContain('נופל מחוץ לבסיס'); } else expect(said, it.key).not.toContain('מחוץ');
      if (t === 0 || t === b) { atEnd += 1; expect(said, it.key).toContain('ישר־זווית'); } else expect(said, it.key).not.toContain('ישר־זווית');
    }
    expect(outside).toBeGreaterThan(5);
    expect(atEnd).toBeGreaterThan(5);
    for (const it of all(3, 800)) {
      if (kindOf(it) !== 'ar3g') continue;
      const p = corners(it); expect(p).toHaveLength(3);
      [[0, 1], [1, 2], [2, 0]].forEach(([i, j]) => expect(p[i][0] !== p[j][0] && p[i][1] !== p[j][1], it.key).toBe(true));
      expect(it.answer >= 3, it.key).toBe(true);
    }
  }));

  it('a quadrilateral with perpendicular diagonals is never a sliver: the longer diagonal is at most three times the other', () => {
    for (const it of all(3, 1000)) {
      if (kindOf(it) !== 'ar3k') continue;
      const [d1, d2] = shown(it.text); expect(Math.max(d1, d2) <= 3 * Math.min(d1, d2), it.key).toBe(true);
    }
  });

  it('ar2g puts the height outside the triangle on a good share of draws, and inside on the rest', seededRun(7124, () => {
    // the model draws "outside" 40% of the time, and an inside foot must also fall on the base (d < b), so about half
    // of the draws that remain have the height outside
    let out = 0; let n = 0;
    for (const it of all(2, 3000)) if (kindOf(it) === 'ar2g') { n += 1; if (it.key.endsWith(':1')) out += 1; }
    expect(out / n).toBeGreaterThan(0.35);
    expect(out / n).toBeLessThan(0.7);
  }));
});

// The ten models (stage2.md Appendix B), ported unchanged from the spec's models.mjs: 4,000 seeded draws of each.
describe('areas and perimeters: the diagnostic and transfer models', () => {
  const RATES = {
    AREA1: { perimeter: 51, 'add-sides': 51, 'area-for-perim': 49, 'two-sides': 49 },
    AREA1T: { 'one-side-perim': 100, 'perim-as-area': 99 },
    AREA2: { 'no-half': 100, 'slant-as-height': 100 },
    AREA2T: { 'no-half': 100, 'half-twice': 100 },
    AREA3: { 'no-subtract': 100, 'double-count': 100 },
    AREA3T: { 'no-subtract': 100, 'no-half': 100 },
    AREA4: { 'no-half': 100, 'one-base': 100, 'slant-as-height': 100 },
    AREA4T: { 'slant-as-height': 100, 'half-para': 100 },
    AREA5: { 'missing-sides': 100, 'area-for-perim': 98 },
    AREA5T: { 'no-convert': 100, 'two-sides': 100 },
  };
  // each model's words: the text, the drawing, the solution, the hint and the unit its stair will show
  const WORDS = {
    AREA1: [AW.area1Text, AW.area1Fig, AW.area1Solution, AW.area1Hint, AW.area1Unit],
    AREA1T: [AW.gardenText, null, AW.gardenSolution, AW.gardenHint, () => AW.UNIT.m],
    AREA2: [AW.area2Text, AW.area2Fig, AW.area2Solution, AW.area2Hint, () => AW.UNIT.cm2],
    AREA2T: [(p) => AW.area2TText(p), (p) => AW.area2TFig(p), AW.area2TSolution, AW.area2THint, () => AW.UNIT.cm],
    AREA3: [AW.area3Text, AW.area3Fig, AW.area3Solution, AW.area3Hint, () => AW.UNIT.cm2],
    AREA3T: [AW.plotText, AW.plotFigOf, AW.plotSolution, AW.plotHint, () => AW.UNIT.m2],
    AREA4: [AW.area4Text, AW.area4Fig, AW.area4Solution, AW.area4Hint, () => AW.UNIT.cm2],
    AREA4T: [AW.paraPlotText, AW.paraPlotFig, AW.paraPlotSolution, AW.paraPlotHint, () => AW.UNIT.m2],
    AREA5: [AW.area5Text, AW.area5Fig, AW.area5Solution, AW.area5Hint, () => AW.UNIT.cm],
    AREA5T: [AW.boardText, null, AW.boardSolution, AW.boardHint, () => AW.UNIT.cm],
  };
  const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  const N = 4000;

  for (const [name, rates] of Object.entries(RATES)) {
    it(`${name}: whole answers, clean draws, every bug above 4% and as Appendix B says, every pair told apart`, () => {
      const m = AW[name]; const r = seeded(name.length * 7919 + 11);
      const fired = {}; const draws = [];
      for (let i = 0; i < N; i += 1) {
        const p = m.params(r); const a = m.answer(p); draws.push(p);
        expect(Number.isInteger(a), `${name} ${JSON.stringify(p)}`).toBe(true);
        expect(AW.clean(m, p), `${name} ${JSON.stringify(p)}`).toBe(true);
        for (const [id, f] of Object.entries(m.bugs)) { const v = f(p); if (v != null && Number.isFinite(v) && !near(v, a)) fired[id] = (fired[id] || 0) + 1; }
      }
      expect(Object.keys(m.bugs).sort()).toEqual(Object.keys(rates).sort());
      for (const [id, want] of Object.entries(rates)) {
        const rate = (100 * (fired[id] || 0)) / N;
        expect(rate, `${name} ${id}`).toBeGreaterThan(4);
        expect(Math.abs(rate - want), `${name} ${id}: ${rate.toFixed(1)}% against ${want}%`).toBeLessThanOrEqual(3);
      }
      const ids = Object.keys(m.bugs);
      for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) {
        const apart = draws.some((p) => {
          const a = m.answer(p); const v = [ids[i], ids[j]].map((id) => { const x = m.bugs[id](p); return x == null ? a : x; });
          return !near(v[0], v[1]) && (!near(v[0], a) || !near(v[1], a));
        });
        expect(apart, `${name}: ${ids[i]} and ${ids[j]}`).toBe(true);
      }
      // the words of every 40th draw: no gaps, maths that renders, a solution that ends on the answer and its unit
      const [text, fig, solution, hint, unit] = WORDS[name];
      draws.filter((_, i) => i % 40 === 0).forEach((p) => {
        const words = [text(p), hint(p), ...solution(p)];
        words.forEach((w) => expect(w, name).not.toMatch(/undefined|NaN/));
        words.forEach((w) => (w.match(/\$([^$]+)\$/g) || []).forEach((t) => expect(() => katex.renderToString(t.slice(1, -1), { throwOnError: true }), `${name}: ${t}`).not.toThrow()));
        const last = solution(p).at(-1);
        expect(last, name).toContain(String(m.answer(p)));
        expect(last.endsWith(unit(p)), `${name}: ${last}`).toBe(true);
        // every number the drawing writes is in the text too
        if (fig) {
          const f = fig(p); const inText = (text(p).match(/\$([^$]+)\$/g) || []).flatMap((t) => (t.match(/\d+(?:\.\d+)?/g) || []).map(Number));
          expect(f.type).toBe('geo');
          (f.segs || []).forEach((s) => { if (s.label && /^\d+(\.\d+)?$/.test(s.label)) expect(inText, `${name}: ${s.label}`).toContain(Number(s.label)); });
        }
      });
    });
  }

  it('the words name the right angle\'s legs, and the transfer of area:2 is in the class\'s form', () => {
    const p = { a: 6, x: 11, S: 33, at: 'B' };
    expect(AW.area2TText(p)).toBe('במשולש $ABC$: $\\sphericalangle B = 90^\\circ$, $AB = 6$ ס״מ, $BC = x$ ס״מ, ושטח המשולש $33$ סמ״ר. מה $x$?');
    expect(AW.area2TSolution(p)).toEqual([
      'נתון: $S_{\\triangle ABC} = 33$',
      '$S_{\\triangle ABC} = \\frac{AB \\cdot BC}{2}$: שני הניצבים יוצאים מהזווית הישרה.',
      '$\\frac{6x}{2} = 33 \\;/{\\cdot}2$',
      '$6x = 66 \\;/{:}6$',
      '$x = 11$ ס״מ',
    ]);
    expect(AW.area2TText({ a: 8, S: 24, at: 'C' }, 10)).toContain('$AB = 10$ ס״מ');
    expect(AW.AREA2T.answer(p)).toBe(11);
    expect(AW.AREA2T.bugs['no-half'](p)).toBe(5.5);
    expect(AW.AREA2T.bugs['half-twice'](p)).toBe(2.75);
  });

  it('the topic: grade 7, fuchsia, not in the first-day test, five stairs, its lesson and words', () => {
    const { AREA } = AW;
    expect(AREA).toMatchObject({ id: 'area', grade: '7', title: 'שטחים והיקפים', desc: 'מלבן, משולש, צורות מורכבות, מקבילית וטרפז, והיקפים', color: 'fuchsia', placement: false });
    expect(AREA.levels.map((l) => l.title)).toEqual(['היקף ושטח של מלבן', 'שטח משולש', 'צורות מורכבות', 'מקבילית וטרפז', 'היקפים: אותו היקף, שטח אחר']);
    expect(AREA.lesson.points).toHaveLength(6);
    expect(AREA.lesson.words.length).toBeGreaterThan(15);
    AREA.lesson.points.forEach((s) => (s.match(/\$([^$]+)\$/g) || []).forEach((t) => expect(() => katex.renderToString(t.slice(1, -1), { throwOnError: true })).not.toThrow()));
    // the reused ids keep the names they have elsewhere in the app
    const named = (topic, id) => TOPICS.find((t) => t.id === topic).cats[id];
    expect(AREA.cats.perimeter).toBe(named('coord', 'perimeter'));
    expect(AREA.cats['add-sides']).toBe(named('coord', 'add-sides'));
    expect(AREA.cats['no-half']).toBe(named('line', 'no-half'));
    expect(AREA.cats['add-legs']).toBe(named('pyth', 'add-legs'));
    expect(AREA.cats['no-convert']).toBe(named('ratio', 'no-convert'));
    // on the ז׳ path since its teaching landed: after expressions, before the boxes, the data unit (curriculum stage 3)
    // and equations, between cobalt and petrol
    expect(TOPICS.find((t) => t.id === 'area').levels.map((L) => [L.title, L.gen])).toEqual(AREA.levels.map((L) => [L.title, L.gen])); // the path's copy, with this file's generators
    expect(topicsFor('7').map((t) => t.id)).toEqual(['signed', 'coord', 'angles', 'transf', 'expr', 'area', 'solid', 'data', 'eq']);
    expect(topicsFor('7').map((t) => t.color).slice(3, 9)).toEqual(['violet', 'cobalt', 'fuchsia', 'petrol', 'cobalt', 'violet']);
  });
});

// Boxes and prisms (stage 2, MEASURE-3): the practice and diagnosis layer (content/solid.js), tested on its topic object,
// the same object GRADE7 puts on the path. Every check reads the question as the student sees it.
describe('boxes and prisms: every practice kind, from the numbers in its text', () => {
  const { SOLID, KIND_KEYS, UNIT } = SW;
  const solidItem = (level) => {
    const L = SOLID.levels[level - 1]; const it = L.gen();
    return { ...it, diag: (u) => (isCorrect(it, u) ? null : it.diag(u)), topic: 'solid', level, levelTitle: L.title };
  };
  const all = (level, n = RUNS) => Array.from({ length: n }, () => solidItem(level));
  const seededRun = (seed, fn) => () => { const real = Math.random; Math.random = seeded(seed); try { fn(); } finally { Math.random = real; } };
  const kindOf = (it) => it.key.split(':')[0];
  const shown = (text) => (text.match(/\$([^$]+)\$/g) || []).flatMap((m) => (m.match(/\d+(?:\.\d+)?/g) || []).map(Number));
  const close = (a, b) => Math.abs(a - b) < 1e-9;
  const surf = (a, b, c) => 2 * (a * b + b * c + a * c);
  let checked = 0;
  const solutionHolds = (it) => it.solution.forEach((line) => (line.match(/\$([^$]+)\$/g) || [])
    .map((m) => m.slice(1, -1).replace(/\\cdot/g, '*').replace(/\\[;,]|\/\{[^}]*\}\d+/g, ' '))
    .filter((m) => m.includes('=') && !/[a-zA-Z□]/.test(m.replace(/\\frac|\\sqrt/g, '')))
    .forEach((m) => {
      m.split('=').reduce((a, b) => { expect(same(evaluate(texToExpr(a)), evaluate(texToExpr(b))), `${it.key}: ${m}`).toBe(true); checked += 1; return b; });
    }));
  afterAll(() => expect(checked).toBeGreaterThan(2000));

  /** The answer computed from the text alone; null for the kinds whose answer is not a number. */
  function fromText(it) {
    const n = shown(it.text); const t = it.text;
    switch (kindOf(it)) {
      case 'so1s': { const [a, b, c] = n; return surf(a, b, c); }
      case 'so1c': { const [v] = n; return t.startsWith('מה שטח') ? 6 * v * v : Math.sqrt(v / 6); }
      case 'so1e': { const [a, b, c] = n; return 4 * (a + b + c); }
      case 'so1o': { const [a, b, c, a2, b2] = n; expect([a2, b2], it.key).toEqual([a, b]); return surf(a, b, c) - a * b; }
      case 'so2v': { const [a, b, c] = n; return a * b * c; }
      case 'so2m': { const [V, a, b] = n; return V / (a * b); }
      case 'so2c': { const [v] = n; return t.startsWith('מה נפח') ? v ** 3 : Math.round(Math.cbrt(v)); }
      case 'so2l': {
        expect(t, it.key).toMatch(/ליטר/);
        if (t.startsWith('אקווריום')) { const [a, b, c] = n; return (a * b * c) / 1000; }
        const [a, b, L] = n; return (1000 * L) / (a * b);
      }
      case 'so2f': { const [e, a, b, c] = n; expect([a % e, b % e, c % e], it.key).toEqual([0, 0, 0]); return (a / e) * (b / e) * (c / e); }
      case 'so3s': { const [p, q, c, L] = n; expect(p * p + q * q, it.key).toBe(c * c); return p * q + L * (p + q + c); }
      case 'so3h': { const [p, q, L] = n; return p * q + L * (p + q + Math.sqrt(p * p + q * q)); }
      case 'so3l': { const [a, b, c, L] = n; expect(a + b > c && a + c > b && b + c > a, it.key).toBe(true); return (a + b + c) * L; }
      case 'so3i': { const [b, h, s, L] = n; expect((b / 2) ** 2 + h * h, it.key).toBe(s * s); return b * h + L * (b + 2 * s); }
      case 'so4v': { const [p, q, c, L] = n; expect(p * p + q * q, it.key).toBe(c * c); return (p * q * L) / 2; }
      case 'so4a': { const [b, h, s, L] = n; expect(s > h, it.key).toBe(true); return (b * h * L) / 2; }
      case 'so4m': { const [V, a, b] = n; return (2 * V) / (a * b); }
      case 'so4h': { const [a, b, c] = n; return (a * b * c) / 2; }
      case 'so4k': { const [k] = n; return k ** 3; }
      default: return null;
    }
  }
  /** The answer's unit, from the question's words. */
  const unitOf = (it) => {
    const k = kindOf(it); const t = it.text;
    if (['so1s', 'so1o', 'so3s', 'so3h', 'so3l'].includes(k)) return UNIT.cm2;
    if (k === 'so3i') return UNIT.m2;
    if (k === 'so1c') return t.startsWith('מה שטח') ? UNIT.cm2 : UNIT.cm;
    if (k === 'so2c') return t.startsWith('מה נפח') ? UNIT.cm3 : UNIT.cm;
    if (k === 'so2l') return t.startsWith('אקווריום') ? UNIT.litre : UNIT.cm;
    if (['so1e', 'so2m', 'so4m'].includes(k)) return UNIT.cm;
    if (k === 'so2f') return UNIT.cubes;
    return UNIT.cm3; // so2v, so4v, so4a, so4h
  };

  for (let level = 1; level <= 4; level += 1) {
    it(`solid:${level}: ${RUNS} draws, every kind; right answers are right, the words and the maths render`, () => {
      const kinds = new Set();
      for (const item of all(level)) {
        kinds.add(kindOf(item));
        expect(item.key).toBeTruthy();
        expect(item.hint).toBeTruthy();
        expect(item.solution?.length).toBeGreaterThan(0);
        expect(isCorrect(item, answerInput(item)), item.key).toBe(true);
        expect(item.diag(answerInput(item))).toBeNull();
        if (item.form === 'manip') { expect(isCorrect(item, manipWrong(item)), item.key).toBe(false); expect(item.practiceOnly, item.key).toBe(true); }
        if (item.form === 'num') {
          expect(Number.isInteger(item.answer), item.key).toBe(true);
          expect(parseNum(answerText(item))).toBe(item.answer);
        }
        if (item.form === 'mc') {
          expect(item.choices[item.answer]).toBeTruthy();
          expect(item.practiceOnly, item.key).toBe(true);
          item.choices.forEach((c) => expect(c.text, item.key).not.toMatch(/\$/));
        }
        for (const tex of texChunks(item)) expect(() => katex.renderToString(tex, { throwOnError: true }), `${item.key}: ${tex}`).not.toThrow();
        for (const s of [item.text, item.hint, ...item.solution]) (s.match(/\$[^$]+\$/g) || []).forEach((m) => expect(m, item.key).not.toMatch(/[֐-׿]/));
        expect(itemPlain(item)).not.toMatch(/undefined|NaN|\[object/);
        expect([item.text, item.hint, ...item.solution].join(' ')).not.toMatch(/undefined|NaN/);
        if (item.fig) expect(figPlain(item.fig), item.key).toBeTruthy();
        const wrong = item.form === 'num' ? item.answer + 1 : null;
        if (wrong != null) { const c = item.diag(wrong); if (c) expect(SOLID.cats[c]).toBeTruthy(); }
        solutionHolds(item);
      }
      expect([...kinds].sort()).toEqual([...KIND_KEYS[level]].sort());
    });
  }

  it('every answer is the computation from the numbers in its text, and a build asks for what its text names', () => {
    let n = 0;
    for (let level = 1; level <= 4; level += 1) {
      for (const it of all(level)) {
        const want = fromText(it);
        if (want != null) { expect(it.answer, it.key).toBeCloseTo(want, 9); n += 1; }
        const k = kindOf(it); const v = shown(it.text);
        if (k === 'so2b') { const [V, c] = v; expect(it.answer, it.key).toEqual({ mode: 'build', V, fixed: { c } }); expect(it.manip.start.c).toBe(c); }
        if (k === 'so4b') { const [V, L] = v; expect(it.answer, it.key).toEqual({ mode: 'build', V, fixed: { L } }); expect(it.manip.start.L).toBe(L); }
        if (k === 'so1n') expect(it.answer.face, it.key).toBe(SW.CUBE_OPPOSITE[it.manip.layout][it.manip.shade]);
        if (k === 'so1m') expect(Object.keys(SW.CUBE_NETS), it.key).toContain(it.choices[it.answer].net);
      }
    }
    expect(n).toBeGreaterThan(900);
  });

  it('every typed answer has its unit, the unit of what is asked; a question in litres says ליטר', () => {
    let litres = 0;
    for (let level = 1; level <= 4; level += 1) {
      for (const it of all(level)) {
        if (it.form !== 'num') continue;
        if (kindOf(it) === 'so4k') { expect(it.unit, `${it.key}: "how many times" has no unit`).toBeUndefined(); expect(it.practiceOnly).toBe(true); continue; }
        expect(typeof it.unit === 'string' && it.unit.length > 0, it.key).toBe(true);
        expect(it.unit, it.key).toBe(unitOf(it));
        if (it.unit === UNIT.litre) { litres += 1; expect(it.text, it.key).toMatch(/ליטר/); expect(it.solution.at(-1), it.key).toMatch(/ליטר$/); }
      }
    }
    expect(litres).toBeGreaterThan(5);
  });

  it('no question\'s answer is a number its text prints, and every number a drawing writes is in the text', () => {
    for (let level = 1; level <= 4; level += 1) {
      for (const it of all(level)) {
        const printed = shown(it.text);
        if (it.form === 'num') expect(printed.some((v) => close(v, it.answer)), `${it.key}: ${it.answer} is printed`).toBe(false);
        if (!it.fig || it.fig.type !== 'solid') continue;
        Object.values(solidLabels(it.fig)).filter((l) => /^\d+(\.\d+)?$/.test(l))
          .forEach((l) => expect(printed, `${it.key}: the drawing writes ${l}`).toContain(Number(l)));
        // a length the question asks for is drawn as ?, never as its number
        if (it.form === 'num' && /מה (אורך|המקצוע|אורכה)/.test(it.text)) expect(Object.values(solidLabels(it.fig)), it.key).not.toContain(String(it.answer));
      }
    }
  });

  it('every mistake a kind is built to name, it names (from the text\'s own numbers), and only those', seededRun(7131, () => {
    // the wrong answer each mistake gives, computed from the numbers in the text
    const PRED = {
      so1s: ([a, b, c]) => [['three-faces', a * b + b * c + a * c], ['vol-for-surf', a * b * c]],
      so1c: ([v], t) => (t.startsWith('מה שטח') ? [['vol-for-surf', v ** 3]] : [['no-root', v / 6]]),
      so1e: ([a, b, c]) => [['three-edges', a + b + c]],
      so1o: ([a, b, c]) => [['lid-counted', surf(a, b, c)], ['vol-for-surf', a * b * c]],
      so2v: ([a, b, c]) => [['surf-for-vol', surf(a, b, c)], ['add-edges', a + b + c]],
      so2m: ([V, a, b]) => [['one-divide', V / a], ['one-divide', V / b]],
      so2c: ([v], t) => (t.startsWith('מה נפח') ? [['cube-times3', 3 * v], ['square-not-cube', v * v]] : [['cube-times3', v / 3]]),
      so2l: (n, t) => { if (t.startsWith('אקווריום')) { const [a, b, c] = n; return [['no-convert', a * b * c], ['surf-for-vol', surf(a, b, c) / 1000]]; } const [a, b, L] = n; return [['no-convert', L / (a * b)]]; },
      so2f: ([e, a, b, c]) => [['div-by-edge', (a * b * c) / e]],
      so3s: ([p, q, c, L]) => [['one-base', (p * q) / 2 + L * (p + q + c)], ['missing-face', p * q + L * (p + q)]],
      so3h: ([p, q, L]) => [['missing-face', p * q + L * (p + q)], ['add-legs', p * q + 2 * L * (p + q)]],
      so3i: ([b, h, s, L]) => [['one-base', (b * h) / 2 + L * (b + 2 * s)], ['slant-as-height', b * s + L * (b + 2 * s)]],
      so4v: ([p, q, c, L]) => [['no-half', p * q * L], ['hyp-as-height', (p * c * L) / 2]],
      so4a: ([b, h, s, L]) => [['no-half', b * h * L], ['slant-as-height', (b * s * L) / 2]],
      so4m: ([V, a, b]) => [['no-half', V / (a * b)]],
      so4h: ([a, b, c]) => [['no-half', a * b * c]],
      so4k: ([k]) => [['linear-volume', k], ['square-scale', k * k]],
    };
    const WANT = {
      so1s: ['three-faces', 'vol-for-surf'], so1c: ['vol-for-surf', 'no-root'], so1e: ['three-edges'], so1o: ['lid-counted', 'vol-for-surf'], so1n: ['opposite-adjacent'], so1m: [],
      so2v: ['surf-for-vol', 'add-edges'], so2m: ['one-divide'], so2c: ['cube-times3', 'square-not-cube'], so2l: ['no-convert', 'surf-for-vol'], so2f: ['div-by-edge'], so2b: [],
      so3s: ['one-base', 'missing-face'], so3h: ['missing-face', 'add-legs'], so3l: [], so3i: ['one-base', 'slant-as-height'], so3n: [],
      so4v: ['no-half', 'hyp-as-height'], so4a: ['no-half', 'slant-as-height'], so4m: ['no-half'], so4h: ['no-half'], so4k: ['linear-volume', 'square-scale'], so4b: [],
    };
    const got = {};
    for (let level = 1; level <= 4; level += 1) {
      for (const it of all(level, 200)) {
        const k = kindOf(it); got[k] ||= new Set();
        if (PRED[k]) {
          for (const [id, v] of PRED[k](shown(it.text), it.text)) { expect(close(v, it.answer), `${it.key} ${id}`).toBe(false); expect(it.diag(v), `${it.key}: ${v}`).toBe(id); got[k].add(id); }
        }
        if (k === 'so1n') {
          // every face but the shaded one and the answer is beside the shaded one on the cube
          for (const f of 'ABCDEF') if (f !== it.manip.shade && f !== it.answer.face) { expect(it.diag({ face: f }), `${it.key} ${f}`).toBe('opposite-adjacent'); got[k].add('opposite-adjacent'); }
        }
        // whatever a wrong number is named, it is one of the kind's own mistakes
        namesOf(it).forEach((c) => expect(WANT[k], `${it.key} names ${c}`).toContain(c));
      }
    }
    for (const [k, ids] of Object.entries(WANT)) expect([...(got[k] || [])].sort(), k).toEqual([...ids].sort());
    expect([...new Set(Object.values(WANT).flat())].sort()).toEqual(Object.keys(SOLID.cats).sort());
  }), 30_000); // 200 draws a level and every wrong answer each mistake gives: a second alone, more beside the full suite

  it('no practice draw has two different mistakes that give the same number (the box 2 by 3 by 6 is redrawn)', seededRun(7132, () => {
    let boxes = 0;
    for (let level = 1; level <= 4; level += 1) {
      for (const it of all(level, 400)) {
        const k = kindOf(it); if (!['so1s', 'so1o', 'so2v'].includes(k)) continue;
        boxes += 1; const [a, b, c] = shown(it.text);
        if (k === 'so1s') expect(a * b * c === a * b + b * c + a * c, it.key).toBe(false);
        if (k === 'so1o') expect(a * b * c === surf(a, b, c), it.key).toBe(false);
        if (k === 'so2v') expect(a + b + c === surf(a, b, c), it.key).toBe(false);
      }
    }
    expect(boxes).toBeGreaterThan(200);
    // and the rule itself, on the box the models allow
    expect(SW.SOLID1.answer({ a: 2, b: 3, c: 6 })).toBe(72);
    expect(SW.SOLID1.bugs['three-faces']({ a: 2, b: 3, c: 6 })).toBe(SW.SOLID1.bugs['vol-for-surf']({ a: 2, b: 3, c: 6 }));
  }));

  it('a cube\'s surface area is never asked at an edge of 6, nor its volume at 3 (where two mistakes give the answer)', () => {
    for (const it of [...all(1, 600), ...all(2, 600)]) {
      if (kindOf(it) === 'so1c') expect(it.key.split(':')[2], it.key).not.toBe('6');
      if (kindOf(it) === 'so2c') expect(it.key.split(':')[2], it.key).not.toBe('3');
    }
  });

  it('the topic: grade 7, petrol, not in the placement test, four stairs, its words, and on the ז׳ path after the areas', () => {
    expect(SOLID).toMatchObject({ id: 'solid', grade: '7', color: 'petrol', placement: false });
    expect(SOLID.levels.map((L) => L.title)).toEqual(['תיבה: פריסה ושטח פנים', 'נפח תיבה וקובייה', 'מנסרה משולשת: פריסה ושטח פנים', 'נפח מנסרה']);
    expect(SOLID.lesson.points.length).toBeGreaterThan(3);
    expect(SOLID.lesson.words).toContain('ליטר');
    // on the path since its teaching landed: after the areas, before the data unit and equations, petrol between
    // fuchsia and data's cobalt
    expect(TOPICS.find((t) => t.id === 'solid').levels.map((L) => [L.title, L.gen])).toEqual(SOLID.levels.map((L) => [L.title, L.gen])); // the path's copy, with this file's generators
    expect(topicsFor('7').map((t) => t.id).slice(5, 9)).toEqual(['area', 'solid', 'data', 'eq']);
    expect(topicsFor('7').map((t) => t.color).slice(5, 9)).toEqual(['fuchsia', 'petrol', 'cobalt', 'violet']);
    // the ids other topics use keep their names but for one-base and no-convert, said here in this unit's words
    for (const t of TOPICS) for (const [id, name] of Object.entries(t.cats || {})) {
      // (the circle's slant-as-height is the cone's slant height, said in its own words, and space says it as the circle
      // does; the angles unit's no-half is half an angle, the bisector of CLASSROOM-10, not half a triangle's area, and
      // the congruence unit says the same of the bisector to the base of an isosceles triangle)
      if (['angles', 'congr'].includes(t.id) && id === 'no-half') continue;
      if (SOLID.cats[id] && !['one-base', 'no-convert'].includes(id) && !(['circle', 'space'].includes(t.id) && id === 'slant-as-height')) expect(SOLID.cats[id], `${t.id} ${id}`).toBe(name);
    }
  });
});

// The eight models of boxes and prisms (stage2.md Appendix B): 4,000 seeded draws of each.
describe('boxes and prisms: the diagnostic and transfer models', () => {
  // [answer range, bug rates] as Appendix B gives them
  const B = {
    SOLID1: [[52, 724], { 'three-faces': 100, 'vol-for-surf': 100 }],
    SOLID1T: [[40, 614], { 'lid-counted': 100, 'vol-for-surf': 100 }],
    SOLID2: [[24, 1320], { 'surf-for-vol': 100, 'add-edges': 100 }],
    SOLID2T: [[24, 270], { 'no-convert': 100, 'surf-for-vol': 100 }],
    SOLID3: [[84, 920], { 'one-base': 100, 'missing-face': 100 }],
    SOLID3T: [[104, 1296], { 'one-base': 100, 'slant-as-height': 100 }],
    SOLID4: [[18, 900], { 'no-half': 100, 'hyp-as-height': 100 }],
    SOLID4T: [[12, 720], { 'no-half': 100, 'slant-as-height': 100 }],
  };
  const { UNIT } = SW;
  const WORDS = {
    SOLID1: [SW.solid1Text, SW.solid1Fig, SW.solid1Solution, SW.solid1Hint, UNIT.cm2],
    SOLID1T: [SW.openBoxText, SW.openBoxFig, SW.openBoxSolution, SW.openBoxHint, UNIT.cm2],
    SOLID2: [SW.solid2Text, SW.solid2Fig, SW.solid2Solution, SW.solid2Hint, UNIT.cm3],
    SOLID2T: [SW.tankText, SW.tankFig, SW.tankSolution, SW.tankHint, UNIT.litre],
    SOLID3: [SW.solid3Text, SW.solid3Fig, SW.solid3Solution, SW.solid3Hint, UNIT.cm2],
    SOLID3T: [SW.tentText, SW.tentFig, SW.tentSolution, SW.tentHint, UNIT.m2],
    SOLID4: [SW.solid4Text, SW.solid4Fig, SW.solid4Solution, SW.solid4Hint, UNIT.cm3],
    SOLID4T: [SW.rampText, SW.rampFig, SW.rampSolution, SW.rampHint, UNIT.m3],
  };
  const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  const N = 4000;

  it('the stairs\' models are these eight, a diagnostic and a transfer for each', () => {
    expect(SW.STAIR_MODELS).toEqual({ 'solid:1': [SW.SOLID1, SW.SOLID1T], 'solid:2': [SW.SOLID2, SW.SOLID2T], 'solid:3': [SW.SOLID3, SW.SOLID3T], 'solid:4': [SW.SOLID4, SW.SOLID4T] });
  });

  for (const [name, [[lo, hi], rates]] of Object.entries(B)) {
    it(`${name}: whole answers in ${lo}..${hi}, clean draws, every bug as Appendix B says, every pair told apart`, () => {
      const m = SW[name]; const r = seeded(name.length * 7919 + 13 + name.charCodeAt(5));
      const fired = {}; const draws = []; let min = Infinity; let max = -Infinity;
      for (let i = 0; i < N; i += 1) {
        const p = m.params(r); const a = m.answer(p); draws.push(p); min = Math.min(min, a); max = Math.max(max, a);
        expect(Number.isInteger(a), `${name} ${JSON.stringify(p)}`).toBe(true);
        expect(AW.clean(m, p), `${name} ${JSON.stringify(p)}`).toBe(true);
        for (const [id, f] of Object.entries(m.bugs)) { const v = f(p); if (v != null && Number.isFinite(v) && !near(v, a)) fired[id] = (fired[id] || 0) + 1; }
      }
      expect(min, name).toBeGreaterThanOrEqual(lo); expect(max, name).toBeLessThanOrEqual(hi);
      expect(Object.keys(m.bugs).sort()).toEqual(Object.keys(rates).sort());
      for (const [id, want] of Object.entries(rates)) {
        const rate = (100 * (fired[id] || 0)) / N;
        expect(Math.abs(rate - want), `${name} ${id}: ${rate.toFixed(1)}% against ${want}%`).toBeLessThanOrEqual(1);
      }
      // told apart: some draw where the two predict different numbers (the spec's rule allows a rare tie, a box 2 by 3
      // by 6 whose three faces and volume are both 36; the practice draws redraw it, see the next describe)
      const ids = Object.keys(m.bugs);
      for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) {
        const ties = draws.filter((p) => near(m.bugs[ids[i]](p), m.bugs[ids[j]](p))).length;
        expect(ties / N, `${name}: ${ids[i]} and ${ids[j]}`).toBeLessThan(0.02);
      }
      const [text, fig, solution, hint, unit] = WORDS[name];
      draws.filter((_, i) => i % 40 === 0).forEach((p) => {
        const words = [text(p), hint(p), ...solution(p)];
        words.forEach((w) => expect(w, name).not.toMatch(/undefined|NaN/));
        words.forEach((w) => (w.match(/\$([^$]+)\$/g) || []).forEach((t) => expect(() => katex.renderToString(t.slice(1, -1), { throwOnError: true }), `${name}: ${t}`).not.toThrow()));
        const last = solution(p).at(-1);
        expect(last, name).toContain(String(m.answer(p)));
        expect(last.endsWith(unit), `${name}: ${last}`).toBe(true);
        const inText = (text(p).match(/\$([^$]+)\$/g) || []).flatMap((t) => (t.match(/\d+(?:\.\d+)?/g) || []).map(Number));
        expect(inText.some((v) => near(v, m.answer(p))), `${name}: the answer is printed`).toBe(false);
        const f = fig(p); expect(f.type).toBe('solid');
        Object.values(solidLabels(f)).forEach((l) => expect(inText, `${name}: ${l}`).toContain(Number(l)));
        expect(figPlain(f), name).toBeTruthy();
      });
    });
  }

  it('the transfer of solid:2 asks in litres and says so, and its answer is the cm³ over 1000', () => {
    const p = { a: 50, b: 30, c: 40 };
    expect(SW.tankText(p)).toBe('אקווריום $50$ על $30$ על $40$ ס״מ. כמה ליטרים מים הוא מחזיק?');
    expect(SW.SOLID2T.answer(p)).toBe(60);
    expect(SW.SOLID2T.bugs['no-convert'](p)).toBe(60000);
    expect(SW.tankSolution(p).at(-1)).toBe('בליטר יש $1000$ סמ״ק: $60000 : 1000 = 60$ ליטר');
  });
});

// The circle, the cylinder and the cone (stage 2, MEASURE-4): the practice and diagnosis layer (content/circle.js), not
// on the path yet, tested on its topic object. Every check reads the question as the student sees it. Two answer forms:
// "with π" (after: \pi, a whole number typed before π) and "with π ≈ 3.14" (pk, tenths, the calculator's π right too).
describe('the circle, the cylinder and the cone: every practice kind, from the numbers in its text', () => {
  const { CIRCLE, KIND_KEYS, UNIT, PK_END } = CW;
  const circleItem = (level) => {
    const L = CIRCLE.levels[level - 1]; const it = L.gen();
    return { ...it, diag: (u) => (isCorrect(it, u) ? null : it.diag(u)), topic: 'circle', level, levelTitle: L.title };
  };
  const all = (level, n = RUNS) => Array.from({ length: n }, () => circleItem(level));
  const seededRun = (seed, fn) => () => { const real = Math.random; Math.random = seeded(seed); try { fn(); } finally { Math.random = real; } };
  const kindOf = (it) => it.key.split(':')[0];
  // the numbers of the question, with π's coefficient read as a number (26\pi is 26) and 3.14 as itself
  const shown = (text) => (text.match(/\$([^$]+)\$/g) || []).flatMap((m) => (m.match(/\d+(?:\.\d+)?/g) || []).map(Number));
  const given = (text) => shown(text).filter((v) => v !== 3.14);
  const close = (a, b) => Math.abs(a - b) < 1e-9;
  const tenth = (v) => Math.round(v * 10) / 10;
  let checked = 0;
  const solutionHolds = (it) => it.solution.forEach((line) => (line.match(/\$([^$]+)\$/g) || [])
    .map((m) => m.slice(1, -1).replace(/\\cdot/g, '*').replace(/\\pi/g, '(1)').replace(/\\approx[^=]*/g, ''))
    .filter((m) => m.includes('=') && !/[a-zA-Z□]/.test(m.replace(/\\frac|\\sqrt/g, '')))
    .forEach((m) => {
      m.split('=').reduce((a, b) => { expect(same(evaluate(texToExpr(a)), evaluate(texToExpr(b))), `${it.key}: ${m}`).toBe(true); checked += 1; return b; });
    }));
  afterAll(() => expect(checked).toBeGreaterThan(1000));

  /**
   * The answer computed from the text alone: for a □π question the multiple of π, for a pk question the multiple of π
   * (its answer is then 3.14 times it, to tenths); null for an object or a choice.
   */
  function fromText(it) {
    const n = given(it.text); const t = it.text;
    switch (kindOf(it)) {
      case 'ci1p': case 'ci1r': { const [v] = n; return /מה הרדיוס/.test(t) ? v / 2 : 2 * v; }
      case 'ci1n': { const [v] = n; return /שקוטרו/.test(t) ? v : 2 * v; }
      case 'ci1w': { const [r, k] = n; return 2 * r * k; }
      case 'ci2p': { const [v] = n; return /שקוטרו/.test(t) ? (v / 2) ** 2 : v * v; }
      case 'ci2n': { const [r] = n; return r * r; }
      case 'ci2h': { const [r] = n; return /רבע/.test(t) ? (r * r) / 4 : (r * r) / 2; }
      case 'ci2r': { const [r, w] = n; return (r + w) ** 2 - r * r; }
      case 'ci3v': { const [r, h] = n; return r * r * h; }
      case 'ci3l': { const [r, h] = n; return 2 * r * h; }
      case 'ci3s': { const [r, h] = n; return 2 * r * r + 2 * r * h; }
      case 'ci3f': { expect(t, it.key).toMatch(/ליטר/); const [B, L] = n; return (1000 * L) / B; }
      case 'ci4v': { const [r, h, l] = n; expect(r * r + h * h, it.key).toBe(l * l); return (r * r * h) / 3; }
      case 'ci4h': { const [r, l] = n; return Math.sqrt(l * l - r * r); }
      case 'ci4a': { const [v, h] = n; return /שקוטרו/.test(t) ? (v * h) / 2 : v * h; }
      case 'ci4c': { const [V] = n; return V / 3; }
      default: return null;
    }
  }
  const unitOf = (it) => {
    const k = kindOf(it);
    if (['ci1p', 'ci1n', 'ci1r', 'ci1w', 'ci3f', 'ci4h'].includes(k)) return UNIT.cm;
    if (k === 'ci2r') return UNIT.m2;
    if (['ci2p', 'ci2n', 'ci2h', 'ci3l', 'ci3s', 'ci4a'].includes(k)) return UNIT.cm2;
    return UNIT.cm3; // ci3v, ci4v, ci4c
  };

  for (let level = 1; level <= 4; level += 1) {
    it(`circle:${level}: ${RUNS} draws, every kind; right answers are right, the words and the maths render`, () => {
      const kinds = new Set();
      for (const item of all(level)) {
        kinds.add(kindOf(item));
        expect(item.key).toBeTruthy();
        expect(item.hint).toBeTruthy();
        expect(item.solution?.length).toBeGreaterThan(0);
        expect(isCorrect(item, answerInput(item)), item.key).toBe(true);
        expect(item.diag(answerInput(item))).toBeNull();
        if (item.form === 'manip') { expect(isCorrect(item, manipWrong(item)), item.key).toBe(false); expect(item.practiceOnly, item.key).toBe(true); }
        if (item.form === 'num') expect(parseNum(answerText(item).replace(/π$/, ''))).toBe(item.answer);
        if (item.form === 'mc') {
          expect(item.choices[item.answer]).toBeTruthy();
          expect(item.practiceOnly, item.key).toBe(true);
          expect(item.choices.filter((c) => c.ok)).toHaveLength(1);
        }
        for (const tex of texChunks(item)) expect(() => katex.renderToString(tex, { throwOnError: true }), `${item.key}: ${tex}`).not.toThrow();
        for (const s of [item.text, item.hint, ...item.solution]) (s.match(/\$[^$]+\$/g) || []).forEach((m) => expect(m, item.key).not.toMatch(/[֐-׿]/));
        expect(itemPlain(item)).not.toMatch(/undefined|NaN|\[object/);
        expect([item.text, item.hint, ...item.solution].join(' ')).not.toMatch(/undefined|NaN/);
        if (item.fig) expect(figPlain(item.fig), item.key).toBeTruthy();
        const wrong = item.form === 'num' ? item.answer + 1 : null;
        if (wrong != null) { const c = item.diag(wrong); if (c) expect(CIRCLE.cats[c]).toBeTruthy(); }
        solutionHolds(item);
      }
      expect([...kinds].sort()).toEqual([...KIND_KEYS[level]].sort());
    });
  }

  it('every answer is the computation from the numbers in its text, with π or with π ≈ 3.14', () => {
    let n = 0;
    for (let level = 1; level <= 4; level += 1) {
      for (const it of all(level)) {
        const want = fromText(it);
        if (want == null) continue;
        if (Number.isFinite(it.pk)) { expect(it.pk, it.key).toBeCloseTo(want, 9); expect(it.answer, it.key).toBeCloseTo(tenth(3.14 * want), 9); } else expect(it.answer, it.key).toBeCloseTo(want, 9);
        n += 1;
        if (kindOf(it) === 'ci1m') expect(tenth(2 * Math.PI * it.answer.r)).toBe(given(it.text)[0]);
      }
      for (const it of all(level, 100)) {
        const k = kindOf(it);
        if (k === 'ci1m') { expect(it.answer.mode).toBe('r'); expect(tenth(2 * Math.PI * it.answer.r), it.key).toBe(given(it.text)[0]); expect(it.manip.start.r).not.toBe(it.answer.r); }
        if (k === 'ci2m') { expect(it.answer.mode).toBe('r'); expect(tenth(Math.PI * it.answer.r ** 2), it.key).toBe(given(it.text)[0]); expect(it.manip.radius).toBe(true); }
        if (k === 'ci3m') { const [a, b] = given(it.text); expect(a > b, it.key).toBe(true); expect(it.choices[it.answer].text, it.key).toMatch(/הארוכה/); }
        if (k === 'ci4m') expect(it.choices[it.answer].tex).toBe('3');
      }
    }
    expect(n).toBeGreaterThan(900);
  });

  it('a question with π: its answer is whole, its text says \\pi, and the answer is written with π after it', () => {
    let pi = 0;
    for (let level = 1; level <= 4; level += 1) {
      for (const it of all(level)) {
        if (it.after == null) continue;
        pi += 1;
        expect(it.after, it.key).toBe(PI_AFTER);
        expect(Number.isInteger(it.answer), it.key).toBe(true);
        expect(it.text, it.key).toContain('\\pi');
        expect(answerText(it).endsWith('π'), `${it.key}: ${answerText(it)}`).toBe(true);
        // the radius from a circumference is typed with no π
        expect(/מה הרדיוס/.test(it.text), it.key).toBe(false);
      }
    }
    expect(pi).toBeGreaterThan(500);
  });

  it('a question with π ≈ 3.14 says so at its end, and takes the 3.14 value and the calculator\'s π value, to tenths', () => {
    let pks = 0;
    for (let level = 1; level <= 2; level += 1) {
      for (const it of all(level)) {
        if (!Number.isFinite(it.pk)) continue;
        pks += 1;
        expect(it.text, it.key).toContain('3.14');
        expect(it.text.endsWith(PK_END), it.key).toBe(true);
        expect(it.after, it.key).toBeUndefined();
        expect(isCorrect(it, tenth(3.14 * it.pk)), it.key).toBe(true);
        expect(isCorrect(it, tenth(Math.PI * it.pk)), it.key).toBe(true);
        // two tenths past both values (past π·pk, the larger) is wrong
        expect(isCorrect(it, tenth(Math.PI * it.pk) + 0.2), it.key).toBe(false);
        expect(isCorrect(it, it.pk), `${it.key}: the multiple of π alone`).toBe(false);
        expect(answerText(it), it.key).toBe(String(it.answer)); // a decimal, never a fraction
      }
    }
    expect(pks).toBeGreaterThan(150);
  });

  it('every typed answer has the unit of what is asked; a question in litres says ליטר', () => {
    for (let level = 1; level <= 4; level += 1) {
      for (const it of all(level)) {
        if (it.form !== 'num') continue;
        expect(it.unit, it.key).toBe(unitOf(it));
        if (kindOf(it) === 'ci3f') expect(it.text, it.key).toMatch(/ליטר/);
      }
    }
  });

  it('no question\'s answer is a number its text prints, and every number a drawing writes is in the text', () => {
    for (let level = 1; level <= 4; level += 1) {
      for (const it of all(level)) {
        const printed = shown(it.text);
        if (it.form === 'num') expect(printed.some((v) => close(v, it.answer)), `${it.key}: ${it.answer} is printed`).toBe(false);
        if (!it.fig) continue;
        const written = it.fig.type === 'solid' ? Object.values(solidLabels(it.fig))
          : [...(it.fig.segs || []).map((s) => s.label), ...(it.fig.circles || []).map((c) => c.label)];
        written.filter((l) => /^\d+(\.\d+)?$/.test(String(l))).forEach((l) => expect(printed, `${it.key}: the drawing writes ${l}`).toContain(Number(l)));
        // the length asked for is drawn as ?, never as its number
        if (it.form === 'num' && /מה (הרדיוס|גובהו)/.test(it.text)) expect(written.map(String), it.key).not.toContain(String(it.answer));
      }
    }
  });

  it('every mistake a kind is built to name, it names (from the text\'s own numbers, in its 3.14 and π versions), and only those', seededRun(8141, () => {
    // the wrong answer each mistake gives, computed from the numbers in the text: a number, or { pk } a multiple of π
    const PRED = {
      ci1p: ([v], t) => (/מה הרדיוס/.test(t) ? [['d-for-r', v]] : [['r-for-d', v], ['area-for-circ', v * v]]),
      ci1r: ([c]) => [['d-for-r', c]],
      ci1n: ([v], t) => (/שקוטרו/.test(t) ? [['d-for-r', { pk: 2 * v }], ['area-for-circ', { pk: (v / 2) ** 2 }]] : [['r-for-d', { pk: v }], ['area-for-circ', { pk: v * v }]]),
      ci1w: ([r, k]) => [['r-for-d', { pk: r * k }]],
      ci2p: ([v], t) => (/שקוטרו/.test(t) ? [['circ-for-area', v], ['d-in-area', v * v]] : [['circ-for-area', 2 * v]]),
      ci2n: ([r]) => [['circ-for-area', { pk: 2 * r }]],
      ci2h: ([r]) => [['whole-circle', r * r]],
      ci2r: ([r, w]) => [['ring-sub-radii', w * w], ['no-subtract', (r + w) ** 2]],
      ci3v: ([r, h]) => [['d-in-area', 4 * r * r * h], ['lateral-for-vol', 2 * r * h]],
      ci3l: ([r, h]) => [['r-for-d', r * h], ['area-for-circ', r * r * h]],
      ci3s: ([r, h]) => [['one-base', r * r + 2 * r * h], ['no-bases', 2 * r * h]],
      ci3f: ([B, L]) => [['no-convert', L / B]],
      ci4v: ([r, h, l]) => [['no-third', r * r * h], ['slant-as-height', (r * r * l) / 3]],
      ci4h: ([r, l]) => [['add-not-sub', Math.sqrt(l * l + r * r)], ['subtract-sides', l - r]],
      ci4a: ([v, h], t) => { const r = /שקוטרו/.test(t) ? v / 2 : v; return [['no-half', 2 * r * h], ['r-for-d', (r * h) / 2]]; },
      ci4c: ([V]) => [['no-third', V]],
    };
    const WANT = {
      ci1p: ['r-for-d', 'area-for-circ', 'd-for-r'], ci1n: ['r-for-d', 'd-for-r', 'area-for-circ'], ci1r: ['d-for-r'], ci1w: ['r-for-d'], ci1m: [],
      ci2p: ['circ-for-area', 'd-in-area'], ci2n: ['circ-for-area'], ci2h: ['whole-circle'], ci2r: ['ring-sub-radii', 'no-subtract'], ci2m: [],
      ci3v: ['d-in-area', 'lateral-for-vol'], ci3l: ['r-for-d', 'area-for-circ'], ci3s: ['one-base', 'no-bases'], ci3f: ['no-convert'], ci3m: ['same-sheet'],
      ci4v: ['no-third', 'slant-as-height'], ci4h: ['add-not-sub', 'subtract-sides'], ci4a: ['no-half', 'r-for-d'], ci4c: ['no-third'], ci4m: ['no-third'],
    };
    const got = {};
    for (let level = 1; level <= 4; level += 1) {
      for (const it of all(level, 200)) {
        const k = kindOf(it); got[k] ||= new Set();
        if (PRED[k]) {
          for (const [id, v] of PRED[k](given(it.text), it.text)) {
            if (typeof v === 'object') {
              if (close(v.pk, it.pk)) continue; // the mistake gives the answer here (a diameter of 4: (4/2)² = 4)
              // a pk mistake, typed with 3.14 or with the calculator's π, to tenths
              for (const u of [tenth(3.14 * v.pk), tenth(Math.PI * v.pk)]) { expect(isCorrect(it, u), `${it.key} ${id}`).toBe(false); expect(it.diag(u), `${it.key} ${id}: ${u}`).toBe(id); }
            } else {
              if (close(v, it.answer)) continue; // the mistake does not show on this question (2rh and r²h at r = 2)
              expect(it.diag(Number.isInteger(v) ? v : Math.round(v * 10) / 10), `${it.key} ${id}: ${v}`).toBe(id);
            }
            got[k].add(id);
          }
        }
        if (it.form === 'mc') it.choices.forEach((c, i) => { const d = it.diag(i); if (d) { expect(c.ok, it.key).toBeFalsy(); got[k].add(d); } });
        namesOf(it).forEach((c) => expect(WANT[k], `${it.key} names ${c}`).toContain(c));
      }
    }
    for (const [k, ids] of Object.entries(WANT)) expect([...(got[k] || [])].sort(), k).toEqual([...ids].sort());
    expect([...new Set(Object.values(WANT).flat())].sort()).toEqual(Object.keys(CIRCLE.cats).sort());
  }), 30_000); // 200 draws a level, each mistake typed two ways: a few seconds alone, more beside the full suite

  it('the axial section is redrawn at rh = 20, where half of it would also read as a ten-off slip', () => {
    for (const it of all(4, 800)) if (kindOf(it) === 'ci4a') expect(it.answer, it.key).not.toBe(20);
  });

  it('the topic: grade 8, cobalt, not in the placement test, four stairs, its words, and on the ח׳ path after Pythagoras', () => {
    expect(CIRCLE).toMatchObject({ id: 'circle', grade: '8', title: 'מעגל, גליל וחרוט', desc: 'היקף מעגל, שטח עיגול, גליל וחרוט', color: 'cobalt', placement: false });
    expect(CIRCLE.levels.map((L) => L.title)).toEqual(['היקף מעגל', 'שטח עיגול', 'גליל', 'חרוט']);
    expect(CIRCLE.lesson.points).toHaveLength(5);
    expect(CIRCLE.lesson.words).toContain('קו יוצר');
    // on the path since its teaching landed: after Pythagoras, before statistics, cobalt between violet and fuchsia
    expect(TOPICS.find((t) => t.id === 'circle').levels.map((L) => [L.title, L.gen])).toEqual(CIRCLE.levels.map((L) => [L.title, L.gen])); // the path's copy, with this file's generators
    const g8 = topicsFor('8').map((t) => t.id); const at = g8.indexOf('circle');
    expect(g8.slice(at - 1, at + 2)).toEqual(['pyth', 'circle', 'stats']);
    expect(topicsFor('8').slice(at - 1, at + 2).map((t) => t.color)).toEqual(['violet', 'cobalt', 'fuchsia']);
    // the ids other topics use keep their names but for one-base, no-convert and slant-as-height, said in this unit's words
    for (const t of TOPICS) for (const [id, name] of Object.entries(t.cats || {})) {
      // (space says r-for-d as the side of the axial section: its own test)
      if (t.id === 'space' && id === 'r-for-d') continue;
      // (the angles unit's no-half is half an angle, the bisector of CLASSROOM-10; the congruence unit's too)
      if (['angles', 'congr'].includes(t.id) && id === 'no-half') continue;
      if (CIRCLE.cats[id] && !['one-base', 'no-convert', 'slant-as-height'].includes(id)) expect(CIRCLE.cats[id], `${t.id} ${id}`).toBe(name);
    }
    expect(CIRCLE.cats['no-convert']).toBe(SW.SOLID.cats['no-convert'].replace('סמ״ק לליטרים', 'ליטרים לסמ״ק'));
  });
});

// The eight models of the circle, the cylinder and the cone (stage2.md Appendix B): 4,000 seeded draws of each.
describe('the circle, the cylinder and the cone: the diagnostic and transfer models', () => {
  const B = {
    CIRCLE1: [[2, 30], { 'r-for-d': 47, 'area-for-circ': 43, 'd-for-r': 53 }],
    CIRCLE1T: [[2, 30], { 'r-for-d': 47, 'area-for-circ': 43, 'd-for-r': 53 }],
    CIRCLE2: [[9, 144], { 'circ-for-area': 100, 'd-in-area': 50 }],
    CIRCLE2T: [[5, 125], { 'ring-sub-radii': 100, 'no-subtract': 100 }],
    CIRCLE3: [[12, 2000], { 'd-in-area': 100, 'lateral-for-vol': 89 }],
    CIRCLE3T: [[12, 400], { 'r-for-d': 100, 'area-for-circ': 89 }],
    CIRCLE4: [[12, 800], { 'no-third': 100, 'slant-as-height': 100 }],
    CIRCLE4T: [[12, 800], { 'no-third': 100, 'slant-as-height': 100 }],
  };
  const { UNIT } = CW;
  const WORDS = {
    CIRCLE1: [CW.circle1Text, CW.circle1Fig, CW.circle1Solution, CW.circle1Hint, UNIT.cm],
    CIRCLE1T: [CW.trackText, CW.trackFig, CW.trackSolution, CW.trackHint, UNIT.m],
    CIRCLE2: [CW.circle2Text, CW.circle2Fig, CW.circle2Solution, CW.circle2Hint, UNIT.cm2],
    CIRCLE2T: [CW.poolText, CW.poolFig, CW.poolSolution, CW.poolHint, UNIT.m2],
    CIRCLE3: [CW.circle3Text, CW.circle3Fig, CW.circle3Solution, CW.circle3Hint, UNIT.cm3],
    CIRCLE3T: [CW.labelText, CW.labelFig, CW.labelSolution, CW.labelHint, UNIT.cm2],
    CIRCLE4: [CW.circle4Text, CW.circle4Fig, CW.circle4Solution, CW.circle4Hint, UNIT.cm3],
    CIRCLE4T: [CW.iceText, CW.iceFig, CW.iceSolution, CW.iceHint, UNIT.cm3],
  };
  const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  const N = 4000;

  it('the stairs\' models are these eight, and all ask with π but the radius from a circumference', () => {
    expect(CW.STAIR_MODELS).toEqual({ 'circle:1': [CW.CIRCLE1, CW.CIRCLE1T], 'circle:2': [CW.CIRCLE2, CW.CIRCLE2T], 'circle:3': [CW.CIRCLE3, CW.CIRCLE3T], 'circle:4': [CW.CIRCLE4, CW.CIRCLE4T] });
    expect(CW.CIRCLE1.after({ k: 0, r: 13, c: 26 })).toBe(PI_AFTER);
    expect(CW.CIRCLE1.after({ k: 1, r: 13, c: 26 })).toBeUndefined();
    expect(CW.CIRCLE1T.after({ k: 1, r: 13, c: 26 })).toBeUndefined();
    for (const m of [CW.CIRCLE2, CW.CIRCLE2T, CW.CIRCLE3, CW.CIRCLE3T, CW.CIRCLE4, CW.CIRCLE4T]) expect(m.after).toBe(PI_AFTER);
  });

  it('Appendix B\'s worked models: a few draws by hand', () => {
    expect(CW.CIRCLE1.answer({ k: 0, r: 6, c: 12 })).toBe(12); // 2π · 6 = 12π
    expect(CW.CIRCLE1.answer({ k: 1, r: 13, c: 26 })).toBe(13); // 26π → 13
    expect(CW.CIRCLE2.answer({ k: 1, r: 5, d: 10 })).toBe(25); expect(CW.CIRCLE2.bugs['d-in-area']({ k: 1, r: 5, d: 10 })).toBe(100);
    expect(CW.CIRCLE2T.answer({ r: 4, w: 2, R: 6 })).toBe(20); expect(CW.CIRCLE2T.bugs['ring-sub-radii']({ r: 4, w: 2, R: 6 })).toBe(4);
    expect(CW.CIRCLE3.answer({ r: 5, h: 8 })).toBe(200); expect(CW.CIRCLE3T.answer({ r: 6, h: 10 })).toBe(120);
    expect(CW.CIRCLE4.answer({ r: 3, h: 4, l: 5 })).toBe(12); expect(CW.CIRCLE4.bugs['slant-as-height']({ r: 3, h: 4, l: 5 })).toBe(15);
    // a diameter-given circumference with π is never asked: a draw has k 0 (from the radius) or k 1 (the radius asked)
    const r = seeded(5); for (let i = 0; i < 500; i += 1) { const p = CW.CIRCLE1.params(r); expect(CW.circle1Text(p)).not.toMatch(/שקוטרו/); }
  });

  for (const [name, [[lo, hi], rates]] of Object.entries(B)) {
    it(`${name}: whole answers in ${lo}..${hi}, clean draws, every bug as Appendix B says, every pair told apart`, () => {
      const m = CW[name]; const r = seeded(name.length * 7919 + 17 + name.charCodeAt(6));
      const fired = {}; const draws = []; let min = Infinity; let max = -Infinity;
      for (let i = 0; i < N; i += 1) {
        const p = m.params(r); const a = m.answer(p); draws.push(p); min = Math.min(min, a); max = Math.max(max, a);
        expect(Number.isInteger(a), `${name} ${JSON.stringify(p)}`).toBe(true);
        expect(AW.clean(m, p), `${name} ${JSON.stringify(p)}`).toBe(true);
        for (const [id, f] of Object.entries(m.bugs)) { const v = f(p); if (v != null && Number.isFinite(v) && !near(v, a)) fired[id] = (fired[id] || 0) + 1; }
      }
      expect(min, name).toBeGreaterThanOrEqual(lo); expect(max, name).toBeLessThanOrEqual(hi);
      expect(Object.keys(m.bugs).sort()).toEqual(Object.keys(rates).sort());
      for (const [id, want] of Object.entries(rates)) {
        const rate = (100 * (fired[id] || 0)) / N;
        expect(Math.abs(rate - want), `${name} ${id}: ${rate.toFixed(1)}% against ${want}%`).toBeLessThanOrEqual(3);
      }
      const ids = Object.keys(m.bugs);
      for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) {
        const ties = draws.filter((p) => { const x = m.bugs[ids[i]](p); const y = m.bugs[ids[j]](p); return x != null && y != null && near(x, y); }).length;
        expect(ties / N, `${name}: ${ids[i]} and ${ids[j]}`).toBeLessThan(0.02);
      }
      const [text, fig, solution, hint, unit] = WORDS[name];
      draws.filter((_, i) => i % 40 === 0).forEach((p) => {
        const words = [text(p), hint(p), ...solution(p)];
        words.forEach((w) => expect(w, name).not.toMatch(/undefined|NaN/));
        words.forEach((w) => (w.match(/\$([^$]+)\$/g) || []).forEach((t) => expect(() => katex.renderToString(t.slice(1, -1), { throwOnError: true }), `${name}: ${t}`).not.toThrow()));
        const last = solution(p).at(-1);
        expect(last, name).toContain(String(m.answer(p)));
        expect(last.endsWith(unit), `${name}: ${last}`).toBe(true);
        const inText = (text(p).match(/\$([^$]+)\$/g) || []).flatMap((t) => (t.match(/\d+(?:\.\d+)?/g) || []).map(Number));
        expect(inText.some((v) => near(v, m.answer(p))), `${name}: the answer is printed`).toBe(false);
        // with π after the answer, the text says בעזרת π; the radius asked from a circumference does not
        const after = typeof m.after === 'function' ? m.after(p) : m.after;
        expect(text(p).includes('כתבו בעזרת $\\pi$'), name).toBe(after === PI_AFTER);
        const f = fig(p);
        const written = f.type === 'solid' ? Object.values(solidLabels(f)) : [...(f.segs || []).map((s) => s.label), ...(f.circles || []).map((c) => c.label)];
        written.filter((l) => /^\d+(\.\d+)?$/.test(String(l))).forEach((l) => expect(inText, `${name}: ${l}`).toContain(Number(l)));
        expect(figPlain(f), name).toBeTruthy();
      });
    });
  }
});

// Pythagoras in space (stage2.md MEASURE-5): every practice kind, read back from the numbers its text prints.
describe('Pythagoras in space: every practice kind, from the numbers in its text', () => {
  const { SPACE, KIND_KEYS, UNIT } = PW;
  const spaceItem = (level) => {
    const L = SPACE.levels[level - 1]; const it = L.gen();
    return { ...it, diag: (u) => (isCorrect(it, u) ? null : it.diag(u)), topic: 'space', level, levelTitle: L.title };
  };
  const all = (level, n = RUNS) => Array.from({ length: n }, () => spaceItem(level));
  const seededRun = (seed, fn) => () => { const real = Math.random; Math.random = seeded(seed); try { fn(); } finally { Math.random = real; } };
  const kindOf = (it) => it.key.split(':')[0];
  const shown = (text) => (text.match(/\$([^$]+)\$/g) || []).flatMap((m) => (m.match(/\d+(?:\.\d+)?/g) || []).map(Number));
  const close = (a, b) => Math.abs(a - b) < 1e-9;
  const tenth = (v) => Math.round(v * 10) / 10;
  const typed = (v) => (Number.isInteger(v) ? v : tenth(v));
  const hyp = (...xs) => Math.sqrt(xs.reduce((s, x) => s + x * x, 0));
  let checked = 0;
  const solutionHolds = (it) => it.solution.forEach((line) => (line.match(/\$([^$]+)\$/g) || [])
    .map((m) => m.slice(1, -1).replace(/\\cdot/g, '*').replace(/\\pi/g, '(1)').replace(/\\approx[^=]*/g, ''))
    .filter((m) => m.includes('=') && !/[a-zA-Z□]/.test(m.replace(/\\frac|\\sqrt/g, '')))
    .forEach((m) => {
      m.split('=').reduce((a, b) => { expect(same(evaluate(texToExpr(a)), evaluate(texToExpr(b))), `${it.key}: ${m}`).toBe(true); checked += 1; return b; });
    }));
  afterAll(() => expect(checked).toBeGreaterThan(1000));

  /** The answer computed from the text alone, before rounding (a cone's volume: the multiple of π); null for a choice. */
  function fromText(it) {
    const n = shown(it.text); const t = it.text;
    switch (kindOf(it)) {
      case 'sp1s': { const [a, b, c] = n; return hyp(a, b, c); }
      case 'sp1f': { const [a, b] = n; return hyp(a, b); }
      case 'sp1c': { const [s] = n; return s * Math.sqrt(3); }
      case 'sp1m': { const [d, a, b] = n; return Math.sqrt(d * d - a * a - b * b); }
      case 'sp2r': { const [v, h] = n; return hyp(/שקוטרו/.test(t) ? v : 2 * v, h); }
      case 'sp2t': { const [a, b, c] = n; return (hyp(a, b) * c) / 2; }
      case 'sp2v': { const [r, l] = n; return (r * r * Math.sqrt(l * l - r * r)) / 3; }
      case 'sp2p': { const [a, b, L] = n; return hyp(a, b) * L; }
      default: return null;
    }
  }
  const unitOf = (it) => {
    const k = kindOf(it);
    if (['sp2t', 'sp2p'].includes(k)) return UNIT.cm2;
    if (k === 'sp2v') return UNIT.cm3;
    return UNIT.cm;
  };

  for (let level = 1; level <= 2; level += 1) {
    it(`space:${level}: ${RUNS} draws, every kind; right answers are right, the words and the maths render`, () => {
      const kinds = new Set();
      for (const item of all(level)) {
        kinds.add(kindOf(item));
        expect(item.key).toBeTruthy();
        expect(item.hint).toBeTruthy();
        expect(item.solution?.length).toBeGreaterThan(0);
        expect(isCorrect(item, answerInput(item)), item.key).toBe(true);
        expect(item.diag(answerInput(item))).toBeNull();
        if (item.form === 'num') expect(parseNum(answerText(item).replace(/π$/, ''))).toBe(item.answer);
        if (item.form === 'mc') {
          expect(item.choices[item.answer]).toBeTruthy();
          expect(item.practiceOnly, item.key).toBe(true);
          expect(item.choices.filter((c) => c.ok)).toHaveLength(1);
        }
        for (const tex of texChunks(item)) expect(() => katex.renderToString(tex, { throwOnError: true }), `${item.key}: ${tex}`).not.toThrow();
        for (const s of [item.text, item.hint, ...item.solution]) (s.match(/\$[^$]+\$/g) || []).forEach((m) => expect(m, item.key).not.toMatch(/[֐-׿]/));
        expect(itemPlain(item)).not.toMatch(/undefined|NaN|\[object/);
        expect([item.text, item.hint, ...item.solution].join(' ')).not.toMatch(/undefined|NaN/);
        if (item.fig) expect(figPlain(item.fig), item.key).toBeTruthy();
        const wrong = item.form === 'num' ? item.answer + 1 : null;
        if (wrong != null) { const c = item.diag(wrong); if (c) expect(SPACE.cats[c]).toBeTruthy(); }
        solutionHolds(item);
      }
      expect([...kinds].sort()).toEqual([...KIND_KEYS[level]].sort());
    });
  }

  it('every answer is the computation from the numbers in its text: whole, or rounded to tenths and right within half a tenth', () => {
    let n = 0; let rounded = 0;
    for (let level = 1; level <= 2; level += 1) {
      for (const it of all(level)) {
        const want = fromText(it);
        if (want == null) continue;
        n += 1;
        if (Number.isInteger(Math.round(want * 1e9) / 1e9)) { expect(it.answer, it.key).toBeCloseTo(want, 9); expect(it.exact, it.key).toBeUndefined(); continue; }
        // a length that is not whole: rounded, its question says so, and both its rounding and its exact value are right
        rounded += 1;
        expect(it.answer, it.key).toBe(tenth(want));
        expect(it.exact, it.key).toBeCloseTo(want, 9);
        expect(it.text, it.key).toMatch(/עגלו לעשירית/);
        expect(isCorrect(it, tenth(want)), it.key).toBe(true);
        expect(isCorrect(it, tenth(want) + 0.2), it.key).toBe(false);
      }
    }
    expect(n).toBeGreaterThan(450);
    expect(rounded).toBeGreaterThan(40);
  });

  it('the cone\'s volume (sp2v) is asked with π, from a radius and a slant height whose height is whole', () => {
    let pi = 0;
    for (const it of all(2)) {
      if (kindOf(it) !== 'sp2v') { expect(it.after, it.key).toBeUndefined(); continue; }
      pi += 1;
      expect(it.after, it.key).toBe(PI_AFTER);
      expect(Number.isInteger(it.answer), it.key).toBe(true);
      expect(it.text, it.key).toContain('כתבו בעזרת $\\pi$');
      expect(answerText(it).endsWith('π'), it.key).toBe(true);
      const [r, l] = shown(it.text); expect(Number.isInteger(Math.sqrt(l * l - r * r)), it.key).toBe(true);
    }
    expect(pi).toBeGreaterThan(20);
    for (const it of all(1)) expect(it.after, it.key).toBeUndefined();
  });

  it('every typed answer has the unit of what is asked', () => {
    for (let level = 1; level <= 2; level += 1) for (const it of all(level)) if (it.form === 'num') expect(it.unit, it.key).toBe(unitOf(it));
  });

  it('no question\'s answer is a number its text prints, and every number a drawing writes is in the text', () => {
    for (let level = 1; level <= 2; level += 1) {
      for (const it of all(level)) {
        const printed = shown(it.text);
        if (it.form === 'num') expect(printed.some((v) => close(v, it.answer)), `${it.key}: ${it.answer} is printed`).toBe(false);
        if (!it.fig) continue;
        const written = it.fig.type === 'solid' ? Object.values(solidLabels(it.fig)) : (it.fig.segs || []).map((s) => s.label);
        written.filter((l) => /^\d+(\.\d+)?$/.test(String(l))).forEach((l) => expect(printed, `${it.key}: the drawing writes ${l}`).toContain(Number(l)));
        // the length asked for is drawn as ?, never as its number
        if (it.form === 'num') expect(written.map(String), it.key).not.toContain(String(it.answer));
      }
    }
  });

  it('a box\'s diagonal is marked only where the box\'s diagonal is asked; a face\'s where a face\'s is', () => {
    for (let level = 1; level <= 2; level += 1) {
      for (const it of all(level)) {
        const diag = [it.fig?.diag || []].flat();
        const asksBox = /האלכסון של (התיבה|קובייה)|המקל הארוך ביותר שנכנס בארגז|האלכסון של תיבה/.test(it.text);
        // the triangle a box's diagonal stands in ('tri', sp2t) draws that diagonal as its hypotenuse
        expect(diag.includes('space') || diag.includes('tri'), `${it.key}: ${it.text}`).toBe(asksBox || kindOf(it) === 'sp2t');
        expect(diag.includes('face'), it.key).toBe(kindOf(it) === 'sp1f');
        // which segment is the box's diagonal: the three are drawn alike and named by letters, never marked
        if (kindOf(it) === 'sp1w') { expect(diag, it.key).toEqual([]); expect(it.fig.segs.map((s) => s.label), it.key).toEqual(['א', 'ב', 'ג']); }
      }
    }
  });

  it('which segment is the box\'s diagonal (sp1w): one runs corner to opposite corner, the other two lie on faces', () => {
    const corner = (i) => [i === 1 || i === 2 || i === 5 || i === 6 ? 1 : 0, i === 2 || i === 3 || i === 6 || i === 7 ? 1 : 0, i >= 4 ? 1 : 0];
    let n = 0;
    for (const it of all(1)) {
      if (kindOf(it) !== 'sp1w') continue;
      n += 1;
      it.fig.segs.forEach((s, i) => {
        const differ = corner(s.from).filter((v, k) => v !== corner(s.to)[k]).length;
        expect(differ, `${it.key} ${s.label}`).toBe(it.choices[i].ok ? 3 : 2);
      });
      expect(figPlain(it.fig), it.key).not.toMatch(/אלכסון/);
    }
    expect(n).toBeGreaterThan(20);
  });

  it('every mistake a kind is built to name, it names (from the text\'s own numbers), and only those', seededRun(8171, () => {
    const PRED = {
      sp1s: ([a, b, c]) => [['face-for-space', hyp(a, b)], ['add-edges3', a + b + c], ['no-root', a * a + b * b + c * c]],
      sp1f: ([a, b]) => [['add-legs', a + b], ['no-root', a * a + b * b]],
      sp1c: ([s]) => [['face-for-space', s * Math.SQRT2], ['add-edges3', 3 * s]],
      sp1m: ([d, a, b]) => [['add-not-sub', hyp(d, a, b)]],
      sp2r: ([v, h], t) => { const d = /שקוטרו/.test(t) ? v : 2 * v; return [['r-for-d', hyp(d / 2, h)], ['add-legs', d + h]]; },
      sp2t: ([a, b, c]) => [['add-legs', ((a + b) * c) / 2], ['no-half', hyp(a, b) * c]],
      sp2v: ([r, l]) => { const h = Math.sqrt(l * l - r * r); return [['no-third', r * r * h], ['slant-as-height', (r * r * l) / 3]]; },
      sp2p: ([a, b, L]) => [['add-legs', (a + b) * L]],
    };
    const WANT = {
      sp1s: ['face-for-space', 'add-edges3', 'no-root'], sp1f: ['add-legs', 'no-root'], sp1c: ['face-for-space', 'add-edges3'], sp1m: ['add-not-sub'], sp1w: ['which-diagonal'],
      sp2r: ['r-for-d', 'add-legs'], sp2t: ['add-legs', 'no-half'], sp2v: ['no-third', 'slant-as-height'], sp2p: ['add-legs'], sp2m: [],
    };
    const got = {};
    for (let level = 1; level <= 2; level += 1) {
      for (const it of all(level, 200)) {
        const k = kindOf(it); got[k] ||= new Set();
        if (PRED[k]) {
          for (const [id, v] of PRED[k](shown(it.text), it.text)) {
            if (close(typed(v), it.answer)) continue;
            expect(it.diag(typed(v)), `${it.key} ${id}: ${v}`).toBe(id);
            got[k].add(id);
          }
        }
        if (it.form === 'mc') it.choices.forEach((c, i) => { const d = it.diag(i); if (d) { expect(c.ok, it.key).toBeFalsy(); got[k].add(d); } });
        namesOf(it).forEach((c) => expect(WANT[k], `${it.key} names ${c}`).toContain(c));
      }
    }
    for (const [k, ids] of Object.entries(WANT)) expect([...(got[k] || [])].sort(), k).toEqual([...ids].sort());
    expect([...new Set(Object.values(WANT).flat())].sort()).toEqual(Object.keys(SPACE.cats).sort());
  }), 30_000);

  it('the topic: grade 8, sky, not in the placement test, two stairs, its words, and last on the ח׳ path, after probability', () => {
    expect(SPACE).toMatchObject({ id: 'space', grade: '8', title: 'פיתגורס במרחב', color: 'sky', placement: false });
    expect(SPACE.levels.map((L) => L.title)).toEqual(['אלכסון בקובייה ובתיבה', 'משולשים ישרי־זווית בגופים']);
    expect(SPACE.lesson.points).toHaveLength(5);
    expect(SPACE.lesson.words).toEqual(expect.arrayContaining(['אלכסון פאה', 'אלכסון התיבה', 'חתך צירי']));
    expect(TOPICS.find((t) => t.id === 'space').levels.map((L) => [L.title, L.gen])).toEqual(SPACE.levels.map((L) => [L.title, L.gen])); // the path's copy, with this file's generators
    const g8 = topicsFor('8');
    expect(g8.at(-1).id).toBe('space');
    expect(g8.slice(-3).map((t) => [t.id, t.color])).toEqual([['sys', 'petrol'], ['prob', 'fuchsia'], ['space', 'sky']]);
    // the ids other topics use keep their names, but for r-for-d, said here as the side of the axial section; the cone's
    // slant height is said as the circle says it (areas and boxes say a slanted side)
    for (const t of TOPICS) for (const [id, name] of Object.entries(t.cats || {})) {
      // (the angles unit's no-half is half an angle, the bisector of CLASSROOM-10; the congruence unit's too)
      if (t.id === 'space' || !SPACE.cats[id] || id === 'r-for-d' || (id === 'slant-as-height' && t.id !== 'circle') || (['angles', 'congr'].includes(t.id) && id === 'no-half')) continue;
      expect(SPACE.cats[id], `${t.id} ${id}`).toBe(name);
    }
    expect(SPACE.cats['r-for-d'].startsWith(CW.CIRCLE.cats['r-for-d'])).toBe(true);
  });
});

// The four models of Pythagoras in space (stage2.md Appendix B): 4,000 seeded draws of each.
describe('Pythagoras in space: the diagnostic and transfer models', () => {
  const B = {
    SPACE1: [[3, 33], { 'face-for-space': 100, 'add-edges3': 100, 'no-root': 100 }],
    SPACE1T: [[3, 33], { 'face-for-space': 100, 'add-edges3': 100 }],
    SPACE2: [[5, 30], { 'r-for-d': 100, 'add-legs': 100 }],
    SPACE2T: [[5, 225], { 'add-legs': 100, 'no-half': 100 }],
  };
  const { UNIT } = PW;
  const WORDS = {
    SPACE1: [PW.space1Text, PW.space1Fig, PW.space1Solution, PW.space1Hint, UNIT.cm],
    SPACE1T: [PW.stickText, PW.stickFig, PW.stickSolution, PW.stickHint, UNIT.cm],
    SPACE2: [PW.space2Text, PW.space2Fig, PW.space2Solution, PW.space2Hint, UNIT.cm],
    SPACE2T: [PW.triText, PW.triFig, PW.triSolution, PW.triHint, UNIT.cm2],
  };
  const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  const N = 4000;

  it('the stairs\' models are these four, none with π', () => {
    expect(PW.STAIR_MODELS).toEqual({ 'space:1': [PW.SPACE1, PW.SPACE1T], 'space:2': [PW.SPACE2, PW.SPACE2T] });
    for (const m of [PW.SPACE1, PW.SPACE1T, PW.SPACE2, PW.SPACE2T]) expect(m.after).toBeUndefined();
  });

  it('Appendix B\'s worked models: a few draws by hand', () => {
    expect(PW.SPACE1.answer({ a: 3, b: 4, c: 12, d: 13 })).toBe(13);
    expect(PW.SPACE1.bugs['face-for-space']({ a: 3, b: 4, c: 12, d: 13 })).toBe(5);
    expect(PW.SPACE1.bugs['add-edges3']({ a: 3, b: 4, c: 12, d: 13 })).toBe(19);
    expect(PW.SPACE2.answer({ r: 3, d: 6, h: 8, rod: 10 })).toBe(10);
    expect(PW.SPACE2.bugs['r-for-d']({ r: 3, d: 6, h: 8, rod: 10 })).toBeCloseTo(Math.sqrt(73), 9);
    expect(PW.SPACE2T.answer({ a: 3, b: 4, e: 5, c: 6 })).toBe(15);
    expect(PW.SPACE2T.bugs['no-half']({ a: 3, b: 4, e: 5, c: 6 })).toBe(30);
    // never a cube in the box model: a cube's diagonal is never whole
    const r = seeded(7); for (let i = 0; i < 500; i += 1) { const p = PW.SPACE1.params(r); expect(p.a === p.b && p.b === p.c).toBe(false); }
  });

  for (const [name, [[lo, hi], rates]] of Object.entries(B)) {
    it(`${name}: whole answers in ${lo}..${hi}, clean draws, every bug as Appendix B says, every pair told apart`, () => {
      const m = PW[name]; const r = seeded(name.length * 7919 + 29 + name.charCodeAt(5));
      const fired = {}; const draws = []; let min = Infinity; let max = -Infinity;
      for (let i = 0; i < N; i += 1) {
        const p = m.params(r); const a = m.answer(p); draws.push(p); min = Math.min(min, a); max = Math.max(max, a);
        expect(Number.isInteger(a), `${name} ${JSON.stringify(p)}`).toBe(true);
        expect(AW.clean(m, p), `${name} ${JSON.stringify(p)}`).toBe(true);
        for (const [id, f] of Object.entries(m.bugs)) { const v = f(p); if (v != null && Number.isFinite(v) && !near(v, a)) fired[id] = (fired[id] || 0) + 1; }
      }
      expect(min, name).toBeGreaterThanOrEqual(lo); expect(max, name).toBeLessThanOrEqual(hi);
      expect(Object.keys(m.bugs).sort()).toEqual(Object.keys(rates).sort());
      for (const [id, want] of Object.entries(rates)) {
        const rate = (100 * (fired[id] || 0)) / N;
        expect(Math.abs(rate - want), `${name} ${id}: ${rate.toFixed(1)}% against ${want}%`).toBeLessThanOrEqual(3);
      }
      const ids = Object.keys(m.bugs);
      for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) {
        const ties = draws.filter((p) => { const x = m.bugs[ids[i]](p); const y = m.bugs[ids[j]](p); return x != null && y != null && near(x, y); }).length;
        expect(ties / N, `${name}: ${ids[i]} and ${ids[j]}`).toBeLessThan(0.02);
      }
      const [text, fig, solution, hint, unit] = WORDS[name];
      draws.filter((_, i) => i % 40 === 0).forEach((p) => {
        const words = [text(p), hint(p), ...solution(p)];
        words.forEach((w) => expect(w, name).not.toMatch(/undefined|NaN/));
        words.forEach((w) => (w.match(/\$([^$]+)\$/g) || []).forEach((t) => expect(() => katex.renderToString(t.slice(1, -1), { throwOnError: true }), `${name}: ${t}`).not.toThrow()));
        const last = solution(p).at(-1);
        expect(last, name).toContain(String(m.answer(p)));
        expect(last.endsWith(unit), `${name}: ${last}`).toBe(true);
        const inText = (text(p).match(/\$([^$]+)\$/g) || []).flatMap((t) => (t.match(/\d+(?:\.\d+)?/g) || []).map(Number));
        expect(inText.some((v) => near(v, m.answer(p))), `${name}: the answer is printed`).toBe(false);
        const f = fig(p);
        Object.values(solidLabels(f)).filter((l) => /^\d+(\.\d+)?$/.test(String(l))).forEach((l) => expect(inText, `${name}: ${l}`).toContain(Number(l)));
        expect(figPlain(f), name).toBeTruthy();
      });
    });
  }
});
