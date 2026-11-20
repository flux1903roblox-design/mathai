// A unit has one number for a student: the map's banner ("יחידה 15"), the topics list and the unit's guide page (its
// "מדריך" link on that banner) say the same one. The map and the list number the grade's path of the month
// (pathTopicsFor: its own units, then a unit of the other grade once the programme teaches it here); the guide page and
// the exam result read unitNumber, which numbered only the grade's own units, so a unit that joined by the month (ח׳'s
// angles, from September; ז׳'s Pythagoras, from December) had another number on its own guide page.
import { describe, it, expect } from 'vitest';
import { TOPIC, unitNumber, pathTopicsFor } from './topics.js';
import { mapTopics } from '@/learn/next.ts';
import { ALSO_ON_PATH } from '@/learn/skills.ts';

describe('a unit\'s number is the one its map banner shows', () => {
  it('every unit on each grade\'s map, in every school month, has the map\'s number on its guide page', () => {
    for (const grade of ['7', '8']) {
      for (let month = 0; month <= 9; month += 1) {
        const map = mapTopics(grade, false, month).filter((t) => !t.bridge);
        map.forEach((t, i) => expect(unitNumber(t, grade, ALSO_ON_PATH, month), `${grade} ${month} ${t.id}`).toBe(i + 1));
      }
    }
  });

  it('ח׳\'s angles unit is unit 15 on the map and on its page; ז׳\'s Pythagoras is 10 from December', () => {
    expect(pathTopicsFor('8', 2).indexOf(TOPIC.angles) + 1).toBe(15);
    expect(unitNumber(TOPIC.angles, '8', ALSO_ON_PATH, 2)).toBe(15);
    expect(unitNumber(TOPIC.pyth, '7', ALSO_ON_PATH, 3)).toBe(10);
    // before ז׳ meets it, Pythagoras is not on the ז׳ path: its own grade's number, as before
    expect(unitNumber(TOPIC.pyth, '7', ALSO_ON_PATH, 2)).toBe(7);
    // the floor has none, and a unit's own grade numbers it for a viewer with no grade
    expect(unitNumber(TOPIC.frac, '8', ALSO_ON_PATH, 2)).toBe(0);
    expect(unitNumber(TOPIC.line, undefined)).toBe(6);
  });
});
