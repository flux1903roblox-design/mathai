// What the app tells a student has to be true: a mistake is named only when the answer really shows it, a right
// answer is accepted, a plan follows the prerequisites, and the copy says what happens. One block per finding of the
// council's integrity review (November 2026).
import { describe, it, expect } from 'vitest';
import type { LearnState } from './types';
import { diagnose, discriminating, CONFIRM_SCORE } from './misconceptions';
import { learnAfterAnswer } from './storeGlue';
import { itemFor } from './items';
import { examPlan, newPlan, recordDiagnostic } from './examRescue';
import { ALL_SKILLS, ancestorsOf } from './skills';
import { seeded } from './expr';
import { loadAllContent } from './content/index';
import { testModel, legModel } from './content/pyth';
import { quadModel } from './content/coord';
import { diagnoseFinal, namedMistake } from './content/togetherDiag';
// @ts-ignore: plain JS
import { isCorrect, fairForCheck, makeItem } from '@/content/index.js';
// @ts-ignore: plain JS
import { inDays } from '@/content/util.js';
// @ts-ignore: plain JS
import { placementMax, startPlacement, PER_TOPIC, PROBE_LEN } from '@/lib/placement.js';

// the teaching content loads one topic at a time (DURABLE-11): these tests run on all of it, loaded
const CONTENT = await loadAllContent();

const NOW = '2026-11-10T10:00:00.000Z';
const empty = (): LearnState => ({ skills: {}, miscon: {}, exam: null, missions: {}, events: [] });
const idsOf = (d: ReturnType<typeof diagnose>) => (d.kind === 'misconception' ? d.candidates.map((c) => c.id) : []);

describe('pyth:3, how many of four triangles are right-angled', () => {
  const c = CONTENT['pyth:3'];
  it('explains "assumed right" for the count the question asks, with an example whose answer is a count', () => {
    const m = c.misconceptions.find((x) => x.id === 'assume-right')!;
    expect(testModel.bugs['assume-right']({ sets: [[3, 4, 5], [6, 8, 11], [5, 12, 13], [7, 8, 9]] })).toBe(4);
    const text = m.explain.join(' ');
    expect(text).toContain('ארבעת המשולשים');
    expect(text).not.toContain('כתבתם את הצלע הארוכה');
    expect(text).not.toContain('והתשובה $0$');
    // the example: 6, 8, 10 is right-angled (36 + 64 = 100), 6, 8, 11 is not (121): one of the two
    expect(6 ** 2 + 8 ** 2).toBe(10 ** 2);
    expect(11 ** 2).not.toBe(6 ** 2 + 8 ** 2);
    expect(text).toContain('רק $1$ ישר־זווית');
  });
  it('names "compared the sides" only where 0 misses at least two right triangles, not for one slip', () => {
    const one = { sets: [[3, 4, 5], [6, 8, 11], [5, 12, 14], [7, 24, 26]] }; // one right triangle
    expect(testModel.answer(one)).toBe(1);
    expect(idsOf(diagnose(testModel, one, 0))).not.toContain('add-legs');
    const three = { sets: [[3, 4, 5], [6, 8, 10], [5, 12, 13], [6, 8, 11]] };
    expect(testModel.answer(three)).toBe(3);
    expect(idsOf(diagnose(testModel, three, 0))).toContain('add-legs');
  });
});

describe('coord:2, a coordinate from the quadrant and the distances to the axes', () => {
  const c = CONTENT['coord:2'];
  it('a dropped minus is a sign mistake, and in the second quadrant it is told apart from a clockwise count', () => {
    const q2 = { k: 3, x: -4, y: 3, t: 2, pts: [], ask: 0 }; // second quadrant, 4 from the y-axis: x = −4
    expect(quadModel.answer(q2)).toBe(-4);
    const d = diagnose(quadModel, q2, 4);
    expect(idsOf(d).sort()).toEqual(['quad-order', 'sign']);
    expect(d.kind === 'misconception' && d.ambiguous).toBe(true);
    // the third quadrant: the same slip is only a sign mistake (it was "unknown")
    expect(idsOf(diagnose(quadModel, { k: 3, x: -4, y: -2, t: 3, pts: [], ask: 0 }, 4))).toEqual(['sign']);
    // and a question tells the two apart
    const p = discriminating(quadModel, ['quad-order', 'sign'], seeded(3));
    expect(p).not.toBeNull();
    expect(quadModel.bugs['quad-order'](p!)).not.toBe(quadModel.bugs.sign(p!));
    // the repair the student is sent to describes what they did
    const m = c.misconceptions.find((x) => x.id === 'sign')!;
    expect(m.explain[0]).toContain('המרחק מהציר');
  });
});

describe('solve together: the last step names a mistake honestly', () => {
  const names = { a: 'החליפו בין $x$ ל־$y$', b: 'מספרו את הרביעים עם כיוון השעון' };
  it('frames past-tense names as what probably happened, one or two', () => {
    expect(namedMistake(['a'], names)).toBe('מה כנראה קרה: החליפו בין $x$ ל־$y$.');
    expect(namedMistake(['a', 'b'], names)).toBe('מה כנראה קרה: אולי החליפו בין $x$ ל־$y$, ואולי מספרו את הרביעים עם כיוון השעון.');
    expect(namedMistake(['zzz'], names)).toBeNull();
  });
  it('does not name a mistake the steps already solved rule out', () => {
    // coord:2 #1: the student read x = −8 as left and y = 3 as up, so 4 is a clockwise count, not a swap
    expect(diagnoseFinal(CONTENT['coord:2'], 0, 4)).toEqual(['quad-order']);
    // pyth:3 #1: 29 was chosen as the hypotenuse, the squares compared and "right-angled" concluded
    expect(diagnoseFinal(CONTENT['pyth:3'], 0, 0)).toEqual([]);
    // pyth:3 #2: "not right-angled" was chosen in step 2, so 16 (taking it as right) is not named
    expect(diagnoseFinal(CONTENT['pyth:3'], 1, 16)).toEqual([]);
    expect(diagnoseFinal(CONTENT['pyth:3'], 1, 21)).toEqual(['add-legs']);
    // coord:2 #2: both points on the axes were just set aside, so 4 is not "counted the axes"
    expect(diagnoseFinal(CONTENT['coord:2'], 1, 4)).toEqual([]);
  });
  it('weighs a guided step below an answer given alone: the two guided problems never confirm a mistake', () => {
    let learn = empty();
    ['together:0', 'together:1'].forEach((k) => {
      learn = learnAfterAnswer(learn, { topic: 'coord', level: 2, ok: false, purpose: 'guided', key: `coord:2:${k}`, cands: [{ id: 'quad-order', conf: 1 }], at: NOW });
    });
    const r = learn.miscon['coord:2|quad-order'];
    expect(r.score).toBe(1);
    expect(r.score).toBeLessThan(CONFIRM_SCORE);
    expect(r.state).toBe('suspected');
    // an answer in practice still counts in full
    const alone = learnAfterAnswer(empty(), { topic: 'coord', level: 2, ok: false, purpose: 'practice', key: 'k', cands: [{ id: 'quad-order', conf: 1 }], at: NOW });
    expect(alone.miscon['coord:2|quad-order'].score).toBe(1);
  });
});

describe('rounded lengths', () => {
  it('a right answer to two decimals is right even when the root rounds to a whole number', () => {
    const it288 = { form: 'num', answer: 17, exact: Math.sqrt(288) }; // √288 = 16.97…, rounded to tenths 17.0
    expect(isCorrect(it288, 16.97)).toBe(true);
    expect(isCorrect(it288, 17)).toBe(true);
    expect(isCorrect(it288, 16.9)).toBe(false);
    // √50 = 7.07…: 7.1 and 7.07 are right, 7 is not
    const it50 = { form: 'num', answer: 7.1, exact: Math.sqrt(50) };
    expect([7.1, 7.07, 7].map((u) => isCorrect(it50, u))).toEqual([true, true, false]);
    // a whole answer is still exact
    expect(isCorrect({ form: 'num', answer: 13, exact: 13 }, 13.04)).toBe(false);
  });
  it('the generators and the stairs\' own questions: every rounded answer typed to two decimals is right', () => {
    const rnd = seeded(29);
    let whole = 0;
    for (let i = 0; i < 400; i += 1) {
      [1, 2, 4, 5].forEach((L) => {
        const items: any[] = [makeItem('pyth', L), itemFor(`pyth:${L}`, 'diag', rnd), itemFor(`pyth:${L}`, 'transfer', rnd)];
        items.forEach((it) => {
          if (it.exact == null) return;
          if (Number.isInteger(it.answer) && !Number.isInteger(it.exact)) whole += 1; // a root that rounds to a whole number
          expect(isCorrect(it, Math.round(it.exact * 100) / 100), `${it.key}: ${it.exact}`).toBe(true);
        });
      });
    }
    expect(whole).toBeGreaterThan(0); // the case the council found is in the sample
  });
  it('a mistake is matched against its exact value: 32.02 for √1025 is "added the squares"', () => {
    const p = { a: 8, b: Math.sqrt(31 * 31 - 64), c: 31 }; // c² + a² = 1025, √1025 = 32.02…
    expect(idsOf(diagnose(legModel, p, 32.02))).toEqual(['add-not-sub']);
    expect(idsOf(diagnose(legModel, p, 32))).toEqual(['add-not-sub']);
    // and the right answer to two decimals (√897 = 29.95…, rounded 30.0) is right, not a mistake
    expect(diagnose(legModel, p, 29.95).kind).toBe('right');
  });
});

describe('Exam Rescue: a prerequisite before the stairs that lean on it', () => {
  it('strengthens a shaky leg (pyth:2) before learning the word problem that uses it (pyth:4)', () => {
    let plan = newPlan({ grade: '8', date: '2026-11-16', skills: ['pyth:2', 'pyth:4'], confidence: 3, minutes: 15 }, NOW);
    plan = recordDiagnostic(plan, 'pyth:2', 1, 2, NOW); // shaky
    plan = recordDiagnostic(plan, 'pyth:4', 0, 2, NOW); // a gap
    const p = examPlan(plan, empty(), NOW, '2026-11-10');
    const tasks = p.days.flatMap((d) => d.tasks);
    const at = (skill: string, kind: string) => tasks.findIndex((t) => t.skill === skill && t.kind === kind);
    expect(at('pyth:2', 'practice')).toBeLessThan(at('pyth:4', 'learn'));
    expect(p.skills.map((s) => s.skill)).toEqual(['pyth:2', 'pyth:4']);
  });
  it('in any plan, no stair is worked on before a chosen prerequisite that still needs work', () => {
    const rnd = seeded(11);
    for (let n = 0; n < 200; n += 1) {
      const grade = rnd() < 0.5 ? '7' : '8';
      const skills = ALL_SKILLS.filter(() => rnd() < 0.4).slice(0, 10);
      if (!skills.length) continue;
      let plan = newPlan({ grade, date: '2026-11-19', skills, confidence: 3, minutes: 30 }, NOW);
      skills.forEach((s) => { plan = recordDiagnostic(plan, s, Math.floor(rnd() * 3), 2, NOW); });
      const p = examPlan(plan, empty(), NOW, '2026-11-10');
      const tasks = p.days.flatMap((d) => d.tasks);
      const first = (s: string) => tasks.findIndex((t) => t.skill === s);
      const work = p.skills.filter((s) => s.standing !== 'mastered' && s.standing !== 'ready').map((s) => s.skill);
      work.forEach((s) => ancestorsOf(s).filter((a) => work.includes(a)).forEach((a) => {
        expect(first(a), `${a} before ${s}`).toBeLessThan(first(s));
      }));
    }
  });
});

describe('copy', () => {
  it('says when the next check is without "בעוד 1 יום"', () => {
    expect(inDays(1)).toBe('מחר');
    expect(inDays(2)).toBe('בעוד יומיים');
    expect(inDays(3)).toBe('בעוד 3 ימים');
  });
  it('the placement test is announced with its real length, from one place', () => {
    expect(placementMax('7')).toBe(3 * PER_TOPIC * PROBE_LEN);
    expect(placementMax('7')).toBe(18);
    expect(startPlacement({ grade: '8' }).total).toBe(placementMax('8'));
  });
});

describe('checks ask every order of a comparison', () => {
  it('a positive number before a negative one in TeX braces counts as a question with a negative number', () => {
    const it = { topic: 'signed', form: 'mc', text: 'איזה סימן מתאים במקום הריבוע?', display: '12 \\;\\square\\; {-12}', choices: [{ tex: '<' }, { tex: '=' }, { tex: '>' }], answer: 2 };
    expect(fairForCheck(it)).toBe(true);
    expect(fairForCheck({ ...it, display: '12 \\;\\square\\; {7}' })).toBe(false);
    // every comparison from the generator with a negative number in it is fair now
    for (let i = 0; i < 2000; i += 1) {
      const g: any = makeItem('signed', 2);
      if (String(g.key).startsWith('sn2:') && /-\d/.test(g.display)) expect(fairForCheck(g), g.display).toBe(true);
    }
  });
  it('a negative fraction counts as a negative number, so a signed fraction with a positive answer stays in checks', () => {
    // −1/4 − (−3/4) = 1/2: both numbers are negative fractions, and the answer is positive
    const it = { topic: 'signed', form: 'num', text: 'חשבו:', display: '-\\frac{1}{4} - \\left(-\\frac{3}{4}\\right)', answer: 0.5 };
    expect(fairForCheck(it)).toBe(true);
    expect(fairForCheck({ ...it, display: '1\\frac{1}{4} + \\left(-\\frac{3}{4}\\right)' })).toBe(true);
    expect(fairForCheck({ ...it, display: '\\frac{1}{4} + \\frac{3}{4}', answer: 1 })).toBe(false);
    // every signed:6 question with a typed answer is fair: each one has a negative number in it
    for (let i = 0; i < 2000; i += 1) {
      const g: any = makeItem('signed', 6);
      if (!g.practiceOnly) expect(fairForCheck(g), `${g.key}`).toBe(true);
    }
  });
});
