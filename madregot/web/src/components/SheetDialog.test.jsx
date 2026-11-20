// Where the focus goes when a sheet closes (finalFocusFor): back to the button that opened it this time, even when the
// sheet was opened again while it was still closing (the wardrobe's coming pieces share one sheet); left alone when it
// went somewhere else on purpose.
import { describe, it, expect } from 'vitest';
import { finalFocusFor } from './SheetDialog.jsx';

const body = { tag: 'body' };
const doc = { body };
const el = (name, connected = true) => ({ name, isConnected: connected });
const sheet = (...inside) => ({ contains: (x) => inside.includes(x) });

describe('finalFocusFor', () => {
  const tie = el('פפיון'); const scarf = el('סיכת מראה'); const close = el('close');

  it('gives the focus back to the button that opened the sheet last, from inside the sheet or from the page\'s body', () => {
    expect(finalFocusFor(scarf, close, sheet(close), doc)).toBe(scarf);
    expect(finalFocusFor(scarf, body, sheet(close), doc)).toBe(scarf);
    expect(finalFocusFor(scarf, null, sheet(close), doc)).toBe(scarf);
    // the opener read on the latest opening wins, whichever button opened the popup first
    expect(finalFocusFor(tie, close, sheet(close), doc)).toBe(tie);
  });

  it('leaves the focus where it went when it left the sheet (a link followed, another sheet opened)', () => {
    const elsewhere = el('unit name');
    expect(finalFocusFor(scarf, elsewhere, sheet(close), doc)).toBe(false);
    expect(finalFocusFor(scarf, elsewhere, null, doc)).toBe(false);
  });

  it('lets Base UI decide when there is no button to go back to', () => {
    expect(finalFocusFor(null, close, sheet(close), doc)).toBe(true);
    expect(finalFocusFor(body, close, sheet(close), doc)).toBe(true);
    expect(finalFocusFor(el('gone', false), close, sheet(close), doc)).toBe(true);
  });
});
