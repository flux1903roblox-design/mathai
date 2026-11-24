// The path as a journey (PRODUCT2-35/37): the map opens only the unit the student is on, previews the next one (its
// banner and first stop), and folds every other unit into a row one tap away; a unit the student (or a link) opens
// shows whole too.
import { describe, it, expect } from 'vitest';
import { journey } from './path.js';
import { topicsFor, TOPIC } from '@/content/index.js';

const grade7 = topicsFor('7').map((t) => t.id);
const done = (levels) => ({ parts: {}, reviews: 0, jumped: 0, done: Object.fromEntries(levels.map((l) => [l, 'mastered'])) });
const currentStops = (units) => units.flatMap((u) => u.nodes).filter((n) => n.state === 'current' && !n.preview);

describe('the map as a journey', () => {
  it('a fresh student: the first unit open, the second previewed by its first stop, every other unit folded', () => {
    const units = journey(grade7, {}, grade7[0]);
    expect(units.map((u) => u.mode)).toEqual(['open', 'preview', ...grade7.slice(2).map(() => 'folded')]);
    expect(units[0].nodes).toHaveLength(TOPIC[grade7[0]].levels.length + 1); // every stair and the review
    expect(units[1].nodes).toHaveLength(1);
    expect(units[1].nodes[0]).toMatchObject({ kind: 'node', level: 1, preview: true });
    for (const u of units.slice(2)) expect(u.nodes).toEqual([]);
  });

  it('only the current unit has a stop to go on from: five units no longer each say "התחלה"', () => {
    const units = journey(grade7, {}, grade7[0]);
    expect(currentStops(units)).toHaveLength(1);
    expect(currentStops(units)[0]).toMatchObject({ topic: grade7[0], level: 1 });
  });

  it('the unit the student is on opens, wherever it is: the one before it folds, the one after is previewed', () => {
    const path = { [grade7[0]]: done([1, 2]), [grade7[1]]: done([1]) };
    const units = journey(grade7, path, grade7[1]);
    expect(units.map((u) => u.mode)).toEqual(['folded', 'open', 'preview', ...grade7.slice(3).map(() => 'folded')]);
    expect(currentStops(units)).toEqual([expect.objectContaining({ topic: grade7[1], level: 2 })]);
  });

  it('a unit the student unfolded, or a link asked for, shows whole too; the last unit has nothing to preview', () => {
    const last = grade7[grade7.length - 1];
    const units = journey(grade7, {}, last, [grade7[0]]);
    expect(units[0].mode).toBe('open');
    expect(units.at(-1).mode).toBe('open');
    expect(units.filter((u) => u.mode === 'preview')).toEqual([]);
  });

  it('a previewed unit the student already worked in shows its first stop as it is', () => {
    const path = { [grade7[1]]: done([1]) };
    const units = journey(grade7, path, grade7[0]);
    expect(units[1].nodes[0]).toMatchObject({ state: 'done', preview: true });
  });
});
