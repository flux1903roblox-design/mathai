// The council's round 3 (learning): mistakes from earlier stairs were not named in later stairs. An equation with a
// negative solution answered with the opposite sign was named on eq:2 (42%) but on eq:3 2%, eq:4 1% and eq:7 never;
// eq:3's 7x − 12 = 6x − 16 answered 4 (for −4) got the general hint. In solving together, eq:3's 4x = 2 answered 2 (the
// division the other way round) and −15 = 3x answered −12 (the coefficient subtracted) got "בדקו את החישוב".
// Every equation ends on a line kx = m, and the first two stairs' mistakes on that line (sign, divide-flip, sub-coef,
// content/eq.js lastStepBugs) are named wherever they can happen: on the exercises, on the diagnostic and transfer
// questions, and on the last step of solving together. An answer another mistake also gives stays ambiguous (both
// named, a question at the end tells them apart); a slip of the hand and a right answer name nothing.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DiagModel } from './types';
import { diagnose } from './misconceptions';
import { seeded } from './expr';
import { loadAllContent, contentOf } from './content/index';
import { diagnoseFinal } from './content/togetherDiag';
// @ts-ignore: plain JS
import { makeItem, catLabel, namesOf } from '@/content/index.js';
// @ts-ignore: plain JS
import { bothFrom, bracketFrom, lastStepBugs } from '@/content/eq.js';

const CONTENT = await loadAllContent();
const realRandom = Math.random;
beforeEach(() => { Math.random = seeded(20261117); });
afterEach(() => { Math.random = realRandom; });

const ids = (d: { kind: string; candidates?: { id: string }[] } | null | undefined) => (d?.kind === 'misconception' ? d.candidates!.map((c) => c.id) : []);
/** The equation stairs whose questions have negative solutions (eq:5 and eq:6 ask lengths, ages, hours and kilometres). */
const SIGNED = [2, 3, 4, 7];

describe('an equation answered with the opposite sign is named on every equation stair', () => {
  it('the exercises of eq:2, eq:3, eq:4 and eq:7, in practice and in a check: every negative solution\'s opposite is "sign"', () => {
    for (const L of SIGNED) {
      for (const test of [false, true]) {
        let n = 0; let named = 0; let alone = 0;
        for (let i = 0; i < 3000; i += 1) {
          const it = makeItem('eq', L, undefined, { test });
          if (it.form !== 'num' || typeof it.answer !== 'number' || it.answer >= 0) continue;
          n += 1;
          const got = ids(it.diagnosis(-it.answer));
          if (got.includes('sign')) named += 1;
          if (got.length === 1 && got[0] === 'sign') alone += 1;
        }
        expect(n, `eq:${L}`).toBeGreaterThan(80);
        expect(named, `eq:${L}${test ? ' check' : ''}: ${named} of ${n}`).toBe(n);
        // alone, most of the time: another mistake's number only now and then is the same (then both are named)
        expect(alone / n, `eq:${L}`).toBeGreaterThan(0.9);
      }
    }
  });

  it('the diagnostic and transfer questions of those stairs too', () => {
    const rnd = seeded(31);
    for (const L of SIGNED) {
      const c = contentOf(`eq:${L}`)!;
      for (const model of [c.diag, c.transfer].filter(Boolean) as DiagModel<any>[]) {
        for (let i = 0; i < 1500; i += 1) {
          const p = model.params(rnd); const ans = model.answer(p);
          if (!(ans < 0)) continue;
          expect(ids(diagnose(model, p, -ans)), `eq:${L} ${JSON.stringify(p)}`).toContain('sign');
        }
      }
    }
  });

  it('the council\'s case: eq:3, 7x − 12 = 6x − 16 answered 4 is "sign", alone, on the exercise and on the diagnostic question', () => {
    const it = bothFrom({ a: 7, b: -12, c: 6, d: -16, x: -4 });
    expect([it.display, it.answer]).toEqual(['7x - 12 = 6x - 16', -4]);
    expect(it.diag(4)).toBe('sign');
    expect(ids(diagnose(contentOf('eq:3')!.diag, { a: 7, b: -12, c: 6, d: -16, x: -4 }, 4))).toEqual(['sign']);
    // the board names it in the stair's own words, and the stair has its repair
    expect(catLabel('eq', 3, 'sign')).toBe('הפתרון יצא עם הסימן ההפוך');
    expect(contentOf('eq:3')!.misconceptions.map((m) => m.id)).toContain('sign');
  });

  it('every stair that names a mistake can repair it: its catalogue has it (the board shows its name, the repair its remedy)', () => {
    for (const L of [2, 3, 4, 7]) {
      const own = new Set(contentOf(`eq:${L}`)!.misconceptions.map((m) => m.id));
      const named = new Set<string>();
      const want = ['sign', 'sub-coef', 'divide-flip'];
      for (let i = 0; i < 300; i += 1) {
        const it = makeItem('eq', L);
        // every mistake a wrong number can name on this question (content/index.js namesOf)
        if (it.form === 'num') namesOf(it, want).forEach((id: string) => named.add(id));
      }
      ['sign', 'sub-coef', 'divide-flip'].filter((id) => named.has(id)).forEach((id) => expect(own.has(id), `eq:${L} names ${id} without a repair`).toBe(true));
      expect(named.has('sign'), `eq:${L}`).toBe(true);
    }
  }, 60_000); // namesOf tries thousands of numbers a question: 2 s alone, more within the whole suite
});

describe('solving together: the last step names the earlier stairs\' mistakes (eq:2 to eq:7)', () => {
  it('eq:3: 4x = 2 answered 2 is the division the other way round; −2 the coefficient subtracted', () => {
    const c = CONTENT['eq:3'];
    expect(c.together[1].display).toBe('6x + 1 = 2x + 3');
    expect(diagnoseFinal(c, 1, 2)).toEqual(['divide-flip']);
    expect(diagnoseFinal(c, 1, -2)).toEqual(['sub-coef']);
  });
  it('eq:3: −15 = 3x answered 5 lost the minus; −18 and −12 subtracted the coefficient; −4 is no one\'s number', () => {
    const c = CONTENT['eq:3'];
    expect(diagnoseFinal(c, 0, 5)).toEqual(['sign']);
    expect(diagnoseFinal(c, 0, -18)).toEqual(['sub-coef']);
    expect(diagnoseFinal(c, 0, -12)).toEqual(['sub-coef']);
    expect(diagnoseFinal(c, 0, -4)).toEqual([]);
  });
  it('eq:2: 3x = −6 answered 2 lost the minus (subtracting 3, which step 2 turned down, is not named)', () => {
    const c = CONTENT['eq:2'];
    expect(diagnoseFinal(c, 0, 2)).toEqual(['sign']);
    expect(diagnoseFinal(c, 0, -9)).toEqual([]);
    expect(diagnoseFinal(c, 1, 8)).toEqual(['sub-coef']);
  });
  it('eq:4 and eq:7: the coefficient subtracted on the last line (12 = 3x, 14 = 2x, 2x = 60, 4x = 24)', () => {
    expect(diagnoseFinal(CONTENT['eq:4'], 0, 9)).toEqual(['sub-coef']);
    expect(diagnoseFinal(CONTENT['eq:4'], 1, 12)).toEqual(['sub-coef']);
    expect(diagnoseFinal(CONTENT['eq:7'], 0, 58)).toEqual(['sub-coef']);
    expect(diagnoseFinal(CONTENT['eq:7'], 2, 20)).toEqual(['sub-coef']);
  });
});

describe('no mistake is named that another could equally explain, nor a slip, nor a right answer', () => {
  it('lastStepBugs: each mistake only where it can happen', () => {
    // 3x = 12: no minus anywhere, the number larger than the coefficient
    expect(lastStepBugs(3, 12)).toEqual({ sign: null, 'divide-flip': null, 'sub-coef': 9 });
    // −4x = −8 (the coefficient's minus) and 3x = −6 (the result's minus)
    expect(lastStepBugs(-4, -8).sign).toBe(-2);
    expect(lastStepBugs(3, -6).sign).toBe(2);
    // 4x = 2: the number smaller than the coefficient; x = 2 (coefficient 1) has nothing to subtract
    expect(lastStepBugs(4, 2)).toEqual({ sign: null, 'divide-flip': 2, 'sub-coef': -2 });
    expect(lastStepBugs(1, 5)['sub-coef']).toBeNull();
    // 3x = −15: the coefficient taken from −15 as it stands, or from 15 with the minus kept
    expect(lastStepBugs(3, -15)).toEqual({ sign: 5, 'divide-flip': null, 'sub-coef': [-18, -12] });
    // 2x = −2: from 2 with the minus kept is −(2 − 2) = 0, a prediction like any other (CI found it named by another
    // mistake alone: −2x + 1 = −4x − 1 answered 0 is also the constant moved keeping its sign)
    expect(lastStepBugs(2, -2)['sub-coef']).toEqual([-4, 0]);
  });

  it('an answer of 0 the coefficient subtracted also gives is named with the other mistake (CI, 23 Nov)', () => {
    expect(bothFrom({ a: -2, b: 1, c: -4, d: -1, x: -1 }).diag(0)).toEqual(['move-no-flip', 'sub-coef']);
    expect(bothFrom({ a: 8, b: 1, c: 6, d: -1, x: -1 }).diag(0)).toEqual(['move-no-flip', 'sub-coef']);
    // 5x − (x − 2) = −2: 4x = −4, and the bracket's minus lost gives 0 too
    expect(bracketFrom({ k: 2, a: 1, p: 1, b: -2, c: 5, d: -2, x: -1 }).diag(0)).toEqual(['minus-bracket', 'sub-coef']);
  });

  it('an answer two mistakes give is ambiguous on the exercises: both named, never one by chance', () => {
    let both = 0;
    for (let i = 0; i < 20000 && both < 20; i += 1) {
      const it = makeItem('eq', 3);
      if (it.form !== 'num' || it.answer >= 0) continue;
      const d = it.diagnosis(-it.answer);
      if (d.candidates.length < 2) continue;
      both += 1;
      expect(d.ambiguous, it.key).toBe(true);
      expect(ids(d), it.key).toContain('sign');
    }
    expect(both).toBeGreaterThan(0);
  });

  it('a right answer and a slip of the hand name nothing, on every equation stair', () => {
    for (const L of [2, 3, 4, 7]) {
      for (let i = 0; i < 800; i += 1) {
        const it = makeItem('eq', L);
        if (it.form !== 'num' || typeof it.answer !== 'number') continue;
        expect(it.diagnosis(it.answer), it.key).toBeNull();
        if (Number.isInteger(it.answer) && Math.abs(it.answer) >= 3) expect(it.diag(it.answer + 1), `${it.key}: one off`).toBeNull();
      }
    }
  });
});
