// The maths burst (PKG-3, lib/mathBurst.js) with canvas-confetti mocked by a factory that counts its imports, on a
// small stand-in page (the unit tests run in node): nothing imported and no canvas under reduced motion, on a hidden
// page, or with the app's sounds off (the store's `sound`, read at that moment); otherwise one import on the first burst, a canvas of its own that is aria-hidden, the symbols in the token
// colours read at that moment, and the canvas removed when the burst ends and when stop() runs. The tests run in order:
// the factory's count is 0 until the first test that lets a burst play.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mathBurst, originOf, burstAllowed } from './mathBurst.js';
import { useApp } from './store.js';

const lib = vi.hoisted(() => ({ imports: 0, fires: [], creates: [], shapes: [], failShapes: false }));
vi.mock('canvas-confetti', () => {
  lib.imports += 1;
  const create = (canvas, opts) => {
    let finish = () => {};
    const fire = (o) => new Promise((resolve) => { finish = resolve; lib.fires.push({ canvas, o, finish: () => resolve() }); });
    fire.reset = vi.fn(() => finish());
    lib.creates.push({ canvas, opts, fire });
    return fire;
  };
  const shapeFromText = (t) => {
    if (lib.failShapes) throw new ReferenceError('OffscreenCanvas is not defined');
    lib.shapes.push(t);
    return { type: 'bitmap', text: t.text, color: t.color };
  };
  return { default: { create, shapeFromText } };
});

const LIGHT = { '--brand': 'brand-light', '--gold': 'gold-light', '--good': 'good-light' };

/** A page: a body that keeps what is appended, the media query, the tokens on the root, the window's size. */
function page({ reduce = false, hidden = false, tokens = LIGHT } = {}) {
  const body = { kids: [], appendChild(el) { this.kids.push(el); return el; } };
  const doc = {
    hidden, body, documentElement: { tokens },
    createElement: (tag) => ({ tag, className: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, remove() { body.kids = body.kids.filter((k) => k !== this); } }),
  };
  const win = {
    innerWidth: 390, innerHeight: 844,
    matchMedia: (q) => ({ matches: reduce && q === '(prefers-reduced-motion: reduce)' }),
    getComputedStyle: (el) => ({ getPropertyValue: (name) => ` ${el.tokens[name] ?? ''}` }),
  };
  return { doc, win, canvases: () => body.kids.filter((k) => k.tag === 'canvas') };
}
// the hero: 150 px square, its centre at (195, 211) in a 390 x 844 window
const hero = { getBoundingClientRect: () => ({ left: 120, top: 136, width: 150, height: 150 }) };
const turn = () => new Promise((r) => { setTimeout(r, 0); });

beforeEach(() => { Object.assign(lib, { fires: [], creates: [], shapes: [], failShapes: false }); });

describe('mathBurst: when it does nothing', () => {
  it('under reduced motion: no import, no canvas, and stop() is safe', async () => {
    const p = page({ reduce: true });
    const stop = mathBurst(hero, p);
    expect(await stop.done).toBe(false);
    await turn();
    expect(lib.imports).toBe(0);
    expect(p.canvases()).toEqual([]);
    expect(() => stop()).not.toThrow();
  });

  it('on a hidden page: no import, no canvas', async () => {
    const p = page({ hidden: true });
    expect(await mathBurst(hero, p).done).toBe(false);
    expect(lib.imports).toBe(0);
    expect(p.canvases()).toEqual([]);
  });

  it('with the app\'s sounds off (quiet for class): no import, no canvas; the store is read at the moment it plays', async () => {
    const before = useApp.getState().sound;
    try {
      useApp.setState({ sound: false });
      const p = page();
      expect(burstAllowed(p)).toBe(false);
      expect(await mathBurst(hero, p).done).toBe(false);
      expect(lib.imports).toBe(0);
      expect(p.canvases()).toEqual([]);
      useApp.setState({ sound: true });
      expect(burstAllowed(p)).toBe(true);
      // said outright, the setting wins over the store
      expect(burstAllowed({ ...p, sound: false })).toBe(false);
      expect(await mathBurst(hero, { ...p, sound: false }).done).toBe(false);
      expect(lib.imports).toBe(0);
    } finally {
      useApp.setState({ sound: before });
    }
  });
});

describe('mathBurst: a burst', () => {
  it('imports canvas-confetti on the first burst only', async () => {
    expect(lib.imports).toBe(0); // importing mathBurst.js, and the bursts that did not play, imported nothing
    const p = page();
    const first = mathBurst(hero, p);
    await vi.waitFor(() => expect(lib.fires).toHaveLength(1));
    expect(lib.imports).toBe(1);
    lib.fires[0].finish();
    await first.done;
    const second = mathBurst(hero, p);
    await vi.waitFor(() => expect(lib.fires).toHaveLength(2));
    lib.fires[1].finish();
    expect(await second.done).toBe(true);
    expect(lib.imports).toBe(1);
  });

  it('stopped before canvas-confetti has loaded: no canvas is ever made', async () => {
    const p = page();
    const stop = mathBurst(hero, p);
    stop();
    expect(await stop.done).toBe(false);
    expect(p.canvases()).toEqual([]);
    expect(lib.creates).toEqual([]);
  });

  it('draws on a canvas of its own: class math-burst, aria-hidden, with no worker; removed when the burst ends', async () => {
    const p = page();
    const stop = mathBurst(hero, p);
    await vi.waitFor(() => expect(lib.fires).toHaveLength(1));
    const [canvas] = p.canvases();
    expect(canvas).toMatchObject({ className: 'math-burst', attrs: { 'aria-hidden': 'true' } });
    expect(lib.creates[0].canvas).toBe(canvas);
    expect(lib.creates[0].opts).toEqual({ resize: true, useWorker: false, disableForReducedMotion: true });
    lib.fires[0].finish(); // the last symbol has fallen
    expect(await stop.done).toBe(true);
    expect(p.canvases()).toEqual([]);
  });

  it('36 symbols, + − × ÷ = in --brand, --gold and --good, from the centre of the element, under 3 seconds', async () => {
    const p = page();
    mathBurst(hero, p);
    await vi.waitFor(() => expect(lib.fires).toHaveLength(1));
    const { o } = lib.fires[0];
    expect(o).toMatchObject({ particleCount: 36, disableForReducedMotion: true, origin: { x: 0.5, y: 0.25 } });
    expect(o.ticks).toBeLessThanOrEqual(160); // frames: 160 at 60 a second is 2.7 s
    expect(o.shapes).toHaveLength(15);
    expect(lib.shapes.map((s) => `${s.text} ${s.color}`)).toEqual(['brand-light', 'gold-light', 'good-light'].flatMap((c) => ['+', '−', '×', '÷', '='].map((t) => `${t} ${c}`)));
    expect(new Set(lib.shapes.map((s) => s.fontFamily))).toEqual(new Set(['"Rubik Variable", sans-serif']));
    lib.fires[0].finish();
  });

  it('reads the tokens when it plays: dark mode gets its own values', async () => {
    const p = page({ tokens: { '--brand': 'brand-dark', '--gold': 'gold-dark', '--good': 'good-dark' } });
    mathBurst(hero, p);
    await vi.waitFor(() => expect(lib.fires).toHaveLength(1));
    expect([...new Set(lib.shapes.map((s) => s.color))]).toEqual(['brand-dark', 'gold-dark', 'good-dark']);
    lib.fires[0].finish();
  });

  it('a browser without OffscreenCanvas gets plain confetti in the same colours', async () => {
    lib.failShapes = true;
    const p = page();
    mathBurst(hero, p);
    await vi.waitFor(() => expect(lib.fires).toHaveLength(1));
    expect(lib.fires[0].o.shapes).toBeUndefined();
    expect(lib.fires[0].o.colors).toEqual(['brand-light', 'gold-light', 'good-light']);
    lib.fires[0].finish();
  });

  it('stop() during the burst ends it and removes the canvas at once (the moment closed first)', async () => {
    const p = page();
    const stop = mathBurst(hero, p);
    await vi.waitFor(() => expect(p.canvases()).toHaveLength(1));
    stop();
    expect(p.canvases()).toEqual([]);
    expect(lib.creates[0].fire.reset).toHaveBeenCalledTimes(1);
    expect(await stop.done).toBe(false);
    stop(); // twice is harmless
  });
});

describe('originOf', () => {
  it('the centre of the element as a fraction of the window, kept inside it; the upper middle without one', () => {
    const win = { innerWidth: 400, innerHeight: 800 };
    expect(originOf({ getBoundingClientRect: () => ({ left: 100, top: 200, width: 200, height: 100 }) }, win)).toEqual({ x: 0.5, y: 0.3125 });
    expect(originOf({ getBoundingClientRect: () => ({ left: -300, top: 900, width: 10, height: 10 }) }, win)).toEqual({ x: 0, y: 1 });
    expect(originOf(null, win)).toEqual({ x: 0.5, y: 0.35 });
  });
});
