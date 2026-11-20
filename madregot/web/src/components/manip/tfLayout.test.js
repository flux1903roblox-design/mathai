// The transform object's layout rules (GEOM-2.3, 2.4), as pure functions: where its letters go (tfLayout.js) and how
// large its plane is in a teaching step (Transform.jsx fitSize). The screens are walked in e2e/manip.spec.js; every
// teaching, repair and practice object's letters in learn/figures.test.ts.
import { describe, it, expect } from 'vitest';
import { tfLetters, tfClashes, planeWords } from './tfLayout.js';
import { fitSize, FIT_MIN, FIT_WANT } from './Transform.jsx';
import { gridGeometry } from './grid.jsx';

const g = gridGeometry(6);

describe('the letters (tfLayout.js)', () => {
  it('a letter with room keeps its usual place: just outside its vertex, away from the middle of its shape', () => {
    const [a] = tfLetters(g, [{ key: 'copy', pts: [[0, 0], [4, 0], [0, 3]], labels: ['A', 'B', 'C'] }], null);
    // A(0, 0) is the corner away from the middle: its letter is down and to the left of it
    expect(a.x).toBeLessThan(g.X(0));
    expect(a.y).toBeGreaterThan(g.Y(0));
    expect(Math.hypot(a.x - g.X(0), a.y - g.Y(0))).toBeCloseTo(15, 5);
  });
  it('congr:1 step 5: the target\'s C and the centre\'s O no longer sit on each other', () => {
    const groups = [
      { key: 'target', pts: [[-1, 4], [-4, 4], [-1, 1]], labels: ['A', 'B', 'C'], hide: new Set() },
      { key: 'orig', pts: [[1, -1], [4, -1], [1, 2]], labels: ['K', 'M', 'L'], hide: new Set(['1,-1', '4,-1', '1,2']) },
      { key: 'copy', pts: [[1, -1], [4, -1], [1, 2]], labels: ['K′', 'M′', 'L′'] },
    ];
    expect(tfClashes(g, groups, [0, 0])).toEqual([]);
    const L = tfLetters(g, groups, [0, 0]);
    const c = L.find((l) => l.group === 'target' && l.text === 'C').box; const o = L.find((l) => l.group === 'centre').box;
    expect(Math.abs(c.x - o.x) >= c.w + o.w || Math.abs(c.y - o.y) >= c.h + o.h).toBe(true);
  });
  it('the plane\'s numbers are obstacles too', () => {
    const words = planeWords(g);
    expect(words.length).toBe(2 * 6 + 2); // −6, −4, −2, 2, 4, 6 on each axis, and the axes' names
  });
});

describe('the plane in a teaching step (Transform.jsx fitSize)', () => {
  const at = (room, chips = 30, refusing = false) => fitSize({ planeTop: 100, below: 100, chips, barTop: 100 + 100 + 6 + room, refusing });
  it('takes the room left, less the chips\' line, while that leaves at least 220 px', () => {
    expect(at(320)).toEqual({ size: 290, tight: false });
    expect(at(FIT_WANT + 30)).toEqual({ size: FIT_WANT, tight: false });
  });
  it('when the chips would take it under 220 px, they leave the screen and the plane keeps the room', () => {
    expect(at(FIT_WANT + 29)).toEqual({ size: FIT_WANT + 29, tight: true });
    expect(at(210)).toEqual({ size: 210, tight: true });
  });
  it('never under 200 px, never over 440', () => {
    expect(at(150).size).toBe(FIT_MIN);
    expect(at(900).size).toBe(440);
  });
  it('a refused move\'s sentence is already under the plane: no chips to take off', () => {
    expect(at(320, 30, true)).toEqual({ size: 320, tight: false });
  });
});
