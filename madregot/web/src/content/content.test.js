import { describe, it, expect, afterAll } from 'vitest';
import katex from 'katex';
import { TOPICS, topicsFor, makeItem, isCorrect, answerText, itemPlain, readAnswer, answerInput, fairForCheck, testItem, figPlain, namesOf } from './index.js';
import { SCENERY } from '@/components/map/Scenery.jsx';
import { parseNum, plainNum, gcd } from './util.js';
import { factsItem } from './frac.js';
import { holds, identical, texToExpr, texRelation, seeded, evaluate, same } from '@/learn/expr.ts';
import * as AW from './area.js';
import { manipWrong } from './manip.js';
// the grid object's rules, which the app loads after the first screen (content/late.js)
import { polyArea, boundsOf, movedPts } from './grid.js';
// boxes and prisms (stage 2, MEASURE-3): their practice layer, and the net object's rules and words it draws with
import * as SW from './solid.js';
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
            expect(Math.abs(parseNum(answerText(item)) - item.answer)).toBeLessThan(0.01);
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
    try {
      for (let i = 0; i < 8000; i += 1) {
        const L = 1 + (i % 5);
        for (const topic of ['expr', 'eq', 'sys']) {
          const it = makeItem(topic, L); const k = String(it.key).split(':')[0];
          if (it.form !== 'mc') continue;
          if (k === 'ex1m') { const v = it.choices.map(numOf); const s = [...v].sort((a, b) => a - b); add('expr:1 the middle number', v[it.answer] === s[1]); add('expr:1 the smallest', v[it.answer] === s[0]); }
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
    } finally { Math.random = real; }
    Object.entries(tally).forEach(([rule, [ok, n]]) => {
      expect(n, rule).toBeGreaterThan(100);
      expect(ok / n, `${rule}: ${(100 * ok / n).toFixed(1)}% of ${n}`).toBeLessThan(0.55);
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

  it('a grid triangle on area:2 sometimes has its height outside its base; one on area:3 has no side on a grid line', seededRun(7123, () => {
    let outside = 0;
    for (const it of all(2, 1500)) if (kindOf(it) === 'ar2q') { const t = Number(it.key.split(':')[3]); const b = Number(it.key.split(':')[1]); if (t < 0 || t > b) outside += 1; }
    expect(outside).toBeGreaterThan(5);
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
    // on the ז׳ path since its teaching landed: after expressions, before the boxes and equations, between cobalt and petrol
    expect(TOPICS.find((t) => t.id === 'area').levels).toBe(AREA.levels);
    expect(topicsFor('7').map((t) => t.id)).toEqual(['signed', 'coord', 'angles', 'expr', 'area', 'solid', 'eq']);
    expect(topicsFor('7').map((t) => t.color).slice(3, 7)).toEqual(['cobalt', 'fuchsia', 'petrol', 'violet']);
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
    // on the path since its teaching landed: after the areas, before equations, petrol between fuchsia and violet
    expect(TOPICS.find((t) => t.id === 'solid').levels).toBe(SOLID.levels);
    expect(topicsFor('7').map((t) => t.id).slice(4, 7)).toEqual(['area', 'solid', 'eq']);
    expect(topicsFor('7').map((t) => t.color).slice(4, 7)).toEqual(['fuchsia', 'petrol', 'violet']);
    // the ids other topics use keep their names but for one-base and no-convert, said here in this unit's words
    for (const t of TOPICS) for (const [id, name] of Object.entries(t.cats || {})) {
      if (SOLID.cats[id] && !['one-base', 'no-convert'].includes(id)) expect(SOLID.cats[id], `${t.id} ${id}`).toBe(name);
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
