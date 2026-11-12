// PRODUCT2-18 and SK-STUDENT-4: every miss shows what probably happened. A miss on an object in a lesson (the number
// line, folded on a short phone) gets the line a typed miss gets; a miss on a teaching step's object names the mistake
// above the hint; a check's end screen names a mistake that came back; and the number line's hint arrow points the way
// to fix the marker, not the jump's way from the start. Rendered to HTML, as ui.test.jsx does.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { makeItem, catLabel } from '@/content/index.js';
import { loadAllContent } from '@/learn/content/index.ts';
import { seeded } from '@/learn/expr.ts';
import { startLesson, answer, resultOf } from '@/lib/lesson.js';
import MissNote, { missNote } from '@/components/lesson/MissNote.jsx';
import { exploreMiss, MissWhy } from './StepPlayer.jsx';
import RepeatNote, { repeatedMistake } from './RepeatNote.jsx';
import NumberLine, { hintArrow } from '@/components/manip/NumberLine.jsx';
import { exploreCat } from '@/content/explore.js';

let C;
const real = Math.random;
beforeAll(async () => { C = await loadAllContent(); });
afterAll(() => { Math.random = real; });
const html = (el) => renderToStaticMarkup(<MemoryRouter>{el}</MemoryRouter>);

describe('a miss on an object in a lesson names what probably happened', () => {
  it('the number line on signed:1: the right distance the wrong way is named, with its repair', () => {
    Math.random = seeded(5);
    let it; let u;
    for (let i = 0; i < 400 && u == null; i += 1) {
      it = makeItem('signed', 1);
      if (it.form !== 'manip' || it.manip.kind !== 'numberline') continue;
      const a = it.manip.from; const mirror = 2 * a - it.answer; // the jump's length, the other way
      if (mirror >= it.manip.min && mirror <= it.manip.max && it.diag(mirror) === 'direction') u = mirror;
    }
    expect(u, 'a number-line question with a mirrored move on the line').not.toBeUndefined();
    const last = { cat: it.diag(u), diagnosis: it.diagnosis(u) };
    const note = missNote('signed', 1, last);
    expect(note.line).toBe(`מה כנראה קרה: ${catLabel('signed', 1, 'direction')}.`);
    expect(note.repair).toBe('direction');
    const out = html(<MissNote note={note} onRepair={() => {}} />);
    expect(out).toContain('class="fb-diag"');
    expect(out).toContain('מה כנראה קרה');
    expect(out).toContain('בואו נראה את זה אחרת');
    // in a check the line stays and no repair is offered
    expect(missNote('signed', 1, last, { test: true })).toEqual({ line: note.line, repair: null });
    // a miss with no name shows nothing extra
    expect(html(<MissNote note={missNote('signed', 1, { cat: null })} onRepair={() => {}} />)).toBe('');
  });
});

describe('a miss on a teaching step names the mistake above the hint', () => {
  const step = (display) => C['signed:1'].discover.find((s) => s.kind === 'explore' && s.display === display);
  it('2 − (−3) moved like 2 − 3: subtracting the negative as if it were positive', () => {
    const s = step('2 - (-3)');
    const miss = exploreMiss('signed:1', s, -1);
    expect(miss.cat).toBe('minus-minus');
    expect(miss.line).toBe(`מה כנראה קרה: ${catLabel('signed', 1, 'minus-minus')}.`);
    expect(miss.title).toBe('עוד לא');
    const out = renderToStaticMarkup(<MissWhy line={miss.line} hint={s.hint} k="x" />);
    // the line first, then the hint (its first sentence, the rest behind "עוד")
    expect(out.startsWith('<p class="bl-diag">')).toBe(true);
    expect(out.split('</p>').length).toBeGreaterThan(2);
  });
  it('−2 + 5 moved 5 to the left: the right distance the wrong way', () => {
    expect(exploreMiss('signed:1', step('-2 + 5'), -7).cat).toBe('direction');
  });
  it('nothing named: the general "not yet" and the hint alone', () => {
    // one step left of the start is a slip on the line, not a sign error (−3 is −answer here by chance)
    const miss = exploreMiss('signed:1', step('-2 + 5'), -3);
    expect(miss).toEqual({ cat: null, line: null, title: 'עוד לא. הזיזו ונסו שוב' });
    expect(renderToStaticMarkup(<MissWhy line={null} hint="חיבור של מספר חיובי מזיז ימינה." k="x" />)).not.toContain('מה כנראה קרה');
    // a step with no stair given names nothing
    expect(exploreMiss(undefined, step('2 - (-3)'), -1).line).toBeNull();
  });
  it('a point with its coordinates swapped, and a line with m and b swapped', () => {
    const plot = { kind: 'explore', manip: { kind: 'plot', range: 6 }, answer: [3, -2], hint: '' };
    expect(exploreCat('coord', 1, plot, [-2, 3])).toBe('swap');
    expect(exploreCat('coord', 1, plot, [3, -2])).toBeNull();
    const line = { kind: 'explore', manip: { kind: 'line', range: 6 }, answer: { m: 2, b: -1 }, hint: '' };
    expect(exploreCat('line', 5, line, { m: -1, b: 2 })).toBe(catLabel('line', 5, 'm-b') ? 'm-b' : null);
  });

  // SK-LEARN-7: the two stairs that had no object to move get one each, and its likely miss has the stair's own name
  it('expr:2: the terms of a sequence as points; the asked term one step too far is n steps counted, not n − 1', () => {
    const s = C['expr:2'].discover.find((x) => x.kind === 'explore');
    expect(s?.manip.kind).toBe('plot');
    const [x, y] = s.answer; const d = s.manip.dots[1][1] - s.manip.dots[0][1];
    const miss = exploreMiss('expr:2', s, [x, y + d]);
    expect(miss.cat).toBe('start-n');
    expect(miss.line).toBe(`מה כנראה קרה: ${catLabel('expr', 2, 'start-n')}.`);
    expect(miss.title).toBe('עוד לא');
    // the term before it, or a point off the pattern: nothing is named, the hint alone
    expect(exploreMiss('expr:2', s, [x - 1, y - d]).cat).toBeNull();
    expect(exploreMiss('expr:2', s, [x, y + 1]).cat).toBeNull();
    expect(exploreMiss('expr:2', s, s.answer).cat).toBeNull();
  });
  it('sys:1: the price before a discount on the double line; 25% of the price after added back is the percent of the new price', () => {
    const s = C['sys:1'].discover.find((x) => x.kind === 'explore');
    expect(s?.manip.kind).toBe('dline');
    // 60 ₪ after 25% off is 75% of 80; 60 + 25% of 60 = 75 takes the percent of the new price
    const given = (s.manip.fixT * s.answer) / 100;
    const wrong = given + ((100 - s.manip.fixT) / 100) * given;
    const miss = exploreMiss('sys:1', s, wrong);
    expect(miss.cat).toBe('pct-of-new');
    expect(miss.line).toBe(`מה כנראה קרה: ${catLabel('sys', 1, 'pct-of-new')}.`);
    expect(exploreMiss('sys:1', s, { t: s.manip.fixT, max: wrong }).cat).toBe('pct-of-new'); // the object's own shape
    expect(exploreMiss('sys:1', s, given).cat).toBeNull(); // the price after taken as the whole: not this mistake
    expect(exploreMiss('sys:1', s, s.answer).cat).toBeNull();
  });
  it('the readings stay inside what they mean: equal steps from place 1, a percent line up to 100%', () => {
    const seq = { kind: 'explore', manip: { kind: 'plot', range: 6, dots: [[1, 1], [2, 2], [3, 3]] }, answer: [5, 5], hint: '' };
    expect(exploreCat('expr', 2, seq, [5, 6])).toBe('start-n');
    expect(exploreCat('expr', 2, seq, [5, 5])).toBeNull();
    // the step times the place alone (the start forgotten): its own name
    const seq2 = { ...seq, manip: { ...seq.manip, dots: [[1, 4], [2, 3], [3, 2]] }, answer: [5, 0] };
    expect(exploreCat('expr', 2, seq2, [5, -5])).toBe('diff-only');
    // a stair with no such name names nothing
    expect(exploreCat('coord', 1, seq, [5, 6])).toBeNull();
    const top = { max: 100, step: 5, unit: '%', label: 'אחוזים' }; const bottom = { max: 120, step: 5, label: 'מחיר' };
    const line = { kind: 'explore', manip: { kind: 'dline', top, bottom, move: 'max', fixT: 75, start: { t: 75, max: 40 } }, answer: 80, hint: '' };
    expect(exploreCat('sys', 1, line, 75)).toBe('pct-of-new');
    // the marker moved (move 't') or a line that is not a percent of a whole: not read
    expect(exploreCat('sys', 1, { ...line, manip: { ...line.manip, move: 't' } }, 75)).toBeNull();
    expect(exploreCat('sys', 1, { ...line, manip: { ...line.manip, top: { ...top, max: 120 } } }, 75)).toBeNull();
  });
});

describe('a check\'s end screen names a mistake that came back', () => {
  it('the council\'s pct:4 case: two "stop at 1%" answers are named once, with the way to their repair', () => {
    const m = repeatedMistake({ named: { 'pct:4|stop-at-one': 2, 'pct:4|other': 1 } });
    expect(m).toEqual({ skill: 'pct:4', misc: 'stop-at-one', times: 2, line: `אותה טעות חזרה פעמיים: ${catLabel('pct', 4, 'stop-at-one')}.`, to: '/repair/pct/4/stop-at-one' });
    const out = html(<RepeatNote mistake={m} onRepair={() => {}} />);
    expect(out).toContain('אותה טעות חזרה פעמיים');
    expect(out).toContain('לתיקון הטעות');
  });
  it('once, and seen before it: named too; once and nothing more: not', () => {
    expect(repeatedMistake({ named: { 'pct:4|stop-at-one': 1 } })).toBeNull();
    expect(repeatedMistake({ named: { 'pct:4|stop-at-one': 1 } }, { 'pct:4|stop-at-one': { state: 'suspected', seen: ['before', 'now'] } })?.line).toBe(`זו טעות שכבר ראינו: ${catLabel('pct', 4, 'stop-at-one')}.`);
    // a suspicion this one answer made is not a mistake that came back
    expect(repeatedMistake({ named: { 'pct:4|stop-at-one': 1 } }, { 'pct:4|stop-at-one': { state: 'suspected', seen: ['now'] } })).toBeNull();
    expect(repeatedMistake({ named: {} })).toBeNull();
    expect(repeatedMistake({})).toBeNull();
  });
  it('a check counts the mistakes its own answers name, one name per answer', () => {
    Math.random = seeded(3);
    let s = startLesson({ kind: 'check', purpose: 'mastery', skill: 'pct:4', topic: 'pct', level: 4 });
    const named = (n) => ({ ...s.item, answer: 50, diag: () => n, diagnosis: () => ({ kind: 'misconception', candidates: [{ id: n, conf: 1 }], ambiguous: false }) });
    s = { ...s, item: named('stop-at-one') }; s = answer(s, 7).s;
    s = { ...s, item: named('stop-at-one'), phase: 'answer' }; s = answer(s, 7).s;
    // an answer two mistakes explain names neither
    s = { ...s, item: { ...named('x'), diagnosis: () => ({ kind: 'misconception', candidates: [{ id: 'a', conf: 1 }, { id: 'b', conf: 1 }], ambiguous: true }) }, phase: 'answer' };
    s = answer(s, 7).s;
    expect(s.named).toEqual({ 'pct:4|stop-at-one': 2 });
    expect(resultOf(s).named).toEqual({ 'pct:4|stop-at-one': 2 });
    expect(repeatedMistake(resultOf(s))?.misc).toBe('stop-at-one');
  });
});

describe('the number line\'s hint arrow points the way to fix it (SK-STUDENT-4)', () => {
  const m = { kind: 'numberline', min: -10, max: 10, from: -4, start: -4 };
  it('−4 − (−5) with the marker past the answer at 2: the arrow points left, from the marker', () => {
    expect(hintArrow(true, 2, -4, 1)).toEqual({ at: 2, dir: -1 });
    const out = renderToStaticMarkup(<NumberLine m={m} value={2} answer={1} hint onChange={() => {}} />);
    expect(out).toContain('שמאלה');
    expect(out).not.toContain('ימינה</text>');
  });
  it('short of the answer, it points on; with the marker still at the start, the jump\'s way', () => {
    expect(hintArrow(true, -1, -4, 1)).toEqual({ at: -1, dir: 1 });
    expect(hintArrow(true, -4, -4, 1)).toEqual({ at: -4, dir: 1 });
    expect(hintArrow(true, 1, -4, 1)).toEqual({ at: -4, dir: 1 }); // on the answer: from the start
    expect(hintArrow(false, 2, -4, 1)).toBeNull();
    expect(renderToStaticMarkup(<NumberLine m={m} value={-4} answer={1} hint onChange={() => {}} />)).toContain('ימינה</text>');
  });
});
