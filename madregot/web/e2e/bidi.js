// Brackets in right-to-left text. In "יחס וקנה מידה (כל הנושא)" the "(" is drawn mirrored, right of "כל", hugging it.
// Rubik's tabular figures (font-variant-numeric: tabular-nums, or font-feature-settings "tnum") also swap ( and ) for its
// tabular brackets: 0.6 em wide (its own are 0.319 em) with the stroke in the middle. In Chromium (desktop, Android,
// Playwright's) each bracket then stands apart from the words it holds, nearer the words outside: the line reads
// "פונקציה קווית ( כל הנושא )", and the brackets seem to face out. So tabular figures go only on numbers that must line
// up or hold still (.num, .mono, counters, timers, readouts, tables' number cells), never on a sentence or on the body
// (styles/tokens.css).
//
// Two checks:
// - rtlBracketsWithTabularFigures: every bracket on the page that is in a right-to-left run and set with tabular
//   figures (the cause), found from the DOM and the drawn positions of the characters; a11y.spec.js runs it on every
//   screen it scans;
// - bracketShapes / expectBracketsFaceIn: how an element's brackets are drawn (the effect), read from the pixels of a
//   screenshot: which way each one bulges, its width, and the blank between it and the words it holds. A Chromium that
//   drew them unmirrored would fail it too.
// bidi-brackets.spec.js shows that both find the fault on a planted paragraph.
import { expect } from '@playwright/test';

/** The mirrored characters Rubik's Latin part draws: ( ) [ ] { } < >. */
const MIRRORED = '()[]{}<>';

/**
 * Every drawn bracket in a right-to-left run whose element has tabular figures on: [{ text, where }] (empty when
 * none). A bracket's run is told by where the nearest character beside it in the same text is drawn: the character
 * after it lies to its left in a right-to-left run. A bracket with no character beside it takes its element's direction.
 */
export function rtlBracketsWithTabularFigures(page) {
  return page.evaluate((mirrored) => {
    const tabular = (cs) => /tabular-nums/.test(cs.fontVariantNumeric) || /["']tnum["'](?!\s*(?:0|off)\b)/.test(cs.fontFeatureSettings);
    const range = document.createRange();
    const rectAt = (node, i) => { range.setStart(node, i); range.setEnd(node, i + 1); return range.getBoundingClientRect(); };
    const centre = (r) => r.left + r.width / 2;
    const sameLine = (a, b) => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > Math.min(a.height, b.height) / 2;
    const where = (el) => {
      const parts = [];
      for (let e = el; e && e !== document.body && parts.length < 3; e = e.parentElement) {
        parts.unshift(`${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}${typeof e.className === 'string' && e.className.trim() ? `.${e.className.trim().split(/\s+/).join('.')}` : ''}`);
      }
      return parts.join(' > ');
    };
    const found = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walk.nextNode(); node; node = walk.nextNode()) {
      const text = node.data;
      if (![...text].some((c) => mirrored.includes(c))) continue;
      const el = node.parentElement;
      if (!el || !tabular(getComputedStyle(el))) continue;
      for (let i = 0; i < text.length; i += 1) {
        if (!mirrored.includes(text[i])) continue;
        const r = rectAt(node, i);
        if (!r.width || !r.height) continue; // not drawn
        let rtl = null;
        for (let d = 1; rtl === null && d < text.length; d += 1) {
          for (const j of [i + d, i - d]) {
            if (j < 0 || j >= text.length || /\s/.test(text[j])) continue;
            const n = rectAt(node, j);
            if (!n.width || !sameLine(r, n)) continue;
            rtl = j > i ? centre(n) < centre(r) : centre(n) > centre(r);
            break;
          }
        }
        if (rtl === null) rtl = getComputedStyle(el).direction === 'rtl';
        if (rtl) { found.push({ text: text.trim().slice(0, 60), where: where(el) }); break; }
      }
    }
    return found;
  }, MIRRORED);
}

/** No bracket in right-to-left text is set with tabular figures (Chromium would draw it wide, apart from its words). */
export async function expectNoTabularBrackets(page, what = '') {
  const found = await rtlBracketsWithTabularFigures(page);
  expect(found, `brackets in right-to-left text set with tabular figures${what ? ` on ${what}` : ''}: Chromium draws them 0.6 em wide, apart from the words they hold (e2e/bidi.js)`).toEqual([]);
}

/**
 * How the brackets in an element's text are drawn, in the order of the text: [{ char, bulge, inner, advance, gapIn }]
 * - bulge: 'right' for a stroke whose middle lies right of its ends (shaped like ")"), 'left' for one shaped like "(";
 * - inner: the side of the bracket where the words it holds are drawn ('left' or 'right'): the character after an
 *   opening bracket, before a closing one (a line never breaks between them);
 * - advance: the bracket's width in em (Rubik's own bracket is 0.319 em wide, its tabular one 0.6 em);
 * - gapIn: the blank between the bracket's ink and the ink of the words it holds, in em (null: none within 0.6 em).
 * Each bracket is photographed with 0.6 em on either side, and the ink of the picture is weighed: the middle third of
 * the stroke against its two ends, and the blank columns beside it.
 */
export async function bracketShapes(locator) {
  const page = locator.page();
  await locator.scrollIntoViewIfNeeded();
  const boxes = await locator.evaluate((root, mirrored) => {
    const OPEN = '([{<';
    const range = document.createRange();
    const rectOf = ({ node, i }) => { range.setStart(node, i); range.setEnd(node, i + 1); return range.getBoundingClientRect(); };
    // the element's characters in the order of its text, across its text nodes
    const chars = [];
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walk.nextNode(); node; node = walk.nextNode()) for (let i = 0; i < node.data.length; i += 1) chars.push({ node, i, c: node.data[i] });
    const out = [];
    chars.forEach((ch, k) => {
      if (!mirrored.includes(ch.c)) return;
      const r = rectOf(ch);
      if (!r.width || !r.height) return;
      // the first drawn character it holds: after an opening bracket, before a closing one
      const step = OPEN.includes(ch.c) ? 1 : -1;
      let inner = null;
      for (let j = k + step; j >= 0 && j < chars.length; j += step) {
        if (/\s/.test(chars[j].c)) continue;
        const n = rectOf(chars[j]);
        if (!n.width) continue;
        inner = n.left + n.width / 2 < r.left + r.width / 2 ? 'left' : 'right';
        break;
      }
      out.push({ char: ch.c, inner, x: r.left, y: r.top, width: r.width, height: r.height, em: parseFloat(getComputedStyle(ch.node.parentElement).fontSize) });
    });
    return out;
  }, MIRRORED);
  const { dpr, vw } = await page.evaluate(() => ({ dpr: devicePixelRatio, vw: document.documentElement.clientWidth }));
  const shapes = [];
  for (const b of boxes) {
    const x0 = Math.max(0, Math.floor(b.x - 0.6 * b.em));
    const x1 = Math.min(vw, Math.ceil(b.x + b.width + 0.6 * b.em));
    const png = await page.screenshot({ clip: { x: x0, y: b.y, width: x1 - x0, height: b.height }, animations: 'disabled', caret: 'hide' });
    const read = await page.evaluate(async ([b64, from, to]) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const canvas = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height);
      // the background is the commonest colour; a pixel is ink when it is far enough from it
      const count = new Map();
      for (let p = 0; p < data.length; p += 4) { const k = (data[p] << 16) | (data[p + 1] << 8) | data[p + 2]; count.set(k, (count.get(k) || 0) + 1); }
      const bg = [...count].sort((a, c) => c[1] - a[1])[0][0];
      const [br, bgG, bb] = [(bg >> 16) & 255, (bg >> 8) & 255, bg & 255];
      const ink = (x, y) => { const p = (y * width + x) * 4; const v = Math.hypot(data[p] - br, data[p + 1] - bgG, data[p + 2] - bb); return v > 60 ? v : 0; };
      // the bracket: the ink inside its own box
      const rows = [];
      let left = Infinity; let right = -Infinity;
      for (let y = 0; y < height; y += 1) {
        let w = 0; let wx = 0;
        for (let x = from; x < to; x += 1) { const v = ink(x, y); if (v) { w += v; wx += v * x; left = Math.min(left, x); right = Math.max(right, x); } }
        if (w) rows.push({ y, w, wx });
      }
      if (rows.length < 4) return null;
      const top = rows[0].y; const bottom = rows[rows.length - 1].y; const span = bottom - top + 1;
      const band = (a, z) => {
        const rs = rows.filter((r) => r.y >= top + a * span && r.y < top + z * span);
        const w = rs.reduce((s, r) => s + r.w, 0);
        return w ? rs.reduce((s, r) => s + r.wx, 0) / w : null;
      };
      const ends = [band(0, 0.25), band(0.75, 1.01)].filter((v) => v !== null);
      const middle = band(1 / 3, 2 / 3);
      const d = middle === null || !ends.length ? 0 : middle - ends.reduce((s, v) => s + v, 0) / ends.length;
      // beside it: the nearest column with ink at the bracket's height, on each side
      const inkAt = (x) => { for (let y = top; y <= bottom; y += 1) if (ink(x, y)) return true; return false; };
      let nl = null; for (let x = from - 1; x >= 0; x -= 1) if (inkAt(x)) { nl = x; break; }
      let nr = null; for (let x = to; x < width; x += 1) if (inkAt(x)) { nr = x; break; }
      return { bulge: Math.abs(d) < 0.25 ? null : d > 0 ? 'right' : 'left', gapLeft: nl === null ? null : left - nl - 1, gapRight: nr === null ? null : nr - right - 1 };
    }, [png.toString('base64'), Math.round((b.x - x0) * dpr), Math.round((b.x + b.width - x0) * dpr)]);
    const em = (px) => (px === null || px === undefined ? null : Math.round((px / dpr / b.em) * 1000) / 1000);
    shapes.push({
      char: b.char, bulge: read?.bulge ?? null, inner: b.inner, advance: Math.round((b.width / b.em) * 1000) / 1000,
      gapIn: b.inner === 'left' ? em(read?.gapLeft) : b.inner === 'right' ? em(read?.gapRight) : null,
    });
  }
  return shapes;
}

/** Rubik's own round bracket is 0.319 em wide and its tabular one 0.6 em: a bracket wider than this is a tabular one. */
const PLAIN_ADVANCE = 0.45;
/**
 * The most blank there may be between a bracket and the word it holds: Rubik's own bracket leaves 0.025 em and its
 * letters and digits at most 0.086 em (0.111 em together); the tabular bracket alone leaves 0.171 em.
 */
const HUG = 0.15;

/**
 * The round brackets of a label are drawn as a reader expects: each bulges away from the words it holds (so it faces
 * them), is Rubik's own bracket and not its wide tabular one, and sits close to those words. In a Hebrew line the "("
 * stands right of the words and is drawn as ")", whichever line each bracket falls on.
 */
export async function expectBracketsFaceIn(locator, what = '') {
  const shapes = (await bracketShapes(locator)).filter((s) => s.char === '(' || s.char === ')');
  expect(shapes.length, `${what}: brackets drawn`).toBeGreaterThan(0);
  const away = { left: 'right', right: 'left' };
  expect(shapes.map((s) => [s.char, s.bulge]), `${what}: each bracket faces the words it holds`)
    .toEqual(shapes.map((s) => [s.char, away[s.inner] ?? 'no words beside it']));
  expect(shapes.filter((s) => !(s.advance < PLAIN_ADVANCE)), `${what}: brackets set as Rubik's own, not its 0.6 em tabular ones`).toEqual([]);
  expect(shapes.filter((s) => !(s.gapIn <= HUG)), `${what}: each bracket sits close to the words it holds (at most ${HUG} em of blank)`).toEqual([]);
}
