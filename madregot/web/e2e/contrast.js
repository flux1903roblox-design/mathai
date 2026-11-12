// WCAG contrast probes for the end-to-end tests (STUDENT-2, light and dark). They read computed colours in the page
// and use the WCAG 2 formula (the same as src/styles/tokens.test.js).
// - expectTextContrast: every visible text node against the background it sits on (4.5:1, or 3:1 for large text).
// - expectNonTextContrast: control edges, stops and the focus ring (3:1, WCAG 1.4.11), which axe does not check.
// axe (e2e/axe.js, run on every screen by a11y.spec.js) checks text contrast too; these probes stay for what axe leaves
// out: control edges, and text over a gradient or a picture, which axe reports as "needs review" rather than a failure.
import { expect } from '@playwright/test';

// Runs in the page: colour parsing, compositing and the ratio. Kept as a string so both probes share it.
const LIB = `
  const parse = (s) => {
    if (!s || s === 'transparent' || s === 'none') return null;
    let m = s.match(/^rgba?\\(([^)]+)\\)$/);
    if (m) { const p = m[1].split(/[\\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    m = s.match(/^color\\(srgb ([^)]+)\\)$/);
    if (m) { const p = m[1].split(/[\\s/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1]; }
    return null;
  };
  const colours = (s) => (String(s).match(/rgba?\\([^)]*\\)|color\\(srgb [^)]*\\)/g) || []).map(parse).filter(Boolean);
  const over = (top, under) => { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1); };
  const lum = (c) => { const [r, g, b] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const hex = (c) => c ? '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('') : '?';
  const pageBg = () => parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1];
  // the backgrounds an element is painted on, from the element up to the first opaque one: a list of possible solid
  // colours (a gradient gives one per stop, so the check takes the worst), or null when an image is behind it
  const backdrops = (el) => {
    const layers = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const img = cs.backgroundImage;
      if (img && img !== 'none') {
        if (/url\\(/.test(img)) return null;
        const stops = colours(img);
        const base = parse(cs.backgroundColor);
        if (stops.length) {
          const solid = base && base[3] >= 0.99;
          layers.push({ alts: solid ? stops.map((c) => over(c, base)) : stops });
          if (solid || stops.every((c) => c[3] >= 0.99)) return finish(layers);
          continue;
        }
      }
      const bg = parse(cs.backgroundColor);
      if (bg && bg[3] > 0) { layers.push({ alts: [bg] }); if (bg[3] >= 0.99) return finish(layers); }
    }
    layers.push({ alts: [pageBg()] });
    return finish(layers);
  };
  const finish = (layers) => {
    let acc = [[255, 255, 255, 1]];
    for (let i = layers.length - 1; i >= 0; i--) acc = acc.flatMap((u) => layers[i].alts.map((c) => over(c, u)));
    return acc;
  };
  const opacityOf = (el) => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return o; };
  const visible = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false; return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const inactive = (el) => !!el.closest(':disabled, [aria-disabled="true"], [inert]');
  // entrances and fades are measured at their end, as the student reads the screen
  for (const a of document.getAnimations()) { try { a.finish(); } catch { /* an endless one */ } }
`;

/** Text nodes on screen whose contrast is under 4.5:1 (3:1 for large text): [{ text, fg, bg, ratio, need }]. */
export function textContrastFailures(page, { root = 'body' } = {}) {
  return page.evaluate(([LIBSRC, rootSel]) => {
    // eslint-disable-next-line no-new-func
    return new Function('rootSel', `${LIBSRC}
      const out = [];
      const root = document.querySelector(rootSel) || document.body;
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const text = n.textContent.replace(/\\s+/g, ' ').trim();
        if (!text || !/[\\p{L}\\p{N}]/u.test(text)) continue;
        const el = n.parentElement;
        if (!el || !visible(el) || inactive(el)) continue;
        const cs = getComputedStyle(el);
        const svg = el instanceof SVGElement;
        let fg = parse(svg ? cs.fill : cs.color);
        if (!fg || fg[3] === 0) continue;
        fg = [fg[0], fg[1], fg[2], fg[3] * opacityOf(el)];
        const bgs = backdrops(el);
        if (!bgs) continue;
        const size = parseFloat(cs.fontSize); const bold = Number(cs.fontWeight) >= 700;
        const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
        let worst = Infinity; let worstBg = null;
        for (const bg of bgs) { const r = ratio(over(fg, bg), bg); if (r < worst) { worst = r; worstBg = bg; } }
        if (worst < need - 0.005) out.push({ text: text.slice(0, 40), cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || el.tagName, fg: hex(fg), bg: hex(worstBg), ratio: Math.round(worst * 100) / 100, need });
      }
      return out;
    `)(rootSel);
  }, [LIB, root]);
}

export async function expectTextContrast(page, what = '') {
  const bad = await textContrastFailures(page);
  expect(bad, `text under AA ${what}`).toEqual([]);
}

/**
 * Edges and marks that must reach 3:1 (WCAG 1.4.11), measured on the screen as it is:
 * - a done or current stop: its ring (dark) or its face (light) against the page;
 * - .input and .seg borders against their own background and against what they sit on;
 * - a checked .seg's border against the card it sits on.
 */
export function nonTextPairs(page) {
  return page.evaluate((LIBSRC) => new Function(`${LIBSRC}
    const out = [];
    const bodyBg = pageBg();
    for (const el of document.querySelectorAll('.node-current, .node-done')) {
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      const ring = cs.boxShadow.match(/(rgba?\\([^)]*\\)|color\\(srgb [^)]*\\))\\s+0px\\s+0px\\s+0px\\s+([\\d.]+)px/);
      const edge = ring && Number(ring[2]) > 0 ? parse(ring[1]) : parse(cs.backgroundColor);
      out.push({ what: 'stop ' + (el.getAttribute('aria-label') || el.className).slice(0, 30), a: hex(edge), b: hex(bodyBg), ratio: ratio(edge, bodyBg) });
    }
    for (const el of document.querySelectorAll('.input, .seg')) {
      if (!visible(el) || inactive(el)) continue;
      const cs = getComputedStyle(el);
      const line = parse(cs.borderTopColor);
      const own = parse(cs.backgroundColor);
      const under = el.parentElement ? backdrops(el.parentElement) : [bodyBg];
      const checked = el.matches('.seg[aria-checked="true"], .seg.on, .seg[aria-pressed="true"]');
      const name = (el.matches('.input') ? 'input ' : checked ? 'checked seg ' : 'seg ') + (el.getAttribute('aria-label') || el.id || el.textContent.trim()).slice(0, 24);
      for (const u of under || []) out.push({ what: name + ' vs card', a: hex(line), b: hex(u), ratio: ratio(over(line, u), u) });
      if (!checked && own && own[3] > 0.5) out.push({ what: name + ' vs own background', a: hex(line), b: hex(own), ratio: ratio(line, own) });
    }
    return out.map((p) => ({ ...p, ratio: Math.round(p.ratio * 100) / 100 }));
  `)(), LIB);
}

/** The outline colour of the element that has keyboard focus, against what it sits on. */
export function focusRingPair(page) {
  return page.evaluate((LIBSRC) => new Function(`${LIBSRC}
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    if (cs.outlineStyle === 'none' || parseFloat(cs.outlineWidth) === 0) return { what: 'focus ' + el.tagName, none: true };
    const line = parse(cs.outlineColor);
    const under = el.parentElement ? backdrops(el.parentElement) : [pageBg()];
    let worst = Infinity; let bg = null;
    for (const u of under || [pageBg()]) { const r = ratio(over(line, u), u); if (r < worst) { worst = r; bg = u; } }
    return { what: 'focus ' + (el.getAttribute('aria-label') || el.textContent.trim()).slice(0, 24), a: hex(line), b: hex(bg), ratio: Math.round(worst * 100) / 100 };
  `)(), LIB);
}

/** Every pair from nonTextPairs (and the focus ring, if given) at 3:1 or more. */
export async function expectNonTextContrast(page, extra = []) {
  const pairs = [...(await nonTextPairs(page)), ...extra.filter(Boolean)];
  const bad = pairs.filter((p) => p.none || p.ratio < 3);
  expect(bad, 'edges under 3:1').toEqual([]);
  return pairs;
}
