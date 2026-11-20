// The help line inside every refusal (COUNCIL2-4): the quiet link to the people to talk to, and ער״ן's number as a
// call button beside it. Rendered to HTML here; e2e/trust.spec.js checks it is in each refusal, 44px tall, on a phone.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { HelpLine } from './SupportSheet.jsx';
import ToolLocked from './ToolLocked.jsx';

const html = (el) => renderToStaticMarkup(<MemoryRouter>{el}</MemoryRouter>);

describe('HelpLine', () => {
  it('the link that opens the people to talk to, and a tel: link to ער״ן 1201 with its hours in the name', () => {
    const out = html(<HelpLine className="limit-support" />);
    expect(out).toMatch(/^<div class="help-line limit-support">/);
    expect(out).toContain('aria-haspopup="dialog">צריכים לדבר עם מישהו?</button>');
    expect(out).toContain('href="tel:1201"');
    expect(out).toContain('aria-label="ער״ן, חיוג 1201, בכל שעה"');
    expect(out).toContain('<span>ער״ן 1201</span>');
    // a phone link works with no network, and the line never speaks of money
    expect(out).not.toMatch(/href="https?:/);
    for (const w of ['₪', 'מנוי', 'מחיר']) expect(out).not.toContain(w);
  });

  it('a tool this device does not have today carries it too', () => {
    const out = html(<ToolLocked kind="check" state="locked" />);
    expect(out).toContain('class="help-line tool-locked-help"');
    expect(out).toContain('href="tel:1201"');
  });
});
