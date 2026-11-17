// A stair mastered is the app's biggest moment (DESIGN.md Results, PRODUCT2-38), rendered: a passed mastery check opens
// on the gold celebration with the stair's badge beside מדי; a failed check, a review and a repair check do not. The test
// is the store's one flag (award.mastered, lib/store.js completeCheck), the same one the level-up sound and מדי's walk on
// the path read, so a kept stair mastered gets the moment too. Under reduced motion the badge is simply there: nothing
// flies, nothing starts hidden. Rendered to HTML on the server, as Learn.test.jsx does.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import CheckDone from './CheckDone.jsx';
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
  });
});
