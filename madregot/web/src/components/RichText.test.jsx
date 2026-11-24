// Markdown off the first download (DURABLE-11): RichText shows the text as written until its markdown file has
// loaded, then Markdown draws it; the legal pages leave $ signs alone.
import { describe, it, expect, beforeAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RichText } from './RichText.jsx';
import Markdown from './Markdown.jsx';
import { loadKatex } from './MathText.jsx';

beforeAll(() => loadKatex());

describe('RichText', () => {
  it('before its file has loaded: the text as written, lines kept, its maths drawn, in the same box', () => {
    const html = renderToStaticMarkup(<RichText className="q-prompt">{'**שימו לב**\n1. $x = 3$'}</RichText>);
    expect(html).toMatch(/^<div class="md q-prompt" style="white-space:pre-line">/);
    expect(html).toContain('**שימו לב**');
    expect(html).toContain('class="katex"');
    expect(renderToStaticMarkup(<RichText inline>{'5'}</RichText>)).toMatch(/^<span class="md-inline"/);
    expect(renderToStaticMarkup(<RichText fallback={<p>טוענים…</p>}>{'x'}</RichText>)).toBe('<p>טוענים…</p>');
    expect(renderToStaticMarkup(<RichText as="article" className="legal" math={false}>{'a $5 b'}</RichText>)).toMatch(/^<article class="md legal"[^>]*>a \$5 b<\/article>$/);
  });
  it('once it has loaded: markdown, in the same box', async () => {
    await new Promise((done) => { setTimeout(done, 0); });
    expect(renderToStaticMarkup(<RichText className="q-prompt">{'**שימו לב**'}</RichText>)).toBe('<div class="md q-prompt"><p><strong>שימו לב</strong></p></div>');
    expect(renderToStaticMarkup(<RichText inline>{'**5**'}</RichText>)).toBe('<span class="md-inline"><span><strong>5</strong></span></span>');
  });
});

describe('Markdown (the file RichText loads)', () => {
  it('draws markdown and maths, and never raw HTML', () => {
    const html = renderToStaticMarkup(<Markdown className="md">{'**כן** $\\frac{1}{2}$ <img src=x onerror="alert(1)">'}</Markdown>);
    expect(html).toContain('<strong>כן</strong>');
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('<img');
  });
  it('without maths (the legal pages): a $ stays a $', () => {
    const html = renderToStaticMarkup(<Markdown as="article" className="md legal" math={false}>{'מחיר: $4 ו־$5 לחודש'}</Markdown>);
    expect(html).toBe('<article class="md legal"><p>מחיר: $4 ו־$5 לחודש</p></article>');
  });
});
