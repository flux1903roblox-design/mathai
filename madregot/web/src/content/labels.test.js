// Every mistake label an exercise generator can give must describe the answer the student actually gave.
// For each category there is a property, written here from the question's own numbers (read from its key, the
// numbers the student saw), not from the generator's diag(). Every generator is sampled with many wrong answers;
// whenever diag() names a category, the answer must have that property. And a label is only recorded as evidence
// about the student when it is honest: the learning model gets exactly the category the answer shows.
import { describe, it, expect } from 'vitest';
import { TOPICS, makeItem, isCorrect, catLabel } from './index.js';
import { quadOf as quadOfPt } from './manip.js';
import { startLesson, answer } from '@/lib/lesson.js';
import { learnAfterAnswer, emptyLearn } from '@/learn/storeGlue.ts';

const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const sgn = (x) => Math.sign(x);
const nums = (key) => key.split(':').slice(1).map(Number);
const sum = (a) => a.reduce((x, y) => x + y, 0);
const sortN = (a) => [...a].sort((x, y) => x - y);
const median = (a) => { const s = sortN(a); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const quadIndex = (x, y) => (x > 0 ? (y > 0 ? 0 : 3) : y > 0 ? 1 : 2);
const ptEq = (u, p) => Array.isArray(u) && near(u[0], p[0]) && near(u[1], p[1]);

/** The numbers of a signed-number exercise, read from what is on screen. */
function signedFacts(it) {
  const d = it.display.replace(/\\cdot/g, '*').replace(/[()]/g, '').trim();
  const t = d.split(/\s+/);
  return t.map((x) => (/^-?\d+$/.test(x) ? Number(x) : x));
}
/** The value subtracted in a signed exercise, when it is negative: the "minus-minus" spot. */
function subtractedNegative(it) {
  const p = it.key.split(':')[0];
  const t = signedFacts(it);
  if (p === 'sn1' || p === 'sn1n') return t[1] === '-' && t[2] < 0 ? t[2] : null; // a - b
  if (p === 'sn4') {
    if (t[3] === '*') return t[1] === '-' && t[2] * t[4] < 0 ? t[2] * t[4] : null; // a - b·c
    return t[3] === '-' && t[4] < 0 ? t[4] : null; // a·b - c
  }
  if (p === 'sn5') { const [a, , b, , c, , d] = t; const q = (b - c) * d; return q < 0 ? q : null; } // a - (b - c)·d
  return null;
}

/**
 * The property each category names, per topic. (it, u) → does the answer u really show this mistake?
 * A category a stair defines for itself is checked with that stair's meaning (catLabel shows the same).
 */
const PROPS = {
  signed: {
    sign: (it, u) => it.answer !== 0 && near(u, -it.answer),
    direction: (it, u) => it.manip?.kind === 'numberline' && u - it.manip.from === -(it.answer - it.manip.from),
    'minus-minus': (it, u) => { const q = subtractedNegative(it); return q != null && near(u, it.answer - 2 * Math.abs(q)); },
    'abs-add': (it, u) => { const [a, op, b] = signedFacts(it); const bb = op === '-' ? -b : b; return sgn(a) !== sgn(bb) && near(u, sgn(a) * (Math.abs(a) + Math.abs(bb))); },
    'ignore-sign': (it, u) => Array.isArray(u) && it.answer.some((v, i) => v < 0 && u[i] === -v),
    'neg-compare': (it, u) => { const [a, b] = nums(it.key); return a < 0 && b < 0 && a !== b && u === 2 - it.answer; },
    order: (it, u) => {
      const t = signedFacts(it);
      if (it.key.startsWith('sn4:') && t[3] === '*') return near(u, (t[1] === '+' ? t[0] + t[2] : t[0] - t[2]) * t[4]);
      if (it.key.startsWith('sn5:')) { const [a, , b, , c, , d] = t; return near(u, (a - (b - c)) * d); }
      return false;
    },
  },
  coord: {
    swap: (it, u) => {
      const p = it.key.split(':')[0];
      if (p === 'cp2') { const [x, y] = nums(it.key); return u === quadIndex(y, x) && u !== it.answer; }
      if (p === 'cp2p') return Array.isArray(u) && quadOfPt([u[1], u[0]]) === it.manip.quadrant && quadOfPt(u) !== it.manip.quadrant;
      return it.answer[0] !== it.answer[1] && ptEq(u, [it.answer[1], it.answer[0]]);
    },
    // coord:1 a coordinate's sign; coord:3 (its own meaning) a negative length
    sign: (it, u) => (it.level === 3 ? near(u, -it.answer) : ptEq(u, [-it.answer[0], it.answer[1]]) || ptEq(u, [it.answer[0], -it.answer[1]])),
    'add-coords': (it, u) => { const [x1, y1, x2, y2] = nums(it.key); const [p, q] = y1 === y2 ? [x1, x2] : [y1, y2]; return p * q < 0 && near(u, Math.abs(Math.abs(q) - Math.abs(p))); },
    perimeter: (it, u) => { const [x1, x2, y1, y2] = nums(it.key); return near(u, 2 * ((x2 - x1) + (y2 - y1))); },
    'add-sides': (it, u) => { const [x1, x2, y1, y2] = nums(it.key); return near(u, (x2 - x1) + (y2 - y1)); },
  },
  angles: {
    'equal-not-supp': (it, u) => {
      const p = it.key.split(':')[0]; const [a] = nums(it.key);
      if (p === 'an1t') return u === a; // the measured angle turned to the given size, as if the two were equal
      if (p === 'an2') return it.key.endsWith('false') && near(u, a);
      if (p === 'an4') return it.key.endsWith('cointerior') && near(u, a);
      return near(u, a) && near(it.answer, 180 - a);
    },
    'supp-not-equal': (it, u) => { const [a] = nums(it.key); return near(it.answer, a) && near(u, 180 - a); },
    'wrong-total': (it, u) => { const [a] = nums(it.key); return near(u, 90 - a) || near(u, 360 - a); },
    'sum-360': (it, u) => { const [a, b] = nums(it.key); return near(u, 360 - a - b); },
    'one-angle': (it, u) => { const [a, b] = nums(it.key); return near(u, 180 - a) || near(u, 180 - b); },
    'forgot-half': (it, u) => { const top = Number(it.key.split(':')[2]); return near(u, 180 - top); },
    'interior-not-exterior': (it, u) => { const [, , a, b] = it.key.split(':').map(Number); return near(u, 180 - a - b); },
  },
  line: {
    'forgot-b': (it, u) => {
      if (it.key.startsWith('lf1p:')) { const [m, , x0] = nums(it.key); return ptEq(u, [x0, m * x0]); }
      const [m, b, x] = nums(it.key); return b !== 0 && near(u, m * x);
    },
    'neg-sub': (it, u) => { const [m, b, x] = nums(it.key); return x < 0 && near(u, m * -x + b); },
    'added-m': (it, u) => { const [m, b, x] = nums(it.key); return near(u, m + x + b); },
    'sign-from-b': (it, u) => { const [, , m, b] = it.key.split(':').map(Number); return it.answer !== 2 && m !== 0 && sgn(m) !== sgn(b) && u === (b > 0 ? 0 : 1); },
    'm-b': (it, u) => {
      if (it.key.startsWith('lf2b:')) { const [m, b] = nums(it.key); return u.m === b && u.b === m; }
      const [, kind, m, b] = it.key.split(':'); return near(u, Number(kind === 'm' ? b : m));
    },
    sign: (it, u) => {
      const p = it.key.split(':')[0];
      if (p === 'lf2b') { const [m, b] = nums(it.key); return u.m === -m && u.b === b; }
      if (p === 'lf5') return near(u.m, -it.answer.m);
      if (p === 'lf6') { const [m, b] = nums(it.key); return near(u[0], b / m) && near(u[1], 0) && it.key.endsWith('true'); }
      return near(u, -it.answer);
    },
    inverse: (it, u) => {
      if (it.key.startsWith('lf3:')) { const [, , rise, run] = nums(it.key); return near(u, run / rise); }
      const [x1, y1, x2, y2] = nums(it.key); return near(u, (x2 - x1) / (y2 - y1));
    },
    'mixed-order': (it, u) => { const [x1, y1, x2, y2] = nums(it.key); return near(u, (y1 - y2) / (x2 - x1)) && !near(it.answer, 0); },
    'b-sign': (it, u) => near(u.m, it.answer.m) && near(u.b, -it.answer.b) && it.answer.b !== 0,
    'b-is-y': (it, u) => { const [, x1, y1] = it.key.split(':').slice(1).map(Number); return near(u.m, it.answer.m) && near(u.b, y1) && x1 !== undefined; },
    swap: (it, u) => ptEq(u, [it.answer[1], it.answer[0]]),
    'axes-mixed': (it, u) => { const [m, b] = nums(it.key); const onX = it.key.endsWith('true'); return onX ? ptEq(u, [0, b]) : ptEq(u, [-b / m, 0]); },
    'no-half': (it, u) => near(u, 2 * it.answer),
    'added-sides': (it, u) => { const [m, b] = nums(it.key); return near(u, Math.abs(b) + Math.abs(b / m)); },
    'forgot-y': (it, u) => near(u[0], it.answer[0]) && !near(u[1], it.answer[1]) && (near(u[1], 0) || near(u[1], u[0])),
  },
  pyth: {
    'add-legs': (it, u) => {
      const p = it.key.split(':')[0];
      if (p === 'py1s') return u && u.a + u.b === it.answer.c;
      if (p === 'py4') { const [, , foot, wall] = it.key.split(':'); return it.key.startsWith('py4:L:') && near(u, Number(wall) + Number(foot)); }
      if (p === 'py5') { const [x1, y1, x2, y2] = nums(it.key); return near(u, Math.abs(x2 - x1) + Math.abs(y2 - y1)); }
      const [a, b] = nums(it.key); return near(u, a + b);
    },
    'no-root': (it, u) => {
      if (it.key.startsWith('py5:')) { const [x1, y1, x2, y2] = nums(it.key); return near(u, (x2 - x1) ** 2 + (y2 - y1) ** 2); }
      if (it.key.startsWith('py2:')) { const [a, c] = nums(it.key); return near(u, c * c - a * a); }
      const [a, b] = nums(it.key); return near(u, a * a + b * b);
    },
    'add-not-sub': (it, u) => {
      if (it.key.startsWith('py4:')) { const [, , foot, len] = it.key.split(':').map(Number); return it.key.startsWith('py4:h:') && near(u, Math.hypot(len, foot), 0.06); }
      const [a, c] = nums(it.key); return near(u, Math.hypot(a, c), 0.06);
    },
    'subtract-sides': (it, u) => { const [a, c] = nums(it.key); return near(u, c - a); },
    // four triangles, 'a,b,c;…' in the key: the side written last checked as the hypotenuse
    'wrong-hyp': (it, u) => {
      const sets = it.key.split(':')[1].split(';').map((x) => x.split(',').map(Number));
      const right = (s) => { const [p, q, r] = [...s].sort((x, y) => x - y); return p * p + q * q === r * r; };
      const lastRight = (s) => s[0] * s[0] + s[1] * s[1] === s[2] * s[2];
      if (it.key.startsWith('py3w:')) return u === 4 && sets.some(right) && !sets.some(lastRight);
      return u === sets.filter(lastRight).length && u !== it.answer;
    },
    'assume-right': (it, u) => it.key.startsWith('py3n:') && u === 4 && it.answer < 4,
  },
  stats: {
    'mode-max': (it, u) => near(u, Math.max(...nums(it.key.replace(/,/g, ':')))),
    'mode-median': (it, u) => { const l = sortN(nums(it.key.replace(/,/g, ':'))); return near(u, l[Math.floor(l.length / 2)]); },
    'mode-count': (it, u) => { const l = nums(it.key.replace(/,/g, ':')); return near(u, l.filter((v) => v === it.answer).length); },
    unsorted: (it, u) => { const l = nums(it.key.replace(/,/g, ':')); const n = l.length; return near(u, n % 2 ? l[(n - 1) / 2] : (l[n / 2 - 1] + l[n / 2]) / 2); },
    'mean-not-median': (it, u) => {
      if (it.key.startsWith('st2b:')) { const [vals, t] = it.key.split(':').slice(1); return near((sum(vals.split(',').map(Number)) + u) / 5, Number(t)); }
      const l = nums(it.key.replace(/,/g, ':')); return near(u, sum(l) / l.length);
    },
    'median-not-mean': (it, u) => near(u, median(nums(it.key.replace(/,/g, ':')))),
    'no-divide': (it, u) => near(u, sum(nums(it.key.replace(/,/g, ':')))),
    'mean-as-answer': (it, u) => near(u, Number(it.key.split(':').pop())),
    'ignore-freq': (it, u) => { const vals = it.key.split(':')[1].split(',').map(Number); return near(u, sum(vals) / vals.length); },
    'wrong-count': (it, u) => { const [vals, freqs] = it.key.split(':').slice(1).map((x) => x.split(',').map(Number)); return near(u, sum(vals.map((v, i) => v * freqs[i])) / vals.length); },
  },
};

/** Wrong answers to try, in the shape of the item: wide enough to reach every prediction a diag() makes. */
function candidates(it) {
  const range = (a, b, step = 1) => { const out = []; for (let v = a; v <= b + 1e-9; v += step) out.push(Math.round(v * 100) / 100); return out; };
  if (it.form === 'mc') return it.choices.map((_, i) => i);
  if (it.form === 'pt') { const v = [...range(-14, 14), ...range(-12, 12, 0.5)]; const set = [...new Set(v)]; return set.flatMap((x) => set.filter((y) => Number.isInteger(x) || Number.isInteger(y) || true).map((y) => [x, y])).filter(([x, y]) => Number.isInteger(x) || y === 0); }
  if (it.form === 'line') return range(-6, 6, 0.5).flatMap((m) => range(-14, 14).map((b) => ({ m, b })));
  if (it.form === 'manip') {
    const m = it.manip;
    switch (m.kind) {
      case 'numberline': return range(m.min, m.max);
      case 'angle': return range(5, 175, 5);
      case 'bars': return range(0, m.max);
      case 'plot': return range(-6, 6).flatMap((x) => range(-6, 6).map((y) => [x, y]));
      case 'line': return range(-6, 6).flatMap((mm) => range(-6, 6).map((b) => ({ m: mm, b })));
      case 'squares': return range(1, 12).flatMap((a) => range(1, 12).map((b) => ({ a, b })));
      case 'triangle': return range(-6, 6).flatMap((x) => range(1, 6).map((y) => [x, y]));
      case 'pins': { const opts = it.answer.map((v, i) => [v, -v, m.start[i], v + 1]); return opts.reduce((acc, o) => acc.flatMap((a) => o.map((x) => [...a, x])), [[]]); }
      default: return [];
    }
  }
  // numbers: whole numbers far enough for squares and sums, tenths and simple fractions near zero
  const out = new Set([...range(-60, 900), ...range(-30, 30, 0.1), ...range(-12, 12, 0.05)]);
  for (let q = 3; q <= 7; q += 1) for (let p = -40; p <= 40; p += 1) out.add(p / q);
  // square roots, as a misused theorem gives them (rounded the way the checker reads them)
  for (let n = 1; n <= 2000; n += 1) { out.add(Math.round(Math.sqrt(n) * 100) / 100); out.add(Math.round(Math.sqrt(n) * 10) / 10); }
  return [...out];
}

const ITEMS_PER_LEVEL = 60;

describe('every mistake label describes the answer', () => {
  TOPICS.forEach((t) => {
    t.levels.forEach((L, i) => {
      const level = i + 1;
      it(`${t.id} level ${level}: ${L.title}`, () => {
        for (let k = 0; k < ITEMS_PER_LEVEL; k += 1) {
          const item = makeItem(t.id, level);
          for (const u of candidates(item)) {
            if (isCorrect(item, u)) continue;
            const cat = item.diag(u);
            if (!cat) continue;
            const prop = PROPS[t.id]?.[cat];
            expect(prop, `${t.id}:${level} returns '${cat}', which has no property here`).toBeTruthy();
            expect(prop(item, u), `${t.id}:${level} ${item.key}: answer ${JSON.stringify(u)} labelled '${cat}' (${catLabel(t.id, level, cat)})`).toBe(true);
            // the words shown to the student exist for this stair
            expect(catLabel(t.id, level, cat), `${t.id}:${level} '${cat}' has no words`).toBeTruthy();
          }
        }
      });
    });
  });
});

/** An item of a generator with a given display (searched by sampling). */
function find(topic, level, pred, tries = 20000) {
  for (let i = 0; i < tries; i += 1) { const it = makeItem(topic, level); if (pred(it)) return it; }
  throw new Error('no such item');
}
/** Answer an item inside a practice lesson and return what the learning model recorded. */
function recorded(item, u) {
  const s = { ...startLesson({ kind: 'node', topic: item.topic, level: item.level }), item };
  const { result } = answer(s, u);
  const learn = learnAfterAnswer(emptyLearn(), result.event);
  return { cat: result.cat, miscon: Object.keys(learn.miscon) };
}

describe('the council\'s reproductions', () => {
  it('a wrong-direction move on the number line is a direction mistake, never a sign mistake', () => {
    // −4 − (−6) = 2; moving 6 to the left gives −10: subtracting −6 was moved like subtracting 6
    const a = find('signed', 1, (it) => it.key === 'sn1n:-4 - (-6)');
    expect(recorded(a, -10)).toEqual({ cat: 'minus-minus', miscon: ['signed:1|minus-minus'] });
    // 2 + 4 = 6; moving 4 to the left gives −2: the move went the wrong way; −2 is not −6
    const b = find('signed', 1, (it) => it.key === 'sn1n:2 + 4');
    expect(recorded(b, -2)).toEqual({ cat: 'direction', miscon: ['signed:1|direction'] });
    // 7 + 1 = 8; moved to 6
    const c = find('signed', 1, (it) => it.key === 'sn1n:7 + 1');
    expect(recorded(c, 6)).toEqual({ cat: 'direction', miscon: ['signed:1|direction'] });
    // the real negative of the answer is a sign mistake
    expect(recorded(b, -6)).toEqual({ cat: 'sign', miscon: ['signed:1|sign'] });
  });

  it('subtracting a positive product is never called "minus-minus"', () => {
    // 6 − (2 − 3)·(−3) = 6 − 3 = 3; typing 9 adds the product, but the product is positive
    const it = find('signed', 5, (x) => x.key === 'sn5:6 - (2 - 3) \\cdot (-3)', 200000);
    expect(it.answer).toBe(3);
    const r = recorded(it, 9);
    expect(r.cat).not.toBe('minus-minus');
    expect(r.miscon).not.toContain('signed:5|minus-minus');
  });

  it('a negative product subtracted as if positive is "minus-minus"', () => {
    // 6 − (2 − 3)·3 = 6 − (−3) = 9; typing 3 subtracts 3
    const it = find('signed', 5, (x) => x.key === 'sn5:6 - (2 - 3) \\cdot 3', 200000);
    expect(it.answer).toBe(9);
    expect(recorded(it, 3)).toEqual({ cat: 'minus-minus', miscon: ['signed:5|minus-minus'] });
  });

  it('a negative length is named as a negative length on its own stair', () => {
    expect(catLabel('coord', 3, 'sign')).toBe('יצא אורך שלילי');
    expect(catLabel('coord', 1, 'sign')).toBe('טעות בסימן של אחד השיעורים');
  });
});
