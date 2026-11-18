import { describe, it, expect, vi, beforeAll } from 'vitest';
import katex from 'katex';
import { texText, renderTex, escapeHtml, loadKatex, fitScale } from './MathText.jsx';

describe('texText: maths as words for a screen reader', () => {
  it('says a lone comparison sign in Hebrew', () => {
    expect(texText('<')).toBe('קטן מ־');
    expect(texText('>')).toBe('גדול מ־');
    expect(texText('=')).toBe('שווה ל־');
    expect(texText('\\le')).toBe('קטן או שווה ל־');
  });
  it('turns common TeX into readable text', () => {
    expect(texText('\\frac{3}{4}')).toBe('3/4');
    expect(texText('-\\frac{1}{2} \\cdot 6')).toBe('-1/2 × 6');
    expect(texText('\\sqrt{25}')).toBe('√25');
    expect(texText('a^2 + b^{2}')).toBe('a² + b²');
    // a table of values (a choice of func:2) is read row by row, not as its column spec and \hline
    expect(texText('\\begin{array}{c|cccc} x & 1 & 2 & 2 & 3 \\\\ \\hline y & 4 & 5 & 7 & 8 \\end{array}')).toBe('x: 1, 2, 2, 3; y: 4, 5, 7, 8');
    expect(texText('\\begin{array}{|c|c|} \\hline 1 & 2 \\\\ \\hline 3 & 4 \\\\ \\hline \\end{array}')).toBe('1, 2; 3, 4');
    expect(texText('90^\\circ')).toBe('90°');
    expect(texText('x \\le 3')).toBe('x ≤ 3');
  });
});

describe('KaTeX loads after the first screen (DURABLE-11)', () => {
  it('until it is here, an expression is plain words, escaped; then it is drawn', async () => {
    expect(renderTex('x \\le 3')).toBe('<span class="tex-plain" dir="ltr">x ≤ 3</span>');
    expect(renderTex('<img src=x onerror="alert(1)">')).not.toContain('<img');
    await loadKatex();
    expect(renderTex('x \\le 3')).toContain('class="katex"');
  });
  it('is fetched once', () => {
    expect(loadKatex()).toBe(loadKatex());
  });
});

describe('renderTex: a TeX failure is shown as text, never as HTML', () => {
  beforeAll(() => loadKatex());
  it('renders TeX with KaTeX', () => {
    expect(renderTex('\\frac{1}{2}')).toContain('katex');
  });
  it('escapes the TeX when KaTeX throws', () => {
    const spy = vi.spyOn(katex, 'renderToString').mockImplementation(() => { throw new Error('boom'); });
    const html = renderTex('<img src=x onerror="alert(1)">');
    expect(html).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(html).not.toContain('<img');
    spy.mockRestore();
  });
  it('escapeHtml covers the five characters', () => {
    expect(escapeHtml(`<a href='x'>&"</a>`)).toBe('&lt;a href=&#39;x&#39;&gt;&amp;&quot;&lt;/a&gt;');
  });
});

// STUDENT-9 §3: maths in a sentence uses the sentence's digits.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MathText, mathPlain, plainNumber, splitFirstSentence } from './MathText.jsx';

const html = (text) => renderToStaticMarkup(createElement(MathText, { text }));

describe('MathText: a bare number is plain text in Rubik, other maths stays KaTeX', () => {
  it('$-3$ is a bdi with a real minus sign', () => {
    expect(html('$-3$')).toBe('<span><bdi class="num" dir="ltr">−3</bdi></span>');
    expect(html('$-3$')).not.toContain('katex');
  });
  it('$(-4)$, a degree sign, a decimal and a plain number', () => {
    expect(html('$(-4)$')).toContain('<bdi class="num" dir="ltr">(−4)</bdi>');
    expect(html('$35^\\circ$')).toContain('<bdi class="num" dir="ltr">35°</bdi>');
    expect(html('$35^{\\circ}$')).toContain('<bdi class="num" dir="ltr">35°</bdi>');
    expect(html('$2.5$')).toContain('<bdi class="num" dir="ltr">2.5</bdi>');
    expect(html('מתחילים ב־$-2$ ומוסיפים $5$.')).toBe('<span><span>מתחילים ב־</span><bdi class="num" dir="ltr">−2</bdi><span> ומוסיפים </span><bdi class="num" dir="ltr">5</bdi><span>.</span></span>');
  });
  it('a letter, an operator or a fraction stays KaTeX, inside .mt-inline', () => {
    for (const t of ['$x+1$', '$\\frac{3}{4}$', '$x = -3$', '$-3 + 5$', '$2x$']) {
      const out = html(t);
      expect(out, t).toMatch(/^<span><span class="mt-inline[^"]*"><span class="katex">/);
      expect(out, t).not.toContain('class="num"');
    }
  });
  // PRODUCT2-41: maths inside a Hebrew sentence is set in the sentence's font (Rubik): its digits, operators and
  // letters. A fraction or a root keeps KaTeX's own layout and fonts, and display maths is not touched.
  it('inline maths in a sentence takes the UI font (.mt-ui); a fraction or a root keeps KaTeX', () => {
    for (const t of ['$x+1$', '$x = -3$', '$-3 + 5$', '$2x$', '$3^2 + 4^2$', '$a \\cdot b$']) expect(html(`נסו את ${t} עכשיו.`), t).toContain('<span class="mt-inline mt-ui"><span class="katex">');
    for (const t of ['$\\frac{3}{4}$', '$x = \\frac{1}{2}$', '$\\sqrt{25}$', '$\\dfrac{2}{3}x$']) {
      const out = html(t);
      expect(out, t).toContain('<span class="mt-inline"><span class="katex">');
      expect(out, t).not.toContain('mt-ui');
    }
  });
  it('the UI font class sets Rubik on the whole expression, letters upright (canon.css)', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(new URL('../styles/canon.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.mt-ui \.katex\s*\{[^}]*font-family:\s*var\(--font-ui\)/);
    expect(css).toMatch(/\.mt-ui \.katex \.mathnormal[^{]*\{[^}]*font-family:\s*var\(--font-ui\);[^}]*font-style:\s*normal/);
  });
  it('plainNumber says which TeX is only a number', () => {
    expect(plainNumber('-3')).toBe('−3');
    expect(plainNumber(' 12 ')).toBe('12');
    expect(plainNumber('+5')).toBe('+5');
    expect(plainNumber('x')).toBeNull();
    expect(plainNumber('3x')).toBeNull();
    expect(plainNumber('\\frac{1}{2}')).toBeNull();
    expect(plainNumber('3^2')).toBeNull();
  });
  it('mathPlain (accessible names) is unchanged', () => {
    expect(mathPlain('$-3$')).toBe('-3');
    expect(mathPlain('מ־$-2$ ל־$35^\\circ$')).toBe('מ־-2 ל־35°');
  });
});

describe('splitFirstSentence: the "not yet" help shows its first sentence first (STUDENT-9 §2)', () => {
  it('splits after the first sentence, outside the maths', () => {
    expect(splitFirstSentence('חיבור של מספר חיובי מזיז ימינה. ספרו 5 צעדים מ־$-2$.')).toEqual(['חיבור של מספר חיובי מזיז ימינה.', 'ספרו 5 צעדים מ־$-2$.']);
    expect(splitFirstSentence('מה יוצא? נסו שוב.')).toEqual(['מה יוצא?', 'נסו שוב.']);
  });
  it('a decimal point inside the maths, or a single sentence, does not split', () => {
    expect(splitFirstSentence('הזיזו ל־$2. 5$ בערך')).toEqual(['הזיזו ל־$2. 5$ בערך', '']);
    expect(splitFirstSentence('רק משפט אחד.')).toEqual(['רק משפט אחד.', '']);
    expect(splitFirstSentence('')).toEqual(['', '']);
  });
});

// KaTeX draws once its text fonts are here: FitDisplay fits a display to its box by measuring it, and the first display
// of a page measured in the fallback serif was up to a sixth narrower than in KaTeX_Main, so it ran out of its box when
// the font came (stats:1 and signed:3 on a busy computer). A font that fails is not waited for, nor one past 3 seconds.
describe('KaTeX waits for its text fonts before it draws', () => {
  /** A fresh copy of MathText (KaTeX is fetched once per page) on a document whose fonts answer with `load`. */
  const withFonts = async (load, run) => {
    vi.resetModules();
    vi.stubGlobal('document', { fonts: { load } });
    try { await run(await import('./MathText.jsx')); } finally { vi.unstubAllGlobals(); vi.useRealTimers(); }
  };

  it('asks for KaTeX_Main and KaTeX_Math, and draws only when both answered (a font that failed counts as answered)', async () => {
    const asked = [];
    let release;
    const main = new Promise((r) => { release = r; });
    await withFonts((f) => { asked.push(f); return f.includes('KaTeX_Main') ? main : Promise.reject(new Error('offline')); }, async (m) => {
      let done = false;
      const drawn = m.loadKatex().then(() => { done = true; });
      await vi.waitFor(() => expect(asked).toEqual(['1em KaTeX_Main', 'italic 1em KaTeX_Math']));
      await new Promise((r) => setTimeout(r, 20));
      expect(done).toBe(false);
      expect(m.renderTex('x \\le 3')).toBe('<span class="tex-plain" dir="ltr">x ≤ 3</span>');
      release([]);
      await drawn;
      expect(m.renderTex('x \\le 3')).toContain('class="katex"');
    });
  });

  it('waits no longer than 3 seconds for a font that does not come', async () => {
    const asked = [];
    await withFonts((f) => { asked.push(f); return new Promise(() => {}); }, async (m) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      let done = false;
      const drawn = m.loadKatex().then(() => { done = true; });
      while (asked.length < 2) await vi.advanceTimersByTimeAsync(0); // eslint-disable-line no-await-in-loop
      await vi.advanceTimersByTimeAsync(2990);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(10);
      await drawn;
      expect(m.renderTex('x')).toContain('class="katex"');
    });
  });
});

// FitDisplay sets a display smaller until it fits its box. Where text is drawn hinted (Linux, GitHub's runner), each
// glyph's width is a whole pixel at every size, so a line does not shrink in proportion: one step left signed:3's
// "3 · (−2) = (−2) + (−2) + (−2)" a pixel too wide, a scroll box the keyboard could not reach (axe,
// scrollable-region-focusable). The line is measured again until it fits.
describe('fitScale: a display is measured again until it fits its box', () => {
  // the line of signed:3 in KaTeX_Main: each glyph's advance in em, every glyph a whole pixel (rounded up), and the
  // spaces around the operators (KaTeX's margins, 0.2222em around · and +, 0.2778em around =), which are not rounded
  const bracket = [0.389, 0.778, 0.5, 0.389]; // (−2)
  const glyphs = [0.5, 0.278, ...bracket, 0.778, ...bracket, 0.778, ...bracket, 0.778, ...bracket];
  const spaces = 6 * 0.2222 + 2 * 0.2778;
  const BASE = 29.376; // 27.2px × 1.08 (tokens.css)
  const hinted = (scale) => {
    const px = BASE * scale;
    return Math.round(glyphs.reduce((sum, em) => sum + Math.ceil(em * px), 0) + spaces * px);
  };
  const floor = Math.min(0.6, 15 / BASE);

  it('one step in proportion leaves the hinted line a pixel too wide, so it is measured again', () => {
    expect(hinted(1)).toBeGreaterThan(306);
    expect(hinted((306 / hinted(1)) * 0.97)).toBeGreaterThan(306); // the one step FitDisplay took before
    const asked = [];
    const scale = fitScale(306, hinted(1), floor, (s) => { asked.push(s); return hinted(s); });
    expect(hinted(scale)).toBeLessThanOrEqual(306);
    expect(asked.length).toBe(2);
    expect(scale).toBeGreaterThan(floor);
  });

  it('a line that shrinks in proportion takes one step; a line that fits is not touched', () => {
    const even = (s) => 400 * s;
    const asked = [];
    const scale = fitScale(306, even(1), 0.6, (s) => { asked.push(s); return even(s); });
    expect(asked).toHaveLength(1);
    expect(even(scale)).toBeLessThanOrEqual(306);
    expect(fitScale(306, 306, 0.6, () => { throw new Error('measured a line that fits'); })).toBe(1);
  });

  it('never goes below its smallest size: a line too long for the box stops there (and FitDisplay wraps it)', () => {
    const long = (s) => 900 * s;
    const scale = fitScale(306, long(1), 0.6, long);
    expect(scale).toBe(0.6);
    expect(long(scale)).toBeGreaterThan(306);
  });
});
