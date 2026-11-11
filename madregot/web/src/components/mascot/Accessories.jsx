// What מדי wears ("מדי שלי", STUDENT-3): one small drawing per item, in his own viewBox (0 0 146 150). Colours are
// tokens only: the unit's colour, gold, and the white of on-brand; none of them changes with the theme, like Madi.
// Slots: head on top of the tall step (y 30), face across the eyes (y 58), neck under the mouth (y 96 to 106, so it
// never covers his face), body on the low step where his "+" is (104, 95). Loaded on demand (Mascot imports it with
// lazy() only while something is worn; the wardrobe and the chest card import it themselves).
import { m } from 'motion/react';
import { ITEMS, itemOf } from '@/lib/wardrobe.js';

const F = (v) => ({ fill: v });
const S = (v) => ({ stroke: v });
const WHITE = 'var(--on-brand)';
const GOLD = 'var(--gold)';
const ch = (c, d = '') => `var(--ch-${c}${d})`;
const round = { strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };

/** A scarf band across the tall step, under the mouth: four stripes (signed: cold − and warm +) or one colour. */
function Band({ stripes }) {
  return stripes.map(([d, fill], i) => <path key={i} d={d} style={F(fill)} />);
}

const DRAW = {
  'thermo-scarf': () => (
    <>
      <path d="M66 104 H75 L77 119 H68Z" style={F(ch('sky'))} />
      <path d="M66.8 110 H75.8 L76.3 114 H67.3Z" style={F('var(--streak)')} />
      <Band stripes={[['M29 96 H40 V106 H29 A5 5 0 0 1 29 96Z', ch('sky')], ['M40 96 H57 V106 H40Z', 'var(--streak)'], ['M57 96 H73 V106 H57Z', ch('sky')], ['M73 96 H85 A5 5 0 0 1 85 106 H73Z', 'var(--streak)']]} />
      <path d="M29.5 101 H34.5 M46 101 H51 M48.5 98.5 V103.5 M62.5 101 H67.5 M78.5 101 H83.5 M81 98.5 V103.5" style={S(WHITE)} strokeWidth="2" {...round} />
    </>
  ),
  'compass-cap': () => (
    <>
      <path d="M34 30 C34 15 44 8 57 8 C70 8 80 15 80 30Z" style={{ ...F(ch('fuchsia')), ...S(ch('fuchsia', '-d')) }} strokeWidth="1.5" />
      <path d="M80 27.5 Q95 27 100 31.5 Q95 34 80 33.5Z" style={F(ch('fuchsia', '-d'))} />
      <rect x="28" y="27" width="58" height="6" rx="3" style={F(ch('fuchsia', '-d'))} />
      <path d="M57 11 L59.6 19 L57 27 L54.4 19Z M49 19 L57 16.4 L65 19 L57 21.6Z" style={F(WHITE)} />
      <path d="M57 11 L59.6 19 H54.4Z" style={F(GOLD)} />
      <circle cx="57" cy="19" r="1.6" style={F(ch('fuchsia', '-d'))} />
    </>
  ),
  'protractor-crown': () => (
    <>
      <path d="M33 31 A24 24 0 0 1 81 31Z" style={{ ...F(ch('petrol')), ...S(ch('petrol', '-d')) }} strokeWidth="1.5" />
      <path d="M46 31 A11 11 0 0 1 68 31 M70 23.5 L75.2 20.5 M64.5 18 L67.5 12.8 M57 16 V10 M49.5 18 L46.5 12.8 M44 23.5 L38.8 20.5" style={S(WHITE)} strokeWidth="2" {...round} />
      <rect x="30" y="28" width="54" height="5" rx="2.5" style={F(ch('petrol', '-d'))} />
      <circle cx="57" cy="7" r="3.2" style={{ ...F(GOLD), ...S(ch('petrol', '-d')) }} strokeWidth="1.5" />
    </>
  ),
  'x-cap': () => (
    <>
      <circle cx="57" cy="8.5" r="4.5" style={F(GOLD)} />
      <path d="M35 30 C35 14 45 10 57 10 C69 10 79 14 79 30Z" style={{ ...F(ch('cobalt')), ...S(ch('cobalt', '-d')) }} strokeWidth="1.5" />
      <rect x="30" y="26" width="54" height="7" rx="3.5" style={F(ch('cobalt', '-d'))} />
      <path d="M51.5 14.5 L62.5 23.5 M62.5 14.5 L51.5 23.5" style={S(WHITE)} strokeWidth="3" {...round} />
    </>
  ),
  'triangle-glasses': () => (
    <g style={S(ch('violet', '-d'))} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
      {/* a flat top across both, the right angle at each outer corner, so his eyes and his look stay his own */}
      <path d="M32 46 H57 L32 71Z M82 46 H57 L82 71Z" style={F(ch('violet'))} fillOpacity="0.2" />
      <path d="M32 47 L26 50 M82 47 L88 50" fill="none" />
    </g>
  ),
  'slope-tie': () => (
    <>
      <path d="M54 102 H60 L64.5 115 L57 122 L49.5 115Z" style={F(ch('cobalt'))} />
      <path d="M51.5 95 H62.5 L60 102 H54Z" style={F(ch('cobalt', '-d'))} />
      <path d="M52.5 115 L61.5 106" style={S(GOLD)} strokeWidth="2.2" {...round} />
      <circle cx="52.5" cy="115" r="1.7" style={F(GOLD)} /><circle cx="61.5" cy="106" r="1.7" style={F(GOLD)} />
    </>
  ),
  'bars-pin': () => (
    <>
      <circle cx="104" cy="95" r="10.5" style={{ ...F(WHITE), ...S(ch('fuchsia', '-d')) }} strokeWidth="2" />
      <path d="M97.6 94 h3.6 v6.5 h-3.6Z M102.2 89.5 h3.6 v11 h-3.6Z M106.8 92 h3.6 v8.5 h-3.6Z" style={F(ch('fuchsia'))} />
      <path d="M96.5 100.5 H111.5" style={S(ch('fuchsia', '-d'))} strokeWidth="1.5" {...round} />
    </>
  ),
  'balance-pin': () => (
    <>
      <circle cx="104" cy="95" r="11" style={{ ...F(WHITE), ...S(ch('violet', '-d')) }} strokeWidth="2" />
      <path d="M104 89 V101 M100 101.5 H108 M96.5 91.5 H111.5" style={S(ch('violet', '-d'))} strokeWidth="2" {...round} />
      <path d="M98 91.5 L96 96 M98 91.5 L100 96 M110 91.5 L108 96 M110 91.5 L112 96" style={S(ch('violet', '-d'))} strokeWidth="1.2" {...round} />
      <path d="M95 96 Q98 99.5 101 96Z M107 96 Q110 99.5 113 96Z" style={F(ch('violet'))} />
    </>
  ),
  'cross-pin': () => (
    <>
      <circle cx="104" cy="95" r="10.5" style={{ ...F(WHITE), ...S(ch('petrol', '-d')) }} strokeWidth="2" />
      <path d="M96 101 L112 89" style={S(ch('petrol'))} strokeWidth="2.4" {...round} />
      <path d="M96 90 L112 100" style={S(ch('petrol', '-d'))} strokeWidth="2.4" {...round} />
      <circle cx="104" cy="95" r="2.6" style={{ ...F(GOLD), ...S(ch('petrol', '-d')) }} strokeWidth="1.2" />
    </>
  ),
  // fractions (the bridge unit): a pie in quarters, three of them coloured
  'fraction-pin': () => (
    <>
      <circle cx="104" cy="95" r="10.5" style={{ ...F(WHITE), ...S(ch('violet', '-d')) }} strokeWidth="2" />
      <path d="M104 95 V87.5 A7.5 7.5 0 1 1 96.5 95Z" style={F(ch('violet'))} />
      <circle cx="104" cy="95" r="7.5" style={S(ch('violet', '-d'))} strokeWidth="1.2" fill="none" />
      <path d="M104 87.5 V102.5 M96.5 95 H111.5" style={S(ch('violet', '-d'))} strokeWidth="1.2" {...round} />
    </>
  ),
  // ratio and scale: a map's scale bar, its parts in two colours, with a tick at each part
  'scale-pin': () => (
    <>
      <circle cx="104" cy="95" r="10.5" style={{ ...F(WHITE), ...S(ch('sky', '-d')) }} strokeWidth="2" />
      <path d="M96 92.5 h4 v5 h-4Z M104 92.5 h4 v5 h-4Z" style={F(ch('sky'))} />
      <path d="M96 92.5 H112 V97.5 H96Z" style={S(ch('sky', '-d'))} strokeWidth="1.2" fill="none" />
      <path d="M96 90 V100 M104 90 V100 M112 90 V100" style={S(ch('sky', '-d'))} strokeWidth="1.2" {...round} />
    </>
  ),
  // percent: a percent sign
  'percent-pin': () => (
    <>
      <circle cx="104" cy="95" r="10.5" style={{ ...F(WHITE), ...S(ch('petrol', '-d')) }} strokeWidth="2" />
      <circle cx="100" cy="91" r="2.4" style={F(ch('petrol'))} />
      <circle cx="108" cy="99" r="2.4" style={F(ch('petrol'))} />
      <path d="M109 89.5 L99 100.5" style={S(ch('petrol', '-d'))} strokeWidth="2" {...round} />
    </>
  ),
  // functions: a walk's graph, a climb, a flat part and the way back, on its two axes
  'graph-pin': () => (
    <>
      <circle cx="104" cy="95" r="10.5" style={{ ...F(WHITE), ...S(ch('fuchsia', '-d')) }} strokeWidth="2" />
      <path d="M97.5 88 V101.5 H111" style={S(ch('fuchsia', '-d'))} strokeWidth="1.2" {...round} />
      <path d="M97.5 101.5 L101 92 H105 L108.5 101.5" style={S(ch('fuchsia'))} strokeWidth="2" {...round} />
    </>
  ),
  'class-scarf': ({ classColor = 'sky' }) => (
    <>
      <path d="M66 104 H75 L77 119 H68Z" style={F(ch(classColor, '-d'))} />
      <path d="M68.5 119 V123 M72.5 119 V123 M76 119 V123" style={S(ch(classColor, '-d'))} strokeWidth="1.6" {...round} />
      <rect x="24" y="96" width="66" height="10" rx="5" style={F(ch(classColor))} />
      <path d="M29 99 H85 M29 103 H85" style={S(WHITE)} strokeWidth="1.4" strokeOpacity="0.55" {...round} />
    </>
  ),
};

/** One item, drawn in Madi's own coordinates. */
export function Item({ id, classColor }) {
  const Draw = DRAW[id];
  return Draw ? <g data-item={id}><Draw classColor={classColor} /></g> : null;
}

/** Everything Madi wears, in slot order; the glasses follow where his eyes look (Mascot's LOOK). */
export default function Accessories({ look, eyes = [0, 0], spring }) {
  return (
    <g className="madi-wear">
      {look.neck && <Item id={look.neck} classColor={look.classColor} />}
      {look.body && <Item id={look.body} classColor={look.classColor} />}
      {look.face && (
        <m.g initial={false} animate={{ x: eyes[0], y: eyes[1] }} transition={spring}>
          <Item id={look.face} />
        </m.g>
      )}
      {look.head && <Item id={look.head} classColor={look.classColor} />}
    </g>
  );
}

// The part of Madi each slot sits on, for a small picture of one item: x y width height in his viewBox.
const BOX = { head: '22 0 82 40', face: '22 38 70 36', neck: '20 88 74 38', body: '86 79 36 34' };
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
