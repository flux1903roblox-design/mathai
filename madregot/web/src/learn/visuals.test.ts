// A picture or an object on every teaching step (STUDENT-8). The council found the teaching screens "mostly text with no
// pictures"; every discover step of a finished topic now shows a drawing (fig) or an object to move (manip). Topics still
// being drawn are listed in learn/visualPlan.ts (PENDING_VISUALS), and a handful of steps may be exempt, each with a
// reason (VISUAL_EXEMPT, at most 5% of a topic). The table of every topic is printed on each run.
import { describe, it, expect } from 'vitest';
import { CONTENT } from './content/index';
import { PENDING_VISUALS, VISUAL_EXEMPT } from './visualPlan';
import type { DiscoverStep } from './types';

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
      return `${t.padEnd(8)} ${String(steps.length).padStart(5)} ${String(shown).padStart(7)} ${String(exempt).padStart(7)} ${String(bare).padStart(5)} ${pct(shown + exempt, steps.length).padStart(5)}  ${PENDING_VISUALS.has(t) ? 'still being drawn' : 'done'}`;
    });
    // eslint-disable-next-line no-console
    console.info(['topic    steps  visual  exempt  bare  done', ...rows].join('\n'));
    expect(rows.length).toBe(Object.keys(topics).length);
  });

  it('every discover step of a finished topic has a drawing or an object to move', () => {
    const bare = Object.entries(topics).filter(([t]) => !PENDING_VISUALS.has(t))
      .flatMap(([, steps]) => steps.filter((s) => !s.shown && !VISUAL_EXEMPT[s.id]).map((s) => s.id));
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

  it('the pending list names real topics that still have steps to draw', () => {
    for (const t of PENDING_VISUALS) {
      expect(topics[t], `${t} is not a topic`).toBeTruthy();
      const left = topics[t].filter((s) => !s.shown && !VISUAL_EXEMPT[s.id]).length;
      expect(left, `${t} is fully drawn: take it out of PENDING_VISUALS`).toBeGreaterThan(0);
    }
  });

  it('the finished topics today: angles is drawn in full', () => {
    // integrity drew every angles step; the content stages add the others one by one
    expect(PENDING_VISUALS.has('angles')).toBe(false);
    expect(topics.angles.every((s) => s.shown)).toBe(true);
  });
});
