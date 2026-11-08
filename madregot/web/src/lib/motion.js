// The motion system. One set of durations, easings and springs for the whole app, the same scale as the CSS
// tokens in styles/tokens.css (--duration-*, --ease-*). A component picks a preset by what its motion does
// (a panel settling, a reward popping, a celebration bouncing), not by numbers. Under reduced motion the app's
// MotionConfig and the CSS guards turn movement off; opacity changes stay.

/** Easings: smooth-out for anything arriving or moving into place (--ease-smooth-out). */
export const EASE = { out: [0.22, 1, 0.36, 1], inOut: [0.65, 0, 0.35, 1], burst: 'easeOut' };

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
