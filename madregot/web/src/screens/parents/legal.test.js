// The legal pages (trust spec TRUST-2): every {{NAME}} the texts use is one fillLegal knows, a full set of plans from
// the server leaves no blank, a copy without a server shows a visible blank, and the texts render with their anchors
// and in-app links. The owner pastes the lawyer's text over these files (TRUST-13 step 3); this test then says whether
// a new placeholder slipped in.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { DOCS, LEGAL_PLACEHOLDERS, fillLegal, legalValues, legalBody, LegalMarkdown } from './Legal.jsx';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../content/legal');
const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
const read = (f) => readFileSync(path.join(dir, f), 'utf8');
const names = (text) => [...String(text).matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]);

/** Plans as GET /api/billing/plans sends them with every legal var set (worker/test/helpers.js makeEnv, legal.test.js). */
const FULL = {
  paywall: true, online: true, vatMode: 'included', termsVersion: '2026-11',
  plans: [
    { id: 'family_month', amountAgorot: 2990 }, { id: 'family_year', amountAgorot: 24900 }, { id: 'class_year', seatAgorot: 4900 },
  ],
  limits: { family: { tutor: 30, check: 6, generate: 5, exam: 2, examMonthly: 10, devices: 3 }, free: { tutor: 2 } },
  business: { name: 'מדרגות בדיקה', id: '000000000', kind: 'עוסק מורשה', address: 'רחוב הבדיקה 1, תל אביב', email: 'hello@example.test', phone: '03-0000000', provider: 'ספק בדיקה' },
  accessibility: { name: 'רכזת בדיקה', phone: '03-0000001', email: 'access@example.test', date: '2026-11-02', tested: 'axe, VoiceOver' },
  contact: 'hello@example.test', legalDate: '2026-11-01', dbJurisdiction: 'eu', legalApproved: true, legalMissing: [],
};
const html = (text, plans = FULL) => renderToStaticMarkup(h(MemoryRouter, null, h(LegalMarkdown, { text, plans })));

describe('legal texts and their placeholders', () => {
  it('has the four pages and the safety statement, each one a route', () => {
    expect(files.sort()).toEqual(['accessibility.md', 'privacy.md', 'safety.md', 'terms.md']);
    expect(Object.keys(DOCS).sort()).toEqual(['accessibility', 'privacy', 'safety', 'terms']);
    for (const [k, d] of Object.entries(DOCS)) expect(d.text, k).toBe(read(`${k}.md`));
  });

  it('fillLegal knows every {{NAME}} in every .md file, and every name the full texts will use (TRUST-2 §4)', () => {
    for (const f of files) for (const n of names(read(f))) expect(LEGAL_PLACEHOLDERS, `${f}: {{${n}}}`).toContain(n);
    const spec = ['BUSINESS_NAME', 'BUSINESS_ID', 'BUSINESS_KIND', 'BUSINESS_ADDRESS', 'CONTACT_EMAIL', 'CONTACT_PHONE', 'TERMS_VERSION', 'LEGAL_DATE',
      'PRICE_MONTH', 'PRICE_YEAR', 'PRICE_SEAT', 'VAT_LINE', 'FAMILY_TUTOR', 'FAMILY_CHECK', 'FAMILY_EXAM', 'FAMILY_EXAM_MONTH', 'FAMILY_GENERATE',
      'FAMILY_DEVICES', 'FREE_TUTOR', 'PAYMENT_PROVIDER', 'DB_PLACE', 'ACCESS_NAME', 'ACCESS_PHONE', 'ACCESS_EMAIL', 'ACCESS_DATE', 'ACCESS_TESTED'];
    expect([...LEGAL_PLACEHOLDERS].sort()).toEqual([...spec].sort());
  });

  it('with full plans from the server, no blank is left; prices, limits, dates and the database place read as people write them', () => {
    for (const f of files) expect(fillLegal(read(f), FULL), f).not.toContain('______');
    const v = legalValues(FULL);
    expect(v).toMatchObject({
      PRICE_MONTH: '₪29.90', PRICE_YEAR: '₪249', PRICE_SEAT: '₪49', VAT_LINE: 'כולל מע״מ', DB_PLACE: 'באיחוד האירופי',
      LEGAL_DATE: '01.11.2026', ACCESS_DATE: '02.11.2026', FAMILY_TUTOR: 30, FAMILY_EXAM_MONTH: 10, FREE_TUTOR: 2,
      BUSINESS_KIND: 'עוסק מורשה', PAYMENT_PROVIDER: 'ספק בדיקה', TERMS_VERSION: '2026-11',
    });
    expect(legalValues({ ...FULL, vatMode: 'exempt' }).VAT_LINE).toBe('המחיר סופי');
    // a limit of 0 is a number to show, not a blank
    expect(fillLegal('{{FAMILY_GENERATE}}', { ...FULL, limits: { ...FULL.limits, family: { ...FULL.limits.family, generate: 0 } } })).toBe('0');
  });

  it('never names a place for the database the server did not say, and blanks every value without a server', () => {
    expect(fillLegal('{{DB_PLACE}}', { ...FULL, dbJurisdiction: '' })).toBe('______');
    expect(fillLegal('{{DB_PLACE}}', { ...FULL, dbJurisdiction: 'fedramp' })).toBe('______');
    const all = LEGAL_PLACEHOLDERS.map((n) => `{{${n}}}`).join(' ');
    expect(fillLegal(all, null)).toBe(LEGAL_PLACEHOLDERS.map(() => '______').join(' '));
    expect(fillLegal('{{UNKNOWN_NAME}}', FULL)).toBe('______');
  });

  it('no text carries its own draft note: the page shows one banner instead (TRUST-2 §2)', () => {
    for (const f of files) expect(read(f), f).not.toMatch(/טיוטה/);
  });

  it('the terms have the cancellation section the checkout and the emails link to', () => {
    expect(read('terms.md')).toMatch(/^## ביטול והחזר \{#cancel\}$/m);
    expect(html(DOCS.terms.text)).toContain('<h2 id="cancel" tabindex="-1">ביטול והחזר</h2>');
  });

  it('renders anchors on headings, app links inside the app, and other sites in a new tab', () => {
    const out = html('# כותרת\n\n## מי אנחנו {#who}\n\n### פרט {#detail}\n\n## בלי עוגן\n\n[בטיחות](/safety) · [ביטול](/terms#cancel) · [מייל](mailto:a@example.test) · [טלפון](tel:1201) · [אתר](https://example.test/x) · [רע](javascript:alert(1))')
      .replace(/ data-discover="true"/g, '');
    expect(out).not.toContain('כותרת');
    expect(out).toContain('<h2 id="who" tabindex="-1">מי אנחנו</h2>');
    expect(out).toContain('<h3 id="detail" tabindex="-1">פרט</h3>');
    expect(out).toContain('<h2>בלי עוגן</h2>');
    expect(out).toContain('<a href="/safety">בטיחות</a>');
    expect(out).toContain('<a href="/terms#cancel">ביטול</a>');
    expect(out).toContain('<a href="mailto:a@example.test">מייל</a>');
    expect(out).toContain('<a href="tel:1201">טלפון</a>');
    expect(out).toContain('<a href="https://example.test/x" target="_blank" rel="noopener noreferrer">אתר<span class="visually-hidden"> (נפתח בכרטיסייה חדשה)</span></a>');
    expect(out).toContain('<span>רע</span>');
    expect(out).not.toContain('javascript');
    expect(legalBody('# תקנון\n\nגרסה 1')).toBe('גרסה 1');
  });

  it('every app link in the texts goes to a page of the app, and every anchor it names exists there', () => {
    const routes = { '/terms': 'terms', '/privacy': 'privacy', '/accessibility': 'accessibility', '/safety': 'safety' };
    const ids = (f) => new Set([...read(f).matchAll(/\{#([a-z0-9-]+)\}/g)].map((m) => m[1]));
    for (const f of files) {
      for (const [, href] of read(f).matchAll(/\]\((\/[^)\s]*)\)/g)) {
        const [route, anchor] = href.split('#');
        expect(Object.keys(routes).concat(['/cancel', '/parents']), `${f}: ${href}`).toContain(route);
        if (anchor) expect(ids(`${routes[route]}.md`).has(anchor), `${f}: ${href}`).toBe(true);
      }
    }
  });

  it('the safety statement says what is built, and only that: the photo step, and the reworded final-answer line', () => {
    const s = read('safety.md');
    // the photo step (trust spec TRUST-5): built, so the statement says what it does, and that no PDF is sent
    expect(s).toContain('בדף הראשון של מבחן השורה העליונה נחתכת, ואפשר להשחיר בשחור מלא כל דבר נוסף.');
    expect(s).toContain('קובץ PDF לא נשלח');
    expect(s).toContain('בתרגילים של האפליקציה, העוזר לא נותן את התשובה הסופית לפני שפתרתם.');
    expect(s).toContain('במבחן שהעליתם בלי מפתח תשובות העוזר בודק את התשובות, וזה מסומן ליד כל שאלה.');
    expect(s).not.toContain('את התשובות של התרגילים בודקת האפליקציה, לא העוזר');
    for (const n of ['1201', '105', '100', '101']) expect(s).toContain(n);
  });
});
