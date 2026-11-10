// Exercises made from a stair's diagnostic models, in the shape the lesson screen already plays
// (key, text, display, form 'num', answer, hint, solution, diag), plus a full diagnosis of a wrong answer.
// And the plan of each kind of check: which questions, from where.
import type { DiagModel, StairContent, SkillId, Rng } from './types';
import { contentOf } from './content/index';
import { diagnose, couldShow, discriminating } from './misconceptions';
import { parseSkill } from './skills';
import { MASTERY_N, REVIEW_N } from './mastery';
import { VERIFY_N } from './misconceptions';
import { DIAG_PER_SKILL } from './examRescue';
// @ts-ignore: plain JS
import { makeItem, fairForCheck } from '@/content/index.js';
// @ts-ignore: plain JS
import { withFormatNote } from '@/content/util.js';

/** probe: where a misconception would show; control: where it would not (so a fixed answer cannot pass a verification). */
export type Source = 'gen' | 'diag' | 'transfer' | 'probe' | 'control';

export function modelItem(c: StairContent, model: DiagModel<any>, p: any, source: Source) {
  // a model whose questions are of two kinds may choose the answer's form per question (decimals, or quarters)
  const fmt = typeof model.fmt === 'function' ? model.fmt(p) : model.fmt;
  const it = {
    key: `${c.skill}:${source}:${JSON.stringify(p)}`,
    text: model.text(p), display: model.display?.(p), fig: model.fig?.(p), form: 'num' as const, unit: model.unit,
    answer: model.answer(p), exact: model.exact?.(p), hint: model.hint(p), solution: model.solution(p),
    diag: (u: number) => { const d = diagnose(model, p, u); return d.kind === 'misconception' ? d.candidates[0].id : null; },
    diagnosis: (u: number) => diagnose(model, p, u),
    could: couldShow(model, p),
    topic: c.topic, level: c.level, levelTitle: c.title, source,
    ...(model.precise ? { precise: true } : {}), ...(fmt ? { fmt } : {}),
  };
  // an exact answer with no short decimal (7/12) says once how to write it, as a generated exercise does
  return model.precise ? withFormatNote(it) : it;
}

/** One question of a skill from a source; falls back to the stair's exercise generator. */
function itemOnce(skill: SkillId, source: Source, rnd: Rng, avoidKey?: string, candidates?: string[]) {
  const { topic, level } = parseSkill(skill);
  const c = contentOf(skill);
  if (c && source !== 'gen') {
    const model = source === 'transfer' && c.transfer ? c.transfer : c.diag;
    if (source === 'probe' && candidates?.length) {
      const m = [c.diag, c.transfer].find((x) => x && candidates.every((id) => id in x.bugs)) || c.diag;
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

export type CheckPurpose = 'mastery' | 'review' | 'verify' | 'diagnostic' | 'exam';
export interface CheckSpec { purpose: CheckPurpose; skill?: SkillId; skills?: SkillId[]; misc?: string }

const shuffle = <T>(a: T[], rnd: Rng) => { const b = [...a]; for (let i = b.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/** The questions of a check, as [skill, source, candidates?] — the items are made one at a time while it runs. */
export function checkPlan(spec: CheckSpec, rnd: Rng): { skill: SkillId; source: Source; candidates?: string[] }[] {
  const has = (s: SkillId) => !!contentOf(s);
  const hasT = (s: SkillId) => !!contentOf(s)?.transfer;
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
    default: return [];
  }
}
