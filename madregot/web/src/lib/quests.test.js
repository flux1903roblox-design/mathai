// The daily quests are a habit layer over the one plan (CURRICULUM-7): they suggest no work of their own. The quest
// that used to count lessons from the improvement plan is now "finish today's mission", and the mission itself says
// when it is finished (store.completeMission sets days[today].missionDone).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QUESTS, questsFor, questProgress } from './quests.js';
import { useApp, today } from './store.js';

const dayAfter = (key) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + 1); return d.toLocaleDateString('en-CA'); };
/** The first day from `key` whose three quests include `id`. */
const dayWith = (id, key = '2026-11-02') => { let k = key; while (!questsFor(k).includes(id)) k = dayAfter(k); return k; };

const review = { kind: 'review', skill: 'coord:1', title: 'בדיקת זיכרון: קריאת נקודה', reason: 'r', minutes: 2, to: '/lesson/coord/1?kind=check&purpose=review' };
const fresh = { kind: 'new', skill: 'signed:1', stage: 'A', title: 'מבינים את הרעיון: מספרים מכוונים', reason: 'r', minutes: 5, to: '/learn/signed/1/A' };

describe('the mission quest', () => {
  it('replaces the plan quest: six quest ids, none of them suggests work of its own', () => {
    expect(Object.keys(QUESTS).sort()).toEqual(['combo', 'correct', 'lessons', 'mission', 'perfect', 'xp']);
    expect(QUESTS.review).toBeUndefined();
    expect(QUESTS.mission.title()).toBe('השלימו את "המשימה שלי להיום"');
    // every quest the days of a year can show is one of the six
    let k = '2026-09-01';
    for (let i = 0; i < 365; i += 1, k = dayAfter(k)) questsFor(k).forEach((id) => expect(QUESTS[id]).toBeTruthy());
    expect(dayWith('mission')).toBeTruthy();
  });

  it('completes when the day records the mission as done, and only then', () => {
    const key = dayWith('mission');
    const q = (day) => questProgress(key, day).find((x) => x.id === 'mission');
    expect(q({})).toMatchObject({ have: 0, target: 1, done: false });
    // lessons, reviews or the retired plan's lessons do not count
    expect(q({ lessons: 4, reviews: 2, planLessons: 3 }).done).toBe(false);
    expect(q({ missionDone: 1 })).toMatchObject({ have: 1, done: true });
  });
});

describe('store: finishing the mission', () => {
  beforeEach(() => { useApp.getState().resetProgress(); useApp.setState({ freezes: 0 }); });
  afterEach(() => vi.useRealTimers());

  it('sets days[today].missionDone when the last item is done, not before', () => {
    const d = today();
    useApp.getState().saveMission(d, [review, fresh]);
    let r = useApp.getState().completeMission({ skill: 'coord:1', kind: 'review' });
    expect(r).toMatchObject({ questsDone: false, freezeEarned: false });
    expect(useApp.getState().days[d]?.missionDone).toBeUndefined();
    r = useApp.getState().completeMission({ skill: 'signed:1', kind: 'continue', stage: 'A' });
    expect(useApp.getState().learn.missions[d].items.every((i) => i.done)).toBe(true);
    expect(useApp.getState().days[d].missionDone).toBe(1);
    // a later activity changes nothing more
    const before = useApp.getState().days;
    useApp.getState().completeMission({ skill: 'signed:1', kind: 'continue', stage: 'B' });
    expect(useApp.getState().days).toBe(before);
  });

  it('with no mission saved today, nothing is recorded', () => {
    expect(useApp.getState().completeMission({ skill: 'coord:1', kind: 'review' })).toEqual({ questsDone: false, freezeEarned: false });
    expect(useApp.getState().days[today()]).toBeUndefined();
  });

  it('when the mission quest is the day\'s last, finishing the mission opens the chest (a streak freeze)', () => {
    const key = dayWith('mission');
    vi.useFakeTimers(); vi.setSystemTime(new Date(`${key}T12:00:00`));
    expect(today()).toBe(key);
    // every other quest of the day is done
    useApp.setState({ days: { [key]: { lessons: 5, combo: 10, perfect: 1, ok: 30, xp: 60 } }, freezes: 0 });
    expect(questProgress(key, useApp.getState().days[key]).filter((q) => !q.done).map((q) => q.id)).toEqual(['mission']);
    useApp.getState().saveMission(key, [review]);
    const r = useApp.getState().completeMission({ skill: 'coord:1', kind: 'review' });
    expect(r).toEqual({ questsDone: true, freezeEarned: true });
    expect(useApp.getState().freezes).toBe(1);
    expect(useApp.getState().days[key]).toMatchObject({ missionDone: 1, questsRewarded: true });
  });
});
