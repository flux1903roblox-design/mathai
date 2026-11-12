// The maths burst (the student plan's M1, PKG-3): a short shower of + − × ÷ = in the app's own colours, on the two rare
// moments only: a new colour for מדי (a whole unit completed, UnlockStage) and the class goal reached (ClassGoalMoment).
// Never on an answer.
// - Nothing plays, and nothing is loaded, under the system's reduced motion, on a hidden page, or with the app's own
//   sounds off (the store's `sound`; Settings › צלילים says so). Sounds off is the app's quiet mode: a student who joins
//   a class starts with it ("a classroom is quiet", quietForClass), so a burst does not fly across a classroom screen
//   unless the student chose sounds. The app has no motion setting of its own (haptics already follow reduced motion).
// - canvas-confetti is imported here only, on the first burst (budget.json lazyOnly keeps it out of the first load).
// - It draws on a canvas of its own, never the library's shared one: `canvas.math-burst` (canon.css), fixed over the
//   screen with pointer-events none, aria-hidden, so it never takes a tap, the focus or a screen reader's attention. The
//   canvas goes when the burst ends (under 3 seconds) or when stop() runs (the moment closes first).
// - Its colours are the tokens --brand, --gold and --good as the page has them now, so dark mode uses its own values.
import { useApp } from '@/lib/store.js';

const SYMBOLS = ['+', '−', '×', '÷', '='];
const TOKENS = ['--brand', '--gold', '--good'];
const FONT = '"Rubik Variable", sans-serif';
const SCALAR = 2;
/** One burst: 36 symbols, 160 frames at most (under 3 s at 60 fps). */
export const BURST = { particleCount: 36, spread: 70, startVelocity: 32, ticks: 160, scalar: SCALAR, disableForReducedMotion: true };

let lib = null;
/** canvas-confetti, imported once; a failed import is tried again next time. */
function load() {
  lib = lib || import('canvas-confetti').then((m) => m.default || m, (e) => { lib = null; throw e; });
  return lib;
}

/** May a burst play now? Not under reduced motion, not on a hidden page, not with the app's sounds off (`sound`). */
export function burstAllowed({ win = globalThis.window, doc = globalThis.document, sound = useApp.getState().sound } = {}) {
  return sound !== false && !!doc && !doc.hidden && !win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

/** The centre of an element as a fraction of the window (canvas-confetti's origin); a little above the middle without one. */
export function originOf(el, win = globalThis.window) {
  const r = el?.getBoundingClientRect?.();
  const w = win?.innerWidth; const h = win?.innerHeight;
  if (!r || !w || !h) return { x: 0.5, y: 0.35 };
  const clamp = (v) => Math.min(1, Math.max(0, v));
  return { x: clamp((r.left + r.width / 2) / w), y: clamp((r.top + r.height / 2) / h) };
}

/** The symbols in the token colours. A text shape needs OffscreenCanvas: without it, plain confetti in the same colours. */
function looks(confetti, win, doc) {
  const css = win.getComputedStyle(doc.documentElement);
  const colors = TOKENS.map((t) => css.getPropertyValue(t).trim()).filter(Boolean);
  if (!colors.length) return {};
  try {
    return { shapes: colors.flatMap((color) => SYMBOLS.map((text) => confetti.shapeFromText({ text, scalar: SCALAR, color, fontFamily: FONT }))) };
  } catch {
    return { colors };
  }
}

/**
 * Play one burst from the centre of `fromEl`. Returns stop(): it ends the burst at once and removes the canvas (call it
 * when the moment closes). `stop.done` resolves when the burst is over: true when it played, false when it did not.
 */
export function mathBurst(fromEl, { win = globalThis.window, doc = globalThis.document, sound } = {}) {
  let stopped = false; let canvas = null; let fire = null;
  const remove = () => { canvas?.remove(); canvas = null; };
  const stop = () => {
    stopped = true;
    try { fire?.reset(); } catch { /* already over */ }
    remove();
  };
  if (!burstAllowed({ win, doc, sound })) {
    stop.done = Promise.resolve(false);
    return stop;
  }
  stop.done = (async () => {
    try {
      const confetti = await load();
      if (stopped || doc.hidden) return false;
      canvas = doc.createElement('canvas');
      canvas.className = 'math-burst';
      canvas.setAttribute('aria-hidden', 'true');
      doc.body.appendChild(canvas);
      fire = confetti.create(canvas, { resize: true, useWorker: false, disableForReducedMotion: true });
      await fire({ ...BURST, origin: originOf(fromEl, win), ...looks(confetti, win, doc) });
      return !stopped;
    } catch {
      return false; // a decoration: a chunk that did not load, or a canvas the browser refused, changes nothing else
    } finally {
      remove();
    }
  })();
  return stop;
}
