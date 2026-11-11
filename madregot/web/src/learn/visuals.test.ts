// A picture or an object on every teaching step (STUDENT-8). The council found the teaching screens "mostly text with no
// pictures"; every discover step of every topic now shows a drawing (fig) or an object to move (manip). A handful of
// steps may be exempt, each with a reason (learn/visualPlan.ts VISUAL_EXEMPT, at most 5% of a topic). A topic added
// later is held to the same rule from its first commit. The table of every topic is printed on each run.
import { describe, it, expect } from 'vitest';
import { loadAllContent } from './content/index';
import { VISUAL_EXEMPT } from './visualPlan';
import { STAIRS } from './skills';
import type { DiscoverStep } from './types';
// @ts-ignore: plain JS
import { FIG_TYPES } from '@/components/Figure.jsx';

// the teaching content loads one topic at a time (DURABLE-11): every topic, loaded
const CONTENT = await loadAllContent();

/**
 * A step shows something when it has an object to move, or a drawing of a type components/Figure.jsx draws (a figure of
 * another type would draw nothing): the data figures of curriculum stage 3, chart, outcomes and pair, count as any other.
 */
const hasVisual = (st: DiscoverStep) => {
  const fig = (st as { fig?: { type?: string } }).fig;
  return !!((fig && FIG_TYPES.includes(fig.type)) || (st as { manip?: unknown }).manip);
};

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

  it('counts a drawing only of a type Figure draws, the data figures among them', () => {
    expect(FIG_TYPES).toEqual(expect.arrayContaining(['chart', 'outcomes', 'pair', 'table', 'numline', 'dots', 'fbar']));
    const step = (fig: unknown): DiscoverStep => ({ kind: 'say', text: '', fig } as DiscoverStep);
    expect(hasVisual(step({ type: 'chart', mode: 'pie', cats: ['א', 'ב'], values: [1, 1] }))).toBe(true);
    expect(hasVisual(step({ type: 'outcomes', cols: ['1', '2'] }))).toBe(true);
    expect(hasVisual(step({ type: 'pair', items: [{ type: 'table', head: ['א'], rows: [[1]] }, { type: 'chart', mode: 'bar', cats: ['א'], values: [1] }] }))).toBe(true);
    expect(hasVisual(step({ type: 'histogram' }))).toBe(false);
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
