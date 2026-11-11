// The challenge medals (CURRICULUM-6.3): none before the student meets the track, then "פתרתם 10 אתגרים", and for each
// topic with a solved task "אתגרי {topic}", earned when all its tasks are solved. The words address no one by gender.
import { describe, it, expect } from 'vitest';
import { challengeMedals, CHALLENGES_MEDAL } from './Achievements.jsx';
import { CHALLENGES, challengesOf } from '@/learn/challenges/index.ts';

const at = '2026-11-04T10:00:00.000Z';
const mastered = { attempts: [], mastered: { at, box: 0, due: '2026-11-20T10:00:00.000Z' } };
const solved = (ids) => Object.fromEntries(ids.map((id) => [id, { startedAt: at, doneAt: at, firstTry: 1, parts: 2 }]));

describe('the challenge medals', () => {
  it('none while no task is open', () => {
    expect(challengeMedals({}, {})).toEqual([]);
    expect(challengeMedals({ 'pct:1': mastered }, {})).toEqual([]); // pct:1 opens no task
  });
  it('a task open: "פתרתם 10 אתגרים", not earned yet, and no topic medal before a task of it is solved', () => {
    const m = challengeMedals({ 'pct:2': mastered }, {});
    expect(m.map((x) => [x.label, x.have, x.need])).toEqual([[`פתרתם ${CHALLENGES_MEDAL} אתגרים`, 0, 10]]);
  });
  it('a topic\'s medal counts its solved tasks, and is earned when all are solved', () => {
    const pct = challengesOf('pct').map((t) => t.id);
    const one = challengeMedals({ 'pct:2': mastered }, solved(pct.slice(0, 1)));
    expect(one.find((x) => x.id === 'ch-pct')).toMatchObject({ label: 'אתגרי אחוזים', have: 1, need: pct.length });
    const all = challengeMedals({ 'pct:2': mastered }, solved(pct));
    const medal = all.find((x) => x.id === 'ch-pct');
    expect(medal.have).toBe(medal.need);
    // ten solved anywhere earn the ten
    const ten = challengeMedals({}, solved(CHALLENGES.slice(0, Math.min(10, CHALLENGES.length)).map((t) => t.id)));
    expect(ten[0].have).toBe(Math.min(10, CHALLENGES.length));
  });
});
