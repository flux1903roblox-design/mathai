// The proof templates and the reason bank (GEOM-3.7, 3.8), and the true-triangle tool (GEOM-5 topic-wide): every
// template passes the template test in every letter set, its drawing is true, and triFromAngles draws what it is asked.
import { describe, it, expect } from 'vitest';
import { REASONS, R, PROOFS, PROOF, LETTER_SETS, proofIn, proofManip, proofRows, proofDiag, triFromAngles, checkProofItem } from './proofs.js';
import { askedSteps, proofCheckable, proofReasonGuess, CHECK_REASONS } from './proof.js';
import { templateFaults, figureFaults } from './proof.check.js';
import { firstOutOfPlace, shuffledOrder } from '@/learn/challenges/grade.ts';
import { fairForCheck } from './index.js';
import { manipSolution } from './manip.js';
import { geoClashes, geoSweep, geoLayout } from '@/components/geoLayout.js';

const angleAt = (a, b, c) => { const u = [a[0] - b[0], a[1] - b[1]]; const v = [c[0] - b[0], c[1] - b[1]]; return (Math.acos((u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v))) * 180) / Math.PI; };

describe('the reason bank (GEOM-3.7)', () => {
  it('has the 19 reasons in the class\'s wording, the adjacent-angles sum among them, none twice', () => {
    expect(REASONS).toHaveLength(19);
    expect(new Set(REASONS).size).toBe(19);
    expect(REASONS).toContain('סכום זוויות צמודות הוא $180°$');
    expect(REASONS).toContain('לפי צ.ז.צ');
    expect(REASONS).toContain('לפי ז.ז');
    expect(REASONS).toContain('צלעות מתאימות במשולשים דומים');
    // no Latin letter outside the maths, and every piece of maths is a number of degrees
    REASONS.forEach((r) => { expect(r.replace(/\$[^$]+\$/g, '')).not.toMatch(/[A-Za-z]/); });
  });
});

describe('the proof templates T1–T11 (GEOM-3.8)', () => {
  it('are the seven of the spec and the four of sim:1\'s and sim:3\'s checks, with the theorem each one names', () => {
    expect(PROOFS.map((T) => T.id)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11']);
    const thm = (T) => { const s = T.steps[T.thm]; return s.reason ? s.reason.choices[s.reason.answer] : s.fixed; };
    expect(PROOFS.map(thm)).toEqual([R.sas, R.sss, R.sas, R.asa, R.sas, R.asa, R.aa, R.asa, R.sss, R.aa, R.aa]);
    // T5 ends in two rows: the equal angles, then the right angles from the adjacent-angles sum
    const t5 = PROOF.T5.steps.slice(-2);
    expect(t5.map((s) => s.reason.choices[s.reason.answer])).toEqual([R.angles, R.linearPair]);
    expect(PROOF.T5.free).toEqual([[0, 1, 2], [4, 5]]);
    // the same claim, two reasons: T5 and T9 get the right angles from two equal adjacent angles, T8 from the given ⊥
    const rightAngles = (T) => T.steps.find((s) => s.text === '$\\sphericalangle ADB = \\sphericalangle ADC = 90°$');
    const why = (s) => s.reason.choices[s.reason.answer];
    expect([PROOF.T5, PROOF.T9, PROOF.T8].map((T) => why(rightAngles(T)))).toEqual([R.linearPair, R.linearPair, R.perpendicular]);
    // T11's equal angles are given, not corresponding: its DE is not parallel to BC, and E matches B
    expect(why(PROOF.T11.steps[1])).toBe(R.given);
    expect(PROOF.T11.steps[1].reason.choices).toContain(R.correspondingPar);
  });

  it('pass the template test in every letter set: rows, groups, the bank, the theorem in its place, KaTeX', () => {
    for (const T of PROOFS) for (let set = 0; set < LETTER_SETS.length; set += 1) expect(templateFaults(proofIn(T, set)), `${T.id} set ${set}`).toEqual([]);
  });

  it('a congruence row offers the other theorems, never two sides and an angle not between them', () => {
    for (const T of PROOFS) {
      const s = T.steps[T.thm];
      expect(s.reason, T.id).toBeTruthy();
      const others = s.reason.choices.filter((_, k) => k !== s.reason.answer);
      expect(others.every((c) => [R.sas, R.asa, R.sss].includes(c)), T.id).toBe(true);
      expect(s.reason.choices.join(' ')).not.toMatch(/שאינה ביניהן|לא ביניהן/);
    }
  });

  it('draw what they state: every equality, ⊥ and ∥ of a row, the givens and the goal holds in the drawing', () => {
    for (const T of PROOFS) for (let set = 0; set < LETTER_SETS.length; set += 1) expect(figureFaults(proofIn(T, set)), `${T.id} set ${set}`).toEqual([]);
    // and what they do not state does not hold: T11's DE is not parallel to BC (its equal angles are given, not from parallels)
    expect(figureFaults({ ...PROOF.T11, given: '$DE \\parallel BC$' }).join(' ')).toMatch(/DE \\parallel BC/);
    // and the check is not empty: a drawing moved off its givens fails it
    const bent = { ...PROOF.T1, fig: { ...PROOF.T1.fig, pts: { ...PROOF.T1.fig.pts, B: [3, -1] } } };
    expect(figureFaults(bent).join(' ')).toMatch(/AM = MB/);
  });

  it('draw readably and with true marks, in every letter set: no label on another, none crossed or cut off, only the proof\'s points', () => {
    const len = (P, s) => Math.hypot(P[s.a][0] - P[s.b][0], P[s.a][1] - P[s.b][1]);
    const dir = (P, s) => { const d = [P[s.b][0] - P[s.a][0], P[s.b][1] - P[s.a][1]]; const n = Math.hypot(...d); return [d[0] / n, d[1] / n]; };
    const sameAll = (vs) => vs.every((v) => Math.abs(v - vs[0]) < 1e-6);
    // the least distance, in pixels, between a letter's box and a drawn line (sampled along the line)
    const gap = (b, [p, q]) => Math.min(...Array.from({ length: 401 }, (_, i) => {
      const x = p[0] + ((q[0] - p[0]) * i) / 400; const y = p[1] + ((q[1] - p[1]) * i) / 400;
      return Math.hypot(Math.max(0, Math.abs(x - b.c[0]) - b.h[0]), Math.max(0, Math.abs(y - b.c[1]) - b.h[1]));
    }));
    for (const T of PROOFS) {
      for (let set = 0; set < LETTER_SETS.length; set += 1) {
        const U = proofIn(T, set); const f = U.fig; const at = `${T.id} set ${set}`;
        // components/geoLayout.js: every letter clear of every other letter and label, inside the drawing
        expect(geoClashes(f), at).toEqual([]);
        // a letter only where the proof's text uses it
        const named = new Set([U.given, U.goal, ...U.steps.map((s) => s.text)].join(' ').replace(/\\[a-z]+/g, ' ').match(/[A-Z]/g));
        expect(Object.keys(f.pts).filter((k) => !named.has(k)), `${at}: a point the proof never names`).toEqual([]);
        // the marks say what is true: the same ticks on equal sides, the same arrows on parallel ones, the same arcs on
        // equal angles, and a right-angle mark on 90°
        for (const n of new Set((f.segs || []).map((s) => s.ticks).filter(Boolean))) expect(sameAll(f.segs.filter((s) => s.ticks === n).map((s) => len(f.pts, s))), `${at}: ${n} ticks`).toBe(true);
        for (const n of new Set((f.segs || []).map((s) => s.arrows).filter(Boolean))) {
          const ds = f.segs.filter((s) => s.arrows === n).map((s) => dir(f.pts, s));
          ds.forEach((d) => expect(Math.abs(d[0] * ds[0][1] - d[1] * ds[0][0]), `${at}: ${n} arrows`).toBeLessThan(1e-9));
        }
        const arcs = (f.angles || []).filter((g) => !g.right);
        for (const n of new Set(arcs.map((g) => g.n || 1))) expect(sameAll(arcs.filter((g) => (g.n || 1) === n).map((g) => geoSweep(f.pts, g).deg)), `${at}: ${n} arcs`).toBe(true);
        (f.angles || []).filter((g) => g.right).forEach((g) => expect(geoSweep(f.pts, g).deg, at).toBeCloseTo(90, 9));
        // the student council's templates (T8–T11): every letter at least 5 px clear of every drawn line, the bowtie's
        // crossing M too (set beside it, on the bisector of the angle AMC)
        if (['T8', 'T9', 'T10', 'T11'].includes(T.id)) {
          const { letters, lines } = geoLayout(f);
          for (const [k, b] of Object.entries(letters)) expect(Math.min(...lines.map((l) => gap(b, l))), `${at}: ${k}`).toBeGreaterThanOrEqual(5);
        }
      }
    }
  });

  it('come in fresh letters: each set writes only its own letters, and the right reason stays right', () => {
    for (const T of PROOFS) {
      for (let set = 1; set < LETTER_SETS.length; set += 1) {
        const U = proofIn(T, set);
        const letters = new Set([U.given, U.goal, ...U.steps.map((s) => s.text)].join(' ').replace(/\\[a-z]+/g, '').match(/[A-Z]/g));
        expect([...letters].every((c) => LETTER_SETS[set].includes(c)), `${T.id} set ${set}: ${[...letters]}`).toBe(true);
        expect(Object.keys(U.fig.pts).every((k) => LETTER_SETS[set].includes(k)), `${T.id} set ${set}`).toBe(true);
        expect(U.steps.map((s) => (s.reason ? s.reason.answer : s.fixed))).toEqual(T.steps.map((s) => (s.reason ? s.reason.answer : s.fixed)));
      }
    }
    // the letter sets are swapped at once: in K–N with P, T1's M (the crossing) is P and its C is M
    expect(proofIn(PROOF.T1, 1).steps[2].text).toBe('$\\sphericalangle KPM = \\sphericalangle LPN$');
    expect(proofIn(PROOF.T7, 2).goal).toBe('$\\triangle EHO \\sim \\triangle EFG$');
  });

  it('the right reason is not always the first choice', () => {
    const at = PROOFS.flatMap((T) => T.steps.filter((s) => s.reason).map((s) => s.reason.answer));
    expect(new Set(at).size).toBeGreaterThan(1);
  });

  it('never start in a right order, whatever the seed', () => {
    for (const T of PROOFS) {
      for (let k = 0; k < 40; k += 1) {
        const o = shuffledOrder({ steps: T.steps, free: T.free }, `${T.id}:${k}`);
        expect(firstOutOfPlace({ steps: T.steps, free: T.free }, o), `${T.id} seed ${k}: ${o}`).not.toBe(-1);
      }
    }
  });

  it('become the proof object, the whole template or only the theorem asked', () => {
    const m = proofManip(PROOF.T1, { set: 2, seed: 's' });
    expect(m).toMatchObject({ kind: 'proof', tpl: 'T1', set: 2, given: proofIn(PROOF.T1, 2).given, goal: '$EG = FH$' });
    expect(m.lockOrder).toBeUndefined();
    expect(m.part.steps.filter((s) => s.reason)).toHaveLength(3);
    const only = proofManip(PROOF.T1, { ask: 'theorem', lockOrder: true });
    expect(only.lockOrder).toBe(true);
    expect(only.part.steps.map((s, i) => (s.reason ? i : -1)).filter((i) => i >= 0)).toEqual([PROOF.T1.thm]);
    expect(only.part.steps[2].fixed).toBe(R.vertical);
  });
});

describe('the proof mistakes (proofDiag, GEOM-3.6)', () => {
  const sol = (part) => ({ order: part.steps.map((_, i) => i), reasons: part.steps.map((s) => (s.reason ? s.reason.answer : null)) });
  it('a corresponding-parts row above the congruence row is circular; another theorem on it is wrong-theorem', () => {
    for (const T of PROOFS) {
      const part = { steps: T.steps, free: T.free };
      const right = sol(part);
      expect(proofDiag(part, right), T.id).toBeNull();
      const { thm, parts } = proofRows(part);
      // every other choice on the theorem row is another theorem
      const s = T.steps[thm];
      s.reason.choices.forEach((_, k) => {
        if (k === s.reason.answer) return;
        const reasons = [...right.reasons]; reasons[thm] = k;
        expect(proofDiag(part, { order: right.order, reasons }), `${T.id} choice ${k}`).toBe('wrong-theorem');
      });
      // each conclusion moved just above the congruence row
      parts.forEach((p) => {
        const order = right.order.filter((i) => i !== p); order.splice(thm, 0, p);
        expect(proofDiag(part, { order, reasons: right.reasons }), `${T.id} row ${p + 1} above`).toBe('circular');
      });
      // a wrong reason elsewhere, or an order mistake among the givens, is neither
      const other = T.steps.findIndex((st, i) => st.reason && i !== thm);
      if (other >= 0) {
        const reasons = [...right.reasons]; reasons[other] = (reasons[other] + 1) % T.steps[other].reason.choices.length;
        expect(proofDiag(part, { order: right.order, reasons }), T.id).toBeNull();
      }
    }
    // T7 has no corresponding parts: only the theorem can be the mistake
    expect(proofRows({ steps: PROOF.T7.steps }).parts).toEqual([]);
  });
});

describe('triFromAngles: a true triangle from its angles (GEOM-5 topic-wide)', () => {
  it('reproduces both angles and the base', () => {
    for (const [al, be, base] of [[50, 70, 5], [55, 55, 5], [30, 100, 4], [90, 45, 3], [20, 20, 8], [110, 35, 6]]) {
      const C = triFromAngles(al, be, base);
      const A = [0, 0]; const B = [base, 0];
      expect(Math.abs(angleAt(B, A, C) - al), `${al}, ${be}`).toBeLessThan(1e-9);
      expect(Math.abs(angleAt(A, B, C) - be), `${al}, ${be}`).toBeLessThan(1e-9);
      expect(Math.abs(angleAt(A, C, B) - (180 - al - be))).toBeLessThan(1e-9);
      expect(Math.hypot(B[0] - A[0], B[1] - A[1])).toBe(base);
      expect(C[1]).toBeGreaterThan(0); // above the base
    }
    // as learn/challenges/angles.ts draws its track: 50° and 70° on a base of 5
    const C = triFromAngles(50, 70, 5);
    const AC = (5 * Math.sin((70 * Math.PI) / 180)) / Math.sin((60 * Math.PI) / 180);
    expect(C[0]).toBeCloseTo(AC * Math.cos((50 * Math.PI) / 180), 12);
    expect(C[1]).toBeCloseTo(AC * Math.sin((50 * Math.PI) / 180), 12);
  });
});

describe('a check asks only a whole proof (GEOM-3.10, the council\'s round 3)', () => {
  const itemOf = (manip, more = {}) => { const it0 = { form: 'manip', manip, topic: 'congr', level: 3, key: 'pf:T1' }; return { ...it0, answer: manipSolution(it0), ...more }; };
  it('fairForCheck skips a practice proof: one or two reasons to fill in, the theorem alone, a hint, or the practice flag', () => {
    // the rows locked in order: only the reasons are asked
    expect(fairForCheck(itemOf(proofManip(PROOF.T1, { lockOrder: true })))).toBe(false);
    // only the theorem asked (proofOrder): one choice of three
    expect(fairForCheck(itemOf(proofManip(PROOF.T1, { ask: 'theorem' })))).toBe(false);
    // T6 shuffled asks two reasons only: a student who knows the order guesses it once in nine
    expect(askedSteps(proofManip(PROOF.T6).part)).toHaveLength(2);
    expect(fairForCheck(itemOf(proofManip(PROOF.T6)))).toBe(false);
    // a whole proof flagged practice only, or with a hint, stays out of a check
    expect(fairForCheck(itemOf(proofManip(PROOF.T1), { practiceOnly: true }))).toBe(false);
    expect(fairForCheck(itemOf(proofManip(PROOF.T1), { hint: 'קודם הנתונים.' }))).toBe(false);
    // the printed exam takes no object at all (lib/exam.js: form 'manip' and fairForCheck), so a proof never prints
  });
  it('a whole proof can be asked: its rows shuffled and at least three reasons asked, of three choices each', () => {
    for (const T of PROOFS) {
      const m = proofManip(T);
      expect(fairForCheck(itemOf(m)), T.id).toBe(proofCheckable(m));
      expect(proofCheckable(m), T.id).toBe(askedSteps(m.part).length >= CHECK_REASONS);
      if (proofCheckable(m)) expect(proofReasonGuess(m), T.id).toBeLessThanOrEqual(1 / 27);
    }
    // the stairs' check proofs (content/proofs.js checkProofItem): the same template, its choices turned, no hint
    const rnd = (() => { let t = 7; return () => { t = (t * 9301 + 49297) % 233280; return t / 233280; }; })();
    const it = { ...checkProofItem(PROOF.T1, { key: 'cg3c:T1', set: 1, seed: 5, text: 'סדרו את שורות ההוכחה, ובחרו נימוק לכל שורה.', rnd }), topic: 'congr', level: 3 };
    expect(it.hint).toBeUndefined();
    expect(fairForCheck(it)).toBe(true);
    expect(manipSolution(it)).toEqual(it.answer);
    // every row keeps its right reason, wherever it now stands among the choices
    const right = (s) => s.fixed ?? s.reason.choices[s.reason.answer];
    expect(it.manip.part.steps.map(right)).toEqual(proofIn(PROOF.T1, 1).steps.map(right));
  });
});
