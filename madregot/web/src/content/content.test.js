import { describe, it, expect, afterAll } from 'vitest';
import katex from 'katex';
import { TOPICS, topicsFor, makeItem, isCorrect, answerText, itemPlain, readAnswer, answerInput, fairForCheck, testItem } from './index.js';
import { SCENERY } from '@/components/map/Scenery.jsx';
import { parseNum, plainNum, gcd } from './util.js';
import { factsItem } from './frac.js';
import { holds, identical, texToExpr, texRelation, seeded, evaluate, same } from '@/learn/expr.ts';

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
