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
    // a line cut into parts is the fraction lane's (PartsLine): its words count parts and never give the value an exercise
    // asks for (content/manip.js partsLineWords)
    expect(named({ type: 'numline', from: 0, to: 2, den: 4, marks: [{ x: 0.75 }] })).toBe('ציר מספרים מ־0 עד 2, כל יחידה מחולקת ל־4 חלקים שווים; נקודה: 3 חלקים מ־0');
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
    // bars with no names are read by their values; a missing value says so; the level line comes last
    expect(named({ type: 'bars', labels: ['', '', ''], values: [3, 7, 5], level: 5 })).toBe('תרשים עמודות: 3, 7, 5, קו בגובה 5');
    expect(named({ type: 'bars', labels: ['מבחן 1', 'מבחן 2'], values: [70, null], level: 85 })).toBe('תרשים עמודות: מבחן 1 70, מבחן 2 חסר, קו בגובה 85');
  });

  it('dots: a line written over the plot is read with it', () => {
    expect(named({ type: 'dots', values: [3, 6, 9], axis: [0, 10], mark: { median: 6 }, unit: 'שלושה נתונים' })).toBe('תרשים נקודות של 3 ערכים בין 0 ל־10, החציון מסומן: שלושה נתונים');
  });

  it('sgraph: the graph read in words, every number it draws (FUNC-1)', () => {
    expect(named({ type: 'sgraph', x: { max: 15, step: 5, label: 'זמן', unit: 'דקות' }, y: { max: 600, step: 100, label: 'מרחק מהבית', unit: 'מטרים' }, series: [{ pts: [[0, 0], [5, 400], [10, 400], [15, 0]] }] }))
      .toBe('גרף: מרחק מהבית (מטרים) לפי זמן (דקות); ציר x מ־0 עד 15, קו כל 5; ציר y מ־0 עד 600, קו כל 100; (0, 0) → (5, 400) → (10, 400) → (15, 0)');
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

  it('bars with ltr run left to right, like the list in maths and the bars object; a missing bar is a question mark', () => {
    const out = html({ type: 'bars', labels: ['א', 'ב'], values: [2, 4], ltr: true });
    const x = (name) => Number(new RegExp(`<text x="([\\d.]+)"[^>]*class="fig-bar-name"[^>]*>${name}<`).exec(out)[1]);
    expect(x('א')).toBeLessThan(x('ב'));
    const gone = html({ type: 'bars', labels: ['', ''], values: [6, null], level: 5 });
    expect(gone).toMatch(/class="fig-bar gone"><rect[^>]*><\/rect><text[^>]*>\?</);
    expect(gone).not.toMatch(/class="fig-bar-name"/); // no names, no empty labels
    // the level is a line across at its height, its number outside the bars; the tallest of bars and level sets the scale
    expect(gone).toMatch(/class="fig-bar-level"><line[^>]*><\/line><text[^>]*>5</);
    const y = (svg) => Number(/class="fig-bar-level"><line x1="[\d.]+" x2="[\d.]+" y1="([\d.]+)"/.exec(svg)[1]);
    expect(y(html({ type: 'bars', labels: ['', ''], values: [2, 4], level: 8 }))).toBe(30); // the level is the top
  });

  it('a dot is as large as the gaps between the values allow', () => {
    const r = (fig) => Number(/<circle[^>]*r="([\d.]+)"/.exec(html(fig))[1]);
    expect(r({ type: 'dots', values: [10, 20, 30], axis: [0, 50] })).toBe(9); // far apart on a long axis: full size
    expect(r({ type: 'dots', values: [2, 3, 30], axis: [0, 50] })).toBe(4); // two values 1 apart: small, so they stay apart
  });

  it('a table keeps a heading that is maths left to right, writes letters in the maths font, and comes in row by row', () => {
    const out = html({ type: 'table', head: ['x', '9 − x', 'מי'], rows: [[1, 8, 'עמית']], anim: true });
    expect(out).toMatch(/<th scope="col"><bdi dir="ltr">9 − <span class="fig-var">x<\/span><\/bdi><\/th>/);
    expect(out).toMatch(/<th scope="col">מי<\/th>/); // a word heading reads right to left as it is
    expect(out).toMatch(/<tr style="opacity:0">/);
    motion.reduce = true;
    expect(html({ type: 'table', head: ['x'], rows: [[1]], anim: true })).not.toMatch(/opacity/);
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
      { type: 'bars', labels: ['א', 'ב'], values: [2, 4], level: 3, anim: true },
      { type: 'coord', range: 6, segments: [[[-5, 4], [-1, 4]]], anim: true }, // segments alone (pyth:5#0) draw in too
      // a situation graph (FUNC-1): its line, its dots, its marked interval and its guides
      { type: 'sgraph', x: { max: 45, step: 5, label: 'זמן', every: 2 }, y: { max: 700, step: 100, label: 'מרחק' }, series: [{ pts: [[0, 0], [10, 600], [45, 0]] }], bands: [{ from: 10, to: 25 }], guide: { x: 5 }, anim: true },
      { type: 'sgraph', x: { max: 4, step: 1, label: 'x' }, y: { max: 8, step: 1, label: 'y' }, series: [{ pts: [[0, 1], [1, 3], [2, 5]], dots: true }], anim: true },
    ]; // (a table's rows: in "a table keeps a heading that is maths left to right…" above)
    for (const f of animated) {
      expect(html(f), f.type).toMatch(/opacity="0"/);
      motion.reduce = true;
      expect(html(f), f.type).not.toMatch(/opacity="0"/);
      motion.reduce = false;
    }
  });
});
