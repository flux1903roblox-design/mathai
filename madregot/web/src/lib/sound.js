// Short feedback sounds made in the browser (no audio files), a small set (PRODUCT2-38): a bright two-note chime with a
// faint shimmer for right, a soft low note for "not yet", a small arpeggio when a lesson ends, a brighter one for the
// daily goal, a run that climbs with the combo (ten in a row starts higher than five), and a level up (a stair mastered,
// a unit done, a new piece for מדי, a streak milestone): a rising fanfare that settles on a soft chord.
// They play only after the student has tapped something, only when sound is on, and never in class by default: a
// student who joined a class and never chose sound themselves hears nothing (soundOn), even when the saved state still
// says sound: true. Under reduced motion the celebration sounds (the end, the goal, a combo, a level up) stay quiet with
// their animations; the short answer tones still follow the sound switch the student set.
// Vibration is its own setting (haptics): short, distinct patterns, only where the phone can vibrate and never under
// reduced motion (some people map motion sensitivity to vibration too). In the iPhone app (VITE_STORE=ios) the phone's
// own haptics play instead (Capacitor's Haptics, through lib/native.js): Safari has no navigator.vibrate.
import { useApp } from './store.js';
import { nativePlugin } from './native.js';

const reducedMotion = () => {
  try { return typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

let ctx = null;
function audio() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { ctx = ctx || new AC(); if (ctx.state === 'suspended') ctx.resume(); return ctx; } catch { return null; }
}

function tone(c, freq, start, dur, { type = 'sine', gain = 0.16 } = {}) {
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.02);
}

/** A combo's first note: five in a row on A5, three semitones higher at ten (COMBO_MARKS in lib/lesson.js). */
const comboRoot = (n = 5) => 880 * 2 ** (Math.min(9, Math.max(0, n - 5) * 0.6) / 12);

const PATTERNS = {
  // G5 then D6, with a quiet D7 above the second note for a little sparkle
  correct: (c) => { tone(c, 784, 0, 0.12, { type: 'triangle' }); tone(c, 1175, 0.09, 0.2, { type: 'triangle' }); tone(c, 2349, 0.1, 0.16, { type: 'sine', gain: 0.025 }); },
  wrong: (c) => { tone(c, 247, 0, 0.18, { type: 'sine', gain: 0.14 }); tone(c, 220, 0.12, 0.22, { type: 'sine', gain: 0.12 }); },
  complete: (c) => { [523, 659, 784, 1047].forEach((f, i) => tone(c, f, i * 0.09, 0.22, { type: 'triangle', gain: 0.14 })); },
  // the daily goal: C5, G5, C6, E6, a little higher and longer than the end of a lesson
  goal: (c) => { [523, 784, 1047, 1319].forEach((f, i) => tone(c, f, i * 0.11, 0.26, { type: 'triangle', gain: 0.12 })); },
  // a quick major run up from the root, which climbs with the run of right answers
  combo: (c, n) => { const r = comboRoot(n); [1, 1.26, 1.5, 2].forEach((k, i) => tone(c, r * k, i * 0.055, 0.15, { type: 'triangle', gain: 0.11 })); },
  // C5 E5 G5 C6 up, then the same four together, soft and held: a level up
  levelup: (c) => {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => tone(c, f, i * 0.09, 0.18, { type: 'triangle', gain: 0.12 }));
    notes.forEach((f) => tone(c, f, 0.4, 0.75, { type: 'triangle', gain: 0.05 }));
  },
  tap: (c) => tone(c, 660, 0, 0.05, { type: 'sine', gain: 0.05 }),
};

/**
 * Is sound on for this student? Their switch, except in a class: a classroom is quiet, so a student in a class hears
 * nothing until they turn sound on themselves (prefs.soundSet), whatever the saved state says (store.js quietForClass).
 */
export function soundOn(s = useApp.getState()) {
  return !!s.sound && !(s.profile?.classCode && !s.prefs?.soundSet);
}

/** The celebration sounds: they go with an animation, so they stay quiet under reduced motion. */
const FLOURISH = new Set(['complete', 'goal', 'combo', 'levelup']);

/** Play a sound of the set (`n`: the combo's run). True when one was played. */
export function play(name, n) {
  if (!PATTERNS[name] || !soundOn()) return false;
  if (FLOURISH.has(name) && reducedMotion()) return false;
  const c = audio(); if (!c) return false;
  try { PATTERNS[name](c, n); return true; } catch { return false; } // audio is optional
}

/**
 * Vibration patterns in ms (on, off, on…): one tap for right, a soft double for "not yet", a run for the end, a long
 * pulse for the goal, three quick taps for a combo, and two taps and a long one for a level up.
 */
export const HAPTICS = {
  correct: [12],
  wrong: [20, 40, 20],
  complete: [15, 30, 15, 30, 40],
  goal: [30, 50, 60],
  combo: [10, 30, 10, 30, 10],
  levelup: [20, 40, 20, 40, 90],
};

/** The iPhone app's haptics for each kind: Capacitor Haptics method and options (a light tap, a warning, a success). */
export const NATIVE_HAPTICS = {
  correct: ['impact', { style: 'LIGHT' }],
  wrong: ['notification', { type: 'WARNING' }],
  complete: ['notification', { type: 'SUCCESS' }],
  goal: ['notification', { type: 'SUCCESS' }],
  combo: ['impact', { style: 'HEAVY' }],
  levelup: ['notification', { type: 'SUCCESS' }],
  buzz: ['impact', { style: 'MEDIUM' }],
};

/** The phone's own haptics, in the iPhone app only. True when one was asked for. */
function nativeHaptic(kind, env = import.meta.env) {
  if (env.VITE_STORE !== 'ios') return false;
  const h = nativePlugin('Haptics');
  const [method, options] = NATIVE_HAPTICS[kind] || [];
  if (!h || !method) return false;
  Promise.resolve().then(() => h[method](options)).catch(() => { /* optional */ });
  return true;
}

/**
 * Vibrate when the student wants it, the platform can and reduced motion is off: the iPhone app's haptics (`kind`),
 * else navigator.vibrate (Android; Safari has none).
 */
function vibrate(pattern, kind) {
  try {
    if (!useApp.getState().haptics || reducedMotion()) return false;
    if (nativeHaptic(kind)) return true;
    const nav = globalThis.navigator;
    if (!nav || typeof nav.vibrate !== 'function') return false;
    nav.vibrate(pattern);
    return true;
  } catch { return false; } // optional
}

/** The vibration that goes with a sound: 'correct', 'wrong', 'complete', 'goal', 'combo' or 'levelup'. */
export function haptic(kind) {
  const pattern = HAPTICS[kind];
  return pattern ? vibrate(pattern, kind) : false;
}

/** A single short vibration. It follows the vibration setting, not the sound setting. */
export function buzz(ms = 30) {
  return vibrate(ms, 'buzz');
}
