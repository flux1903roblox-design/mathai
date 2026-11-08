// The art at the top of a screen: מדי on a two-step stair in the screen's colour, beside one thing that says
// what the screen is for. Drawn for Madregot (no stock illustration), in the page's own colours (--c, --c-d,
// --c-tint) through the sc-* classes, so every screen belongs to the same world as the map and the lessons.
import Mascot from './Mascot.jsx';

const Chest = () => (
  <g transform="translate(14 46)">
    <path d="M6 30 L-2 6 M28 26 V0 M50 30 L58 6" className="sc-rays" />
    <path d="M4 30 h48 v8 H4 Z" className="sc-glow" />
    <path d="M0 32 h56 v24 a5 5 0 0 1 -5 5 H5 a5 5 0 0 1 -5 -5 Z" className="sc-wood" />
    <path d="M0 40 h56 M14 32 v29 M42 32 v29" className="sc-band" />
    <rect x="23" y="35" width="10" height="11" rx="2.5" className="sc-g sc-ink" />
    <path d="M2 30 l2 -16 a10 10 0 0 1 10 -8 h28 a10 10 0 0 1 10 8 l2 16 Z" className="sc-wood light" transform="translate(0 -6) scale(1 0.7)" />
    <circle cx="20" cy="28" r="5" className="sc-g sc-ink" /><circle cx="31" cy="25" r="5" className="sc-g sc-ink" /><circle cx="40" cy="29" r="4" className="sc-g sc-ink" />
  </g>
);

const Sheet = ({ check = true }) => (
  <g transform="translate(10 18) rotate(-6 30 40)">
    <rect x="0" y="0" width="62" height="80" rx="6" className="sc-w sc-line" />
    {[16, 28, 40, 52].map((y) => <path key={y} d={`M10 ${y} H${y === 52 ? 34 : 52}`} className="sc-grid-d" />)}
    {check && (<><circle cx="44" cy="62" r="13" className="sc-good" /><path d="M38 62 l4 4 l8 -9" className="sc-stroke-w" /></>)}
  </g>
);

const Scan = () => (
  <g transform="translate(16 14)">
    <rect x="0" y="0" width="56" height="92" rx="12" className="sc-d" />
    <rect x="5" y="9" width="46" height="70" rx="5" className="sc-t" />
    <rect x="13" y="20" width="30" height="40" rx="3" className="sc-w" />
    {[28, 36, 44].map((y) => <path key={y} d={`M18 ${y} H38`} className="sc-grid-d" />)}
    <path d="M10 18 v-5 h5 M46 18 v-5 h-5 M10 62 v5 h5 M46 62 v5 h-5" className="sc-stroke-c" />
    <circle cx="28" cy="85" r="3" className="sc-w" />
  </g>
);

const Print = () => (
  <g>
    <Sheet check={false} />
    <g transform="translate(58 30) rotate(35)">
      <rect x="0" y="0" width="9" height="46" rx="2" className="sc-g sc-ink" />
      <path d="M0 46 l4.5 10 l4.5 -10 Z" className="sc-w sc-ink" />
      <rect x="0" y="-6" width="9" height="7" rx="2" className="sc-c" />
    </g>
  </g>
);

const Climb = () => (
  <g transform="translate(6 20)">
    {[0, 1, 2, 3].map((i) => <rect key={i} x={i * 16} y={70 - i * 16} width="16" height={16 + i * 16} rx="3" className={i < 2 ? 'sc-c' : 'sc-t sc-line'} />)}
    <path d="M58 22 V-4 l16 6 l-16 6" className="sc-flag" />
    <path d="M6 64 C 20 40, 36 50, 50 20" className="sc-route" />
  </g>
);

const Bubble = () => (
  <g transform="translate(6 10)">
    <path d="M6 0 h64 a10 10 0 0 1 10 10 v30 a10 10 0 0 1 -10 10 h-36 l-12 12 v-12 h-16 a10 10 0 0 1 -10 -10 v-30 a10 10 0 0 1 10 -10 Z" className="sc-w sc-line" />
    <text x="40" y="33" textAnchor="middle" className="sc-math">x² = 9</text>
    <path d="M74 -2 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z" className="sc-g" />
  </g>
);

const Worlds = () => (
  <g transform="translate(4 16)">
    <g transform="rotate(-8 40 40)"><rect x="0" y="10" width="58" height="44" rx="8" className="sc-w sc-line" /><path d="M4 50 V30 l12 -12 l8 8 l12 -14 l18 22 V50 Z" className="sc-frost" /><path d="M30 50 l10 -16 l6 6 l8 -10 V50 Z" className="sc-fire" /></g>
    <g transform="translate(14 24) rotate(4 30 30)"><rect x="0" y="10" width="58" height="44" rx="8" className="sc-w sc-line" /><path d="M4 30 H54 V50 H4 Z" className="sc-sea" /><path d="M14 30 V50 M24 30 V50 M34 30 V50 M44 30 V50" className="sc-grid-d" /><path d="M20 30 q10 -10 22 0 Z" className="sc-sand" /></g>
  </g>
);

const Board = () => (
  <g transform="translate(6 12)">
    <rect x="0" y="0" width="84" height="58" rx="6" className="sc-d" />
    <rect x="5" y="5" width="74" height="48" rx="3" className="sc-w" />
    <path d="M12 44 H72 M12 44 V10" className="sc-grid-d" />
    <path d="M14 40 L30 32 L44 34 L58 20 L70 14" className="sc-stroke-c" />
    <path d="M40 58 l-8 14 M44 58 l8 14" className="sc-stroke" />
  </g>
);

const Tray = () => (
  <g transform="translate(10 50)">
    <path d="M0 10 h70 l-8 26 H8 Z" className="sc-t sc-line" />
    <path d="M14 22 H56" className="sc-grid-d" />
  </g>
);

const PROPS = { quests: Chest, exams: Sheet, check: Scan, practice: Print, plan: Climb, assistant: Bubble, topics: Worlds, teacher: Board, empty: Tray };

export default function PageScene({ name, mood = 'idle' }) {
  const Prop = PROPS[name];
  return (
    <div className="scene">
      <svg viewBox="0 0 160 130" className="scene-art" aria-hidden="true" focusable="false">
        {Prop && <Prop />}
        {/* the stair מדי stands on */}
        <rect x="22" y="114" width="126" height="16" rx="5" className="sc-t sc-line" />
        <rect x="84" y="100" width="64" height="18" rx="5" className="sc-c" />
        <path d="M90 104 H142" className="sc-stroke-w" opacity="0.5" />
      </svg>
      <Mascot mood={mood} size={74} className="scene-mascot" />
    </div>
  );
}
