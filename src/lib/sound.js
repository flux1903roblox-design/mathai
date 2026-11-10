// Tiny synthesized UI sounds (no audio files). Brilliant-style audible feedback for right/wrong/complete.
const KEY = 'mathai_sound';
let ctx = null;

export const soundOn = () => localStorage.getItem(KEY) !== 'off';
export const setSoundOn = (on) => localStorage.setItem(KEY, on ? 'on' : 'off');

function tone(freq, start, dur, { type = 'sine', gain = 0.12 } = {}) {
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function play(notes) {
  if (!soundOn()) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    notes.forEach(([f, s, d, o]) => tone(f, s, d, o));
  } catch { /* audio unavailable — stay silent */ }
}

export const sfx = {
  correct: () => play([[784, 0, 0.16], [1175, 0.09, 0.26]]),
  wrong: () => play([[220, 0, 0.18, { type: 'triangle', gain: 0.1 }], [185, 0.1, 0.22, { type: 'triangle', gain: 0.08 }]]),
  tap: () => play([[660, 0, 0.05, { gain: 0.04 }]]),
  complete: () => play([[523, 0, 0.18], [659, 0.1, 0.18], [784, 0.2, 0.18], [1047, 0.3, 0.45]]),
};
