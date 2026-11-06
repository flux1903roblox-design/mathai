// Short feedback sounds made in the browser (no audio files): a rising pair for
// correct, a soft low note for "not yet", a small arpeggio when a lesson ends.
// They play only after the student has tapped something, and only when sound is on.
import { useApp } from './store.js';

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
  combo: (c) => { [880, 1175, 1568].forEach((f, i) => tone(c, f, i * 0.06, 0.14, { type: 'triangle', gain: 0.12 })); },
  tap: (c) => tone(c, 660, 0, 0.05, { type: 'sine', gain: 0.05 }),
};

export function play(name) {
  if (!useApp.getState().sound) return;
  const c = audio(); if (!c) return;
  try { PATTERNS[name]?.(c); } catch { /* audio is optional */ }
}

/** A short vibration where the platform allows it (Android); iOS ignores it. */
export function buzz(ms = 30) {
  try { if (useApp.getState().sound && navigator.vibrate) navigator.vibrate(ms); } catch { /* optional */ }
}
