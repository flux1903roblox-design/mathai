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
