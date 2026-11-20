// A practice first try hides an object's readout of the quantity the question asks (stage 2, MEASURE-1.4; CURRICULUM-11
// item 1 for the grid, the net and the circle), and the retry says what can be seen now (Manip.jsx readoutLine). Over
// every practice exercise of the four measurement topics that uses one of the three objects: an object whose practice
// readout says more than its check readout at a wrong value has a line, and one whose readouts are the same has none
// (a fold, a face, a slot, a move, a cut not yet right, the apex: nothing to hide, nothing to announce).
import { describe, it, expect } from 'vitest';
import { makeItem, TOPIC } from '@/content/index.js';
import { manipWrong, manipSolution, manipCorrect } from '@/content/manip.js';
import { readoutLine } from './Manip.jsx';
import { gridSaid } from './GridShape.jsx';
import { netSaid } from './NetFold.jsx';
import { circleSaid } from './CircleRoll.jsx';

const said = (it, v, test) => {
  const m = it.manip;
  if (m.kind === 'polygon') return gridSaid(m, v, { test, right: !test && manipCorrect(it, v) });
  if (m.kind === 'net') return netSaid(m, v, { test, answer: it.answer });
  return circleSaid(m, v, { test });
};
const shown = (x) => JSON.stringify({ text: x.text, line: x.line, more: x.more });

describe('the readout on a practice first try', () => {
  it('every grid, net and circle exercise of stage 2 has a line exactly when its readout hides something', () => {
    const seen = new Set();
    for (const topic of ['area', 'solid', 'circle', 'space']) {
      for (let level = 1; level <= TOPIC[topic].levels.length; level += 1) {
        for (let i = 0; i < 300; i += 1) {
          const it = makeItem(topic, level);
          if (it.form !== 'manip' || !['polygon', 'net', 'circle'].includes(it.manip.kind)) continue;
          const wrong = manipWrong(it);
          const hides = shown(said(it, wrong, false)) !== shown(said(it, wrong, true));
          const line = readoutLine(it);
          expect(!!line, `${it.key}: ${hides ? 'hides its readout but has no line' : 'hides nothing but has a line'}`).toBe(hides);
          if (line) {
            expect(line).toMatch(/^עכשיו רואים גם את .+\. נסו שוב\.$/);
            // the right state is never announced on the first try: the check readout is the same at the answer
            expect(said(it, manipSolution(it), true).line, it.key).not.toMatch(/שטח \d|היקף|נפח|אלכסון/);
          }
          seen.add(`${it.manip.kind}:${it.manip.task || it.manip.show}:${!!line}`);
        }
      }
    }
    // the practice exercises the review named are among them: ar1b and ar5b (rect), so2b and so4b (build), ci1m and ci2m
    for (const k of ['polygon:rect:true', 'net:build:true', 'circle:circumference:true', 'circle:area:true']) expect(seen.has(k), k).toBe(true);
  });

  it('says what appears, for each object', () => {
    expect(readoutLine({ manip: { kind: 'polygon', task: 'rect' }, answer: { mode: 'rect', area: 12, perim: 14 } })).toBe('עכשיו רואים גם את השטח ואת ההיקף. נסו שוב.');
    expect(readoutLine({ manip: { kind: 'net', task: 'build', solid: 'box' }, answer: { mode: 'build', V: 24 } })).toBe('עכשיו רואים גם את הנפח ואת שטח הפנים. נסו שוב.');
    expect(readoutLine({ manip: { kind: 'net', task: 'build', solid: 'box' }, answer: { mode: 'build', d2: 81 } })).toBe('עכשיו רואים גם את האלכסון בריבוע. נסו שוב.');
    expect(readoutLine({ manip: { kind: 'net', task: 'build', solid: 'prism' }, answer: { mode: 'build', V: 60 } })).toBe('עכשיו רואים גם את שטח הבסיס ואת הנפח. נסו שוב.');
    expect(readoutLine({ manip: { kind: 'circle', show: 'circumference' }, answer: { mode: 'r', r: 5 } })).toBe('עכשיו רואים גם את ההיקף. נסו שוב.');
    expect(readoutLine({ manip: { kind: 'circle', show: 'area' }, answer: { mode: 'r', r: 5 } })).toBe('עכשיו רואים גם את השטח. נסו שוב.');
    for (const task of ['move', 'cut', 'apex']) expect(readoutLine({ manip: { kind: 'polygon', task } })).toBeNull();
    for (const task of ['fold', 'face', 'fix']) expect(readoutLine({ manip: { kind: 'net', task } })).toBeNull();
    expect(readoutLine({ manip: { kind: 'bars' } })).toBeNull();
    expect(readoutLine({ form: 'num' })).toBeNull();
  });
});
