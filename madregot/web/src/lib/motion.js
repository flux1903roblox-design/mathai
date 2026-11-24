// The motion system. One set of durations, easings and springs for the whole app, the same scale as the CSS
// tokens in styles/tokens.css (--duration-*, --ease-*). A component picks a preset by what its motion does
// (a panel settling, a reward popping, a celebration bouncing), not by numbers. Under reduced motion the app's
// MotionConfig and the CSS guards turn movement off; opacity changes stay.

/** Easings: smooth-out for anything arriving or moving into place (--ease-smooth-out), in for anything leaving (--ease-in). */
export const EASE = { out: [0.22, 1, 0.36, 1], in: [0.7, 0, 0.84, 0], inOut: [0.65, 0, 0.35, 1], burst: 'easeOut' };

/** Durations in seconds, mirroring --duration-* (micro 80ms … very-slow 500ms), plus a long draw for paths. */
export const DUR = { stagger: 0.04, micro: 0.08, quick: 0.15, fast: 0.25, medium: 0.35, slow: 0.4, verySlow: 0.5, draw: 0.9 };

/** Springs, by role. */
export const SPRING = {
  /** a panel or sheet arriving: firm, no overshoot (the feedback panel) */
  settle: { type: 'spring', stiffness: 420, damping: 34 },
  /** a reward or chip popping in: a small overshoot (medals, the combo chip, the week's days) */
  pop: { type: 'spring', stiffness: 400, damping: 18 },
  /** a celebration: a bigger overshoot (the streak number, the chest lid, a stair just completed) */
  bounce: { type: 'spring', stiffness: 260, damping: 12 },
  /** a character's limbs and face: soft and quick to settle (the mascot) */
  soft: { type: 'spring', stiffness: 260, damping: 18 },
  /** a slow lean (the mascot tilting his head while thinking) */
  lean: { type: 'spring', stiffness: 120, damping: 14 },
  /** a bar filling up (lesson progress) */
  fill: { type: 'spring', stiffness: 140, damping: 20 },
};

/** A tween into place with the shared easing: enter(DUR.medium, 0.1) */
export const enter = (duration = DUR.medium, delay = 0) => ({ duration, delay, ease: EASE.out });

/** A tween out of the way: quicker than it came, and speeding up as it goes (ux-motion 5, 18). */
export const leave = (duration = DUR.quick, delay = 0) => ({ duration, delay, ease: EASE.in });

/**
 * One thing giving its place to the next (an exercise to the next exercise, a teaching step to the next step), for
 * AnimatePresence mode="wait": the new one slides in from the reading side over `inS`; the old one leaves the other way
 * in half that, so the next exercise is whole on screen sooner (ux-motion 18 and 20: the most-used move is the quickest).
 */
export const swap = (dx = 28, inS = 0.2) => ({
  initial: entrance({ opacity: 0, x: -dx }),
  animate: { opacity: 1, x: 0, transition: enter(inS) },
  exit: { opacity: 0, x: dx, transition: leave(inS / 2) },
});

/** The delay of the i-th item of a list that comes in one after another: 40ms apart, the rest together after six (ux-motion 3). */
export const cascade = (i, each = DUR.stagger, cap = 6) => Math.min(i, cap) * each;

// motion's animation features are not part of the first download (COUNCIL2-14): App.jsx's LazyMotion loads them with
// loadMotionFeatures. Until they arrive an m.* component stays at its `initial` values, so a screen that fades in would
// sit faded and a card that slides in would stay hidden while they load. entrance(from) is a component's start state:
// `from` once the features are here, and before that false (start at the target), so the first screen is drawn whole
// at once and everything that mounts later moves in as before.
let featuresIn = false;
/** LazyMotion's features (App.jsx): domAnimation, from its own file. */
export const loadMotionFeatures = () => import('./motionFeatures.js').then((mod) => { featuresIn = true; return mod.default; });
// Under reduced motion MotionConfig skips the move but an element still mounts at its `initial` offset for the frames
// before the jump: a solve-together step sat 10px low there and a check measured it (the deploy runs of 0653e8c and
// 7aa6529 on GitHub, where motion's features load before the step mounts). So under reduced motion an entrance keeps
// only what is not a move (its fade) and starts in its place.
const MOVES = new Set(['x', 'y', 'scale', 'scaleX', 'scaleY', 'rotate']);
const reduced = () => { try { return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
/** The `initial` of an entrance: `from` once motion's features have loaded, else false (drawn at its target); under
 *  reduced motion, `from` without its moves. */
export const entrance = (from) => {
  if (!featuresIn) return false;
  if (!from || typeof from !== 'object' || !reduced()) return from;
  const still = Object.fromEntries(Object.entries(from).filter(([k]) => !MOVES.has(k)));
  return Object.keys(still).length ? still : false;
};
