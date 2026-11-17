// The missions tab's two weekly cards (PRODUCT2-39), rendered: the ghost race (this week against the student's own last
// week, two calm bars, and the personal best) and the family challenge a parent sent and the child accepted. No other
// student, no countdown, no loss words, no price. Rendered to HTML on the server, as Learn.test.jsx does.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Quests from './Quests.jsx';
import { useApp } from '@/lib/store.js';
import { PRESSURE } from '@/lib/familyChallenge.js';

vi.mock('react', async (load) => {
  const react = await load();
  return { ...react, default: react, useSyncExternalStore: (sub, get, server) => react.useSyncExternalStore(sub, get, server || get) };
});

const html = () => { Object.assign(useApp.getInitialState(), useApp.getState()); return renderToStaticMarkup(<MemoryRouter initialEntries={['/quests']}><Quests /></MemoryRouter>); };
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/ /g, ' ').replace(/\s+/g, ' ');
/** One card's HTML, by its class. */
const card = (h, cls) => h.match(new RegExp(`<section class="card ${cls}[\\s\\S]*?</section>`))?.[0] || '';
const L = (n) => ({ lessons: n, xp: 10 * n });

describe('the ghost race: this week against my own last week', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T16:00:00')); // Wednesday 11.11
    useApp.getState().resetProgress();
    useApp.setState({
      profile: { role: 'student', name: 'נועה', grade: '7', know: 1 },
      days: {
        '2026-10-19': L(9), // the best week: 9 stages (week of 18.10)
        '2026-11-02': L(2), '2026-11-04': { stages: 3 }, // last week: 5 stages on 2 days
        '2026-11-08': L(1), '2026-11-10': { stages: 2 }, // this week so far: 3 stages on 2 days
      },
      family: { challenges: {}, sent: null },
    });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('two bars, last week and this week, each with its number of stages', () => {
    const c = card(html(), 'ghost-card');
    expect(c, 'the card is there').not.toBe('');
    expect(text(c)).toContain('השבוע שלי');
    const rows = [...c.matchAll(/<li class="ghost-row ([a-z-]+)"[\s\S]*?<\/li>/g)];
    expect(rows.map((r) => r[1])).toEqual(['is-last', 'is-now']);
    expect(text(rows[0][0]).trim()).toBe('השבוע שעבר: 5 שלבים');
    expect(text(rows[1][0]).trim()).toBe('השבוע: 3 שלבים');
    // the bars are drawn to one scale (the larger of the two weeks, at least 5): last week full, this week 60%
    expect(rows[0][0]).toContain('style="inline-size:100%"');
    expect(rows[1][0]).toContain('style="inline-size:60%"');
    // the bars are pictures of the numbers: a screen reader hears the words once
    expect(c).toMatch(/<span class="ghost-bar" aria-hidden="true">/);
    expect(text(c)).toContain('ימי תרגול: השבוע 2, בשבוע שעבר 2');
    expect(text(c)).toContain('השיא שלכם: 9 שלבים בשבוע');
    expect(text(c)).toContain('שלב הוא שלב לימוד, שיעור או בדיקה.');
  });

  it('a week ahead of the last one says so, and one behind says nothing about it: no countdown, no loss', () => {
    expect(text(card(html(), 'ghost-card'))).not.toContain('עברתם את השבוע שעבר');
    expect(PRESSURE.test(text(card(html(), 'ghost-card')))).toBe(false);
    useApp.setState({ days: { ...useApp.getState().days, '2026-11-11': L(3) } });
    const c = text(card(html(), 'ghost-card'));
    expect(c).toContain('השבוע: 6 שלבים');
    expect(c).toContain('עברתם את השבוע שעבר.');
    expect(PRESSURE.test(c)).toBe(false);
  });

  it('the first week: no last week, no best yet, a calm start', () => {
    useApp.setState({ days: {} });
    const c = text(card(html(), 'ghost-card'));
    expect(c).toContain('השבוע שעבר: 0 שלבים');
    expect(c).toContain('השבוע עוד לא התחיל. כל שלב קטן נספר כאן.');
    expect(c).toContain('זה השבוע הראשון. מה שתעשו השבוע יהיה השיא.');
  });

  it('no other student anywhere in the card: only "השבוע" and "השבוע שעבר", and no names', () => {
    const c = text(card(html(), 'ghost-card'));
    expect(c).not.toMatch(/תלמיד|כיתה|מקום|דירוג|ליגה/);
  });
});

describe('the family challenge, accepted on this device', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T16:00:00'));
    useApp.getState().resetProgress();
    useApp.setState({
      profile: { role: 'student', name: 'נועה', grade: '7', know: 1 },
      days: { '2026-11-08': L(1), '2026-11-10': { stages: 2 } },
      family: { challenges: { '2026-11-08': { k: 'd', n: 4, at: '2026-11-08T18:00:00.000Z' } }, sent: null },
    });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('the goal, the week\'s days so far as dots, and the words, with no price and no countdown', () => {
    const c = card(html(), 'family-card');
    expect(c, 'the card is there').not.toBe('');
    const t = text(c);
    expect(t).toContain('אתגר משפחתי');
    expect(t).toContain('4 ימי תרגול השבוע');
    expect(t).toContain('עד עכשיו: 2 מתוך 4.');
    expect(c.match(/class="fc-dot is-on"/g)).toHaveLength(2);
    expect(c.match(/class="fc-dot"/g)).toHaveLength(2);
    expect(t).not.toMatch(/₪|מנוי|מחיר/);
    expect(PRESSURE.test(t)).toBe(false);
    // the child can take it off at any time
    expect(c).toMatch(/<button type="button" class="link-btn fc-drop">להסיר את האתגר<\/button>/);
  });

  it('done: said once, warmly, with the way to tell the parents in the weekly summary', () => {
    useApp.setState({ days: { ...useApp.getState().days, '2026-11-09': L(1), '2026-11-11': L(1) } });
    const c = card(html(), 'family-card');
    expect(text(c)).toContain('עשיתם את זה! 4 מתוך 4.');
    expect(c).toMatch(/<a [^>]*href="\/report"[^>]*>לסיכום השבועי<\/a>/);
  });

  it('a challenge for next week waits for its Sunday; one from a week that ended is not shown', () => {
    useApp.setState({ family: { challenges: { '2026-11-15': { k: 's', n: 5, at: '2026-11-12T18:00:00.000Z' } }, sent: null } });
    expect(text(card(html(), 'family-card'))).toContain('האתגר מתחיל ביום ראשון, 15.11: 5 שלבים בשבוע.');
    useApp.setState({ family: { challenges: { '2026-11-01': { k: 'd', n: 3, at: '2026-11-01T18:00:00.000Z' } }, sent: null } });
    expect(card(html(), 'family-card')).toBe('');
  });
});

// The goal card says what the header's XP pill says (lib/quests.js goalProgress): 20/20 XP and reached, over the goal.
describe('the daily goal card', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-05T10:00:00'));
    useApp.getState().resetProgress();
    useApp.setState({ profile: { role: 'student', name: 'נועה', grade: '7', know: 1 }, goalXp: 20, days: { '2026-11-05': { lessons: 3, xp: 35 } }, family: { challenges: {}, sent: null } });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('over the goal: reached, 20/20 XP, the bar full', () => {
    const c = card(html(), 'goal-card');
    expect(text(c)).toContain('היעד היומי הושג');
    expect(text(c)).toContain('20/20 XP');
    expect(c).toContain('aria-valuenow="20"');
    expect(c).toContain('width:100%');
  });
});
