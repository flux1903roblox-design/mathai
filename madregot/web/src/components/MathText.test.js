import { describe, it, expect, vi, beforeAll } from 'vitest';
import katex from 'katex';
import { texText, renderTex, escapeHtml, loadKatex } from './MathText.jsx';

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
      expect(out, t).toMatch(/^<span><span class="mt-inline"><span class="katex">/);
      expect(out, t).not.toContain('class="num"');
    }
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
