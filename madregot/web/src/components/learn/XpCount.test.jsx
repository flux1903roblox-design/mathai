// The XP count-up (PRODUCT2-38): on the stage's end and the lesson's end the XP rolls up from 0 and lands with a small
// pop. A screen reader hears the final number at once, and under reduced motion the screen shows it at once too: no
// counting, nothing to wait for. Rendered to HTML on the server (no effects run), as the first frame a student sees.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

let reduce = false;
vi.mock('motion/react', async (load) => ({ ...(await load()), useReducedMotion: () => reduce }));

const { default: XpCount } = await import('./XpCount.jsx');

/** What the eye sees (the part hidden from screen readers) and what a screen reader hears. */
function parts(html) {
  const seen = html.match(/<span[^>]*aria-hidden="true"[^>]*>([^<]*)<\/span>/)?.[1];
  const heard = html.match(/<span class="visually-hidden">([^<]*)<\/span>/)?.[1];
  return { seen, heard };
}

afterEach(() => { reduce = false; });

describe('XpCount', () => {
  it('under reduced motion the final number is on screen at once, with nothing left to count', () => {
    reduce = true;
    const html = renderToStaticMarkup(<XpCount value={25} />);
    expect(parts(html)).toEqual({ seen: '+25', heard: '+25 XP' });
    expect(html).toContain('data-done="true"');
  });

  it('with motion the number starts from 0 and counts up, while a screen reader already has the final number', () => {
    const html = renderToStaticMarkup(<XpCount value={25} />);
    expect(parts(html)).toEqual({ seen: '+0', heard: '+25 XP' });
    expect(html).toContain('data-done="false"');
  });

  it('nothing to count (0 XP, a stage done before) is shown still', () => {
    const html = renderToStaticMarkup(<XpCount value={0} />);
    expect(parts(html)).toEqual({ seen: '+0', heard: '+0 XP' });
    expect(html).toContain('data-done="true"');
  });

  it('the label can be left out (a tile that already says XP), and a prefix can be left out (today\'s total)', () => {
    reduce = true;
    expect(renderToStaticMarkup(<XpCount value={40} unit={false} />)).not.toMatch(/aria-hidden="true"[^>]*>[^<]*XP/);
    expect(parts(renderToStaticMarkup(<XpCount value={40} plus={false} />)).seen).toBe('40');
  });
});
