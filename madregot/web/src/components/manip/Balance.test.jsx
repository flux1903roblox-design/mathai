// The balance's four groups are buttons a screen reader names: what is taken off, and from which pan, in plain Hebrew
// ("להוריד קופסה מהכף השמאלית"). The council read 'מהכף ההשמאלית' (a doubled ה) from the DOM on eq:3. The drag and the
// keys run in the browser (e2e/manip.spec.js).
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Balance from './Balance.jsx';

const m = { kind: 'balance', start: { lx: 3, l1: 5, rx: 1, r1: 11 } };
const labels = (html) => [...html.matchAll(/role="button"[^>]*aria-label="([^"]+)"|aria-label="([^"]+)"[^>]*role="button"/g)].map((x) => x[1] || x[2]);

describe('the balance names its groups for a screen reader', () => {
  it('says which pan with one definite article: מהכף השמאלית, מהכף הימנית', () => {
    const html = renderToStaticMarkup(<Balance m={m} onChange={() => {}} answer={3} />);
    const said = labels(html);
    expect(said).toEqual([
      'להוריד קופסה מהכף השמאלית (יש 3)',
      'להוריד משקולת מהכף השמאלית (יש 5)',
      'להוריד קופסה מהכף הימנית (יש 1)',
      'להוריד משקולת מהכף הימנית (יש 11)',
    ]);
    expect(html).not.toContain('ההשמאלית');
    expect(html).not.toContain('ההימנית');
  });
});
