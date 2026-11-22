// The functions unit's words (council round 3, math): two maths runs side by side read as one ("…עד $x = 60$ $y$ קטן…",
// a number and a letter with nothing between them). Every exercise of every func stair, from its generator and its
// models, keeps a Hebrew word between two maths runs.
import { describe, it, expect } from 'vitest';
import { itemFor } from '@/learn/items.ts';
import { ALL_SKILLS, parseSkill } from '@/learn/skills.ts';
import { loadAllContent, contentOf } from '@/learn/content/index.ts';
import { seeded } from '@/learn/expr.ts';
import { func3Solution } from './func.js';

await loadAllContent();

/** Two maths runs with only spaces between them: "$x = 60$ $y$". */
const SIDE_BY_SIDE = /\$[^$]+\$[  ]+\$[^$]+\$/;

describe('func: no two maths runs side by side', () => {
  it('func:3\'s worked solution says "ה־$y$" after the range', () => {
    const p = { s: 1, x0: 0, x1: 20, x2: 60, x3: 80, y0: 2, y1: 9, y2: 4, q: 1 };
    const [first] = func3Solution(p);
    expect(first).not.toMatch(SIDE_BY_SIDE);
    expect(first).toContain('ה־$y$ קטן');
    expect(func3Solution({ ...p, q: 0 })[0]).toContain('ה־$y$ גדל');
    expect(func3Solution({ ...p, q: 2 })[0]).toContain('ה־$y$ נשאר');
  });

  it('every func exercise, from every source a lesson or a check draws', () => {
    const rnd = seeded(626);
    const bad = {};
    for (const skill of ALL_SKILLS.filter((s) => parseSkill(s).topic === 'func')) {
      const c = contentOf(skill);
      for (const source of ['gen', 'diag', 'transfer']) {
        if (source !== 'gen' && !c?.[source]) continue;
        for (let i = 0; i < 400; i += 1) {
          const it = itemFor(skill, source, rnd);
          const words = [it.text, it.hint, ...(it.solution || []), ...(it.choices || []).map((ch) => ch.text ?? '')].map((w) => String(w ?? ''));
          for (const w of words) if (SIDE_BY_SIDE.test(w)) bad[`${skill} ${source}`] ||= `${it.key}: ${w}`;
        }
      }
    }
    expect(bad).toEqual({});
  });
});
