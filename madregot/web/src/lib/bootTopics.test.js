// Opened straight on a screen that asks from the teaching content: which topics load before the first screen (DURABLE-11).
import { describe, it, expect } from 'vitest';
import { routeTopics, bootTopics } from './bootTopics.js';
import { placementTopicsFor } from '@/content/index.js';
import { topicsReady } from '@/learn/content/index.ts';

const kid = (extra = {}) => ({ profile: { role: 'student', grade: '8' }, learn: { exam: null }, ...extra });

describe('routeTopics', () => {
  it('a lesson, a practice route, a stair, a teaching stage and a repair: their topic', () => {
    expect(routeTopics('#/lesson/signed/2?kind=check&purpose=mastery', kid())).toEqual(['signed']);
    expect(routeTopics('#/practice/coord?level=3', kid())).toEqual(['coord']);
    expect(routeTopics('#/learn/line/5', kid())).toEqual(['line']);
    expect(routeTopics('#/learn/pyth/1/B', kid())).toEqual(['pyth']);
    expect(routeTopics('#/repair/stats/3/no-divide', kid())).toEqual(['stats']);
  });
  it('the placement test: every topic it tests, for the grade asked or the profile\'s', () => {
    expect(routeTopics('#/placement', kid())).toEqual(placementTopicsFor('8').map((t) => t.id));
    expect(routeTopics('#/placement?grade=7', kid())).toEqual(placementTopicsFor('7').map((t) => t.id));
  });
  it('Exam Rescue\'s check and practice exam: the exam\'s stairs', () => {
    const st = kid({ learn: { exam: { skills: ['eq:2', 'sys:1'] } } });
    expect(routeTopics('#/rescue/check', st)).toEqual(['eq:2', 'sys:1']);
    expect(routeTopics('#/rescue/exam', st)).toEqual(['eq:2', 'sys:1']);
    expect(routeTopics('#/rescue/check', kid())).toEqual([]);
  });
  it('nothing for other screens, an unknown topic, a teacher or a first visit', () => {
    for (const h of ['', '#/', '#/me', '#/topics', '#/rescue', '#/lesson/nope/1']) expect(routeTopics(h, kid()), h).toEqual([]);
    expect(routeTopics('#/lesson/signed/1', { profile: { role: 'teacher' } })).toEqual([]);
    expect(routeTopics('#/lesson/signed/1', { profile: null })).toEqual([]);
  });
});

describe('bootTopics', () => {
  it('loads them before it resolves', async () => {
    expect(topicsReady(['eq'])).toBe(false);
    await bootTopics('#/lesson/eq/3', kid());
    expect(topicsReady(['eq'])).toBe(true);
  });
  it('never waits longer than it was given', async () => {
    const t0 = Date.now();
    await bootTopics('#/lesson/sys/1', kid(), 0);
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});
