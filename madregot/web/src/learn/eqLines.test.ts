// Equation lines as the class writes them (CLASSROOM-7). On the board, the operation done to both sides goes at the
// end of the line it acts on, after a slash ("3x + 9 = 4x /−3x", "/:9", "/·2"), and the next line is what it gives;
// a "9 = x" is turned round to "x = 9 (הפכנו צדדים)". These tests read every equation line the app writes for
// equations and systems as a chain, line after line: the generated solutions (500 per level), the diagnostic
// models' solutions (500 draws each), the worked examples and the teaching displays. Wherever the next line is the
// same equation with one operation done to both sides, the line carries that operation's mark, and doing it gives
// the next line exactly.
import { describe, it, expect } from 'vitest';
import { loadAllContent } from './content/index';
import type { DiagModel, StairContent, WorkedExample } from './types';
import { evaluate, same, seeded, texToExpr, texRelation } from './expr';
// @ts-ignore: plain JS
import { makeItem, TOPIC } from '@/content/index.js';
// @ts-ignore: plain JS
import { opMark, unmark } from '@/content/util.js';

const CONTENT = await loadAllContent();
const STAIRS = (Object.values(CONTENT) as StairContent[]).filter((c) => c.topic === 'eq' || c.topic === 'sys');
const N = 500;

type Op = { kind: 'add' | 'mul' | 'div'; v: string; tex: string };
type Eq = { L: string; R: string; rel: string; op: Op | null; tex: string };

/** The mark at the end of a line, as opMark writes it: /{-3x}, /{:}2, /{\cdot}(-2). */
function readOp(tex: string): Op | null {
  const m = /\\qquad\s*\/(.*)$/.exec(tex);
  if (!m) return null;
  const s = m[1].trim();
  if (s.startsWith('{:}')) return { kind: 'div', v: texToExpr(s.slice(3)), tex: s };
  if (s.startsWith('{\\cdot}')) return { kind: 'mul', v: texToExpr(s.slice(7)), tex: s };
  const a = /^\{([+-].+)\}$/.exec(s);
  if (a) return { kind: 'add', v: texToExpr(a[1]), tex: s };
  throw new Error(`a mark that is not an operation: ${tex}`);
}
/** One equation or inequality of a line, or null for anything else (a chain a = b = c, a pair, an expression). */
function eqOf(tex: string): Eq | null {
  if (/\\square|cases|Rightarrow|\\text|\\circ|\\begin/.test(tex)) return null;
  let e: Eq;
  try {
    const { left, rel, right } = texRelation(unmark(tex));
    e = { L: left, R: right, rel, op: readOp(tex), tex };
  } catch { return null; }
  // an identity (x + 0.2x = 1.2x, "x + 2x + x = 4x") states a fact on the way; it is not a line of the solving
  return e.rel === '=' && sameFn(e.L, e.R) ? null : e;
}
const VARS = 'abcdhkmnpqrstuvwxyz';
const POINTS: Record<string, number>[] = [0.37, -1.6, 2.3, 4.1, -2.7].map((v, i) => Object.fromEntries([...VARS].map((n, j) => [n, v + j * 0.71 + i * 0.13])));
const val = (e: string, p: Record<string, number>) => evaluate(e, p);
/** Are two expressions the same function of their letters (at five points where both are defined)? */
function sameFn(a: string, b: string) {
  return POINTS.every((p) => { const u = val(a, p); const v = val(b, p); return !Number.isFinite(u) || !Number.isFinite(v) || same(u, v, 1e-7); });
}
const isZero = (e: string) => sameFn(e, '0');
const flip = (rel: string) => ({ '<': '>', '>': '<', '<=': '>=', '>=': '<=' } as Record<string, string>)[rel] || rel;
/** Does doing `op` to both sides of a give b (its sides in either order)? */
function gives(a: Eq, op: Op, b: Eq) {
  const f = (s: string) => (op.kind === 'add' ? `(${s}) + (${op.v})` : op.kind === 'mul' ? `(${s}) * (${op.v})` : `(${s}) / (${op.v})`);
  const negative = op.kind !== 'add' && val(op.v, POINTS[0]) < 0;
  const rel = negative ? flip(a.rel) : a.rel;
  if (sameFn(f(a.L), b.L) && sameFn(f(a.R), b.R)) return b.rel === rel;
  if (sameFn(f(a.L), b.R) && sameFn(f(a.R), b.L)) return b.rel === flip(rel);
  return false;
}
const lettersOf = (...es: string[]) => [...new Set(es.join(' ').match(/[a-z]/g) || [])];
/** One term, as the class writes after a slash: a number (−8) or a number of one letter (−3x), not −4x + 1. */
function oneTerm(e: string, names: string[]) {
  if (sameFn(e, String(val(e, POINTS[0])))) return true;
  return names.some((v) => { const k = val(e, POINTS[0]) / POINTS[0][v]; return sameFn(e, `(${k}) * ${v}`); });
}
/**
 * Is b the equation a with one operation done to both sides: one term added (a number, or a number of one letter), or
 * both multiplied by a number other than 1? Two operations written as one jump ("מורידים x־ים ופותרים") are not.
 */
function oneOpApart(a: Eq, b: Eq) {
  const names = lettersOf(a.L, a.R, b.L, b.R);
  // the same equation written again (brackets opened, terms collected), or turned round: no operation
  if ((sameFn(a.L, b.L) && sameFn(a.R, b.R)) || (sameFn(a.L, b.R) && sameFn(a.R, b.L))) return false;
  for (const [L2, R2] of [[b.L, b.R], [b.R, b.L]]) {
    const dL = `(${L2}) - (${a.L})`; const dR = `(${R2}) - (${a.R})`;
    if (sameFn(dL, dR) && !isZero(dL) && oneTerm(dL, names)) return true;
    const p = POINTS.find((q) => Math.abs(val(a.L, q)) > 1e-6 && Math.abs(val(a.R, q)) > 1e-6);
    if (!p) continue;
    const k = val(L2, p) / val(a.L, p);
    if (Number.isFinite(k) && !same(k, 1) && !same(k, 0) && sameFn(L2, `(${k}) * (${a.L})`) && sameFn(R2, `(${k}) * (${a.R})`)) return true;
  }
  return false;
}
/** Every problem found in a chain of board lines; the empty list when it reads like the board. */
function chainProblems(lines: Eq[], where: string): string[] {
  const out: string[] = [];
  for (let i = 0; i + 1 < lines.length; i += 1) {
    const a = lines[i]; const b = lines[i + 1];
    if (a.op) { if (!gives(a, a.op, b)) out.push(`${where}: ${a.tex} does not give ${b.tex}`); } else if (oneOpApart(a, b)) out.push(`${where}: no mark on ${a.tex} before ${b.tex}`);
  }
  return out;
}
/** The equation lines of a solution, in order: every $...$ that is one equation, up to a check ("בדיקה"). */
function solutionChain(solution: string[], display?: string): Eq[] {
  const lines: Eq[] = [];
  const first = display ? eqOf(display) : null;
  if (first) lines.push(first);
  for (const line of solution) {
    const body = String(line).split('בדיקה')[0];
    // an equation of numbers only is a check or a substitution, not a line of the solving
    for (const m of body.matchAll(/\$([^$]+)\$/g)) { const e = eqOf(m[1]); if (e && lettersOf(e.L, e.R).length) lines.push(e); }
  }
  return lines;
}
/** "number = x" at the end of a line (a letter alone on the right, no letter on the left). */
const endsMirrored = (tex: string) => { const m = /^([^a-z]*)=\s*([a-z])\s*$/.exec(unmark(tex).replace(/\\[a-zA-Z]+/g, '').trim()); return m && /\d/.test(m[1]) ? m[2] : null; };
function solutionProblems(solution: string[], display: string | undefined, where: string): string[] {
  const out = chainProblems(solutionChain(solution, display), where);
  // a class exam keeps a question's solution only within the server's limit (worker/src/assignments.js: 8 lines of
  // at most 300 characters), so the board lines stay inside it
  if (solution.length > 8 || solution.some((l) => String(l).length > 300)) out.push(`${where}: ${solution.length} lines, longer than a class exam keeps`);
  solution.forEach((line, i) => {
    if (/(מוסיפים|מחסירים) \$-?0\$/.test(line)) out.push(`${where}: a zero step: ${line}`);
    const segs = [...String(line).split('בדיקה')[0].matchAll(/\$([^$]+)\$/g)].map((m) => m[1]);
    const v = segs.length ? endsMirrored(segs[segs.length - 1]) : null;
    // "35 : 7 = x", worked out on the next line ("5 = x"), is turned round there
    const next = [...String(solution[i + 1] || '').matchAll(/\$([^$]+)\$/g)].map((m) => m[1]);
    if (v && next.length && endsMirrored(next[next.length - 1]) === v) return;
    if (v &&!(new RegExp(`^\\$${v} = [^$]+\\$ \\(הפכנו צדדים\\)`).test(solution[i + 1] || ''))) out.push(`${where}: "${segs[segs.length - 1]}" is not turned round on the next line`);
  });
  return out;
}

describe('opMark writes the operation the class\'s way', () => {
  it('after a slash at the end of the line, the sign and the colon tight to the number', () => {
    expect(opMark('3x + 9 = 4x', '-3x')).toBe('3x + 9 = 4x \\qquad /{-3x}');
    expect(opMark('2x = 8', ':2')).toBe('2x = 8 \\qquad /{:}2');
    expect(opMark('\\frac{x}{2} = 4', '\\cdot 2')).toBe('\\frac{x}{2} = 4 \\qquad /{\\cdot}2');
    expect(unmark(opMark('-3x = 12', ':(-3)'))).toBe('-3x = 12');
  });
  it('the checker reads a marked line and finds a missing or wrong mark', () => {
    const e = (t: string) => eqOf(t)!;
    expect(chainProblems([e('3x + 9 = 4x \\qquad /{-3x}'), e('9 = 4x - 3x'), e('9 = x')], 't')).toEqual([]);
    expect(chainProblems([e('2x - 3 > 5 \\qquad /{+3}'), e('2x > 8 \\qquad /{:}2'), e('x > 4')], 't')).toEqual([]);
    expect(chainProblems([e('-2x < 6 \\qquad /{:}(-2)'), e('x > -3')], 't')).toEqual([]);
    expect(chainProblems([e('-2x < 6 \\qquad /{:}(-2)'), e('x < -3')], 't')).toHaveLength(1);
    expect(chainProblems([e('3x + 9 = 4x'), e('9 = x')], 't')).toHaveLength(1);
    expect(chainProblems([e('2x = 8 \\qquad /{:}4'), e('x = 4')], 't')).toHaveLength(1);
    expect(chainProblems([e('4(x + 2) = 5x'), e('4x + 8 = 5x')], 't')).toEqual([]);
    expect(solutionProblems(['$8 = x$', '$x = 8$ (הפכנו צדדים)'], undefined, 't')).toEqual([]);
    expect(solutionProblems(['$8 = x$', 'בדיקה: $4 \\cdot 10 = 40$'], undefined, 't')).toHaveLength(1);
    expect(solutionProblems(['מוסיפים $0$ לשני האגפים: $3x = 9$'], undefined, 't')).toHaveLength(1);
  });
});

describe('generated solutions read like the board (500 per level)', () => {
  for (const topic of ['eq', 'sys']) {
    TOPIC[topic].levels.forEach((_: unknown, i: number) => {
      it(`${topic}:${i + 1}`, () => {
        const problems = new Set<string>();
        for (let n = 0; n < N; n += 1) {
          const it2 = makeItem(topic, i + 1);
          // "which number solves it?" puts numbers in, line by line: its display is not the first line of a solving
          const solving = !String(it2.key).startsWith('eq1w');
          for (const p of solutionProblems(it2.solution || [], solving ? it2.display : undefined, it2.key)) problems.add(p);
        }
        expect([...problems].slice(0, 12)).toEqual([]);
      });
    });
  }
});

describe('the diagnostic models\' solutions read like the board (500 draws each)', () => {
  for (const c of STAIRS) {
    const models = [['diag', c.diag], ['transfer', c.transfer]].filter(([, m]) => m) as [string, DiagModel<any>][];
    for (const [name, model] of models) {
      it(`${c.skill} ${name}`, () => {
        const problems = new Set<string>();
        const rnd = seeded(c.level * 97 + name.length);
        for (let n = 0; n < N; n += 1) {
          const p = model.params(rnd);
          for (const q of solutionProblems(model.solution(p), model.display?.(p), `${c.skill} ${name} ${JSON.stringify(p)}`)) problems.add(q);
        }
        expect([...problems].slice(0, 12)).toEqual([]);
      });
    }
  }
});

/** A worked example's lines as the board shows them: the problem's line, then each result, each with the mark of the step after it. */
function exampleChain(ex: WorkedExample): Eq[] {
  const raw = [ex.display, ...ex.steps.map((s) => s.result)];
  const out: Eq[] = [];
  raw.forEach((t, i) => {
    const mark = ex.steps[i]?.mark;
    const e = t ? eqOf(mark ? opMark(t, mark) : t) : null;
    if (e && lettersOf(e.L, e.R).length) out.push(e);
  });
  return out;
}

describe('worked examples read like the board', () => {
  for (const c of STAIRS) {
    it(`${c.skill}: every both-sides step is marked on the line it acts on, and "number = x" is turned round`, () => {
      c.examples.forEach((ex, k) => {
        expect(chainProblems(exampleChain(ex), `${c.skill} example ${k + 1}`)).toEqual([]);
        ex.steps.forEach((s, i) => {
          if (s.mark) expect(() => opMark('x = 1', s.mark), `${c.skill} example ${k + 1} step ${i + 1}`).not.toThrow();
          const v = endsMirrored(s.result);
          if (v) expect(ex.steps[i + 1]?.result.replace(/\s/g, '').startsWith(`${v}=`), `${c.skill} example ${k + 1}: "${s.result}" is not turned round`).toBe(true);
        });
      });
    });
  }
});

describe('eq:3\'s table of both sides, as the class writes it', () => {
  it('each row says what is done to it, and doing it gives the next row (at x = 7: 11 = 11, then 4 = 4)', () => {
    const c = STAIRS.find((s) => s.skill === 'eq:3')!;
    const step = c.discover.find((s) => (s as any).fig?.type === 'table' && (s as any).fig.head?.includes('עושים')) as any;
    const rows: string[][] = step.fig.rows;
    expect(rows).toEqual([['2x − 3', 'x + 4', '/−x'], ['x − 3', '4', '/+3'], ['x', '7', '']]);
    const minus = (t: string) => t.replace(/−/g, '-');
    const chain = rows.map(([l, r, op]) => eqOf(op ? opMark(`${minus(l)} = ${minus(r)}`, minus(op.slice(1))) : `${minus(l)} = ${minus(r)}`)!);
    expect(chainProblems(chain, 'the table')).toEqual([]);
    chain.forEach((e) => expect(same(evaluate(e.L, { x: 7 }), evaluate(e.R, { x: 7 })), e.tex).toBe(true));
  });
});

describe('the teaching displays read like the board', () => {
  for (const c of STAIRS) {
    it(`${c.skill}: rows of an aligned display`, () => {
      const displays = [...c.discover, ...c.misconceptions.flatMap((m) => m.remedy)].map((s) => ('display' in s ? s.display : undefined)).filter((d): d is string => !!d && d.includes('aligned'));
      for (const d of displays) {
        const rows = d.replace(/\\(begin|end)\{aligned\}/g, '').split('\\\\').map((r) => r.replace(/&/g, '').trim());
        const chain = rows.map(eqOf).filter((e): e is Eq => !!e);
        expect(chainProblems(chain, `${c.skill} ${d}`)).toEqual([]);
      }
    });
  }
});
