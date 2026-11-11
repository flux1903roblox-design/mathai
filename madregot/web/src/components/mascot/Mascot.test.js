// מדי wears the student's look (STUDENT-3): his colour sets the --madi-* tokens on his own drawing, and an item worn
// draws inside his body group. Rendered on the server (react-dom/server and react-dom/static), with no browser.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { prerenderToNodeStream } from 'react-dom/static';
import Mascot from '@/components/Mascot.jsx';
import Accessories, { ItemArt, DRAWN } from './Accessories.jsx';
import { ITEMS, DEFAULT_LOOK } from '@/lib/wardrobe.js';

/** Render and wait for anything lazy (the accessories) to load. */
async function full(el) {
  const { prelude } = await prerenderToNodeStream(el);
  let html = '';
  for await (const chunk of prelude) html += chunk;
  return html;
}

describe('Mascot wears the look', () => {
  it('a colour sets his --madi-* tokens on the drawing (violet: --madi-lo #7048e8)', () => {
    const html = renderToStaticMarkup(createElement(Mascot, { look: { ...DEFAULT_LOOK, color: 'violet' } }));
    expect(html).toMatch(/<svg[^>]*style="[^"]*--madi-lo:#7048e8/);
    expect(html).toMatch(/--madi-hi:#9a7bff/);
  });

  it('the default colour leaves the tokens to tokens.css, and he keeps his "+" mark', () => {
    const html = renderToStaticMarkup(createElement(Mascot, {}));
    expect(html).not.toMatch(/<svg[^>]*style=/);
    expect(html).toContain('M104 88 V102 M97 95 H111');
    expect(html).not.toContain('data-item');
  });

  it('an item on the head draws as <g data-item="compass-cap"> inside his body group', async () => {
    const html = await full(createElement(Mascot, { look: { ...DEFAULT_LOOK, head: 'compass-cap' } }));
    expect(html).toContain('<g data-item="compass-cap">');
    // inside the moving body group: after the feet, before the group closes and the thought bubble
    expect(html.indexOf('data-item="compass-cap"')).toBeGreaterThan(html.indexOf('x="34" y="124"'));
  });

  it('a pin on the low step hides the "+" there', async () => {
    const html = await full(createElement(Mascot, { look: { ...DEFAULT_LOOK, body: 'bars-pin' } }));
    expect(html).not.toContain('M104 88 V102 M97 95 H111');
    expect(html).toContain('<g data-item="bars-pin">');
  });

  it('every item in the catalogue has a drawing, with tokens only (no colour literal)', () => {
    expect(DRAWN).toEqual(ITEMS.map((i) => i.id));
    for (const i of ITEMS) {
      const html = renderToStaticMarkup(createElement('svg', null, createElement(Accessories, { look: { ...DEFAULT_LOOK, [i.slot]: i.id, classColor: 'cobalt' } })));
      expect(html, i.id).toContain(`data-item="${i.id}"`);
      expect(html, i.id).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
      expect(renderToStaticMarkup(createElement(ItemArt, { id: i.id })), i.id).toContain(`data-item="${i.id}"`);
    }
  });

  it('the class scarf is drawn in the class\'s first unit colour', () => {
    const html = renderToStaticMarkup(createElement('svg', null, createElement(Accessories, { look: { ...DEFAULT_LOOK, neck: 'class-scarf', classColor: 'cobalt' } })));
    expect(html).toContain('var(--ch-cobalt)');
  });
});
