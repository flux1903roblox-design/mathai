import { describe, it, expect } from 'vitest';
import katex from 'katex';
import { TOPICS, makeItem, isCorrect, answerText, itemPlain, readAnswer } from './index.js';
import { parseNum, plainNum } from './util.js';
import { holds, identical, texToExpr, texRelation } from '@/learn/expr.ts';

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
          // The exact answer must be accepted and must not be diagnosed as a mistake.
          expect(isCorrect(item, item.answer)).toBe(true);
          expect(item.diag(item.answer)).toBeNull();
          if (item.form === 'num') {
            expect(Number.isFinite(item.answer)).toBe(true);
            // What we print as the answer parses back to the same value.
            expect(Math.abs(parseNum(answerText(item)) - item.answer)).toBeLessThan(0.01);
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
      expect(t.fig.angles.reduce((x, y) => x + y, 0)).toBe(180);
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
