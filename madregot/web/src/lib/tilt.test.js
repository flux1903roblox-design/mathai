// The tilt toward the pointer (ux-motion 10): at most 8° each way, none at the centre, toward the corner the pointer is
// over; the stair page's card wears it (screens/Journey.jsx), and the lesson never does.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { tiltAt, TILT_MAX } from './tilt.js';

const box = { left: 100, top: 50, width: 200, height: 100 };
describe('tiltAt', () => {
  it('none at the centre, the most at the edges, never past it', () => {
    expect(tiltAt(200, 100, box)).toEqual({ rx: 0, ry: 0 });
    expect(tiltAt(300, 50, box)).toEqual({ rx: TILT_MAX, ry: TILT_MAX });
    expect(tiltAt(100, 150, box)).toEqual({ rx: -TILT_MAX, ry: -TILT_MAX });
    expect(tiltAt(900, -400, box)).toEqual({ rx: TILT_MAX, ry: TILT_MAX });
    expect(TILT_MAX).toBeLessThanOrEqual(15);
  });

  it('the card leans with a 1000px perspective, comes back quickly, and the lesson has no tilt', () => {
    const css = readFileSync(new URL('../styles/lazy/journey.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.journey-head \{ transition: transform var\(--duration-quick\) var\(--ease-out\); \}/);
    // only while a pointer leans it: a card nobody hovers is drawn exactly as before
    expect(css).toMatch(/\.journey-head\.is-tilting \{ transform: perspective\(1000px\) rotateX\(var\(--tilt-x, 0deg\)\) rotateY\(var\(--tilt-y, 0deg\)\); \}/);
    expect(readFileSync(new URL('../screens/Journey.jsx', import.meta.url), 'utf8')).toMatch(/useTilt\(headRef\)/);
    expect(readFileSync(new URL('../screens/Lesson.jsx', import.meta.url), 'utf8')).not.toMatch(/useTilt|tilt-x/);
  });
});
