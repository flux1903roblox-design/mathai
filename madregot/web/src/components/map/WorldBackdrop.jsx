// The entrance to each unit's world: a landscape drawn from the topic, behind the first stairs of the path.
// Signed numbers: a valley of frost (below zero, on the left, as on a number line) and fire (above zero).
// Coordinates: an island on a gridded sea with an X. Angles: sharp peaks with their angles marked, a gear sun.
// Linear functions: a city whose road is a straight line rising at a steady slope. Pythagoras: dunes and
// pyramids built of square blocks. Statistics: market towers of different heights with the mean line across.
// Colours come from the unit (--c, --c-d, --c-tint) through the wb-* classes; drawn for this app.

const Frost = () => (
  <>
    <path d="M0 130 V74 L34 36 L52 54 L86 16 L122 62 L150 48 L196 96 V130 Z" className="wb-frost" />
    <path d="M86 16 L100 32 L92 30 L86 38 L79 30 L72 32 Z M34 36 L44 47 L38 46 L33 51 L28 45 Z" className="wb-white" />
    <path d="M204 96 L238 64 L258 74 L292 30 L314 30 L346 70 L368 58 L400 78 V130 H204 Z" className="wb-fire" />
    <path d="M292 30 Q300 46 293 60 Q307 52 304 38 Q312 50 309 64 Q322 46 314 30 Z" className="wb-lava" />
    <circle cx="300" cy="16" r="3" className="wb-ember" /><circle cx="312" cy="8" r="2" className="wb-ember" /><circle cx="292" cy="6" r="2.4" className="wb-ember" />
    <g className="wb-flake"><path d="M30 14 v12 M24 17 l12 6 M24 23 l12 -6" /><path d="M140 22 v9 M135.5 24.5 l9 4.5 M135.5 29 l9 -4.5" /></g>
    <path d="M0 116 Q100 100 200 114 T400 110 V130 H0 Z" className="wb-ground" />
  </>
);

const Island = () => (
  <>
    <path d="M0 70 H400 V130 H0 Z" className="wb-sea" />
    {[40, 80, 120, 160, 200, 240, 280, 320, 360].map((x) => <path key={x} d={`M${x} 70 V130`} className="wb-gridline" />)}
    {[86, 104, 122].map((y) => <path key={y} d={`M0 ${y} H400`} className="wb-gridline" />)}
    <path d="M0 76 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" className="wb-wave" />
    <path d="M150 100 Q200 70 268 98 Q214 112 150 100 Z" className="wb-sand" />
    <path d="M214 92 Q212 64 222 44" className="wb-trunk" />
    <path d="M222 44 q-20 -6 -30 6 q14 -4 30 -6 q-6 -16 -22 -16 q16 6 22 16 q8 -14 24 -12 q-16 4 -24 12 q20 -2 26 12 q-12 -8 -26 -12 Z" className="wb-leaf" />
    <path d="M240 90 l10 10 M250 90 l-10 10" className="wb-x" />
    <path d="M70 92 h30 l-5 7 h-20 Z M86 92 V70 l12 18 Z" className="wb-boat" />
    <circle cx="350" cy="30" r="16" className="wb-sun" />
  </>
);

const Peaks = () => (
  <>
    <circle cx="330" cy="34" r="20" className="wb-sun" />
    <path d="M330 8 v6 M330 54 v6 M304 34 h6 M350 34 h6 M312 16 l4 4 M344 48 l4 4 M348 16 l-4 4 M316 48 l-4 4" className="wb-gear" />
    <path d="M0 130 V92 L56 34 L104 84 L150 22 L214 96 L262 44 L318 104 L360 66 L400 92 V130 Z" className="wb-far" />
    <path d="M0 130 V110 L80 66 L150 112 L230 70 L300 114 L360 90 L400 106 V130 Z" className="wb-mid" />
    <path d="M150 22 L163 37 L150 33 L137 37 Z M56 34 L67 45 L56 42 L45 45 Z" className="wb-white" />
    <path d="M128 48 A26 26 0 0 1 172 48" className="wb-arc" />
    <path d="M0 122 H400 V130 H0 Z" className="wb-ground" />
  </>
);

const Slopes = () => (
  <>
    <circle cx="60" cy="30" r="15" className="wb-sun" />
    {[[20, 70, 36], [62, 54, 30], [98, 80, 28], [132, 44, 38], [176, 66, 30], [212, 36, 34], [252, 60, 32], [290, 48, 30], [326, 74, 36], [366, 58, 34]].map(([x, y, w]) => (
      <g key={x}>
        <path d={`M${x} 130 V${y} L${x + w} ${y - 10} V130 Z`} className={x % 3 ? 'wb-far' : 'wb-mid'} />
        {[0, 1, 2].map((k) => <rect key={k} x={x + 6} y={y + 6 + k * 14} width={w - 12} height="5" rx="2" className="wb-window" />)}
      </g>
    ))}
    <path d="M0 124 L400 84" className="wb-road" />
    <path d="M0 124 L400 84" className="wb-road-dash" />
    <path d="M0 126 H400 V130 H0 Z" className="wb-ground" />
  </>
);

const Dunes = () => (
  <>
    <circle cx="70" cy="34" r="18" className="wb-sun" />
    <path d="M220 104 L280 40 L340 104 Z" className="wb-far" />
    <path d="M250 72 H310 M235 88 H325 M265 56 H295" className="wb-blocks" />
    <path d="M150 108 L186 70 L222 108 Z" className="wb-mid" />
    <path d="M168 89 H204" className="wb-blocks" />
    <path d="M0 118 Q60 92 130 110 T260 104 T400 112 V130 H0 Z" className="wb-sand" />
    <path d="M0 126 Q90 112 200 122 T400 120 V130 H0 Z" className="wb-ground" />
  </>
);

const Towers = () => {
  const bars = [[30, 74], [74, 52], [118, 86], [162, 40], [206, 64], [250, 30], [294, 70], [338, 50]];
  return (
    <>
      {bars.map(([x, y], i) => (
        <g key={x}>
          <rect x={x} y={y} width="32" height={130 - y} rx="4" className={i % 2 ? 'wb-far' : 'wb-mid'} />
          <path d={`M${x - 3} ${y + 2} h38 l-5 9 h-28 Z`} className={i % 3 === 0 ? 'wb-awning' : 'wb-awning alt'} />
          <path d={`M${x + 16} ${y} v-12 l10 4 l-10 4`} className="wb-flag" />
        </g>
      ))}
      <path d="M0 76 H400" className="wb-mean" />
      <path d="M0 124 H400 V130 H0 Z" className="wb-ground" />
    </>
  );
};

const SCENES = { signed: Frost, coord: Island, angles: Peaks, line: Slopes, pyth: Dunes, stats: Towers };

export default function WorldBackdrop({ topic }) {
  const S = SCENES[topic];
  if (!S) return null;
  return (
    <svg className="world-horizon" viewBox="0 0 400 130" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <S />
    </svg>
  );
}
