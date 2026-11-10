import { lazy, Suspense, useEffect, useId, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import clsx from 'clsx';
import { SPRING } from '@/lib/motion.js';
import { useMadiLook } from '@/lib/madiLook.js';
import { MADI_PALETTE, SLOTS } from '@/lib/wardrobe.js';

// What he wears (STUDENT-3) loads only when he wears something, so the boot bundle does not grow for anyone else.
const Accessories = lazy(() => import('./mascot/Accessories.jsx'));

/**
 * מדי, the Madregot mascot: a two-step stair block with a face, the shape of climbing one stair at a time.
 * Moods follow what just happened in the app:
 *   idle        breathing and blinking (waiting with you)
 *   happy       a hop and a wave (a right answer)
 *   thinking    head tilted, eyes up, a question bubble (a question in progress)
 *   encouraging a lean and a thumbs up (after a wrong answer)
 *   excited     two jumps and sparkles (a finished lesson)
 *   achievement a gold star held high (a milestone: a unit, a streak, a placement)
 * Older names still work: cheer → happy, think → thinking, oops → encouraging.
 * `beat` replays the reaction when the same mood fires again (each right answer).
 * His look (a colour and up to four items, "מדי שלי") comes from the student's MadiLookProvider (lib/madiLook.js);
 * `look` draws another one instead (the wardrobe's options, the unlock moment).
 */
const ALIAS = { cheer: 'happy', think: 'thinking', oops: 'encouraging' };

// Madi is a drawing: his face, the star he holds and his thought bubble keep these colours in both themes (the face
// sits on his own blue body, which does not change with the theme).
const INK = '#001526'; // colour-ok: Madi's face ink, on his blue body
const WHITE = '#fff'; // colour-ok: Madi's eyes, teeth and thought bubble
const TONGUE = '#ff7aa8'; // colour-ok: Madi illustration
const STAR_HI = '#fff6c7'; const STAR_LO = '#f5b400'; const STAR_LINE = '#d39600'; // colour-ok: Madi illustration
const FLOOR = '#231d5c'; // colour-ok: Madi's ground shadow
const BUBBLE_LINE = '#d9dae6'; const QMARK = '#5b4ff0'; // colour-ok: Madi illustration
// His own colour lives in tokens.css (--madi-*), so it is set in one place. The fallbacks are never used.
const HI = { stopColor: 'var(--madi-hi, #7a70ff)' }; // colour-ok: fallback only
const LO = { stopColor: 'var(--madi-lo, #5246ea)' }; // colour-ok: fallback only
const EDGE = 'var(--madi-edge, #3f33c4)'; // colour-ok: fallback only
const TREAD = 'var(--madi-tread, #a49dff)'; // colour-ok: fallback only
const LIMB = 'var(--madi-limb, #3f33c4)'; // colour-ok: fallback only
const MARK = 'var(--madi-mark, rgba(255, 255, 255, 0.45))'; // colour-ok: fallback only
const BLUSH = 'var(--madi-blush, #ff8fb8)'; // colour-ok: fallback only
const ARMS = {
  //       left arm (shoulder 28,86)            right arm (shoulder 116,90)
  idle: ['M28 86 Q18 94 17 105', 'M116 90 Q126 98 127 109'],
  happy: ['M28 86 Q18 94 17 105', 'M116 88 Q131 74 131 56'],
  thinking: ['M28 86 Q32 101 46 95', 'M116 90 Q126 98 127 109'],
  encouraging: ['M28 86 Q18 94 17 105', 'M116 90 Q132 86 131 68'],
  excited: ['M28 84 Q14 70 13 52', 'M116 88 Q131 72 133 54'],
  achievement: ['M28 84 Q15 72 15 55', 'M116 86 Q129 64 124 42'],
};
const HAND = { idle: [[17, 105], [127, 109]], happy: [[17, 105], [131, 56]], thinking: [[46, 95], [127, 109]], encouraging: [[17, 105], [131, 66]], excited: [[13, 52], [133, 54]], achievement: [[15, 55], [124, 40]] };
const BROWS = {
  idle: ['M38 44 Q46 40 54 44', 'M60 44 Q68 40 76 44'],
  happy: ['M38 41 Q46 36 54 41', 'M60 41 Q68 36 76 41'],
  thinking: ['M38 41 Q46 35 54 40', 'M60 46 Q68 45 76 46'],
  encouraging: ['M38 45 Q46 43 54 39', 'M60 39 Q68 43 76 45'],
  excited: ['M38 40 Q46 34 54 40', 'M60 40 Q68 34 76 40'],
  achievement: ['M38 40 Q46 34 54 40', 'M60 40 Q68 34 76 40'],
};
const LOOK = { idle: [0, 0], happy: [0, 0], thinking: [-3, -3.5], encouraging: [0, 1.5], excited: [0, 0], achievement: [0, -1] };

const IDLE = { y: [0, -2.4, 0], scaleY: [1, 1.018, 1], rotate: 0, transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } };
const REACT = {
  idle: IDLE,
  happy: { y: [0, -14, 0, -5, 0], scaleY: [1, 1.04, 0.95, 1.02, 1], rotate: 0, transition: { duration: 0.85, times: [0, 0.3, 0.55, 0.78, 1], ease: 'easeOut' } },
  thinking: { y: [0, -1.5, 0], rotate: -4, scaleY: 1, transition: { y: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }, rotate: SPRING.lean } },
  encouraging: { y: 0, rotate: [0, 5, 2.5], scaleY: [1, 0.97, 1], transition: { duration: 0.7, ease: 'easeOut' } },
  excited: { y: [0, -18, 0, -18, 0], scaleY: [1, 1.05, 0.94, 1.05, 1], rotate: [0, -3, 0, 3, 0], transition: { duration: 1.2, times: [0, 0.22, 0.5, 0.72, 1], ease: 'easeOut' } },
  achievement: { y: [0, -16, 0], scaleY: [1, 1.05, 1], rotate: 0, transition: { duration: 0.9, ease: 'easeOut' } },
};
const SPARKLE = 'M0 -7 C1 -2 2 -1 7 0 C2 1 1 2 0 7 C-1 2 -2 1 -7 0 C-2 -1 -1 -2 0 -7Z';

function Mouth({ mood }) {
  switch (mood) {
    case 'happy':
      return <><path d="M47 78 H67 Q67 92 57 92 Q47 92 47 78 Z" fill={INK} /><path d="M51 88 Q57 84 63 88 Q60 91 57 91 Q54 91 51 88Z" fill={TONGUE} /></>;
    case 'excited':
      return <><ellipse cx="57" cy="84" rx="7.5" ry="8.5" fill={INK} /><ellipse cx="57" cy="89" rx="4.5" ry="3" fill={TONGUE} /></>;
    case 'achievement':
      return <><path d="M45 77 H69 Q69 94 57 94 Q45 94 45 77 Z" fill={INK} /><rect x="48" y="77" width="18" height="4.5" rx="2" fill={WHITE} /></>;
    case 'thinking':
      return <path d="M51 85 Q57 81.5 63 84" stroke={INK} strokeWidth="3.4" strokeLinecap="round" fill="none" />;
    case 'encouraging':
      return <path d="M46 80 Q57 91 68 80" stroke={INK} strokeWidth="3.6" strokeLinecap="round" fill="none" />;
    default:
      return <path d="M48 80 Q57 88 66 80" stroke={INK} strokeWidth="3.6" strokeLinecap="round" fill="none" />;
  }
}

export default function Mascot({ mood: moodIn = 'idle', size = 120, className, title, beat = 0, look: lookIn }) {
  const mood = ALIAS[moodIn] || (REACT[moodIn] ? moodIn : 'idle');
  const own = useMadiLook();
  const look = lookIn || own;
  // a colour other than the default sets his --madi-* tokens on this drawing only (the defaults live in tokens.css)
  const pal = look.color && look.color !== 'sky' ? MADI_PALETTE[look.color] : null;
  const colours = pal ? { '--madi-hi': pal.hi, '--madi-lo': pal.lo, '--madi-edge': pal.edge, '--madi-tread': pal.tread, '--madi-limb': pal.limb } : undefined;
  const dressed = SLOTS.some((s) => look[s]);
  const reduce = useReducedMotion();
  const id = useId().replace(/:/g, '');
  const [rest, setRest] = useState(false);
  const [blink, setBlink] = useState(false);
  useEffect(() => { setRest(false); }, [mood, beat]);
  // A blink every few seconds: alive without asking for attention.
  useEffect(() => {
    if (reduce) return undefined;
    let t; let u;
    const loop = () => { t = setTimeout(() => { setBlink(true); u = setTimeout(() => { setBlink(false); loop(); }, 140); }, 2600 + Math.random() * 2800); };
    loop();
    return () => { clearTimeout(t); clearTimeout(u); };
  }, [reduce]);

  const body = reduce ? { y: 0, scaleY: 1, rotate: mood === 'thinking' ? -4 : 0 } : rest ? IDLE : REACT[mood];
  const [lx, ly] = LOOK[mood];
  const spring = reduce ? { duration: 0 } : SPRING.soft;
  const hands = HAND[mood];
  const showSparkles = mood === 'excited' || mood === 'achievement' || mood === 'happy';

  return (
    <svg
      viewBox="0 0 146 150" width={size} height={size * (150 / 146)}
      className={clsx('mascot', `mascot-${mood}`, className)} style={colours}
      role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}
    >
      <defs>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={HI} /><stop offset="1" style={LO} />
        </linearGradient>
        <radialGradient id={`s${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={STAR_HI} /><stop offset="1" stopColor={STAR_LO} />
        </radialGradient>
      </defs>

      {/* ground shadow: shrinks as he jumps */}
      <m.ellipse cx="72" cy="140" rx="46" ry="5" fill={FLOOR} opacity="0.12"
        animate={reduce || rest || mood === 'idle' || mood === 'thinking' || mood === 'encouraging' ? { scaleX: 1 } : { scaleX: [1, 0.8, 1, 0.85, 1] }}
        transition={{ duration: 1, ease: 'easeOut' }} style={{ originX: 0.5, originY: 0.5 }} />

      <AnimatePresence>
        {showSparkles && !reduce && (
          <m.g key={`sp-${beat}-${mood}`} fill={`var(--gold, ${STAR_LO})`} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} exit={{ opacity: 0 }}
            transition={{ duration: mood === 'happy' ? 1 : 1.8, repeat: mood === 'happy' ? 0 : 1, ease: 'easeOut' }}>
            <m.path d={SPARKLE} transform="translate(12 30)" animate={{ scale: [0.4, 1.2, 0.8] }} transition={{ duration: 0.9, repeat: 2 }} />
            <m.path d={SPARKLE} transform="translate(132 22) scale(0.8)" animate={{ scale: [0.3, 1, 0.6] }} transition={{ duration: 0.8, delay: 0.15, repeat: 2 }} />
            <m.path d={SPARKLE} transform="translate(138 70) scale(0.6)" animate={{ scale: [0.3, 1, 0.5] }} transition={{ duration: 0.7, delay: 0.3, repeat: 2 }} />
          </m.g>
        )}
      </AnimatePresence>

      <m.g animate={body} onAnimationComplete={() => { if (!rest && !reduce && ['happy', 'excited', 'achievement', 'encouraging'].includes(mood)) setRest(true); }}
        style={{ originX: 0.5, originY: 1 }}>
        {/* arms behind the body */}
        <g style={{ stroke: LIMB }} strokeWidth="8.5" strokeLinecap="round" fill="none">
          <m.path initial={false} animate={{ d: ARMS[mood][0] }} transition={spring} />
          <m.path initial={false} animate={{ d: ARMS[mood][1] }} transition={spring} />
        </g>
        {/* the 3D edge, then the two steps */}
        <g style={{ fill: EDGE }}>
          <rect x="26" y="36" width="62" height="94" rx="17" />
          <rect x="26" y="72" width="94" height="58" rx="17" />
        </g>
        <g fill={`url(#b${id})`}>
          <rect x="26" y="30" width="62" height="94" rx="17" />
          <rect x="26" y="66" width="94" height="58" rx="17" />
        </g>
        {/* treads catch the light; a soft highlight on the tall step */}
        <g style={{ fill: TREAD }}>
          <rect x="35" y="34" width="44" height="6" rx="3" />
          <rect x="93" y="70" width="20" height="6" rx="3" />
        </g>
        <ellipse cx="40" cy="58" rx="7" ry="13" fill={WHITE} opacity="0.12" />
        {/* a plus sign on the low step: the maths in him (a pin worn there covers it) */}
        {!look.body && <path d="M104 88 V102 M97 95 H111" style={{ stroke: MARK }} strokeWidth="4" strokeLinecap="round" />}
        {/* feet */}
        <g style={{ fill: LIMB }}>
          <rect x="34" y="124" width="22" height="12" rx="6" />
          <rect x="92" y="124" width="22" height="12" rx="6" />
        </g>
        {/* hands */}
        <g style={{ fill: LIMB }}>
          <m.circle r="6" initial={false} animate={{ cx: hands[0][0], cy: hands[0][1] }} transition={spring} />
          <m.circle r="6" initial={false} animate={{ cx: hands[1][0], cy: hands[1][1] }} transition={spring} />
        </g>
        {mood === 'encouraging' && (
          <m.rect x="128" y="54" width="6" height="11" rx="3" style={{ fill: LIMB, originX: 0.5, originY: 1 }} initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, ...spring }} />
        )}

        {/* face */}
        <m.g animate={{ scaleY: blink ? 0.12 : 1 }} transition={{ duration: 0.07 }} style={{ originX: 0.5, originY: 0.5 }}>
          <ellipse cx="46" cy="58" rx="10" ry="11" fill={WHITE} />
          <ellipse cx="68" cy="58" rx="10" ry="11" fill={WHITE} />
          <m.g initial={false} animate={{ x: lx, y: ly }} transition={spring}>
            <circle cx="47" cy="60" r="5.2" fill={INK} />
            <circle cx="69" cy="60" r="5.2" fill={INK} />
            <circle cx="49" cy="57.6" r="1.8" fill={WHITE} />
            <circle cx="71" cy="57.6" r="1.8" fill={WHITE} />
          </m.g>
        </m.g>
        <g stroke={INK} strokeWidth="3.2" strokeLinecap="round" fill="none">
          <m.path initial={false} animate={{ d: BROWS[mood][0] }} transition={spring} />
          <m.path initial={false} animate={{ d: BROWS[mood][1] }} transition={spring} />
        </g>
        <circle cx="35" cy="76" r="5" style={{ fill: BLUSH }} opacity="0.75" />
        <circle cx="79" cy="76" r="5" style={{ fill: BLUSH }} opacity="0.75" />
        <AnimatePresence initial={false}>
          <m.g key={mood} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ duration: reduce ? 0 : 0.18 }} style={{ originX: 0.5, originY: 0.5 }}>
            <Mouth mood={mood} />
          </m.g>
        </AnimatePresence>

        {/* the star he holds up for a milestone */}
        {mood === 'achievement' && (
          <m.g initial={reduce ? false : { scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...SPRING.bounce, delay: 0.15 }} style={{ originX: 0.5, originY: 0.5 }}>
            <path d="M124 14 l4.6 9.4 10.4 1.5 -7.5 7.3 1.8 10.3 -9.3 -4.9 -9.3 4.9 1.8 -10.3 -7.5 -7.3 10.4 -1.5Z" fill={`url(#s${id})`} stroke={STAR_LINE} strokeWidth="2" strokeLinejoin="round" />
          </m.g>
        )}
        {/* what he wears, last, so it moves with every hop */}
        {dressed && <Suspense fallback={null}><Accessories look={look} eyes={[lx, ly]} spring={spring} /></Suspense>}
      </m.g>

      {/* a question bubble while he thinks */}
      <AnimatePresence>
        {mood === 'thinking' && (
          <m.g key="q" initial={{ opacity: 0, y: 6 }} animate={reduce ? { opacity: 1, y: 0 } : { opacity: 1, y: [0, -3, 0] }} exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0 } : { opacity: { duration: 0.2 }, y: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } }}>
            <circle cx="98" cy="44" r="3" fill={WHITE} stroke={BUBBLE_LINE} strokeWidth="2" />
            <circle cx="106" cy="33" r="4.5" fill={WHITE} stroke={BUBBLE_LINE} strokeWidth="2" />
            <circle cx="124" cy="17" r="13" fill={WHITE} stroke={BUBBLE_LINE} strokeWidth="2" />
            <path d="M119.5 13.5 Q119.5 8.5 124.5 8.5 Q129.5 8.5 129.5 13 Q129.5 16 125.5 17.8 Q124.5 18.3 124.5 20.5" stroke={QMARK} strokeWidth="3.2" strokeLinecap="round" fill="none" />
            <circle cx="124.5" cy="25" r="2" fill={QMARK} />
          </m.g>
        )}
      </AnimatePresence>
    </svg>
  );
}
