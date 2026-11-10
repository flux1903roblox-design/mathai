// The world around each unit of the map, drawn from the topic itself: a thermometer and the sea
// line for signed numbers, a treasure grid for coordinates, a protractor for angles, slope stairs
// for linear functions, the squares on a right triangle for Pythagoras, a bar-chart skyline for
// statistics, tiles and brackets for expressions, a balance for equations, two crossing lines for systems. Colours
// come from the unit (--c, --c-d, --c-tint) through the sc-* classes. The first piece is the unit's emblem on its
// banner; the second and third sit beside its path (Learn.jsx), so every topic has three.

const Thermometer = () => (
  <svg viewBox="0 0 96 110">
    <rect x="36" y="6" width="24" height="78" rx="12" className="sc-w sc-line" />
    <rect x="43" y="40" width="10" height="46" rx="5" className="sc-c" />
    <circle cx="48" cy="90" r="15" className="sc-c sc-line" />
    <circle cx="44" cy="86" r="4" className="sc-w" opacity="0.5" />
    {[16, 26, 36, 46, 56, 66].map((y) => <path key={y} d={`M62 ${y} H${y === 46 ? 76 : 70}`} className="sc-stroke" />)}
    <path d="M62 46 H78" className="sc-stroke-gold" />
  </svg>
);
const SeaLevel = () => (
  <svg viewBox="0 0 110 96">
    <path d="M58 40 V14 L78 38 Z" className="sc-w sc-line" />
    <path d="M40 42 H82 L76 52 H46 Z" className="sc-d" />
    <path d="M4 58 Q16 50 28 58 T52 58 T76 58 T100 58 V96 H4 Z" className="sc-t" />
    <path d="M4 58 Q16 50 28 58 T52 58 T76 58 T100 58" className="sc-stroke" />
    <path d="M30 78 Q42 68 54 78 Q42 88 30 78 Z M54 78 L62 72 V84 Z" className="sc-c" />
    <circle cx="37" cy="77" r="2" className="sc-w" />
  </svg>
);
const Cloud = () => (
  <svg viewBox="0 0 100 64">
    <path d="M22 50 H80 A14 14 0 0 0 76 23 A20 20 0 0 0 38 18 A16 16 0 0 0 22 50 Z" className="sc-t" />
    <path d="M22 50 H80 A14 14 0 0 0 76 23 A20 20 0 0 0 38 18 A16 16 0 0 0 22 50 Z" className="sc-none sc-line" />
    <circle cx="40" cy="34" r="5" className="sc-w" opacity="0.8" />
  </svg>
);

const GridMap = () => (
  <svg viewBox="0 0 100 100">
    <rect x="6" y="6" width="88" height="88" rx="14" className="sc-w sc-line" />
    {[24, 42, 58, 76].map((v) => <path key={v} d={`M${v} 12 V88 M12 ${v} H88`} className="sc-grid" />)}
    <path d="M50 12 V88 M12 50 H88" className="sc-stroke" />
    <path d="M24 76 Q34 60 42 66 T64 40 T76 24" className="sc-route" />
    <circle cx="24" cy="76" r="5" className="sc-c" />
    <path d="M70 18 L82 30 M82 18 L70 30" className="sc-stroke-gold" />
  </svg>
);
const Compass = () => (
  <svg viewBox="0 0 96 96">
    <circle cx="48" cy="48" r="38" className="sc-w sc-line" />
    <circle cx="48" cy="48" r="30" className="sc-t" />
    <path d="M48 16 L57 48 L48 52 L39 48 Z" className="sc-c" />
    <path d="M48 80 L57 48 L48 44 L39 48 Z" className="sc-d" opacity="0.35" />
    <circle cx="48" cy="48" r="5" className="sc-g" />
  </svg>
);
const Pin = () => (
  <svg viewBox="0 0 80 100">
    <ellipse cx="40" cy="90" rx="18" ry="5" className="sc-t" />
    <path d="M40 88 C22 64 12 52 12 36 A28 28 0 0 1 68 36 C68 52 58 64 40 88 Z" className="sc-c" />
    <circle cx="40" cy="36" r="11" className="sc-w" />
  </svg>
);

const Protractor = () => (
  <svg viewBox="0 0 110 70">
    <path d="M8 62 A47 47 0 0 1 102 62 Z" className="sc-w sc-line" />
    <path d="M30 62 A25 25 0 0 1 80 62" className="sc-grid" />
    {[0, 30, 60, 90, 120, 150, 180].map((a) => { const r = (a * Math.PI) / 180; return <path key={a} d={`M${55 + 40 * Math.cos(r)} ${62 - 40 * Math.sin(r)} L${55 + 46 * Math.cos(r)} ${62 - 46 * Math.sin(r)}`} className="sc-stroke" />; })}
    <path d="M55 62 L88 30" className="sc-stroke-c" />
    <path d="M73 62 A18 18 0 0 0 68 49" className="sc-stroke-gold" />
  </svg>
);
const Peaks = () => (
  <svg viewBox="0 0 120 84">
    <path d="M4 80 L40 22 L76 80 Z" className="sc-c" />
    <path d="M44 80 L80 30 L116 80 Z" className="sc-d" />
    <path d="M32 35 L40 22 L48 35 L44 32 L40 37 L36 32 Z" className="sc-w" />
    <path d="M73 40 L80 30 L87 40 L83 37 L80 41 L77 37 Z" className="sc-w" />
    <path d="M18 80 A14 14 0 0 1 21 72" className="sc-stroke-gold" />
  </svg>
);
const Kite = () => (
  <svg viewBox="0 0 90 110">
    <path d="M45 6 L72 36 L45 76 L18 36 Z" className="sc-c" />
    <path d="M45 6 L45 76 M18 36 H72" className="sc-stroke-w" />
    <path d="M45 76 Q38 88 46 96 T44 108" className="sc-stroke" />
    <path d="M40 88 l-6 -3 0 6 Z M47 99 l6 -3 0 6Z" className="sc-g" />
  </svg>
);

const SlopeSteps = () => (
  <svg viewBox="0 0 100 100">
    <rect x="6" y="6" width="88" height="88" rx="14" className="sc-w sc-line" />
    {[28, 50, 72].map((v) => <path key={v} d={`M${v} 12 V88 M12 ${v} H88`} className="sc-grid" />)}
    <path d="M16 82 L84 18" className="sc-stroke-c" />
    <path d="M28 71 H50 V50 H72 V29" className="sc-stroke-gold" />
    <circle cx="28" cy="71" r="4.5" className="sc-d" />
    <circle cx="72" cy="29" r="4.5" className="sc-d" />
  </svg>
);
const FlagHill = () => (
  <svg viewBox="0 0 120 84">
    <path d="M2 82 Q30 40 60 46 T118 82 Z" className="sc-t" />
    <path d="M14 76 L88 34" className="sc-stroke-c" />
    <path d="M88 34 V8" className="sc-stroke" />
    <path d="M88 8 L108 15 L88 22 Z" className="sc-g" />
  </svg>
);
const Plane = () => (
  <svg viewBox="0 0 110 80">
    <path d="M6 70 L60 34" className="sc-route" />
    <path d="M62 32 L104 10 L84 52 L74 38 Z" className="sc-w sc-line" />
    <path d="M74 38 L104 10 L70 46 Z" className="sc-c" />
  </svg>
);

const Squares = () => (
  <svg viewBox="0 0 110 110">
    <path d="M40 70 L40 46 L72 70 Z" className="sc-w sc-line" />
    <rect x="16" y="46" width="24" height="24" className="sc-t sc-line" />
    <rect x="40" y="70" width="32" height="32" className="sc-c" />
    <path d="M40 46 L72 70 L96 38 L64 14 Z" className="sc-g" />
    <path d="M40 64 H46 V70" className="sc-stroke" />
  </svg>
);
const Ladder = () => (
  <svg viewBox="0 0 100 110">
    <rect x="62" y="6" width="30" height="98" rx="4" className="sc-t" />
    {[20, 40, 60, 80].map((y) => <path key={y} d={`M62 ${y} H92 M77 ${y} V${y + 20}`} className="sc-grid" />)}
    <path d="M8 104 H96" className="sc-stroke" />
    <path d="M20 104 L60 14 M34 104 L72 18" className="sc-stroke-c" />
    {[0, 1, 2, 3].map((k) => { const t = 0.2 + k * 0.2; return <path key={k} d={`M${20 + 40 * t} ${104 - 90 * t} L${34 + 38 * t} ${104 - 86 * t}`} className="sc-stroke-c" />; })}
  </svg>
);
const Pyramid = () => (
  <svg viewBox="0 0 120 84">
    <circle cx="96" cy="20" r="12" className="sc-g" />
    <path d="M6 80 L52 18 L98 80 Z" className="sc-c" />
    <path d="M52 18 L98 80 L66 80 Z" className="sc-d" />
    <path d="M22 66 H40 M30 52 H48" className="sc-stroke-w" />
  </svg>
);

const BarSkyline = () => (
  <svg viewBox="0 0 110 100">
    <path d="M6 94 H104" className="sc-stroke" />
    <rect x="12" y="52" width="18" height="42" rx="4" className="sc-t sc-line" />
    <rect x="36" y="30" width="18" height="64" rx="4" className="sc-c" />
    <rect x="60" y="62" width="18" height="32" rx="4" className="sc-d" />
    <rect x="84" y="16" width="18" height="78" rx="4" className="sc-g" />
    <path d="M21 46 L45 24 L69 56 L93 10" className="sc-route" />
  </svg>
);
const PieSun = () => (
  <svg viewBox="0 0 96 96">
    <circle cx="48" cy="48" r="36" className="sc-t" />
    <path d="M48 48 L48 12 A36 36 0 0 1 82 60 Z" className="sc-c" />
    <path d="M48 48 L82 60 A36 36 0 0 1 30 79 Z" className="sc-g" />
    <circle cx="48" cy="48" r="36" className="sc-line sc-none" />
  </svg>
);
const Dice = () => (
  <svg viewBox="0 0 110 80">
    <g transform="rotate(-10 30 44)"><rect x="8" y="22" width="44" height="44" rx="10" className="sc-w sc-line" />{[[20, 34], [40, 54], [30, 44]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="4" className="sc-d" />)}</g>
    <g transform="rotate(12 80 44)"><rect x="58" y="20" width="44" height="44" rx="10" className="sc-c" />{[[70, 32], [90, 32], [70, 52], [90, 52]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="4" className="sc-w" />)}</g>
  </svg>
);

// Algebra.
/** Algebraic expressions: tiles, two x bars and three units, in a bracket. */
const ExprTiles = () => (
  <svg viewBox="0 0 100 100">
    <path d="M14 18 Q4 50 14 82" className="sc-stroke" />
    <path d="M86 18 Q96 50 86 82" className="sc-stroke" />
    <rect x="22" y="20" width="16" height="60" rx="5" className="sc-c" />
    <rect x="42" y="20" width="16" height="60" rx="5" className="sc-c" />
    {[22, 42, 62].map((y) => <rect key={y} x="64" y={y} width="16" height="16" rx="4" className="sc-w sc-line" />)}
  </svg>
);
/** Expressions: a box with an x on its side, the unknown inside. */
const XBox = () => (
  <svg viewBox="0 0 100 100">
    <ellipse cx="50" cy="88" rx="36" ry="6" className="sc-t" />
    <rect x="20" y="36" width="60" height="50" rx="6" className="sc-w sc-line" />
    <rect x="14" y="22" width="72" height="16" rx="5" className="sc-c" />
    <path d="M40 48 L60 74 M60 48 L40 74" className="sc-stroke-c" />
  </svg>
);
/** Expressions: a pair of round brackets around two terms. */
const Brackets = () => (
  <svg viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="40" className="sc-t" />
    <path d="M32 18 Q14 50 32 82" className="sc-stroke-c" />
    <path d="M68 18 Q86 50 68 82" className="sc-stroke-c" />
    <circle cx="41" cy="50" r="8" className="sc-d" />
    <circle cx="59" cy="50" r="8" className="sc-g" />
  </svg>
);
/** Equations: a balance, a box on one pan and weights on the other. */
const EqScale = () => (
  <svg viewBox="0 0 100 100">
    <path d="M50 46 L38 84 H62 Z" className="sc-d" />
    <rect x="30" y="82" width="40" height="8" rx="4" className="sc-d" />
    <rect x="8" y="42" width="84" height="7" rx="3.5" className="sc-d" />
    <rect x="6" y="34" width="34" height="6" rx="3" className="sc-d" />
    <rect x="60" y="34" width="34" height="6" rx="3" className="sc-d" />
    <rect x="14" y="12" width="20" height="20" rx="4" className="sc-c" />
    <rect x="64" y="20" width="8" height="12" rx="2" className="sc-t sc-line" />
    <rect x="76" y="14" width="8" height="18" rx="2" className="sc-t sc-line" />
  </svg>
);
/** Equations: a level plank on a triangle, the same weight on each end. */
const Seesaw = () => (
  <svg viewBox="0 0 110 84">
    <path d="M4 80 H106" className="sc-stroke" />
    <path d="M55 44 L40 78 H70 Z" className="sc-d" />
    <rect x="6" y="38" width="98" height="8" rx="4" className="sc-c" />
    <rect x="12" y="18" width="20" height="20" rx="4" className="sc-w sc-line" />
    <circle cx="88" cy="28" r="10" className="sc-g" />
  </svg>
);
/** Equations: solving unlocks, a keyhole and its key. */
const Keyhole = () => (
  <svg viewBox="0 0 100 100">
    <circle cx="46" cy="46" r="38" className="sc-t" />
    <circle cx="46" cy="46" r="28" className="sc-w sc-line" />
    <circle cx="46" cy="40" r="8" className="sc-d" />
    <path d="M42 44 H50 L54 62 H38 Z" className="sc-d" />
    <path d="M70 70 L88 88 M80 80 L86 74 M84 84 L90 78" className="sc-stroke-gold" />
    <circle cx="68" cy="68" r="7" className="sc-g" />
  </svg>
);
/** Systems and inequalities: two lines crossing at a point. */
const SysCross = () => (
  <svg viewBox="0 0 100 100">
    <rect x="6" y="6" width="88" height="88" rx="14" className="sc-w sc-line" />
    <path d="M14 80 L86 26" className="sc-stroke-c" />
    <path d="M14 30 L86 76" className="sc-stroke" />
    <circle cx="50" cy="53" r="7" className="sc-g" />
  </svg>
);

/** Systems: two dotted roads that cross once. */
const TwoRoads = () => (
  <svg viewBox="0 0 110 90">
    <ellipse cx="55" cy="46" rx="50" ry="36" className="sc-t" />
    <path d="M10 80 C44 80 66 10 100 10" className="sc-route" />
    <path d="M10 10 C44 10 66 80 100 80" className="sc-route" />
    <circle cx="10" cy="80" r="5" className="sc-c" />
    <circle cx="10" cy="10" r="5" className="sc-d" />
    <circle cx="100" cy="10" r="5" className="sc-c" />
    <circle cx="100" cy="80" r="5" className="sc-d" />
  </svg>
);
/** Systems: two points on two lines that meet under a small flag. */
const MeetFlag = () => (
  <svg viewBox="0 0 100 100">
    <path d="M8 90 L50 62" className="sc-stroke-c" />
    <path d="M92 90 L50 62" className="sc-stroke" />
    <circle cx="23" cy="80" r="6" className="sc-c" />
    <circle cx="77" cy="80" r="6" className="sc-d" />
    <path d="M50 62 V16" className="sc-stroke" />
    <path d="M50 16 L76 25 L50 34 Z" className="sc-g" />
    <circle cx="50" cy="62" r="6" className="sc-w sc-line" />
  </svg>
);

export const SCENERY = {
  signed: [Thermometer, SeaLevel, Cloud],
  coord: [GridMap, Compass, Pin],
  angles: [Protractor, Peaks, Kite],
  line: [SlopeSteps, FlagHill, Plane],
  pyth: [Squares, Ladder, Pyramid],
  stats: [BarSkyline, PieSun, Dice],
  expr: [ExprTiles, XBox, Brackets],
  eq: [EqScale, Seesaw, Keyhole],
  sys: [SysCross, TwoRoads, MeetFlag],
};

/** The unit's own sign for its header: the first piece of its world. */
export function Emblem({ topic }) {
  const E = SCENERY[topic]?.[0];
  return E ? <span className="emblem" aria-hidden="true"><E /></span> : null;
}
