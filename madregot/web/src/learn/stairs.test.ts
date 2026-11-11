// shared/stairs.js is the one list of stairs that the Worker and the tutor's prompt read (PARENTS-8, ai spec AI-5). It
// is written by hand, so this test holds it to the app: a topic or a stair added without its name, or a name that
// differs from the one on screen, fails here.
import { describe, it, expect } from 'vitest';
// @ts-ignore: plain JS shared with the Worker
import { TOPIC_NAMES, STAIR_NAMES, TOPIC_GRADE, NOT_YET, stairName } from '@shared/stairs.js';
// @ts-ignore: plain JS
import { TOPIC } from '@/content/index.js';
import { TOPIC_ORDER, GRADE_OF, STAIRS, ALL_SKILLS, skillId } from './skills';
import { contentOf, loadAllContent } from './content/index';

// every topic's teaching content, loaded once (the durable lane's split, DURABLE-11: topics load on demand)
await loadAllContent();

const NAMES: Record<string, string> = STAIR_NAMES;

describe('shared/stairs.js is the app\'s own list', () => {
  it('the topics, in teaching order, with their grades and names', () => {
    expect(Object.keys(TOPIC_NAMES)).toEqual(TOPIC_ORDER);
    expect(TOPIC_GRADE).toEqual(GRADE_OF);
    for (const t of TOPIC_ORDER) {
      expect(TOPIC_NAMES[t], t).toBe(TOPIC[t].title);
      expect(TOPIC_GRADE[t], t).toBe(TOPIC[t].grade);
    }
  });

  it('every stair, with the name its lesson and its teaching content use', () => {
    expect(Object.keys(STAIR_NAMES)).toEqual(ALL_SKILLS);
    for (const t of TOPIC_ORDER) {
      expect(TOPIC[t].levels).toHaveLength(STAIRS[t]);
      TOPIC[t].levels.forEach((L: { title: string }, i: number) => {
        const id = skillId(t, i + 1);
        expect(NAMES[id], id).toBe(L.title);
        expect(NAMES[id], id).toBe(contentOf(id)?.title);
        expect(stairName(id)).toBe(`${TOPIC[t].title}: ${L.title}`);
      });
    }
  });

  it('NOT_YET lists only what the app does not teach', () => {
    const taught = new Set([...Object.values(TOPIC_NAMES), ...Object.values(STAIR_NAMES), ...ALL_SKILLS.map((s) => contentOf(s)?.title)]);
    expect(Object.keys(NOT_YET)).toEqual(['7', '8']);
    [...NOT_YET['7'], ...NOT_YET['8']].forEach((title: string) => expect(taught.has(title), title).toBe(false));
  });
});
