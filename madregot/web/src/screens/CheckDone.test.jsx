// A stair mastered is the app's biggest moment (DESIGN.md Results, PRODUCT2-38), rendered: a passed mastery check opens
// on the gold celebration with the stair's badge beside מדי; a failed check, a review and a repair check do not. The test
// is the store's one flag (award.mastered, lib/store.js completeCheck), the same one the level-up sound and מדי's walk on
// the path read, so a kept stair mastered gets the moment too. Under reduced motion the badge is simply there: nothing
// flies, nothing starts hidden. Rendered to HTML on the server, as Learn.test.jsx does.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import CheckDone, { PEAK } from './CheckDone.jsx';
import { useApp } from '@/lib/store.js';
import { TOPIC } from '@/content/topics.js';
import { loadMotionFeatures } from '@/lib/motion.js';

vi.mock('react', async (load) => {
  const react = await load();
  return { ...react, default: react, useSyncExternalStore: (sub, get, server) => react.useSyncExternalStore(sub, get, server || get) };
});
// the student's reduced-motion setting, as motion reads it (Celebrate and the badge)
const motion = vi.hoisted(() => ({ reduce: false }));
vi.mock('motion/react', async (load) => ({ ...(await load()), useReducedMotion: () => motion.reduce }));

const html = (result, award) => {
  Object.assign(useApp.getInitialState(), useApp.getState());
  return renderToStaticMarkup(<MemoryRouter initialEntries={['/lesson/signed/2']}><CheckDone result={result} award={award} onExit={() => {}} /></MemoryRouter>);
};
const check = (purpose, passed, right = passed ? 5 : 3) => ({ purpose, skill: 'signed:2', topic: 'signed', level: 2, right, asked: 5, perSkill: {}, passed, xp: passed ? 15 : 0 });
/** The award the store gives each (completeCheck): only a passed mastery check is a stair mastered. */
const award = (mastered, more = {}) => ({ mastered, stairDone: mastered, done: mastered ? 2 : 1, streak: 1, ...more });
const badge = (out) => out.match(/<span class="mastered-badge[^"]*"[^>]*>/)?.[0];

describe('the end of a check: a stair mastered is the biggest moment', () => {
  // the app has its motion features once it is open (App.jsx): until then every entrance is drawn at its target
  beforeAll(async () => { await loadMotionFeatures(); });
  beforeEach(() => {
    motion.reduce = false;
    useApp.getState().resetProgress();
    useApp.setState({ profile: { role: 'student', name: 'נועה', grade: '7', know: 1 } });
  });
  afterEach(() => { motion.reduce = false; });

  it('a passed mastery check: the gold celebration, its light and shapes, and the stair\'s badge in the unit\'s colour', () => {
    const out = html(check('mastery', true), award(true));
    expect(out).toContain('שולטים לבד!');
    expect(out).toContain('class="celebrate celebrate-gold"');
    expect(out).toContain('class="celebrate-rays"');
    expect(out).toContain('class="celebrate-burst"');
    const b = badge(out);
    expect(b, 'the badge is there').toBeTruthy();
    expect(b).toContain(`ch-${TOPIC.signed.color}`);
    expect(b).toContain('aria-hidden="true"'); // decorative: the title says what happened
    expect(out).toContain('class="mastered-seal"');
    // it lands: drawn from above, small and hidden, then springs into place
    expect(b).toMatch(/opacity:0/);
  });

  it('a kept stair mastered (the path did not change) gets the same moment: the flag, not the path, decides', () => {
    const out = html(check('mastery', true), award(true, { stairDone: false }));
    expect(out).toContain('celebrate-gold');
    expect(badge(out)).toBeTruthy();
  });

  it('a failed mastery check: מדי alone, no celebration and no badge', () => {
    const out = html(check('mastery', false), award(false));
    expect(out).toContain('עוד לא, וזה בסדר');
    expect(out).not.toContain('celebrate');
    expect(badge(out)).toBeUndefined();
  });

  it('a passed review and a passed repair check are not a stair mastered: no gold moment', () => {
    for (const purpose of ['review', 'verify']) {
      const out = html(check(purpose, true), award(false));
      expect(out, purpose).not.toContain('celebrate');
      expect(badge(out), purpose).toBeUndefined();
    }
  });

  it('the peak (ux-motion 19, 7): the badge lands, its check draws itself, מדי hops, and the numbers count up beside it', () => {
    const out = html(check('mastery', true), award(true));
    // the seal pops in, and its check starts undrawn (a path of length 1 with nothing of it shown yet)
    expect(out).toMatch(/<span class="mastered-seal" style="transform:scale\(0\)">/);
    expect(out).toMatch(/<path class="mastered-check" d="[^"]+" pathLength="1" stroke-dashoffset="0" stroke-dasharray="0 1">/);
    // מדי's own hop sits inside his jump
    expect(out).toContain('class="mastered-madi"');
    // the tiles count up from 0, while a screen reader has the final numbers
    expect(out).toMatch(/<span class="xp-count-n" aria-hidden="true">0<\/span><span class="visually-hidden">5<\/span><\/bdi>\/5/);
    expect(out).toMatch(/<span class="xp-count-n" aria-hidden="true">\+0<\/span><span class="visually-hidden">\+15<\/span>/);
    // in order, and about a second in all: a one-time moment (ux-motion 8); the count is done before the hop
    expect(PEAK.land).toBeLessThan(PEAK.seal);
    expect(PEAK.seal).toBeLessThan(PEAK.draw);
    expect(PEAK.draw + PEAK.drawFor).toBeLessThanOrEqual(PEAK.hop + 1e-9);
    expect(PEAK.count + PEAK.countFor).toBeLessThanOrEqual(PEAK.hop + 0.05);
    expect(PEAK.hop + 0.4).toBeLessThanOrEqual(1.3);
  });

  it('a check that is not a stair mastered shows its numbers at once: nothing counts', () => {
    const out = html(check('review', true), award(false));
    expect(out).not.toContain('xp-count');
    expect(out).toContain('<bdi dir="ltr">5/5</bdi>');
  });

  it('in a quiet class the moment stays on the student\'s screen: no flying shapes, no turning light; the check still draws', () => {
    useApp.setState({ profile: { role: 'student', name: 'דנה', grade: '7', know: 1, classCode: 'K7Q2MD', token: 'stok-a1' }, prefs: { theme: 'system', soundSet: false } });
    const out = html(check('mastery', true), award(true));
    expect(out).toContain('class="mastered-hero is-quiet"');
    expect(out).toContain('celebrate-gold');
    expect(out).not.toContain('celebrate-rays');
    expect(out).not.toContain('celebrate-burst');
    expect(out).toContain('class="mastered-check"');
    // a student who turned sound on in class gets the whole moment
    useApp.setState({ prefs: { theme: 'system', soundSet: true } });
    const loud = html(check('mastery', true), award(true));
    expect(loud).toContain('celebrate-burst');
    expect(loud).not.toContain('is-quiet');
  });

  it('under reduced motion nothing flies and the badge is simply there', () => {
    motion.reduce = true;
    const out = html(check('mastery', true), award(true));
    expect(out).toContain('celebrate-gold');
    expect(out).toContain('class="celebrate-rays"'); // the light stays, still and faint (celebrate.css)
    expect(out).not.toContain('celebrate-burst');
    const b = badge(out);
    expect(b).toBeTruthy();
    expect(b).not.toMatch(/opacity:0/);
    expect(b).not.toMatch(/translateY\(-|scale\(0\./);
    // a plain fade: the whole moment fades in as one, its check already drawn and its numbers final
    expect(out).toMatch(/<div class="mastered-hero" style="opacity:0">/);
    expect(out).not.toContain('stroke-dasharray="0 1"');
    expect(out).toMatch(/<span class="mastered-seal"( style="transform:none")?>/);
    expect(out).toMatch(/<span class="xp-count-n" aria-hidden="true">\+15<\/span>/);
  });
});
