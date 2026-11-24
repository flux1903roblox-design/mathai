// The topics screen's challenge line (CURRICULUM-6.3), rendered as the screen renders it: nothing while no task is open
// (no row of zeros), "אתגרים: {done} מתוך {open}" once a stair with a task is mastered, a link to the next task while
// one is left, and plain text when all the open ones are solved.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Topics from '@/screens/Topics.jsx';
import ChallengeLine from './ChallengeLine.jsx';

// rendering to a string reads a store's initial state, so the screen reads this test's state through a plain stand-in
const state = vi.hoisted(() => ({ current: {} }));
vi.mock('@/lib/store.js', async (orig) => {
  const real = await orig();
  const useApp = Object.assign((sel = (s) => s) => sel(state.current), { getState: () => state.current, setState: (p) => { state.current = { ...state.current, ...p }; }, subscribe: () => () => {} });
  return { ...real, useApp };
});

const at = '2026-11-04T10:00:00.000Z';
const mastered = { attempts: [], mastered: { at, box: 0, due: '2026-11-20T10:00:00.000Z' } };
const learnWith = (skills, challenges = {}) => ({ skills, miscon: {}, exam: null, missions: {}, events: [], floor: null, challenges });
const render = (el) => renderToStaticMarkup(<MemoryRouter>{el}</MemoryRouter>);
const as = (learn) => { state.current = { profile: { role: 'student', name: 'נועה', grade: '8' }, path: {}, progress: {}, gaps: {}, placement: null, learn }; };

describe('the challenges line on the topics screen', () => {
  beforeEach(() => as(learnWith({})));

  it('a learner with nothing mastered sees no אתגרים line, on the whole screen', () => {
    const html = render(<Topics />);
    expect(html).toContain('יחס וקנה מידה'); // the screen itself rendered, with the grade's units
    expect(html).not.toContain('אתגרים');
    expect(render(<ChallengeLine topic="pct" />)).toBe('');
  });

  it('a mastered stair that opens a task: the count, and a link to that task', () => {
    as(learnWith({ 'pct:2': mastered }));
    const line = render(<ChallengeLine topic="pct" />);
    expect(line).toContain('אתגרים: 0 מתוך 1');
    expect(line).toContain('href="/challenge/pct:c1"');
    expect(line).toContain('aria-label="אתגרים: 0 מתוך 1. לאתגר הבא"');
    expect(render(<Topics />)).toContain('אתגרים: 0 מתוך 1');
    // a unit with nothing open still shows nothing
    expect(render(<ChallengeLine topic="ratio" />)).toBe('');
  });

  it('all the open tasks solved: the count as plain text, no link', () => {
    as(learnWith({ 'pct:2': mastered }, { 'pct:c1': { startedAt: at, doneAt: at, firstTry: 2, parts: 3 } }));
    const line = render(<ChallengeLine topic="pct" />);
    expect(line).toContain('אתגרים: 1 מתוך 1');
    expect(line).not.toContain('href=');
  });
});
