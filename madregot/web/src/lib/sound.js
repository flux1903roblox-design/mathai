// Short feedback sounds made in the browser (no audio files): a rising pair for
// correct, a soft low note for "not yet", a small arpeggio when a lesson ends, a brighter one for the daily goal.
// They play only after the student has tapped something, and only when sound is on.
// Vibration is its own setting (haptics): short, distinct patterns, only where the phone can vibrate and never under
// reduced motion (some people map motion sensitivity to vibration too). In the iPhone app (VITE_STORE=ios) the phone's
// own haptics play instead (Capacitor's Haptics, through lib/native.js): Safari has no navigator.vibrate.
import { useApp } from './store.js';
import { nativePlugin } from './native.js';

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

const PATTERNS = {
  correct: (c) => { tone(c, 784, 0, 0.12, { type: 'triangle' }); tone(c, 1175, 0.09, 0.2, { type: 'triangle' }); },
  wrong: (c) => { tone(c, 247, 0, 0.18, { type: 'sine', gain: 0.14 }); tone(c, 220, 0.12, 0.22, { type: 'sine', gain: 0.12 }); },
  complete: (c) => { [523, 659, 784, 1047].forEach((f, i) => tone(c, f, i * 0.09, 0.22, { type: 'triangle', gain: 0.14 })); },
  // the daily goal: C5, G5, C6, E6, a little higher and longer than the end of a lesson
  goal: (c) => { [523, 784, 1047, 1319].forEach((f, i) => tone(c, f, i * 0.11, 0.26, { type: 'triangle', gain: 0.12 })); },
  combo: (c) => { [880, 1175, 1568].forEach((f, i) => tone(c, f, i * 0.06, 0.14, { type: 'triangle', gain: 0.12 })); },
  tap: (c) => tone(c, 660, 0, 0.05, { type: 'sine', gain: 0.05 }),
};

export function play(name) {
  if (!useApp.getState().sound) return;
  const c = audio(); if (!c) return;
  try { PATTERNS[name]?.(c); } catch { /* audio is optional */ }
}

/** Vibration patterns in ms (on, off, on…): one tap for right, a soft double for "not yet", a run for the end. */
export const HAPTICS = {
  correct: [12],
  wrong: [20, 40, 20],
  complete: [15, 30, 15, 30, 40],
  goal: [30, 50, 60],
};

const reducedMotion = () => {
  try { return typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** The iPhone app's haptics for each kind: Capacitor Haptics method and options (a light tap, a warning, a success). */
export const NATIVE_HAPTICS = {
  correct: ['impact', { style: 'LIGHT' }],
  wrong: ['notification', { type: 'WARNING' }],
  complete: ['notification', { type: 'SUCCESS' }],
  goal: ['notification', { type: 'SUCCESS' }],
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

/** The vibration that goes with a sound: 'correct', 'wrong', 'complete' or 'goal'. */
export function haptic(kind) {
  const pattern = HAPTICS[kind];
  return pattern ? vibrate(pattern, kind) : false;
}

/** A single short vibration. It follows the vibration setting, not the sound setting. */
export function buzz(ms = 30) {
  return vibrate(ms, 'buzz');
}
