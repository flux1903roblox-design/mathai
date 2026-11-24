// The unit's emblem: the first piece of its world (components/map/Scenery.jsx), on its banner on the path and on
// every screen that names a unit. On their own so the first screen draws them without the other drawings, which sit
// beside the path and load after it (Scenery.jsx; moved off the first load at the product2 merge). Colours come from
// the unit (--c, --c-d, --c-tint) through the sc-* classes.

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

const Protractor = () => (
  <svg viewBox="0 0 110 70">
    <path d="M8 62 A47 47 0 0 1 102 62 Z" className="sc-w sc-line" />
    <path d="M30 62 A25 25 0 0 1 80 62" className="sc-grid" />
    {[0, 30, 60, 90, 120, 150, 180].map((a) => { const r = (a * Math.PI) / 180; return <path key={a} d={`M${55 + 40 * Math.cos(r)} ${62 - 40 * Math.sin(r)} L${55 + 46 * Math.cos(r)} ${62 - 46 * Math.sin(r)}`} className="sc-stroke" />; })}
    <path d="M55 62 L88 30" className="sc-stroke-c" />
    <path d="M73 62 A18 18 0 0 0 68 49" className="sc-stroke-gold" />
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

const Squares = () => (
  <svg viewBox="0 0 110 110">
    <path d="M40 70 L40 46 L72 70 Z" className="sc-w sc-line" />
    <rect x="16" y="46" width="24" height="24" className="sc-t sc-line" />
    <rect x="40" y="70" width="32" height="32" className="sc-c" />
    <path d="M40 46 L72 70 L96 38 L64 14 Z" className="sc-g" />
    <path d="M40 64 H46 V70" className="sc-stroke" />
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

/** Fractions and decimals: a bar cut into four, three parts shaded, over a number line with its marks. */
const FracBarArt = () => (
  <svg viewBox="0 0 100 100">
    <rect x="8" y="22" width="84" height="30" rx="6" className="sc-w sc-line" />
    <rect x="8" y="22" width="63" height="30" rx="6" className="sc-c" />
    {[29, 50, 71].map((x) => <path key={x} d={`M${x} 22 V52`} className="sc-stroke" />)}
    <path d="M8 74 H92" className="sc-stroke" />
    {[8, 29, 50, 71, 92].map((x) => <path key={x} d={`M${x} 68 V80`} className="sc-stroke" />)}
    <circle cx="71" cy="74" r="6" className="sc-g" />
  </svg>
);

/** Ratio and scale: a route between two places on a map, over the map's scale bar (its parts in two colours). */
const ScaleBarArt = () => (
  <svg viewBox="0 0 100 100">
    <path d="M18 34 Q40 14 58 32 T84 28" className="sc-stroke" strokeDasharray="6 6" />
    <circle cx="18" cy="34" r="7" className="sc-g" />
    <circle cx="84" cy="28" r="7" className="sc-c" />
    <rect x="10" y="60" width="80" height="14" className="sc-w sc-line" />
    {[10, 50].map((x) => <rect key={x} x={x} y="60" width="20" height="14" className="sc-c" />)}
    {[10, 30, 50, 70, 90].map((x) => <path key={x} d={`M${x} 54 V80`} className="sc-stroke" />)}
  </svg>
);

/** Percent: the percent bar, filled to 60% with a tick at every 20%, over a percent sign. */
const PctBarArt = () => (
  <svg viewBox="0 0 100 100">
    <rect x="8" y="18" width="84" height="26" rx="6" className="sc-w sc-line" />
    <rect x="8" y="18" width="50" height="26" rx="6" className="sc-c" />
    {[25, 41, 58, 75].map((x) => <path key={x} d={`M${x} 12 V18`} className="sc-stroke" />)}
    <circle cx="36" cy="66" r="8" className="sc-g" />
    <circle cx="64" cy="86" r="8" className="sc-g" />
    <path d="M70 58 L30 94" className="sc-stroke-c" />
  </svg>
);

/**
 * Functions: a graph of a walk on its two axes, a climb, a flat part and the way back down, a dot where it ends. No hill
 * or road behind it: a graph that looks like a landscape would teach the misconception the unit repairs.
 */
const WalkGraph = () => (
  <svg viewBox="0 0 100 100">
    <rect x="6" y="6" width="88" height="88" rx="14" className="sc-w sc-line" />
    <path d="M20 18 V80 H86 M16 24 L20 16 L24 24 M80 76 L88 80 L80 84" className="sc-stroke" />
    <path d="M20 80 L38 36 H58 L76 80" className="sc-stroke-c" />
    <circle cx="76" cy="80" r="5.5" className="sc-g" />
  </svg>
);

/** Areas and perimeters: an L shaded on a grid, one of its cells outlined (area counts the squares inside). */
const GridL = () => (
  <svg viewBox="0 0 100 100">
    <rect x="6" y="6" width="88" height="88" rx="14" className="sc-w sc-line" />
    <path d="M18 18 H50 V50 H82 V82 H18 Z" className="sc-t" />
    {[34, 50, 66].map((v) => <path key={v} d={`M${v} 14 V86 M14 ${v} H86`} className="sc-grid" />)}
    <path d="M18 18 H50 V50 H82 V82 H18 Z" className="sc-none sc-line" />
    <rect x="18" y="66" width="16" height="16" className="sc-c" />
    <circle cx="74" cy="26" r="6" className="sc-g" />
  </svg>
);

/** Boxes and prisms: a box with its front opened down flat, the net unfolding from it (the inside lighter). */
const BoxNet = () => (
  <svg viewBox="0 0 100 100">
    <path d="M18 30 L34 18 H80 L64 30 Z" className="sc-t sc-line" />
    <path d="M64 30 L80 18 V52 L64 64 Z" className="sc-d" />
    <rect x="18" y="30" width="46" height="34" className="sc-w sc-line" />
    <path d="M18 30 L34 18 V52 L18 64" className="sc-grid" />
    <rect x="18" y="64" width="46" height="26" className="sc-c" />
    <path d="M18 64 H64" className="sc-stroke-w" />
  </svg>
);

/** The circle: a wheel with its radius drawn, and one turn of it unrolled along the line under it (a little past 3 diameters). */
const WheelRoll = () => (
  <svg viewBox="0 0 100 100">
    <circle cx="30" cy="44" r="20" className="sc-t sc-line" />
    <path d="M30 44 H50" className="sc-stroke" />
    <circle cx="30" cy="44" r="3.5" className="sc-c" />
    <path d="M10 78 H92" className="sc-grid" />
    <path d="M10 78 H86" className="sc-stroke-c" />
    <path d="M10 72 V84 M50 72 V84 M90 72 V84" className="sc-stroke" />
  </svg>
);

/** Pythagoras in space: a box with its diagonal in the accent tone, from a bottom corner to the far top corner. */
const BoxDiagonal = () => (
  <svg viewBox="0 0 100 100">
    <path d="M14 40 L32 26 H86 L68 40 Z" className="sc-t sc-line" />
    <path d="M68 40 L86 26 V68 L68 82 Z" className="sc-d" />
    <rect x="14" y="40" width="54" height="42" className="sc-w sc-line" />
    <path d="M14 82 L32 68 H86 M32 68 V26" className="sc-grid" />
    <path d="M14 82 L86 26" className="sc-stroke-c" />
    <circle cx="14" cy="82" r="4" className="sc-g" />
    <circle cx="86" cy="26" r="4" className="sc-g" />
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

/** Data: a clipboard with a three-row frequency table, its tally marks in groups of five (the fifth stroke across). */
const TallyBoard = () => (
  <svg viewBox="0 0 100 100">
    <rect x="16" y="12" width="68" height="82" rx="10" className="sc-w sc-line" />
    <rect x="36" y="6" width="28" height="14" rx="5" className="sc-c sc-line" />
    {[34, 56, 78].map((y) => <path key={y} d={`M24 ${y + 9} H76`} className="sc-grid" />)}
    {[[34, 7], [56, 4], [78, 6]].map(([y, n]) => (
      <g key={y}>
        <circle cx="30" cy={y} r="4.5" className="sc-c" />
        {Array.from({ length: Math.min(n, 4) }, (_, k) => <path key={k} d={`M${42 + 6 * k} ${y - 7} V${y + 7}`} className="sc-stroke" />)}
        {n >= 5 && <path d={`M38 ${y + 6} L66 ${y - 6}`} className="sc-stroke-c" />}
        {Array.from({ length: Math.max(0, n - 5) }, (_, k) => <path key={`r${k}`} d={`M${70 + 6 * k} ${y - 7} V${y + 7}`} className="sc-stroke" />)}
      </g>
    ))}
  </svg>
);

// Probability.
/**
 * The emblem: a wheel of four sectors, two of them one colour, a centre pin and a large pointer at the top. The pointer
 * tells it from stats' pie and the fractions' eighths at 24 px, and the wheel is not a loading spinner.
 */
const WheelPointer = () => (
  <svg viewBox="0 0 100 100">
    <circle cx="50" cy="56" r="38" className="sc-w sc-line" />
    <path d="M50 56 L50 18 A38 38 0 0 1 88 56 Z" className="sc-c" />
    <path d="M50 56 L12 56 A38 38 0 0 1 50 18 Z" className="sc-t" />
    <path d="M50 56 L50 94 A38 38 0 0 1 12 56 Z" className="sc-c" />
    <path d="M50 18 V94 M12 56 H88" className="sc-stroke" />
    <circle cx="50" cy="56" r="38" className="sc-line sc-none" />
    <path d="M50 30 L40 4 H60 Z" className="sc-d sc-line" />
    <circle cx="50" cy="56" r="6" className="sc-g sc-line" />
  </svg>
);

// transformations (GEOM-4): a flag and its mirror image across a dashed line (the emblem), a small L turned about a dot
// three times with a curved arrow, and a piece of a tiling: three hexagons and the six triangles between them (HexTiling:
// the areas unit's TileFloor is a floor of square tiles)
const MirrorFlag = () => (
  <svg viewBox="0 0 110 96">
    <path d="M55 6 V90" className="sc-route" />
    <path d="M38 84 V18" className="sc-stroke" />
    <path d="M38 18 L14 27 L38 36 Z" className="sc-c" />
    <path d="M72 84 V18" className="sc-stroke" />
    <path d="M72 18 L96 27 L72 36 Z" className="sc-t sc-line" />
    <path d="M28 86 H48 M62 86 H82" className="sc-stroke" />
  </svg>
);

// congruent triangles (GEOM-5): two triangles, the second the mirror image of the first, with matching tick marks and
// arcs (the emblem); a pair of compasses (מחוגה) copying a segment; a roof truss of congruent triangles
const TwinTriangles = () => (
  <svg viewBox="0 0 112 92">
    <path d="M8 80 L48 80 L20 18 Z" className="sc-c sc-line" />
    <path d="M104 80 L64 80 L92 18 Z" className="sc-t sc-line" />
    {/* one tick on the bases, two on the long sides, and the same arc at the base corner of each */}
    <path d="M28 76 V84 M84 76 V84" className="sc-stroke" />
    <path d="M30 47 L38 45 M31 51 L39 49 M82 47 L74 45 M81 51 L73 49" className="sc-stroke" />
    <path d="M40 80 A8 8 0 0 0 44 72" className="sc-stroke-gold" />
    <path d="M72 80 A8 8 0 0 1 68 72" className="sc-stroke-gold" />
  </svg>
);

// isosceles triangles and similarity (GEOM-6): a small triangle inside a large one, sharing the top vertex, with
// parallel bases (the emblem); a person and a palm tree with their shadows under one sun ray; an isosceles tent with
// its dashed axis of symmetry
const NestedTriangles = () => (
  <svg viewBox="0 0 108 92">
    <path d="M54 8 L100 84 L8 84 Z" className="sc-t sc-line" />
    <path d="M54 8 L77 46 L31 46 Z" className="sc-c" />
    {/* the two bases are parallel: one arrow mark on each */}
    <path d="M31 46 H77" className="sc-stroke" />
    <path d="M50 42 L55 46 L50 50" className="sc-stroke" />
    <path d="M50 80 L55 84 L50 88" className="sc-stroke" />
    <path d="M60 18 A12 12 0 0 1 48 18" className="sc-stroke-gold" />
  </svg>
);

/** The first piece of each unit's world, by topic. */
export const EMBLEMS = {
  signed: Thermometer,
  coord: GridMap,
  angles: Protractor,
  transf: MirrorFlag,
  line: SlopeSteps,
  pyth: Squares,
  stats: BarSkyline,
  congr: TwinTriangles,
  sim: NestedTriangles,
  expr: ExprTiles,
  area: GridL,
  solid: BoxNet,
  circle: WheelRoll,
  eq: EqScale,
  sys: SysCross,
  space: BoxDiagonal,
  frac: FracBarArt,
  ratio: ScaleBarArt,
  pct: PctBarArt,
  func: WalkGraph,
  data: TallyBoard,
  prob: WheelPointer,
};

/** The unit's own sign for its header: the first piece of its world. */
export function Emblem({ topic }) {
  const E = EMBLEMS[topic];
  return E ? <span className="emblem" aria-hidden="true"><E /></span> : null;
}
