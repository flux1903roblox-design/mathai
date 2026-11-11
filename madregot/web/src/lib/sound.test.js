// Sound and vibration are two settings (STUDENT-7): vibration follows its own switch, never the sound switch, uses a
// short distinct pattern per moment, and stays off under reduced motion and where the browser cannot vibrate. In the
// iPhone app (VITE_STORE=ios, STUDENT-12 §3) the phone's own haptics play through the native shell's bridge.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useApp } from './store.js';
import { haptic, buzz, HAPTICS, NATIVE_HAPTICS } from './sound.js';

let vibrate;
const reduced = (on) => vi.stubGlobal('matchMedia', (q) => ({ matches: on && q.includes('prefers-reduced-motion: reduce'), media: q }));

beforeEach(() => {
  vibrate = vi.fn(() => true);
  vi.stubGlobal('navigator', { vibrate });
  reduced(false);
  useApp.setState({ sound: true, haptics: true });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); delete globalThis.Capacitor; });

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

describe('the iPhone app\'s haptics (VITE_STORE=ios)', () => {
  /** The native shell's bridge, with Haptics: what was asked of it. */
  function shell() {
    const asked = [];
    globalThis.Capacitor = { isNativePlatform: () => true, nativePromise: vi.fn(async (name, method, options) => { asked.push([name, method, options]); }) };
    return asked;
  }
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('a light tap for right, a warning for "not yet", a success for the end and the goal', async () => {
    vi.stubEnv('VITE_STORE', 'ios');
    const asked = shell();
    vi.stubGlobal('navigator', {}); // Safari: no navigator.vibrate
    for (const k of ['correct', 'wrong', 'complete', 'goal']) expect(haptic(k)).toBe(true);
    expect(buzz()).toBe(true);
    await settle();
    expect(asked).toEqual([
      ['Haptics', 'impact', { style: 'LIGHT' }], ['Haptics', 'notification', { type: 'WARNING' }],
      ['Haptics', 'notification', { type: 'SUCCESS' }], ['Haptics', 'notification', { type: 'SUCCESS' }],
      ['Haptics', 'impact', { style: 'MEDIUM' }],
    ]);
    expect(Object.keys(NATIVE_HAPTICS)).toEqual(['correct', 'wrong', 'complete', 'goal', 'buzz']);
  });

  it('follows the vibration setting and reduced motion, as on Android', async () => {
    vi.stubEnv('VITE_STORE', 'ios');
    const asked = shell();
    useApp.setState({ haptics: false });
    expect(haptic('correct')).toBe(false);
    useApp.setState({ haptics: true });
    reduced(true);
    expect(haptic('goal')).toBe(false);
    await settle();
    expect(asked).toEqual([]);
  });

  it('the web build never calls the shell, even when a page has one', async () => {
    const asked = shell();
    expect(haptic('wrong')).toBe(true);
    await settle();
    expect(asked).toEqual([]);
    expect(vibrate).toHaveBeenCalledWith([20, 40, 20]);
  });
});
