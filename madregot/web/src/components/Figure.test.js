// The teaching figures of STUDENT-8 (components/Figure.jsx): each type renders as one picture (role="img") with its Hebrew
// name built from its props, as a screen reader says it; with anim it starts drawn out (each part from nothing) unless
// the phone asks for reduced motion, when it is there at once.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const motion = vi.hoisted(() => ({ reduce: false }));
vi.mock('motion/react', async (load) => ({ ...(await load()), useReducedMotion: () => motion.reduce }));
const { default: Figure } = await import('./Figure.jsx');

const html = (fig) => renderToStaticMarkup(createElement(Figure, { fig }));
const named = (fig) => {
  const out = html(fig);
  expect(out).toMatch(/^<div class="figure-wrap"><svg [^>]*role="img"/);
  expect(out).not.toMatch(/NaN|undefined|Infinity/);
  return /aria-label="([^"]*)"/.exec(out)[1];
};

beforeEach(() => { motion.reduce = false; });

describe('the new figure types render with role="img" and their Hebrew name', () => {
  it('numline: the range, each point and each jump', () => {
    expect(named({ type: 'numline', from: -6, to: 6, marks: [{ x: 0, label: '0' }], jumps: [{ from: -2, to: 3, label: '+5' }], anim: true }))
      .toBe('ציר מספרים מ־−6 עד 6, נקודה ב־0, קפיצה מ־−2 ל־3');
    expect(named({ type: 'numline', from: -5, to: 5, marks: [{ x: -3, label: 'A' }, { x: 2, label: 'B', tone: 'good' }] }))
      .toBe('ציר מספרים מ־−5 עד 5, נקודה A ב־−3, נקודה B ב־2');
    // a unit cut into parts (the fractions lane writes these too)
    expect(named({ type: 'numline', from: 0, to: 2, den: 4, marks: [{ x: 0.75 }] })).toBe('ציר מספרים מ־0 עד 2, כל יחידה מחולקת ל־4 חלקים, נקודה ב־3/4');
  });

  it('thermo: the reading in degrees', () => {
    expect(named({ type: 'thermo', value: -4, min: -10, max: 10 })).toBe('מדחום שמראה −4 מעלות');
    expect(named({ type: 'thermo', value: 12, min: -10, max: 30, label: 'בצהריים' })).toBe('מדחום שמראה 12 מעלות, בצהריים');
    // two thermometers on one scale (two days)
    expect(named({ type: 'thermo', value: -3, label: 'יום ראשון', also: { value: -8, label: 'יום שני' }, min: -10, max: 10 }))
      .toBe('שני מדחומים: יום ראשון −3 מעלות, יום שני −8 מעלות');
  });

  it('machine: in, the rule in words, out; a question mark when the output is asked', () => {
    expect(named({ type: 'machine', inX: 3, rule: '2x + 1', outY: 7 })).toBe('מכונה: נכנס 3, הכלל 2x + 1, יוצא 7');
    expect(named({ type: 'machine', inX: 4, rule: 'x \\cdot 3 - 2', outY: '?' })).toBe('מכונה: נכנס 4, הכלל x × 3 − 2, יוצא סימן שאלה');
    expect(named({ type: 'machine', rule: '2x' })).toBe('מכונה: נכנס x, הכלל 2x, יוצא y');
  });

  it('dots: how many values on which axis, and the mean when it is marked', () => {
    expect(named({ type: 'dots', values: [6, 7, 7, 8, 9], axis: [5, 10] })).toBe('תרשים נקודות של 5 ערכים בין 5 ל־10');
    expect(named({ type: 'dots', values: [6, 7, 7, 8, 9], axis: [5, 10], mark: { mean: 7.4 } })).toBe('תרשים נקודות של 5 ערכים בין 5 ל־10, הממוצע מסומן');
    expect(named({ type: 'dots', values: [1, 2, 2, 3], axis: [0, 4], mark: { mode: 2, median: 2 } })).toBe('תרשים נקודות של 4 ערכים בין 0 ל־4, השכיח מסומן, החציון מסומן');
  });

  it('bars: each bar with its value', () => {
    expect(named({ type: 'bars', labels: ['כדורגל', 'כדורסל', 'שחייה'], values: [12, 8, 5], highlight: 0 })).toBe('תרשים עמודות: כדורגל 12, כדורסל 8, שחייה 5');
    expect(named({ type: 'bars', labels: ['א׳', 'ב׳'], values: [3, 4], unit: 'תלמידים' })).toBe('תרשים עמודות: א׳ 3, ב׳ 4 (תלמידים)');
  });

  it('coord: still "מערכת צירים", with what the new fields add, and never where a point is', () => {
    expect(named({ type: 'coord', range: 6, points: [{ x: 3, y: 4, label: 'A' }] })).toBe('מערכת צירים, הנקודה A');
    expect(named({ type: 'coord', range: 6, quadrants: true, path: [[3, 0], [3, 4]], points: [{ x: 3, y: 4, label: 'D' }] }))
      .toBe('מערכת צירים, ארבעה רביעים, הנקודה D, מסלול מראשית הצירים');
    expect(named({ type: 'coord', range: 6, lines: [{ m: 1, b: 1, label: 'y = x + 1' }, { m: -1, b: 5, label: 'y = −x + 5' }], meet: true }))
      .toBe('מערכת צירים, 2 ישרים: y = x + 1, y = −x + 5, הישרים נפגשים ב־(2, 3)');
    expect(named({ type: 'coord', range: 6, line: { m: 2, b: -1 }, riseRun: { x: 0, run: 1 } })).toBe('מערכת צירים, ישר, צעד של 1 ימינה ו־2 למעלה');
    expect(named({ type: 'coord', range: 6, line: { m: -0.5, b: 2 }, riseRun: { x: -2, run: 2 } })).toBe('מערכת צירים, ישר, צעד של 2 ימינה ו־1 למטה');
    // a rectangle on the grid, its sides' letters; segments
    expect(named({ type: 'coord', range: 5, polygon: [[0, 0], [4, 0], [4, 3], [0, 3]], words: [{ at: [2, -0.6], text: 'a' }, { at: [4.6, 1.5], text: 'b' }] }))
      .toBe('מערכת צירים, מלבן, כתוב: a, b');
    expect(named({ type: 'coord', range: 6, segments: [[[1, 2], [5, 2]]], points: [{ x: 1, y: 2, label: 'C' }, { x: 5, y: 2, label: 'D' }, { x: 0, y: -3, label: 'E', hidden: true }] }))
      .toBe('מערכת צירים, קטע, הנקודות C, D');
  });
});

describe('what each figure draws', () => {
  it('a number line lights up a point named by its own number, and writes other names', () => {
    const out = html({ type: 'numline', from: -6, to: 6, marks: [{ x: 0, label: '0' }, { x: 4, label: 'A' }] });
    expect(out).toMatch(/class="fig-nl-num zero on tone-brand">0</);
    expect(out).toMatch(/class="fig-nl-name fig-var">A</);
    expect(out.match(/>0</g)).toHaveLength(1); // 0 is not written twice
  });

  it('the plane draws its quadrants, the walk, the lines, where they meet and the rise and run', () => {
    const out = html({ type: 'coord', range: 6, quadrants: true, path: [[3, 0], [3, 4]], lines: [{ m: 1, b: 1 }, { m: -1, b: 5 }], meet: true, riseRun: { x: 0, run: 2 } });
    for (const q of [1, 2, 3, 4]) expect(out).toContain(`רביע ${q}`);
    expect(out.match(/class="fig-cd-line /g)).toHaveLength(2);
    expect(out.match(/class="fig-cd-walk"/g)).toHaveLength(2); // two legs from the origin
    expect(out).toContain('>(2, 3)<');
    expect(out).toMatch(/class="fig-cd-rr-num"[^>]*>2</); // the run, and the rise is also 2
  });

  it('a dot plot stacks equal values and marks the middle dot for the median', () => {
    const out = html({ type: 'dots', values: [3, 1, 2, 2, 5], axis: [0, 6], mark: { median: 2 } });
    expect(out.match(/<circle/g)).toHaveLength(5);
    expect(out.match(/fig-dt-dot hi/g)).toHaveLength(1);
  });

  it('numbers on a long line are spaced to fit, but where a jump starts and lands is always written', () => {
    const out = html({ type: 'numline', from: -12, to: 12, jumps: [{ from: 0, to: 7 }] });
    const nums = [...out.matchAll(/class="fig-nl-num[^"]*">([^<]+)</g)].map((m) => m[1]);
    expect(nums).toEqual(['−10', '−5', '0', '7', '10']); // every 5 fits; 5 gives way to the 7 the jump lands on
  });

  it('a jump that goes back over an earlier one rises above it, so the arcs and their labels do not cross', () => {
    const out = html({ type: 'numline', from: 0, to: 12, marks: [{ x: 10, label: '10' }], jumps: [{ from: 10, to: 6, label: '-4' }, { from: 6, to: 9, label: '+3' }] });
    const ys = [...out.matchAll(/class="fig-nl-move"[^>]*y="([\d.]+)"|y="([\d.]+)"[^>]*class="fig-nl-move"/g)].map((m) => Number(m[1] || m[2]));
    expect(ys).toHaveLength(2);
    expect(ys[0] - ys[1]).toBeGreaterThan(30); // the second label is well above the first
    // jumps one after another the same way (10 − 3 − 2) stay at their own height
    const flat = html({ type: 'numline', from: 0, to: 12, jumps: [{ from: 10, to: 7 }, { from: 7, to: 5 }] });
    expect(/viewBox="0 0 320 ([\d.]+)"/.exec(flat)[1]).toBe(/viewBox="0 0 320 ([\d.]+)"/.exec(html({ type: 'numline', from: 0, to: 12, jumps: [{ from: 10, to: 7 }] }))[1]);
  });

  it('two thermometers: the first on the right, each named under it; the plane writes its words', () => {
    const out = html({ type: 'thermo', value: -3, label: 'יום ראשון', also: { value: -8, label: 'יום שני' }, min: -10, max: 10 });
    const x = (name) => Number(new RegExp(`<text x="([\\d.]+)"[^>]*>${name}<`).exec(out)[1]);
    expect(x('יום ראשון')).toBeGreaterThan(x('יום שני'));
    expect(out.match(/class="fig-th-glass"/g)).toHaveLength(2);
    expect(html({ type: 'coord', range: 5, words: [{ at: [2, -0.6], text: 'a' }] })).toMatch(/class="fig-cd-word fig-var">a</);
  });

  it('a point\'s name near the right edge goes to its left, so it stays on the drawing', () => {
    const out = html({ type: 'coord', range: 7, points: [{ x: 2, y: 0, label: '(2, 0)' }, { x: 7, y: 0, label: '(7, 0)' }] });
    expect(out).toMatch(/text-anchor="start"[^>]*>\(2, 0\)</);
    expect(out).toMatch(/text-anchor="end"[^>]*>\(7, 0\)</);
  });

  it('bars: the first bar is on the right', () => {
    const out = html({ type: 'bars', labels: ['א', 'ב'], values: [2, 4] });
    const x = (name) => Number(new RegExp(`<text x="([\\d.]+)"[^>]*class="fig-bar-name"[^>]*>${name}<`).exec(out)[1]);
    expect(x('א')).toBeGreaterThan(x('ב'));
  });

  it('the machine shows a question mark in the brand when its output is asked', () => {
    expect(html({ type: 'machine', inX: 3, rule: '2x + 1', outY: '?' })).toMatch(/class="fig-mc-io target"><rect[^>]*><\/rect><text[^>]*>\?</);
  });
});

describe('drawing in, once, and never under reduced motion', () => {
  const fig = { type: 'numline', from: -6, to: 6, marks: [{ x: 0, label: '0' }], jumps: [{ from: -2, to: 3, label: '+5' }], anim: true };

  it('with anim, a jump starts at length 0 and its head and label wait', () => {
    const out = html(fig);
    expect(out).toMatch(/<path d="M 114[^"]*Q[^"]*"[^>]*pathLength="1"[^>]*stroke-dasharray="0 1"/);
    expect(out).toMatch(/class="fig-nl-move" opacity="0"/);
  });

  it('under reduced motion, or without anim, everything is there at once', () => {
    motion.reduce = true;
    expect(html(fig)).not.toMatch(/opacity="0"|stroke-dasharray/);
    motion.reduce = false;
    expect(html({ ...fig, anim: false })).not.toMatch(/opacity="0"|stroke-dasharray/);
  });

  it('every animated figure type starts hidden with anim and complete without it', () => {
    const animated = [
      fig,
      { type: 'machine', inX: 3, rule: '2x + 1', outY: '?', anim: true },
      { type: 'dots', values: [1, 2, 2], axis: [0, 4], anim: true },
      { type: 'coord', range: 6, lines: [{ m: 1, b: 0 }], path: [[2, 0]], anim: true },
      { type: 'thermo', value: -3, min: -10, max: 10, anim: true },
    ];
    for (const f of animated) {
      expect(html(f), f.type).toMatch(/opacity="0"/);
      motion.reduce = true;
      expect(html(f), f.type).not.toMatch(/opacity="0"/);
      motion.reduce = false;
    }
  });
});
