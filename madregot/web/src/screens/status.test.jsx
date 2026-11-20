// What the screens say about a stair, rendered (external review, findings 2 and 3, synthetic students only):
//  - a lesson left at step 4 of 13 goes on from step 4, and the stair page, the map's stop and the board's tile say it
//    is started, never "עוד לא התחלנו";
//  - the profile counts a stair that passed its mastery check and is now due for a memory check as learned ("שולטים
//    לבד"), and says apart how many wait for a memory check and how many are worth strengthening.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Journey from './Journey.jsx';
import Learn from './Learn.jsx';
import Me from './Me.jsx';
import { useApp } from '@/lib/store.js';
import { ensureTopics, contentOf } from '@/learn/content/index.ts';
import MasteryMap, { gradeTiles, tilesSummary } from '@/components/learn/MasteryMap.jsx';
import { previewOf } from '@/components/durable/RestorePreview.jsx';
import { shownKind, KIND_LABEL } from '@/components/learn/TodayCard.jsx';
import { learnerSummary } from '@/lib/tutorContext.js';

// the screens' small stores read the device's state with no server snapshot: on the server they read it the same way
vi.mock('react', async (load) => {
  const react = await load();
  return { ...react, default: react, useSyncExternalStore: (sub, get, server) => react.useSyncExternalStore(sub, get, server || get) };
});

// rendered on the server, a zustand store is read through its first state: the test's state is copied into it first
const html = (el, entry) => { Object.assign(useApp.getInitialState(), useApp.getState()); return renderToStaticMarkup(<MemoryRouter initialEntries={[entry]}>{el}</MemoryRouter>); };
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/ /g, ' ').replace(/\s+/g, ' ');
const stairPage = (topic, level) => html(<Routes><Route path="/learn/:topic/:level" element={<Journey />} /></Routes>, `/learn/${topic}/${level}`);
const chip = (h) => (h.match(/class="mastery-chip[^"]*">([^<]*)</) || [])[1];

const DAY = 86_400_000;
const NOW = Date.now();
const at = (days) => new Date(NOW + days * DAY).toISOString();
// synthetic stair records, one per state the labels must tell apart
const REC = {
  fresh: undefined,
  partial: { attempts: [], pos: { A: 3 } }, // left the first stage at step 4 (of 13 on signed:1)
  mastered: { attempts: [], mastered: { at: at(-10), box: 1, due: at(5) } },
  due: { attempts: [], mastered: { at: at(-10), box: 0, due: at(-1) } },
  missed: { attempts: [], mastered: { at: at(-10), box: 0, due: at(1), lastReview: { at: at(-1), ok: false } } },
};

beforeAll(async () => { await ensureTopics(['signed:1', 'signed:2', 'signed:3', 'signed:4']); });
beforeEach(() => {
  useApp.getState().resetProgress();
  useApp.setState({ profile: { role: 'student', name: 'נועה', grade: '7', know: 1 } });
});
const withSkills = (skills) => useApp.setState({ learn: { ...useApp.getState().learn, skills } });

describe('finding 2: a lesson left in the middle is a started stair', () => {
  it('the place is kept where the lesson goes on from (step 4 of 13)', () => {
    expect(contentOf('signed:1').discover).toHaveLength(13);
    useApp.getState().setStagePos('signed:1', 'A', 3);
    expect(useApp.getState().learn.skills['signed:1'].pos.A).toBe(3);
  });

  it('the stair page says "באמצע שיעור", marks the first stage as going, and goes on rather than starts', () => {
    useApp.getState().setStagePos('signed:1', 'A', 3);
    const out = stairPage('signed', 1);
    expect(chip(out)).toBe('באמצע שיעור');
    expect(text(out)).not.toContain('עוד לא התחלנו');
    expect(out).toMatch(/class="jstage going current"/);
    expect(text(out)).toContain('ממשיכים מצעד 4 מתוך 13');
    expect(text(out)).toContain('ממשיכים ללמוד');
  });

  it('a stair never opened still says "עוד לא התחלנו", and its button starts', () => {
    const out = stairPage('signed', 1);
    expect(chip(out)).toBe('עוד לא התחלנו');
    expect(text(out)).toContain('מתחילים ללמוד');
  });

  it('a stair that passed its check and is due for a memory check says so on its page', () => {
    withSkills({ 'signed:2': REC.due, 'signed:3': REC.missed, 'signed:4': REC.mastered });
    expect(chip(stairPage('signed', 2))).toBe('זמן לבדיקת זיכרון');
    expect(chip(stairPage('signed', 3))).toBe('כדאי לחזק');
    expect(chip(stairPage('signed', 4))).toMatch(/^שולטים לבד · בדיקה חוזרת/);
  });

  it("the map's stop goes on (המשך) rather than starts (התחלה)", () => {
    useApp.getState().setStagePos('signed:1', 'A', 3);
    const out = html(<Learn />, '/');
    expect(out.match(/<span class="node-start" aria-hidden="true">([^<]*)</)?.[1]).toBe('המשך');
  });

  it("the day's mission and the banner show a new stair left in the middle as going on, not as new", () => {
    expect(shownKind({ kind: 'new' }, REC.partial)).toBe('continue');
    expect(KIND_LABEL[shownKind({ kind: 'new' }, REC.partial)]).toBe('ממשיכים');
    expect(shownKind({ kind: 'new' }, REC.fresh)).toBe('new');
    expect(shownKind({ kind: 'review' }, REC.partial)).toBe('review');
  });

  it('the tutor is told the stair is started, in the same words', () => {
    useApp.getState().setStagePos('signed:1', 'A', 3);
    expect(learnerSummary(useApp.getState().learn, 'signed:1').stairState).toBe('באמצע שיעור');
    withSkills({ 'signed:2': REC.due });
    expect(learnerSummary(useApp.getState().learn, 'signed:2').stairState).toBe('זמן לבדיקת זיכרון');
  });

  it("the board's tile names the stair as started, and the board counts it on the way", () => {
    withSkills({ 'signed:1': REC.partial });
    const rows = gradeTiles('7', useApp.getState().learn.skills, {}, at(0));
    const tile = rows.flatMap((r) => r.tiles).find((x) => x.id === 'signed:1');
    expect(tile.st).toBe('learning'); // drawn as a started stair
    const out = renderToStaticMarkup(<MemoryRouter><MasteryMap rows={rows} /></MemoryRouter>);
    expect(out).toContain(`aria-label="${tile.title}: באמצע שיעור"`);
    expect(tilesSummary(rows)).toBe('מדרגה אחת בדרך לשליטה');
  });
});

describe('finding 3: the profile keeps learned stairs learned when a memory check comes due', () => {
  const stat = (h, label) => Number(text(h).match(new RegExp(`(\\d+) ${label}`))?.[1]);

  it('mastered and mastered-then-due both count as "שולטים לבד"; due and worth strengthening are counted apart', () => {
    withSkills({ 'signed:1': REC.mastered, 'signed:2': REC.due, 'signed:3': REC.missed, 'signed:4': REC.partial });
    const out = html(<Me />, '/me');
    expect(stat(out, 'שולטים לבד')).toBe(2);
    expect(text(out)).toContain('מדרגה אחת מחכה לבדיקת זיכרון');
    expect(text(out)).toContain('מדרגה אחת שכדאי לחזק');
  });

  it('the counts say several in the plural, and say nothing when there is nothing to say', () => {
    withSkills({ 'signed:1': REC.due, 'signed:2': REC.due, 'signed:3': REC.missed, 'signed:4': REC.missed });
    const out = html(<Me />, '/me');
    expect(stat(out, 'שולטים לבד')).toBe(2);
    expect(text(out)).toContain('2 מדרגות מחכות לבדיקת זיכרון');
    expect(text(out)).toContain('2 מדרגות שכדאי לחזק');
    withSkills({ 'signed:1': REC.mastered });
    const calm = html(<Me />, '/me');
    expect(stat(calm, 'שולטים לבד')).toBe(1);
    expect(calm).not.toContain('profile-keep');
  });

  it("the list of what needs work names each stair's state in its own words", () => {
    withSkills({ 'signed:2': REC.due, 'signed:3': REC.missed });
    const out = text(html(<Me />, '/me'));
    expect(out).toContain('זמן לבדיקת זיכרון');
    expect(out).toContain('כדאי לחזק');
  });

  it("the board's line and a backup's preview count the same way as the profile", () => {
    const skills = { 'signed:1': REC.mastered, 'signed:2': REC.due, 'signed:3': REC.missed };
    expect(tilesSummary(gradeTiles('7', skills, {}, at(0)))).toMatch(/^שולטים לבד ב־2 מתוך \d+ מדרגות · מדרגה אחת מחכה לבדיקת זיכרון · מדרגה אחת שכדאי לחזק$/);
    expect(previewOf({ profile: { grade: '7' }, learn: { skills } }, new Date(NOW)).mastered).toBe(2);
  });
});
