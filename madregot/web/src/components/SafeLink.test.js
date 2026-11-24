// Links in the tutor's replies (trust spec TRUST-4 §4.2): an anchor only to an allowed host, plain text otherwise.
import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SUPPORT } from '@shared/safety.js';
// (they live in the markdown file RichText loads, components/Markdown.jsx: DURABLE-11)
import Markdown, { SafeLink, SafeImage } from './Markdown.jsx';

const html = (el) => renderToStaticMarkup(el);

describe('SafeLink', () => {
  it('shows a link to a host nobody checked as plain text', () => {
    const out = html(h(SafeLink, { href: 'https://evil.example' }, 'פתרונות'));
    expect(out).not.toContain('<a');
    expect(out).not.toContain('evil.example');
    expect(out).toContain('פתרונות');
  });
  it('renders an anchor for WhatsApp and the support sites, opening in a new tab with no opener', () => {
    const out = html(h(SafeLink, { href: 'https://wa.me/972528451201' }, 'וואטסאפ'));
    expect(out).toBe('<a href="https://wa.me/972528451201" target="_blank" rel="noopener noreferrer">וואטסאפ</a>');
    for (const href of [SUPPORT.eran.web, SUPPORT.sahar.web, 'https://parents.education.gov.il/x']) expect(html(h(SafeLink, { href }, 'x'))).toContain('<a ');
  });
  it('rejects look-alike hosts and other schemes; a support number may be dialled', () => {
    for (const href of ['https://evil-gov.il/', 'https://gov.il.evil.example/', 'javascript:alert(1)', 'tel:0521234567', undefined]) {
      expect(html(h(SafeLink, { href }, 'x'))).not.toContain('<a');
    }
    expect(html(h(SafeLink, { href: 'tel:1201' }, '1201'))).toBe('<a href="tel:1201">1201</a>');
  });
  it('never loads an image from a reply; its words stay', () => {
    expect(html(h(SafeImage, { src: 'https://wa.me/a.png', alt: 'תמונה' }))).toBe('<span class="md-link-text">תמונה</span>');
    expect(html(h(SafeImage, { src: 'https://evil.example/a.png' }))).toBe('');
  });
  it('is what the tutor\'s Markdown uses, inline or not', () => {
    for (const inline of [false, true]) {
      const out = html(h(Markdown, { inline }, 'ראו [כאן](https://evil.example) ו[ער״ן](https://www.eran.org.il/online-emotional-help/) ![x](https://evil.example/x.png)'));
      expect(out).not.toContain('evil.example');
      expect(out).toContain('href="https://www.eran.org.il/online-emotional-help/"');
      expect(out).not.toContain('<img');
    }
  });
  it('the app\'s own text (the legal pages, trusted) keeps its links as written', () => {
    const out = html(h(Markdown, { trusted: true, math: false }, 'ראו [האתר](https://www.gov.il/he/departments/the_privacy_protection_authority) ו[דוגמה](https://example.org/x)'));
    expect(out).toContain('href="https://example.org/x"');
  });
});
