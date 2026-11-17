// The home path as a journey (PRODUCT2-35/37), rendered: the unit the student is on shows its stops, the next one its
// banner and first stop, and every other unit is a folded row that names it and opens it with one tap.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Learn from './Learn.jsx';
import { useApp } from '@/lib/store.js';
import { topicsFor } from '@/content/index.js';
import { homeCard, HOME_CARDS } from '@/lib/homeCards.js';

// the screen's small stores (the class goal) read the device's state with no server snapshot: on the server they read it
// the same way, as the phone would
vi.mock('react', async (load) => {
  const react = await load();
  return { ...react, default: react, useSyncExternalStore: (sub, get, server) => react.useSyncExternalStore(sub, get, server || get) };
});

const done = (levels) => ({ parts: {}, reviews: 0, jumped: 0, done: Object.fromEntries(levels.map((l) => [l, 'mastered'])) });
// rendered on the server, a zustand store is read through its first state (getInitialState): the state the test set is
// copied into it before each render, so the screen draws that student
const html = (entry) => { Object.assign(useApp.getInitialState(), useApp.getState()); return renderToStaticMarkup(<MemoryRouter initialEntries={[entry]}><Learn /></MemoryRouter>); };
const render = (entry = '/') => html(entry);
// the page's words, without its tags (the no-break space that keeps "יחידה 1 ·" together read as a space)
const text = (html) => html.replace(/<[^>]+>/g, '').replace(/\u00a0/g, ' ');
const sections = (html, cls) => [...html.matchAll(new RegExp(`<section class="${cls}[ "][^>]*>`, 'g'))];
const titles = (html, cls) => [...html.matchAll(new RegExp(`<section class="${cls}[ "][\\s\\S]*?class="unit-title"[^>]*>([^<]+)<`, 'g'))].map((m) => m[1]);

describe('the home path: one unit open, the next previewed, the others folded', () => {
  const grade7 = topicsFor('7');
  beforeEach(() => {
    useApp.getState().resetProgress();
    useApp.setState({ profile: { role: 'student', name: 'נועה', grade: '7', know: 1 } });
  });

  it('a fresh student: the first unit with its stops, the second with one, the rest as rows that open it', () => {
    const out = render();
    expect(titles(out, 'unit')).toEqual([grade7[0].title, grade7[1].title]);
    expect(out).toContain('class="unit ch-');
    expect(sections(out, 'unit').length).toBe(2);
    // one stop to go on from, and one 'התחלה': not one per unit
    expect(out.match(/class="node-start"/g)).toHaveLength(1);
    expect(out.match(/node node-preview/g)).toHaveLength(1);
    expect(out).toContain('כל המדרגות של ' + grade7[1].title);
    // the folded units: a heading each with a button that names the unit, its number and its size
    const rows = titles(out, 'unit-row');
    expect(rows).toEqual(grade7.slice(2).map((t) => t.title));
    expect(out.match(/<h2 class="unit-row-h"><button type="button" class="unit-row-btn" aria-expanded="false">/g)).toHaveLength(grade7.length - 2);
    expect(text(out)).toContain(`יחידה 3 · ${grade7[2].levels.length} מדרגות`);
  });

  it('a link to a unit (the wardrobe\'s "ליחידת …", a teacher\'s) opens that unit, wherever it is on the path', () => {
    const last = grade7[grade7.length - 1];
    const out = render({ pathname: '/', state: { from: last.id } });
    expect(titles(out, 'unit')).toEqual([last.title]);
    expect(titles(out, 'unit-row')).toEqual(grade7.slice(0, -1).map((t) => t.title));
  });

  it('a student further on: the unit before folds and shows its count; the next is previewed', () => {
    useApp.setState({ path: { [grade7[0].id]: done(grade7[0].levels.map((_, i) => i + 1)), [grade7[1].id]: done([1]) }, lastTopic: grade7[1].id });
    const out = render();
    expect(titles(out, 'unit')).toEqual([grade7[1].title, grade7[2].title]);
    expect(titles(out, 'unit-row')[0]).toBe(grade7[0].title);
    expect(text(out)).toContain(`יחידה 1 · ${grade7[0].levels.length} מתוך ${grade7[0].levels.length} מדרגות`);
  });
});

// A returning student's home (PRODUCT2-40, the council's painful moment #2): at most one card above the path, the most
// important one; the header's flame says what the repair card says; the path ends without the Ministry's programme.
describe('the returning home screen: one card above the path, and a flame that agrees with it', () => {
  it('the card above the path is the most important one: repair, then class work, then the next step, then install', () => {
    expect(HOME_CARDS).toEqual(['repair', 'work', 'next', 'install']);
    expect(homeCard({ repair: true, work: true, next: true, install: true })).toBe('repair');
    expect(homeCard({ work: true, next: true, install: true })).toBe('work');
    expect(homeCard({ next: true, install: true })).toBe('next');
    expect(homeCard({ install: true })).toBe('install');
    expect(homeCard({})).toBeNull();
  });

  describe('learned Thu 5, Fri 6, Sun 8 and Mon 9, nothing on Tue 10, today Wed 11', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-11T16:00:00'));
      useApp.getState().resetProgress();
      const d = { lessons: 1, xp: 20, q: 8, ok: 7 };
      useApp.setState({
        profile: { role: 'student', name: 'נועה', grade: '7', know: 1 }, xp: 80,
        days: { '2026-11-05': d, '2026-11-06': d, '2026-11-08': d, '2026-11-09': d },
      });
    });
    afterEach(() => { vi.useRealTimers(); });

    it('the header shows the kept 4 days, at risk, as the repair card says; not 0', () => {
      const out = render();
      expect(text(out)).toContain('אתמול לא יצא ללמוד. עוד שני שיעורים היום, והרצף של 4 ימים נשמר.');
      const flame = out.match(/<a[^>]*class="top-stat streak[^"]*"[^>]*>[\s\S]*?<\/a>/)[0];
      expect(flame).toContain('at-risk');
      expect(flame).toMatch(/aria-label="רצף של 4 ימים, מחכה לשיעור היום[^"]*"/);
      expect(text(flame)).toContain('4');
      expect(text(flame)).not.toMatch(/(^|[^0-9])0([^0-9]|$)/);
    });

    it('one card above the path (the repair card), and no Ministry programme link at the end of the path', () => {
      // an exam soon makes the next step a banner too: the repair card wins, and its button goes to that same step
      useApp.setState((st) => ({ learn: { ...st.learn, exam: { grade: '7', date: '2026-11-14', skills: ['signed:1', 'signed:2'], confidence: 2, minutes: 15, createdAt: '2026-11-04T10:00:00.000Z' } } }));
      const out = render();
      const firstUnit = out.indexOf('<section class="unit ');
      const above = out.slice(0, firstUnit);
      expect(above.match(/class="(repair-card|next-banner|install-card|learn-work-chip)"/g)).toEqual(['class="repair-card"']);
      expect(out).not.toContain('class="next-banner"');
      expect(out).not.toContain('/programme');
      expect(text(out)).not.toContain('תוכנית משרד החינוך');
      expect(text(out)).toContain('כל הנושאים והמצב בכל אחד');
    });
  });
});

// The header's XP pill and the quests tab's goal card agree (lib/quests.js goalProgress): over the goal the pill stops at
// it ("20/20", never "35/20") and wears a check; its screen-reader name says the goal is reached and keeps the total.
describe('the header XP pill: the daily goal, by the quests tab\'s rule', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-05T10:00:00'));
    useApp.getState().resetProgress();
    useApp.setState({ profile: { role: 'student', name: 'נועה', grade: '7', know: 1 }, goalXp: 20, xp: 35 });
  });
  afterEach(() => { vi.useRealTimers(); });
  const pill = (out) => out.match(/<a[^>]*class="top-stat xp[^"]*"[^>]*>[\s\S]*?<\/a>/)[0];

  it('under the goal: today\'s XP of the goal, no check', () => {
    useApp.setState({ days: { '2026-11-05': { lessons: 1, xp: 12 } } });
    const p = pill(render());
    expect(text(p)).toBe('12/20');
    expect(p).not.toContain('top-stat-check');
    expect(p).toContain('aria-label="היום 12 מתוך 20 XP, סך הכול 35"');
  });

  it('over the goal: 20/20 with a check, as the goal card says, never 35/20', () => {
    useApp.setState({ days: { '2026-11-05': { lessons: 3, xp: 35 } } });
    const p = pill(render());
    expect(text(p)).toBe('20/20');
    expect(p).toContain('class="top-stat xp is-done"');
    expect(p).toContain('top-stat-check');
    expect(p).toContain('aria-label="היעד היומי הושג: 20 מתוך 20 XP, סך הכול 35"');
  });
});
