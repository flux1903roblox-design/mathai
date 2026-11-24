// Rubber banding (ux-motion 13): an object dragged past the end of its range follows by a shrinking share of the
// overshoot and never further than RUBBER, then springs back when let go; under reduced motion it stops at the end.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { rubber, pullPast, RUBBER } from './core.jsx';

const src = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');

describe('rubber banding', () => {
  it('the skill\'s curve: (1 - 1 / (over * 0.55 / size + 1)) * size, growing ever more slowly, never past size', () => {
    expect(rubber(0, 24)).toBe(0);
    expect(rubber(-5, 24)).toBe(0);
    expect(rubber(24, 24)).toBeCloseTo((1 - 1 / 1.55) * 24, 6);
    const a = rubber(10, 24); const b = rubber(20, 24); const c = rubber(400, 24);
    expect(a).toBeLessThan(10); // it lags the pointer from the first pixel
    expect(b - a).toBeLessThan(a); // and slows
    expect(c).toBeLessThan(24);
    expect(c).toBeGreaterThan(20);
  });

  it('pulls only past an end: back below the start, on past the end, nothing in between', () => {
    expect(pullPast(50, 20, 340, RUBBER)).toBe(0);
    expect(pullPast(0, 20, 340, RUBBER)).toBeCloseTo(-rubber(20, RUBBER), 6);
    expect(pullPast(360, 20, 340, RUBBER)).toBeCloseTo(rubber(20, RUBBER), 6);
  });

  it('the number line\'s marker and the movable bar take it; a cancelled drag lets go too; CSS springs them back', () => {
    expect(src('./NumberLine.jsx')).toMatch(/useDrag\(\(p, phase\) => \{ track\(p\.x, X\(min\), X\(max\), phase\); set\(toV\(p\.x\)\); \}, locked, \(\) => track\(0, 0, 0, 'cancel'\)\)/);
    expect(src('./DataBars.jsx')).toMatch(/useDrag\(\(p, phase\) => \{ track\(p\.y, TOP, BOT, phase\); set\(toV\(p\.y\)\); \}, locked, \(\) => track\(0, 0, 0, 'cancel'\)\)/);
    expect(src('./core.jsx')).toMatch(/still \|\| phase === 'end' \|\| phase === 'cancel' \? 0/);
    const css = src('../../styles/lazy/shared.css');
    expect(css).toMatch(/\.mp-rubber \{ transition: translate var\(--duration-fast\) var\(--ease-smooth-out\), scale var\(--duration-fast\) var\(--ease-smooth-out\); \}/);
    expect(css).toMatch(/\.mp-rubber\.is-pulled \{ transition: none; \}/);
  });
});
