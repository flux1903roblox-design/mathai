// A picture or an object on every teaching step (STUDENT-8). The council found the teaching screens "mostly text with no
// pictures"; every discover step of every topic now shows a drawing (fig) or an object to move (manip). A handful of
// steps may be exempt, each with a reason (learn/visualPlan.ts VISUAL_EXEMPT, at most 5% of a topic). A topic added
// later is held to the same rule from its first commit. The table of every topic is printed on each run.
import { describe, it, expect } from 'vitest';
import { loadAllContent } from './content/index';
import { VISUAL_EXEMPT } from './visualPlan';
import { STAIRS } from './skills';
import type { DiscoverStep } from './types';

// the teaching content loads one topic at a time (DURABLE-11): every topic, loaded
const CONTENT = await loadAllContent();

const hasVisual = (st: DiscoverStep) => !!((st as { fig?: unknown }).fig || (st as { manip?: unknown }).manip);

/** Every discover step by topic: its id (`signed:1#0`) and whether it shows something. */
function byTopic() {
  const out: Record<string, { id: string; shown: boolean }[]> = {};
  for (const [skill, c] of Object.entries(CONTENT)) {
    const topic = skill.split(':')[0];
    c.discover.forEach((st, i) => (out[topic] ||= []).push({ id: `${skill}#${i}`, shown: hasVisual(st) }));
  }
  return out;
}

const pct = (a: number, b: number) => `${Math.round((100 * a) / Math.max(1, b))}%`;

describe('a picture or an object on every teaching step (STUDENT-8)', () => {
  const topics = byTopic();

  it('prints the table of every topic', () => {
    const rows = Object.entries(topics).map(([t, steps]) => {
      const shown = steps.filter((s) => s.shown).length;
      const exempt = steps.filter((s) => !s.shown && VISUAL_EXEMPT[s.id]).length;
      const bare = steps.length - shown - exempt;
      return `${t.padEnd(8)} ${String(steps.length).padStart(5)} ${String(shown).padStart(7)} ${String(exempt).padStart(7)} ${String(bare).padStart(5)} ${pct(shown + exempt, steps.length).padStart(5)}`;
    });
    // eslint-disable-next-line no-console
    console.info(['topic    steps  visual  exempt  bare  done', ...rows].join('\n'));
    expect(rows.length).toBe(Object.keys(topics).length);
  });

  it('every discover step of every topic has a drawing or an object to move', () => {
    const bare = Object.values(topics).flatMap((steps) => steps.filter((s) => !s.shown && !VISUAL_EXEMPT[s.id]).map((s) => s.id));
    expect(bare).toEqual([]);
  });

  it('an exemption names a real step with nothing to see, says why, and stays within 5% of its topic', () => {
    for (const [id, why] of Object.entries(VISUAL_EXEMPT)) {
      const topic = id.split(':')[0];
      const step = (topics[topic] || []).find((s) => s.id === id);
      expect(step, `${id}: no such step`).toBeTruthy();
      expect(step!.shown, `${id} has a visual: take it off the list`).toBe(false);
      expect(why.trim().length, `${id}: the reason`).toBeGreaterThan(10);
    }
    for (const [t, steps] of Object.entries(topics)) {
      const n = steps.filter((s) => VISUAL_EXEMPT[s.id]).length;
      expect(n, `${t}: ${n} of ${steps.length} steps exempt`).toBeLessThanOrEqual(Math.floor(steps.length * 0.05));
    }
  });

  it('the rule covers every topic of the catalogue, every stair of it', () => {
    // a topic or a stair added to the catalogue (learn/skills.ts) is in CONTENT, so the rule above holds it from its
    // first commit: there is no list of topics still being drawn
    expect(Object.keys(topics).sort()).toEqual(Object.keys(STAIRS).sort());
    for (const [t, n] of Object.entries(STAIRS)) {
      const stairs = new Set(topics[t].map((s) => s.id.split('#')[0]));
      expect(stairs.size, `${t}: stairs with teaching steps`).toBe(n);
    }
  });
});

// ---------------------------------------------------------------- SK-STUDENT-1: worked examples and solving together
// Stages B (a worked example) and C (solving together) are 7 of every 12 teaching minutes (recommend.ts). The council
// found a drawing on 4 of their 263 problems, and none in geometry, where the maths is the picture: the triangle's angle
// sum and Pythagoras were taught as text cards. Every angles and Pythagoras problem now has its drawing, made from the
// problem's own numbers (learn/figures.test.ts checks them against the text); in the other topics where a number line,
// a plane, a chart or a bar carries the idea, at least the share below has one. The table prints on each run.
// counted with the council's own counter (student-verify/count-figs.ts): a problem counts when it has a figure
const ALL_B_C: Record<string, number> = { angles: 1, pyth: 1 };
const SOME_B_C: Record<string, number> = { coord: 0.6, line: 0.5, stats: 0.5, frac: 0.4 };

function problemsByTopic() {
  const out: Record<string, { B: { id: string; fig: boolean }[]; C: { id: string; fig: boolean }[] }> = {};
  for (const [skill, c] of Object.entries(CONTENT)) {
    const t = (out[skill.split(':')[0]] ||= { B: [], C: [] });
    c.examples.forEach((e, i) => t.B.push({ id: `${skill} B${i + 1}`, fig: !!e.fig }));
    c.together.forEach((g, i) => t.C.push({ id: `${skill} C${i + 1}`, fig: !!g.fig }));
  }
  return out;
}

describe('a drawing where the maths is a picture: worked examples and solving together (SK-STUDENT-1)', () => {
  const topics = problemsByTopic();

  it('prints the table of every topic', () => {
    let tb = 0; let tbf = 0; let tc = 0; let tcf = 0;
    const rows = Object.entries(topics).map(([t, { B, C }]) => {
      const bf = B.filter((x) => x.fig).length; const cf = C.filter((x) => x.fig).length;
      tb += B.length; tbf += bf; tc += C.length; tcf += cf;
      return `${t.padEnd(8)} ${`${bf}/${B.length}`.padStart(7)} ${`${cf}/${C.length}`.padStart(7)} ${pct(bf + cf, B.length + C.length).padStart(5)}`;
    });
    // eslint-disable-next-line no-console
    console.info(['topic    B drawn C drawn  share', ...rows, `${'all'.padEnd(8)} ${`${tbf}/${tb}`.padStart(7)} ${`${tcf}/${tc}`.padStart(7)} ${pct(tbf + tcf, tb + tc).padStart(5)}`].join('\n'));
    expect(rows.length).toBe(Object.keys(topics).length);
  });

  it('every worked example and every problem solved together in angles and Pythagoras has its drawing', () => {
    const bare = Object.keys(ALL_B_C).flatMap((t) => [...topics[t].B, ...topics[t].C].filter((x) => !x.fig).map((x) => x.id));
    expect(bare).toEqual([]);
  });

  it('in the plane, lines, statistics and fractions, at least a set share of them has one', () => {
    for (const [t, share] of Object.entries(SOME_B_C)) {
      const all = [...topics[t].B, ...topics[t].C];
      const drawn = all.filter((x) => x.fig).length;
      expect(drawn / all.length, `${t}: ${drawn} of ${all.length} drawn`).toBeGreaterThanOrEqual(share);
    }
  });
});
