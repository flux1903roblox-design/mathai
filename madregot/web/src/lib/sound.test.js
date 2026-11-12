// Sound and vibration are two settings (STUDENT-7): vibration follows its own switch, never the sound switch, uses a
// short distinct pattern per moment, and stays off under reduced motion and where the browser cannot vibrate. In the
// iPhone app (VITE_STORE=ios, STUDENT-12 §3) the phone's own haptics play through the native shell's bridge.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useApp } from './store.js';
import { haptic, buzz, play, soundOn, HAPTICS, NATIVE_HAPTICS } from './sound.js';

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
  it('has a short, distinct pattern for each moment, a combo and a level up included (PRODUCT2-38)', () => {
    expect(HAPTICS).toEqual({
      correct: [12], wrong: [20, 40, 20], complete: [15, 30, 15, 30, 40], goal: [30, 50, 60],
      combo: [10, 30, 10, 30, 10], levelup: [20, 40, 20, 40, 90],
    });
    // no two moments feel the same in the hand
    const seen = Object.values(HAPTICS).map((p) => p.join(','));
    expect(new Set(seen).size).toBe(seen.length);
    ['correct', 'complete', 'goal', 'combo', 'levelup'].forEach((k) => haptic(k));
    expect(vibrate.mock.calls.map(([p]) => p)).toEqual([[12], [15, 30, 15, 30, 40], [30, 50, 60], [10, 30, 10, 30, 10], [20, 40, 20, 40, 90]]);
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
    for (const k of ['correct', 'wrong', 'complete', 'goal', 'combo', 'levelup']) expect(haptic(k)).toBe(true);
    expect(buzz()).toBe(true);
    await settle();
    expect(asked).toEqual([
      ['Haptics', 'impact', { style: 'LIGHT' }], ['Haptics', 'notification', { type: 'WARNING' }],
      ['Haptics', 'notification', { type: 'SUCCESS' }], ['Haptics', 'notification', { type: 'SUCCESS' }],
      ['Haptics', 'impact', { style: 'HEAVY' }], ['Haptics', 'notification', { type: 'SUCCESS' }],
      ['Haptics', 'impact', { style: 'MEDIUM' }],
    ]);
    expect(Object.keys(NATIVE_HAPTICS)).toEqual(['correct', 'wrong', 'complete', 'goal', 'combo', 'levelup', 'buzz']);
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

// The sound set (PRODUCT2-38): a chime for right, a combo that climbs with the run, a level up for a stair, a piece or a
// streak milestone. Made in the browser with oscillators; here a stand-in AudioContext counts the notes asked for.
describe('play(name): the sound set, quiet in class', () => {
  let notes;
  class FakeAudio {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    resume() {}
    createOscillator() {
      const o = { type: 'sine', frequency: { value: 0 }, connect: (g) => g, start: () => {}, stop: () => {} };
      notes.push(o);
      return o;
    }
    createGain() {
      const g = { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (d) => d };
      return g;
    }
  }
  const pitches = () => notes.map((o) => o.frequency.value);
  beforeEach(() => {
    notes = [];
    vi.stubGlobal('window', { AudioContext: FakeAudio });
    useApp.setState({ sound: true, profile: { role: 'student', name: 'נועה', grade: '7' }, prefs: { theme: 'system', soundSet: false } });
  });

  it('has a sound for right, for a combo and for a level up', () => {
    for (const k of ['correct', 'combo', 'levelup']) {
      notes = [];
      expect(play(k)).toBe(true);
      expect(notes.length).toBeGreaterThan(1);
    }
    expect(play('no-such-sound')).toBe(false);
  });

  it('a combo climbs with the run: ten in a row starts higher than five', () => {
    play('combo', 5); const five = pitches()[0];
    notes = [];
    play('combo', 10); const ten = pitches()[0];
    expect(ten).toBeGreaterThan(five);
  });

  it('a level up ends on a chord: its last notes start together', () => {
    play('levelup');
    expect(notes.length).toBeGreaterThanOrEqual(7);
  });

  it('a student in a class who never chose hears nothing: a classroom is quiet by default', () => {
    const cls = { role: 'student', name: 'נועה', grade: '7', classCode: 'K7Q2MD', className: 'ז׳3', token: 'stu_token_1' };
    // even when the saved state still says sound: true (a backup from before the class, a profile set elsewhere)
    useApp.setState({ sound: true, profile: cls, prefs: { theme: 'system', soundSet: false } });
    expect(soundOn()).toBe(false);
    for (const k of ['correct', 'wrong', 'combo', 'levelup', 'goal', 'complete', 'tap']) expect(play(k)).toBe(false);
    expect(notes).toEqual([]);
    // the student turns sound on themselves: now it plays
    useApp.getState().setSound(true);
    expect(soundOn()).toBe(true);
    expect(play('correct')).toBe(true);
    expect(notes.length).toBeGreaterThan(0);
  });

  it('nothing plays with sound off', () => {
    useApp.setState({ sound: false });
    for (const k of ['correct', 'combo', 'levelup']) expect(play(k)).toBe(false);
    expect(notes).toEqual([]);
  });

  it('under reduced motion the celebration sounds stay quiet; the short answer tones still follow the sound switch', () => {
    reduced(true);
    for (const k of ['combo', 'levelup', 'goal', 'complete']) expect(play(k)).toBe(false);
    expect(notes).toEqual([]);
    expect(play('correct')).toBe(true);
  });
});
