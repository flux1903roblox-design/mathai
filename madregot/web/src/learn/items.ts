// Exercises made from a stair's diagnostic models, in the shape the lesson screen already plays
// (key, text, display, form 'num', answer, hint, solution, diag), plus a full diagnosis of a wrong answer.
// And the plan of each kind of check: which questions, from where.
import type { DiagModel, StairContent, SkillId, Rng } from './types';
import { contentOf, metaOf } from './content/index';
import { diagnose, couldShow, discriminating } from './misconceptions';
import { parseSkill } from './skills';
import { MASTERY_N, REVIEW_N } from './mastery';
import { VERIFY_N } from './misconceptions';
import { DIAG_PER_SKILL } from './examRescue';
// @ts-ignore: plain JS
import { makeItem, fairForCheck, namesOf } from '@/content/index.js';
// @ts-ignore: plain JS
import { factsItem } from '@/content/frac.js';
// @ts-ignore: plain JS
import { withFormatNote } from '@/content/util.js';

/**
 * probe: where a misconception would show; control: where it would not (so a fixed answer cannot pass a verification);
 * facts: a multiplication fact (content/frac.js factsItem), which belongs to no stair.
 */
export type Source = 'gen' | 'diag' | 'transfer' | 'probe' | 'control' | 'facts';
/** The skill a facts question is filed under in a check's plan and its per-skill count: no stair (level 0). */
export const FACTS_SKILL = 'facts:0';
/** The floor check: one question from each fractions stair, and two multiplication facts. */
export const FLOOR_SKILLS = ['frac:1', 'frac:2', 'frac:3', 'frac:4'];
export const FLOOR_FACTS = 2;

/** A typed answer as the number the models predict: a fraction answer ({ n, d }, the 'frac' form) by its value. */
export type TypedAnswer = number | { n: number; d: number };
export const answerValue = (u: TypedAnswer): number => (typeof u === 'object' && u ? u.n / u.d : (u as number));

export function modelItem(c: StairContent, model: DiagModel<any>, p: any, source: Source) {
  // a model whose questions are of two kinds may choose the answer's form per question (decimals, or quarters)
  const fmt = typeof model.fmt === 'function' ? model.fmt(p) : model.fmt;
  const form = model.form ?? 'num';
  const it = {
    key: `${c.skill}:${source}:${JSON.stringify(p)}`,
    text: model.text(p), display: model.display?.(p), fig: model.fig?.(p), form, unit: model.unit,
    answer: model.answer(p), exact: model.exact?.(p), hint: model.hint(p), solution: model.solution(p),
    // a fraction typed (form 'frac') is diagnosed by its value: 2/22 and 1/11 name the same mistake
    diag: (u: TypedAnswer) => { const d = diagnose(model, p, answerValue(u)); return d.kind === 'misconception' ? d.candidates[0].id : null; },
    diagnosis: (u: TypedAnswer) => diagnose(model, p, answerValue(u)),
    could: couldShow(model, p),
    topic: c.topic, level: c.level, levelTitle: c.title, source,
    ...(model.precise ? { precise: true } : {}), ...(fmt ? { fmt } : {}),
  };
  // an exact answer with no short decimal (7/12) says once how to write it, as a generated exercise does (a fraction
  // answer is typed as a fraction: it needs no note)
  return model.precise && form === 'num' ? withFormatNote(it) : it;
}

/** The forms of a stair's exercises that can show some misconceptions, learned once from a sample (see genProbe). */
const PROBE_FORMS = new Map<string, Set<string>>();
const PROBE_SAMPLE = 80;
const PROBE_TRIES = 400;
const PROBE_PICK = 4;
/**
 * An exercise of the stair's own generator where these misconceptions can show (its diag() names each of them for
 * some wrong answer): the probe of a verification when no diagnostic model predicts the misconception (the pair
 * written the other way round, a relation reversed in words, a bar set to the mean). Null when none can.
 */
function genProbe(topic: string, level: number, ids: string[], avoidKey?: string) {
  const k = `${topic}:${level}|${ids.join(',')}`;
  let forms = PROBE_FORMS.get(k);
  if (!forms) {
    // which kinds of exercise can show them at all, so a search skips the others at once
    forms = new Set();
    // (only exercises a check may ask: a practice-only one, such as the curriculum lane's two-choice questions, is one a
    // guesser gets right half the time, content/index.js fairForCheck)
    for (let i = 0; i < PROBE_SAMPLE; i += 1) { const it = makeItem(topic, level); if (!fairForCheck(it)) continue; const n = namesOf(it, ids); if (ids.every((id) => n.includes(id))) forms.add(it.form); }
    PROBE_FORMS.set(k, forms);
  }
  if (!forms.size) return null;
  // of a few that can show it, the one a guesser is least likely to get right: typed, else the most choices
  const odds = (it: any) => (it.form === 'mc' ? 1 / it.choices.length : 0);
  let best: any = null;
  for (let i = 0, found = 0; i < PROBE_TRIES && found < PROBE_PICK; i += 1) {
    const it = makeItem(topic, level, avoidKey);
    if (!forms.has(it.form) || it.key === avoidKey || !fairForCheck(it)) continue;
    const could = namesOf(it, ids);
    if (!ids.every((id) => could.includes(id))) continue;
    found += 1;
    if (!best || odds(it) < odds(best)) best = { ...it, source: 'probe' as const, probe: ids, could };
    if (!odds(best)) break; // a typed answer: none better
  }
  return best;
}

/**
 * Can a check's question show these misconceptions at all: a diagnostic model predicts them, or an exercise a check may
 * ask (fairForCheck) names them? Not always: the curriculum lane's ratio:1 add-same and signed:6 toward-zero show
 * only in practice-only choices (two or three options, which a guesser gets right too often for a check), so their
 * verification asks the stair's ordinary questions and cannot see a relapse.
 */
export function canProbe(skill: SkillId, ids: string[]): boolean {
  const c = contentOf(skill);
  if (c && [c.diag, c.transfer].some((x) => x && ids.every((id) => id in x.bugs))) return true;
  const { topic, level } = parseSkill(skill);
  return !!genProbe(topic, level, ids);
}

/** One question of a skill from a source; falls back to the stair's exercise generator. */
function itemOnce(skill: SkillId, source: Source, rnd: Rng, avoidKey?: string, candidates?: string[]) {
  if (source === 'facts') return factsItem(avoidKey);
  const { topic, level } = parseSkill(skill);
  // 'gen' is the stair's own generator and never reads the teaching content, so it needs no topic loaded (the teacher's
  // class exam, lib/exam.js, draws only these)
  const c = source === 'gen' ? null : contentOf(skill);
  if (c) {
    const model = source === 'transfer' && c.transfer ? c.transfer : c.diag;
    if (source === 'probe' && candidates?.length) {
      const inModel = [c.diag, c.transfer].find((x) => x && candidates.every((id) => id in x.bugs));
      // a misconception no model predicts (the generators name it): one of the stair's exercises where it can show
      const g = inModel ? null : genProbe(topic, level, candidates, avoidKey);
      if (g) return g;
      const m = inModel || c.diag;
      const p = discriminating(m!, candidates.filter((id) => id in m!.bugs), rnd);
      if (p) return { ...modelItem(c, m!, p, 'probe'), probe: candidates };
    } else if (source === 'control' && candidates?.length) {
      // a question of the same kind where the misconception would not change the answer
      const m = [c.diag, c.transfer].find((x) => x && candidates.every((id) => id in x.bugs)) || c.diag;
      for (let i = 0; i < 400; i += 1) {
        const p = m!.params(rnd); const ans = m!.answer(p);
        const quiet = candidates.every((id) => { const v = m!.bugs[id]?.(p); return v == null || !Number.isFinite(v) || Math.abs(v - ans) < 1e-9; });
        if (quiet) { const it = modelItem(c, m!, p, 'control'); if (it.key !== avoidKey) return it; }
      }
      return itemOnce(skill, 'diag', rnd, avoidKey);
    } else {
      for (let i = 0; i < 20; i += 1) { const p = model.params(rnd); const it = modelItem(c, model, p, source); if (it.key !== avoidKey) return it; }
    }
  }
  return makeItem(topic, level, avoidKey);
}

/**
 * One question of a skill from a source. In a check or the placement test (`test`), a question that cannot show the
 * skill is skipped (content/index.js fairForCheck: a signed-number question with no negative number in it).
 */
export function itemFor(skill: SkillId, source: Source, rnd: Rng, avoidKey?: string, candidates?: string[], opts: { test?: boolean } = {}) {
  let it = itemOnce(skill, source, rnd, avoidKey, candidates);
  for (let i = 0; opts.test && i < 40 && !fairForCheck(it); i += 1) it = itemOnce(skill, source, rnd, avoidKey, candidates);
  return it;
}

export type CheckPurpose = 'mastery' | 'review' | 'verify' | 'diagnostic' | 'exam' | 'floor';
export interface CheckSpec { purpose: CheckPurpose; skill?: SkillId; skills?: SkillId[]; misc?: string }

const shuffle = <T>(a: T[], rnd: Rng) => { const b = [...a]; for (let i = b.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/** The questions of a check, as [skill, source, candidates?] — the items are made one at a time while it runs. */
export function checkPlan(spec: CheckSpec, rnd: Rng): { skill: SkillId; source: Source; candidates?: string[] }[] {
  // the plan needs only the meta; making its questions needs the topics loaded (ensureTopics, lib/lesson.js)
  const has = (s: SkillId) => !!metaOf(s);
  const hasT = (s: SkillId) => !!metaOf(s)?.transfer;
  switch (spec.purpose) {
    case 'mastery': {
      const s = spec.skill!;
      // a fresh surface on purpose: the generator's exercises and the diagnostic/transfer questions together
      const src: Source[] = has(s) ? ['gen', 'diag', 'gen', hasT(s) ? 'transfer' : 'diag', 'gen'] : Array(MASTERY_N).fill('gen');
      return shuffle(src, rnd).map((source) => ({ skill: s, source }));
    }
    case 'review': {
      const s = spec.skill!;
      const src: Source[] = has(s) ? ['gen', hasT(s) ? 'transfer' : 'diag', 'diag'] : Array(REVIEW_N).fill('gen');
      return shuffle(src, rnd).map((source) => ({ skill: s, source }));
    }
    case 'verify': {
      const s = spec.skill!;
      // questions where the repaired misconception would show again, and one where it would not: the answers differ,
      // so neither the old habit nor a fixed answer passes (all VERIFY_N right, src/learn/misconceptions.ts)
      if (!has(s)) return Array.from({ length: VERIFY_N }, () => ({ skill: s, source: 'gen' as const }));
      return Array.from({ length: VERIFY_N }, (_, i) => ({ skill: s, source: (i < VERIFY_N - 1 ? 'probe' : 'control') as Source, candidates: [spec.misc!] }));
    }
    case 'diagnostic':
      return (spec.skills || []).flatMap((s) => Array.from({ length: DIAG_PER_SKILL }, (_, i) => ({ skill: s, source: (has(s) && i === 0 ? 'diag' : 'gen') as Source })));
    case 'exam': {
      const list = spec.skills || [];
      const per = list.length >= 6 ? 1 : 2;
      return shuffle(list.flatMap((s) => Array.from({ length: per }, (_, i) => ({ skill: s, source: (hasT(s) && i === 1 ? 'transfer' : 'gen') as Source }))), rnd).slice(0, 14);
    }
    case 'floor': {
      // the floor check (בדיקת יסודות): a diagnostic question of each fractions stair, so a wrong answer names its
      // misconception, and two multiplication facts; six questions in all, in a shuffled order
      const list = spec.skills?.length ? spec.skills : FLOOR_SKILLS;
      const facts = Array.from({ length: FLOOR_FACTS }, () => ({ skill: FACTS_SKILL, source: 'facts' as Source }));
      return shuffle([...list.map((s) => ({ skill: s, source: (has(s) ? 'diag' : 'gen') as Source })), ...facts], rnd);
    }
    default: return [];
  }
}
