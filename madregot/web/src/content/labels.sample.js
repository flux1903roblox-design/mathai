// Wrong answers to try on an exercise, shared by the tests that sample what the generators' diag() can return
// (content/labels.test.js: every label describes the answer; lib/teacherText.test.js: the teacher reads the student's
// words for each; content/stage3.test.js: the whole-content check). Only tests import this file.
import { manipSolution } from './manip.js';

/** A covered wheel or two dice in the estimate mode: every choice picked after 10, 50, 100 and 1000 trials. */
const estimatePicks = (it) => (it.answer?.mode !== 'estimate' ? [] : it.answer.choices.flatMap((_, pick) => [10, 50, 100, 1000].map((n) => ({ ...manipSolution(it), pick, n }))));

/** Wrong answers to try, in the shape of the item: wide enough to reach every prediction a diag() makes. */
export function candidates(it) {
  const range = (a, b, step = 1) => { const out = []; for (let v = a; v <= b + 1e-9; v += step) out.push(Math.round(v * 100) / 100); return out; };
  if (it.form === 'mc') return it.choices.map((_, i) => i);
  if (it.form === 'pt') { const v = [...range(-14, 14), ...range(-12, 12, 0.5)]; const set = [...new Set(v)]; return set.flatMap((x) => set.filter((y) => Number.isInteger(x) || Number.isInteger(y) || true).map((y) => [x, y])).filter(([x, y]) => Number.isInteger(x) || y === 0); }
  if (it.form === 'line') return range(-6, 6, 0.5).flatMap((m) => range(-14, 14).map((b) => ({ m, b })));
  if (it.form === 'lin') return range(-30, 30).flatMap((k) => range(-100, 100).map((c) => ({ k, c })));
  if (it.form === 'frac') return range(-20, 60).flatMap((n) => range(-6, 60).filter((d) => d !== 0).map((d) => ({ n, d })));
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
      case 'ray': return range(m.min ?? -10, m.max ?? 10).flatMap((at) => [-1, 1].flatMap((dir) => [false, true].map((closed) => ({ at, dir, closed }))));
      case 'pins': { const st = 1 / (m.den || 1); const opts = it.answer.map((v, i) => [v, -v, m.start[i], v + st]); return opts.reduce((acc, o) => acc.flatMap((a) => o.map((x) => [...a, x])), [[]]); }
      case 'fbar': return range(1, m.maxDen || 24).flatMap((den) => range(0, den).map((shaded) => ({ den, shaded })));
      case 'simulate': return estimatePicks(it);
      default: return [];
    }
  }
  // numbers: whole numbers far enough for squares and sums, tenths and simple fractions near zero; for ratio and scale,
  // the answer times and over 100, 1000 and 100000 too (units not converted, or converted too far)
  const scaled = it.topic === 'ratio' && typeof it.answer === 'number' ? [100, 1000, 100000].flatMap((k) => [it.answer * k, it.answer / k]) : [];
  // and every prediction a diag() lists (content/data.js diagWith): a large one (a spring total, 1470) is tried too
  const out = new Set([...scaled, ...(it.diag?.wrongs || []), ...range(-60, 900), ...range(-30, 30, 0.1), ...range(-12, 12, 0.05), ...range(-100, 1000, 0.5), ...range(-100, 100, 0.1)]);
  for (let q = 3; q <= 7; q += 1) for (let p = -40; p <= 40; p += 1) out.add(p / q);
  // square roots, as a misused theorem gives them (rounded the way the checker reads them)
  for (let n = 1; n <= 2000; n += 1) { out.add(Math.round(Math.sqrt(n) * 100) / 100); out.add(Math.round(Math.sqrt(n) * 10) / 10); }
  return [...out];
}

/**
 * The wrong answers that reach every prediction an exercise's diag() lists, as a student types them: each prediction
 * itself, to tenths and hundredths, a slip of 0.01 or 1 away, and whole; every tenth near the answer; every choice;
 * every fraction up to /36 (and every form of a prediction as one); a covered wheel or two dice picked after 10 to 1000
 * trials. Much narrower than candidates(), so thousands of exercises a stair can be read (content/stage3.test.js).
 */
export function nearCandidates(it) {
  if (it.form === 'mc') return it.choices.map((_, i) => i);
  if (it.form === 'manip') return it.manip?.kind === 'simulate' ? estimatePicks(it) : [];
  const out = new Set();
  const add = (x) => { if (Number.isFinite(x)) out.add(Math.round(x * 1e9) / 1e9); };
  for (const v of it.diag?.wrongs || []) {
    if (typeof v !== 'number') continue;
    [v, Math.round(v * 10) / 10, Math.round(v * 100) / 100, v + 0.01, v - 0.01, v + 1, v - 1, Math.round(v)].forEach(add);
  }
  if (it.form === 'frac') {
    // every fraction up to /36 that is a prediction, and every fraction from 0 to 1 up to /36 (a probability)
    const fr = [];
    for (const v of out) for (let d = 1; d <= 36; d += 1) { const n = Math.round(v * d); if (Math.abs(n / d - v) < 1e-9 && n > d) fr.push({ n, d }); }
    for (let d = 1; d <= 36; d += 1) for (let n = 0; n <= d; n += 1) fr.push({ n, d });
    return fr;
  }
  if (typeof it.answer === 'number') for (let k = -20; k <= 20; k += 1) add(Math.round((it.answer + k / 10) * 100) / 100);
  for (let k = 0; k <= 100; k += 1) { add(k); add(k / 100); }
  return [...out];
}
