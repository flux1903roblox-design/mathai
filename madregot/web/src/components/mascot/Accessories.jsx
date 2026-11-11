// What מדי wears ("מדי שלי", STUDENT-3; drawn larger and with more character, PRODUCT2-36): one drawing per item, in his
// own viewBox (0 0 146 150). Colours are tokens only: the unit colours, gold, the streak orange and the white of
// on-brand; none of them changes with the theme, like Madi.
// Slots: head on top of the tall step (its top edge is y 30), face across the eyes (y 58), neck right under the mouth
// (from y 95: a scarf wraps round him there and its ends hang down his front, so it reads as a scarf, not a belt), body
// on the low step where his "+" is (104, 95). Pins are a disc of radius 14 with a rim, a shadow and a shine.
// Loaded on demand (Mascot imports it with lazy() only while something is worn; the wardrobe, the chest card and the
// unlock moment import it themselves). `reveal` (the unlock moment): that one item drops onto him with a little bounce
// and a sparkle, once; under reduced motion it is simply there.
import { m, useReducedMotion } from 'motion/react';
import { ITEMS, itemOf } from '@/lib/wardrobe.js';
import { SPRING } from '@/lib/motion.js';

const F = (v) => ({ fill: v });
const S = (v) => ({ stroke: v });
const FS = (f, s) => ({ fill: f, stroke: s });
const WHITE = 'var(--on-brand)';
const GOLD = 'var(--gold)';
const GOLD_D = 'var(--gold-d)';
const ORANGE = 'var(--streak)';
const ch = (c, d = '') => `var(--ch-${c}${d})`;
const round = { strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
const J = { strokeLinejoin: 'round' };
// the shapes, written short (most of this file is shapes): a path with its fill and stroke (tokens), the stroke's width
// and any other attributes; a round-ended line; a circle by its centre and radius
const P = (d, fill, stroke, w, x) => <path d={d} style={{ fill, stroke }} strokeWidth={w} {...x} />;
const L = (d, stroke, w, x) => <path d={d} style={{ stroke }} strokeWidth={w} {...round} {...x} />;
const C = (cx, cy, r, fill, stroke, w, x) => <circle cx={cx} cy={cy} r={r} style={{ fill, stroke }} strokeWidth={w} {...x} />;

/** A pin on the low step: a shadow, a white disc with a rim in the unit's colour, the picture, and a shine. */
function Pin({ c, children, face = WHITE }) {
  return (
    <>
      {C(104.5, 97, 14.5, ch(c, '-d'), undefined, undefined, { opacity: 0.35 })}
      {C(104, 95, 14, face, ch(c, '-d'), 2.6)}
      {children}
      {L('M95 89.5 A11 11 0 0 1 100.5 85', WHITE, 2.2, { opacity: 0.85 })}
    </>
  );
}

/** A scarf wrapped under his mouth: a band that curves round him, a knot, and two ends that hang down his front. */
function Scarf({ main, stripe, stripe2 = stripe, edge, side = 'left', marks = null }) {
  const left = side === 'left';
  const kx = left ? 37 : 77; // the knot
  const tailA = left ? 'M31 106 Q27 116 24 127 L33 129 Q35 118 38 109Z' : 'M83 106 Q87 116 90 127 L81 129 Q79 118 76 109Z';
  const tailB = left ? 'M39 109 Q41 119 42 129 L50 127 Q47 116 44 107Z' : 'M75 109 Q73 119 72 129 L64 127 Q67 116 70 107Z';
  return (
    <>
      {/* the band: wider than him at the sides, where it wraps round, and dipping a little in the middle */}
      {P('M21 95.5 Q57 103.5 93 95.5 Q96 101.5 93 107.5 Q57 115.5 21 107.5 Q18 101.5 21 95.5Z', main, edge, 2, J)}
      {stripe && L('M33 98.6 Q35 104 33 109.8 M66 100.6 Q64 106 66 112', stripe, 4.2)}
      {stripe && L('M48 100.6 Q50 106 48 112 M81 98.6 Q79 104 81 109.8', stripe2, 4.2)}
      {P(tailA, main, edge, 2, J)}
      {P(tailB, main, edge, 2, J)}
      {stripe && L(left ? 'M27 119 L35 120.5' : 'M87 119 L79 120.5', stripe, 3.6)}
      {stripe && L(left ? 'M42 120 L48.5 118.5' : 'M72 120 L65.5 118.5', stripe2, 3.6)}
      {/* fringe at the ends */}
      {L(left ? 'M25 129 V132.5 M28.5 129.6 V133 M32 130 V133.5 M43 128.8 V132.3 M46.5 128.2 V131.7 M50 127.4 V130.9' : 'M89 129 V132.5 M85.5 129.6 V133 M82 130 V133.5 M71 128.8 V132.3 M67.5 128.2 V131.7 M64 127.4 V130.9', edge, 1.8)}
      <ellipse cx={kx} cy="106.5" rx="7.5" ry="6.5" style={FS(main, edge)} strokeWidth="2" />
      {stripe && L(`M${kx - 4} 104 Q${kx} 108 ${kx + 4} 104`, stripe, 2.6)}
      {marks}
    </>
  );
}

const DRAW = {
  // signed numbers: a white scarf striped in the cold blue of the minus side and the warm orange of the plus side,
  // with a − in blue and a + in orange
  'thermo-scarf': () => (
    <Scarf main={WHITE} stripe={ch('sky')} stripe2={ORANGE} edge={ch('sky', '-d')}
      marks={<>{L('M53.5 106.5 H59.5', ch('sky', '-d'), 2.6)}{L('M70.5 105.6 H76.5 M73.5 102.6 V108.6', 'var(--streak-ink)', 2.6)}</>} />
  ),
  'class-scarf': ({ classColor = 'sky' }) => <Scarf main={ch(classColor)} stripe={WHITE} edge={ch(classColor, '-d')} side="right" />,
  'stripe-scarf': () => <Scarf main={ch('violet')} stripe={GOLD} edge={ch('violet', '-d')} side="right" />,
  'compass-cap': () => (
    <>
      {P('M30 31 C30 13 42 4 57 4 C72 4 84 13 84 31Z', ch('fuchsia'), ch('fuchsia', '-d'), 2, J)}
      {L('M38 14 Q46 8 55 7.5', WHITE, 2.4, { opacity: 0.6 })}
      {P('M82 27 Q100 26 106 31.5 Q100 35 82 34.5Z', ch('fuchsia', '-d'))}
      <rect x="25" y="27" width="64" height="7.5" rx="3.75" style={F(ch('fuchsia', '-d'))} />
      {C(57, 17.5, 9.5, WHITE, ch('fuchsia', '-d'), 1.6)}
      {P('M57 9.5 L59.8 17.5 H54.2Z', ORANGE)}
      {P('M57 25.5 L59.8 17.5 H54.2Z', ch('fuchsia', '-d'))}
      {C(57, 17.5, 1.8, GOLD)}
      {C(57, 3.5, 2.6, ch('fuchsia', '-d'))}
    </>
  ),
  'protractor-crown': () => (
    <>
      {P('M28 33 A29 29 0 0 1 86 33Z', ch('petrol'), ch('petrol', '-d'), 2, J)}
      {L('M43 33 A14 14 0 0 1 71 33', WHITE, 2.4)}
      {L('M78.8 22 L83.5 19 M73 13.6 L76.2 9 M65.3 8.6 L66.8 3.4 M57 7 V1.5 M48.7 8.6 L47.2 3.4 M41 13.6 L37.8 9 M35.2 22 L30.5 19', WHITE, 2.2)}
      {L('M57 33 L69 15.5', GOLD, 2.8)}
      <rect x="25" y="29.5" width="64" height="6" rx="3" style={F(ch('petrol', '-d'))} />
      {C(57, 33, 3.4, GOLD, ch('petrol', '-d'), 1.4)}
      {C(57, -2.5, 4, GOLD, ch('petrol', '-d'), 1.6)}
    </>
  ),
  'x-cap': () => (
    <>
      {C(57, 5, 6, GOLD, GOLD_D, 1.6)}
      {P('M31 32 C31 13 43 8 57 8 C71 8 83 13 83 32Z', ch('cobalt'), ch('cobalt', '-d'), 2, J)}
      {L('M39 18 Q46 12.5 53 11.5', WHITE, 2.2, { opacity: 0.5 })}
      <rect x="26" y="27" width="62" height="8.5" rx="4.25" style={F(ch('cobalt', '-d'))} />
      {L('M50.5 13.5 L63.5 24.5 M63.5 13.5 L50.5 24.5', WHITE, 3.6)}
    </>
  ),
  // the first stage: a party hat, a little crooked, with dots and a pompom
  'party-hat': () => (
    <g transform="rotate(8 57 32)">
      {P('M39 33 L58 -3 L76 33Z', ch('violet'), ch('violet', '-d'), 2, J)}
      {L('M45 22 L71 22 M50.5 11.5 L66 11.5', GOLD, 3.4)}
      {C(53, 28, 1.9, WHITE)}{C(63, 27.5, 1.9, WHITE)}{C(58, 16.5, 1.7, WHITE)}
      <rect x="36" y="30.5" width="43" height="5" rx="2.5" style={F(ch('violet', '-d'))} />
      {C(58, -4, 5.5, GOLD, GOLD_D, 1.6)}
      {L('M55.5 -6 Q58 -8.5 60.5 -6', WHITE, 1.6, { opacity: 0.8 })}
    </g>
  ),
  headphones: () => (
    <>
      {L('M22 58 C22 26 36 18 57 18 C78 18 92 26 92 58', ch('cobalt', '-d'), 6.5)}
      {L('M26 46 C28 30 40 23 57 23', ch('cobalt'), 2.4, { opacity: 0.9 })}
      <rect x="13" y="45" width="16" height="25" rx="7" style={FS(ch('cobalt'), ch('cobalt', '-d'))} strokeWidth="2" />
      <rect x="85" y="45" width="16" height="25" rx="7" style={FS(ch('cobalt'), ch('cobalt', '-d'))} strokeWidth="2" />
      {C(21, 57.5, 4.2, GOLD, GOLD_D, 1.3)}
      {C(93, 57.5, 4.2, GOLD, GOLD_D, 1.3)}
      {L('M100 30 V22 L106 20.5 V28.5', GOLD, 2)}
      {C(98.6, 30.5, 2.4, GOLD)}{C(104.6, 29, 2.4, GOLD)}
    </>
  ),
  beanie: () => (
    <>
      {P('M31 30 C31 12 43 6 57 6 C71 6 83 12 83 30Z', ORANGE, 'var(--streak-ink)', 2, J)}
      {L('M44 28 Q43 16 48 9 M57 28 V6.5 M70 28 Q71 16 66 9', 'var(--streak-ink)', 1.6, { opacity: 0.55 })}
      <rect x="27" y="25" width="60" height="11" rx="5.5" style={FS(WHITE, 'var(--streak-ink)')} strokeWidth="2" />
      {L('M33 27.5 V33.5 M39 27.5 V33.5 M45 27.5 V33.5 M51 27.5 V33.5 M57 27.5 V33.5 M63 27.5 V33.5 M69 27.5 V33.5 M75 27.5 V33.5 M81 27.5 V33.5', ORANGE, 1.8)}
      {C(57, 3, 7.5, WHITE, 'var(--streak-ink)', 1.8)}
      {L('M53 1 Q57 -2 61 1 M52.5 5 Q57 2.5 61.5 5', ORANGE, 1.4, { opacity: 0.7 })}
    </>
  ),
  'grad-cap': () => (
    <>
      {P('M37 21 V33 H77 V21', ch('cobalt'), ch('cobalt', '-d'), 2, J)}
      {P('M17 18 L57 5 L97 18 L57 31Z', ch('cobalt', '-d'), ch('cobalt', '-d'), 2, J)}
      {L('M27 18 L57 8.5 L87 18', ch('cobalt'), 1.8, { opacity: 0.9 })}
      {C(57, 18, 2.6, GOLD)}
      {L('M57 18 L88 22 V38', GOLD, 2.2)}
      {P('M85 37 H91 L92.5 45 H83.5Z', GOLD, GOLD_D, 1.2, J)}
    </>
  ),
  'triangle-glasses': () => (
    <g style={S(ch('violet', '-d'))} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
      {/* a flat top across both, the right angle at each outer corner, so his eyes and his look stay his own */}
      {P('M30 45 H57 L30 72Z M84 45 H57 L84 72Z', ch('violet'), undefined, undefined, { fillOpacity: 0.22 })}
      {P('M33.5 49 L36.5 49', undefined, WHITE, 2.2)}
      {P('M30 46.5 L23 50 M84 46.5 L91 50', 'none')}
    </g>
  ),
  'round-glasses': () => (
    <g strokeLinecap="round" strokeLinejoin="round">
      {C(45, 58, 12, WHITE, ch('fuchsia', '-d'), 3, { fillOpacity: 0.18 })}
      {C(69, 58, 12, WHITE, ch('fuchsia', '-d'), 3, { fillOpacity: 0.18 })}
      {P('M54.5 55 Q57 52.5 59.5 55', 'none', ch('fuchsia', '-d'), 2.6)}
      {P('M33 55 L24 51.5 M81 55 L90 51.5', 'none', ch('fuchsia', '-d'), 2.6)}
      {P('M38.5 52 Q40.5 49.5 43.5 49', 'none', WHITE, 2)}
      {P('M62.5 52 Q64.5 49.5 67.5 49', 'none', WHITE, 2)}
    </g>
  ),
  'sun-glasses': () => (
    <g strokeLinecap="round" strokeLinejoin="round">
      {P('M30 49 H55 Q56 61 49 66 Q41 70 34 65 Q29 60 30 49Z', ch('cobalt', '-d'), GOLD_D, 2)}
      {P('M84 49 H59 Q58 61 65 66 Q73 70 80 65 Q85 60 84 49Z', ch('cobalt', '-d'), GOLD_D, 2)}
      {P('M55 51 Q57 49.5 59 51', 'none', GOLD_D, 2.4)}
      {P('M30 50 L22 47 M84 50 L92 47', 'none', GOLD_D, 2.4)}
      {P('M35 53 L41 59 M64 53 L70 59', 'none', WHITE, 2.4, { opacity: 0.75 })}
    </g>
  ),
  'star-glasses': () => (
    <g strokeLinejoin="round">
      {[45, 69].map((x) => (
        <path key={x} d={`M${x} 45.5 L${x + 3.6} 53.2 L${x + 12} 54.2 L${x + 5.8} 60 L${x + 7.4} 68.5 L${x} 64.3 L${x - 7.4} 68.5 L${x - 5.8} 60 L${x - 12} 54.2 L${x - 3.6} 53.2Z`}
          style={{ ...FS(GOLD, GOLD_D), fillOpacity: 0.3 }} strokeWidth="2.8" />
      ))}
      <path d="M53.5 56 Q57 53.5 60.5 56" style={S(GOLD_D)} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M33 54.5 L24 51 M81 54.5 L90 51" style={S(GOLD_D)} strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </g>
  ),
  'slope-tie': () => (
    <>
      {P('M52.5 104 H61.5 L67 120 L57 129 L47 120Z', ch('cobalt'), ch('cobalt', '-d'), 1.8, J)}
      {P('M49.5 95.5 H64.5 L61.5 104 H52.5Z', ch('cobalt', '-d'), ch('cobalt', '-d'), 1.8, J)}
      {L('M51 120 L62.5 108', GOLD, 2.6)}
      {C(51, 120, 2.2, GOLD)}{C(62.5, 108, 2.2, GOLD)}
    </>
  ),
  'bow-tie': () => (
    <>
      {P('M57 102 L39 94 Q35 102 39 110Z', ch('fuchsia'), ch('fuchsia', '-d'), 2, J)}
      {P('M57 102 L75 94 Q79 102 75 110Z', ch('fuchsia'), ch('fuchsia', '-d'), 2, J)}
      {C(44, 99.5, 1.8, WHITE)}{C(45, 105.5, 1.8, WHITE)}
      {C(70, 99.5, 1.8, WHITE)}{C(69, 105.5, 1.8, WHITE)}
      <rect x="52" y="97" width="10" height="10" rx="3.5" style={FS(ch('fuchsia', '-d'), ch('fuchsia', '-d'))} strokeWidth="1" />
      {L('M54.5 99.5 Q57 98.5 59.5 99.5', WHITE, 1.4, { opacity: 0.6 })}
    </>
  ),
  medal: () => (
    <>
      {P('M44 95 L53 112 H61 L70 95 H63 L57 106 L51 95Z', ch('fuchsia'), ch('fuchsia', '-d'), 1.8, J)}
      {L('M47.5 95 L54.5 108.5 M66.5 95 L59.5 108.5', WHITE, 1.8, { opacity: 0.8 })}
      {C(57, 119, 10, GOLD, GOLD_D, 2.2)}
      {C(57, 119, 6.8, 'none', GOLD_D, 1.2, { opacity: 0.7 })}
      {P('M57 113.2 L58.7 116.9 L62.7 117.3 L59.7 120 L60.5 124 L57 122 L53.5 124 L54.3 120 L51.3 117.3 L55.3 116.9Z', WHITE)}
    </>
  ),
  'bars-pin': () => (
    <Pin c="fuchsia">
      {P('M95.6 93.5 h4.8 v8.5 h-4.8Z M101.6 87.5 h4.8 v14.5 h-4.8Z M107.6 91 h4.8 v11 h-4.8Z', ch('fuchsia'))}
      {L('M94 102.5 H114', ch('fuchsia', '-d'), 2)}
    </Pin>
  ),
  'balance-pin': () => (
    <Pin c="violet">
      {L('M104 87 V103 M98.5 103.5 H109.5 M94.5 90 H113.5', ch('violet', '-d'), 2.4)}
      {L('M97 90 L94.5 96 M97 90 L99.5 96 M111 90 L108.5 96 M111 90 L113.5 96', ch('violet', '-d'), 1.4)}
      {P('M93.5 96 Q97 100.5 100.5 96Z M107.5 96 Q111 100.5 114.5 96Z', ch('violet'))}
    </Pin>
  ),
  'cross-pin': () => (
    <Pin c="petrol">
      {L('M94 102.5 L114 87.5', ch('petrol'), 3)}
      {L('M94 88.5 L114 101.5', ch('petrol', '-d'), 3)}
      {C(104, 95, 3.3, GOLD, ch('petrol', '-d'), 1.4)}
    </Pin>
  ),
  // fractions (the bridge unit): a pie in quarters, three of them coloured
  'fraction-pin': () => (
    <Pin c="violet">
      {P('M104 95 V85 A10 10 0 1 1 94 95Z', ch('violet'))}
      {C(104, 95, 10, 'none', ch('violet', '-d'), 1.6)}
      {L('M104 85 V105 M94 95 H114', ch('violet', '-d'), 1.6)}
    </Pin>
  ),
  // ratio and scale: a map's scale bar, its parts in two colours, with a tick at each part
  'scale-pin': () => (
    <Pin c="sky">
      {P('M93.5 91.5 h5.25 v7 h-5.25Z M104 91.5 h5.25 v7 h-5.25Z', ch('sky'))}
      {P('M93.5 91.5 H114.5 V98.5 H93.5Z', 'none', ch('sky', '-d'), 1.6)}
      {L('M93.5 88 V102 M104 88 V102 M114.5 88 V102', ch('sky', '-d'), 1.6)}
    </Pin>
  ),
  // percent: a percent sign
  'percent-pin': () => (
    <Pin c="petrol">
      {C(98.8, 89.8, 3.2, ch('petrol'))}
      {C(109.2, 100.2, 3.2, ch('petrol'))}
      {L('M110.5 88 L97.5 102', ch('petrol', '-d'), 2.6)}
    </Pin>
  ),
  'star-pin': () => (
    <>
      {P('M104.5 81.5 L108.9 90.5 L118.8 91.9 L111.6 98.9 L113.3 108.8 L104.5 104.1 L95.7 108.8 L97.4 98.9 L90.2 91.9 L100.1 90.5Z', GOLD_D, undefined, undefined, { transform: 'translate(0.6 1.6)', opacity: 0.5 })}
      {P('M104 81 L108.4 90 L118.3 91.4 L111.1 98.4 L112.8 108.3 L104 103.6 L95.2 108.3 L96.9 98.4 L89.7 91.4 L99.6 90Z', GOLD, GOLD_D, 2.2, J)}
      {L('M99 92 L101.5 91.5', WHITE, 2.2)}
      {C(101, 96.5, 1.4, 'var(--gold-ink)')}{C(107, 96.5, 1.4, 'var(--gold-ink)')}
      {L('M101.5 100 Q104 102 106.5 100', 'var(--gold-ink)', 1.5)}
    </>
  ),
  'pi-pin': () => (
    <Pin c="petrol">
      {L('M95.5 89.5 Q97 87 100 87.5 H113', ch('petrol', '-d'), 3)}
      {L('M101 88 Q101 97 97.5 103', ch('petrol', '-d'), 3)}
      {L('M108.5 88 V100 Q108.5 103 112 102', ch('petrol', '-d'), 3)}
    </Pin>
  ),
  'bolt-pin': () => (
    <Pin c="cobalt" face={ch('cobalt')}>
      {P('M106.5 84.5 L97.5 97 H103.5 L100.5 106 L111 92.5 H105Z', GOLD, GOLD_D, 1.4, J)}
    </Pin>
  ),
  'infinity-pin': () => (
    <Pin c="violet">
      {L('M104 95 C100 89 93.5 89 93.5 95 C93.5 101 100 101 104 95 C108 89 114.5 89 114.5 95 C114.5 101 108 101 104 95Z', ch('violet'), 3)}
    </Pin>
  ),
};

/** One item, drawn in Madi's own coordinates. */
export function Item({ id, classColor }) {
  const Draw = DRAW[id];
  return Draw ? <g data-item={id}><Draw classColor={classColor} /></g> : null;
}

// where each slot's piece sits; its three sparkles show around it as it arrives
const AT = { head: [57, 20], face: [57, 58], neck: [57, 104], body: [104, 95] };
const SPARKS = [[-32, -12], [34, -16], [30, 18]];
const SPARK = 'M0 -6 C0.8 -1.8 1.8 -0.8 6 0 C1.8 0.8 0.8 1.8 0 6 C-0.8 1.8 -1.8 0.8 -6 0 C-1.8 -0.8 -0.8 -1.8 0 -6Z';

/** The unlock moment's piece: it drops onto Madi from above with a bounce, then three sparkles; still under reduced motion. */
function Arrive({ id, classColor }) {
  const reduce = useReducedMotion();
  const slot = itemOf(id)?.slot || 'head';
  if (reduce) return <Item id={id} classColor={classColor} />;
  return (
    <>
      <m.g data-reveal={id} initial={{ y: -46, opacity: 0, scale: 1.25 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ ...SPRING.bounce, delay: 0.45 }} style={{ originX: 0.5, originY: 0.5 }}>
        <Item id={id} classColor={classColor} />
      </m.g>
      <g style={F(GOLD)}>
        {SPARKS.map(([dx, dy], i) => (
          <m.path key={i} d={SPARK} initial={{ x: AT[slot][0] + dx, y: AT[slot][1] + dy, scale: 0, opacity: 0 }} animate={{ scale: [0, 1.3, 0], opacity: [0, 1, 0] }} transition={{ duration: 0.9, delay: 0.85 + i * 0.12, ease: 'easeOut' }} />
        ))}
      </g>
    </>
  );
}

/** Everything Madi wears, in slot order; the glasses follow where his eyes look (Mascot's LOOK). */
export default function Accessories({ look, eyes = [0, 0], spring, reveal = null }) {
  const one = (id) => (id === reveal ? <Arrive id={id} classColor={look.classColor} /> : <Item id={id} classColor={look.classColor} />);
  return (
    <g className="madi-wear">
      {look.neck && one(look.neck)}
      {look.body && one(look.body)}
      {look.face && (
        <m.g initial={false} animate={{ x: eyes[0], y: eyes[1] }} transition={spring}>
          {one(look.face)}
        </m.g>
      )}
      {look.head && one(look.head)}
    </g>
  );
}

// The part of Madi each slot sits on, for a small picture of one item: x y width height in his viewBox (the bigger
// pieces need the room: a party hat's pompom goes above his top, a scarf's ends hang to his feet).
const BOX = { head: '4 -12 106 54', face: '14 32 86 42', neck: '12 86 90 50', body: '84 76 42 40' };
// his outline behind the item, so the picture shows where it goes
const BODY = 'M43 30 H71 A17 17 0 0 1 88 47 V66 H103 A17 17 0 0 1 120 83 V107 A17 17 0 0 1 103 124 H43 A17 17 0 0 1 26 107 V47 A17 17 0 0 1 43 30Z';

/** A small picture of one item on the part of Madi it goes on (the wardrobe's options, the chest card). */
export function ItemArt({ id, classColor, className }) {
  const it = itemOf(id);
  if (!it) return null;
  return (
    <svg viewBox={BOX[it.slot]} className={className} aria-hidden="true" focusable="false">
      <path d={BODY} style={F('var(--track)')} />
      {it.slot === 'face' && <g style={F('var(--surface)')}><ellipse cx="46" cy="58" rx="10" ry="11" /><ellipse cx="68" cy="58" rx="10" ry="11" /></g>}
      <Item id={id} classColor={classColor} />
    </svg>
  );
}

export const DRAWN = ITEMS.map((i) => i.id).filter((id) => DRAW[id]);
