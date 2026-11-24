// PRODUCT2-12, SK-LEARN-1: the flagship stair names the mistake the student made. The council's measure (learning-verify
// mm.ts) as a test: a minus-minus answer (−4 − (−11) answered −15) on signed:1 was named "adding the distances" half the
// time on the typed exercises, and on the stair's own diagnostic questions it was never named alone (it came out
// ambiguous with abs-add, and with 'direction', a move on a number line those typed questions do not have).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DiagModel } from './types';
import { diagnose } from './misconceptions';
import { seeded } from './expr';
import { loadAllContent, contentOf } from './content/index';
// @ts-ignore: plain JS
import { makeItem, ambiguousText, catLabel } from '@/content/index.js';

const CONTENT = await loadAllContent();
const realRandom = Math.random;
beforeEach(() => { Math.random = seeded(20261112); });
afterEach(() => { Math.random = realRandom; });

const ids = (d: ReturnType<typeof diagnose>) => (d.kind === 'misconception' ? d.candidates.map((c) => c.id) : []);

describe('signed:1 names a minus-minus answer as minus-minus', () => {
  it('on the typed exercises: never "adding the distances", over 2,500 questions that subtract a negative', () => {
    const tally: Record<string, number> = {};
    let n = 0;
    for (let i = 0; i < 200_000 && n < 2500; i += 1) {
      const it = makeItem('signed', 1);
      const m = String(it.key).match(/^sn1:(-?\d+) - \((-\d+)\)$/);
      if (!m) continue;
      const a = Number(m[1]); const b = Number(m[2]);
      n += 1;
      const d = it.diagnosis(a + b);
      const named = d?.kind === 'misconception' ? d.candidates.map((c: { id: string }) => c.id).join('+') : 'none';
      tally[named] = (tally[named] || 0) + 1;
      expect(it.diag(a + b), `${it.key} answered ${a + b}`).toBe('minus-minus');
    }
    expect(n).toBe(2500);
    // a negative first number is half of them: there adding the distances gives the same number, and the flagship names it
    expect(tally).toEqual({ 'minus-minus': 2500 });
  });

  it('on the diagnostic and transfer questions: named alone, never ambiguous with direction or abs-add', () => {
    const c = contentOf('signed:1')!;
    const rnd = seeded(5);
    for (const model of [c.diag, c.transfer!] as DiagModel<any>[]) {
      let n = 0;
      for (let i = 0; i < 4000; i += 1) {
        const p = model.params(rnd); const v = model.bugs['minus-minus']?.(p);
        if (v == null || v === model.answer(p)) continue;
        n += 1;
        expect(ids(diagnose(model, p, v)), JSON.stringify(p)).toEqual(['minus-minus']);
      }
      expect(n).toBeGreaterThan(500);
    }
  });

  it('the student\'s −4 − (−11) answered −15 is minus-minus, on the exercise and on the diagnostic question', () => {
    expect(ids(diagnose(contentOf('signed:1')!.diag, { a: -4, b: -11, s: -1 }, -15))).toEqual(['minus-minus']);
    for (let i = 0; i < 100_000; i += 1) {
      const it = makeItem('signed', 1);
      if (it.key !== 'sn1:-4 - (-11)') continue;
      expect(it.diag(-15)).toBe('minus-minus');
      expect(it.diagnosis(-15)).toMatchObject({ kind: 'misconception', ambiguous: false, candidates: [{ id: 'minus-minus' }] });
      return;
    }
    throw new Error('no such question');
  });
});

describe('a move on the number line is named only where there is a number line (SK-LEARN-1)', () => {
  it('no stair\'s diagnostic or transfer model predicts "direction" unless its questions draw a number line', () => {
    const rnd = seeded(9);
    Object.values(CONTENT).forEach((c) => [c.diag, c.transfer].forEach((model) => {
      if (!model || !('direction' in model.bugs)) return;
      for (let i = 0; i < 200; i += 1) expect(model.fig?.(model.params(rnd))?.type, `${c.skill}: a typed question names direction`).toBe('numline');
    }));
  });

  it('a typed signed:1 question never names direction, and its ambiguous line never speaks of the line', () => {
    const c = contentOf('signed:1')!;
    const rnd = seeded(11);
    let ambiguous = 0;
    for (let i = 0; i < 600; i += 1) {
      const p = c.diag.params(rnd);
      for (let u = -40; u <= 40; u += 1) {
        const d = diagnose(c.diag, p, u);
        expect(ids(d)).not.toContain('direction');
        if (d.kind === 'misconception' && d.ambiguous) {
          ambiguous += 1;
          expect(ambiguousText('signed', 1, d.candidates)).not.toMatch(/ציר/);
        }
      }
    }
    // the stair still has answers two mistakes explain (dropping the first minus, and "minus and minus make plus")
    expect(ambiguous).toBeGreaterThan(0);
  });
});

describe('the line of an ambiguous answer', () => {
  it('names two mistakes, and says a question at the end will tell them apart only when one will', () => {
    const two = [{ id: 'drop-sign', conf: 0.5 }, { id: 'neg-neg-plus', conf: 0.5 }];
    const [a, b] = two.map((x) => catLabel('signed', 1, x.id));
    expect(ambiguousText('signed', 1, two)).toBe(`מה כנראה קרה: אולי ${a}, ואולי ${b}. עוד שאלה בסוף השיעור תעזור לדעת מה בדיוק בלבל.`);
    expect(ambiguousText('signed', 1, two, false)).toBe(`מה כנראה קרה: אולי ${a}, ואולי ${b}.`);
  });
  it('stays one short sentence with three or more', () => {
    const three = ['minus-minus', 'abs-add', 'direction'].map((id) => ({ id, conf: 1 / 3 }));
    const t = ambiguousText('signed', 1, three);
    expect(t).toBe('התשובה הזאת מתאימה לכמה טעויות שונות. עוד שאלה בסוף השיעור תעזור לדעת מה בדיוק בלבל.');
    expect(t).not.toMatch(/ציר/);
    expect(ambiguousText('signed', 1, three, false)).toBe('התשובה הזאת מתאימה לכמה טעויות שונות.');
  });
});
