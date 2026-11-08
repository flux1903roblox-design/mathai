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
import { makeItem } from '@/content/index.js';

export type Source = 'gen' | 'diag' | 'transfer' | 'probe';

export function modelItem(c: StairContent, model: DiagModel<any>, p: any, source: Source) {
  return {
    key: `${c.skill}:${source}:${JSON.stringify(p)}`,
    text: model.text(p), display: model.display?.(p), fig: model.fig?.(p), form: 'num' as const, unit: model.unit,
    answer: model.answer(p), hint: model.hint(p), solution: model.solution(p),
    diag: (u: number) => { const d = diagnose(model, p, u); return d.kind === 'misconception' ? d.candidates[0].id : null; },
    diagnosis: (u: number) => diagnose(model, p, u),
    could: couldShow(model, p),
    topic: c.topic, level: c.level, levelTitle: c.title, source,
  };
}

/** One question of a skill from a source; falls back to the stair's exercise generator. */
export function itemFor(skill: SkillId, source: Source, rnd: Rng, avoidKey?: string, candidates?: string[]) {
  const { topic, level } = parseSkill(skill);
  const c = contentOf(skill);
  if (c && source !== 'gen') {
    const model = source === 'transfer' && c.transfer ? c.transfer : c.diag;
    if (source === 'probe' && candidates?.length) {
      const m = [c.diag, c.transfer].find((x) => x && candidates.every((id) => id in x.bugs)) || c.diag;
      const p = discriminating(m!, candidates.filter((id) => id in m!.bugs), rnd);
      if (p) return { ...modelItem(c, m!, p, 'probe'), probe: candidates };
    } else {
      for (let i = 0; i < 20; i += 1) { const p = model.params(rnd); const it = modelItem(c, model, p, source); if (it.key !== avoidKey) return it; }
    }
  }
  return makeItem(topic, level, avoidKey);
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
      // questions where the repaired misconception would show again
      return Array.from({ length: VERIFY_N }, () => (has(s) ? { skill: s, source: 'probe' as const, candidates: [spec.misc!] } : { skill: s, source: 'gen' as const }));
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
