// Sound and vibration are two settings (STUDENT-7): vibration follows its own switch, never the sound switch, uses a
// short distinct pattern per moment, and stays off under reduced motion and where the browser cannot vibrate.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useApp } from './store.js';
import { haptic, buzz, HAPTICS } from './sound.js';

let vibrate;
const reduced = (on) => vi.stubGlobal('matchMedia', (q) => ({ matches: on && q.includes('prefers-reduced-motion: reduce'), media: q }));

beforeEach(() => {
  vibrate = vi.fn(() => true);
  vi.stubGlobal('navigator', { vibrate });
  reduced(false);
  useApp.setState({ sound: true, haptics: true });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('haptic(kind)', () => {
  it('vibrates the "not yet" pattern when vibration is on and reduced motion is off', () => {
    expect(haptic('wrong')).toBe(true);
    expect(vibrate).toHaveBeenCalledWith([20, 40, 20]);
  });
  it('has a short, distinct pattern for each moment', () => {
    expect(HAPTICS).toEqual({ correct: [12], wrong: [20, 40, 20], complete: [15, 30, 15, 30, 40], goal: [30, 50, 60] });
    ['correct', 'complete', 'goal'].forEach((k) => haptic(k));
    expect(vibrate.mock.calls.map(([p]) => p)).toEqual([[12], [15, 30, 15, 30, 40], [30, 50, 60]]);
    expect(haptic('tap')).toBe(false); // no vibration for a plain tap
  });
  it('does nothing when vibration is off', () => {
    useApp.setState({ haptics: false });
    expect(haptic('wrong')).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });
  it('does nothing under reduced motion', () => {
    reduced(true);
    expect(haptic('correct')).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });
  it('does nothing where the browser cannot vibrate (iPhone Safari)', () => {
    vi.stubGlobal('navigator', {});
    expect(haptic('goal')).toBe(false);
  });
});

describe('buzz()', () => {
  it('follows the vibration setting, not the sound setting', () => {
    useApp.setState({ sound: false, haptics: true });
    expect(buzz(40)).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(40);
    vibrate.mockClear();
    useApp.setState({ sound: true, haptics: false });
    expect(buzz(40)).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });
});
