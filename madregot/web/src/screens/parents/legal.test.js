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
    expect(s).toContain('בתרגילים של האפליקציה, העוזר מתבקש לא לתת את התשובה הסופית לפני שפתרתם, ובשרת יש בדיקה שמסתירה את התשובה כשהיא נכתבת בצורות הנפוצות.');
    expect(s).toContain('כיתה שנפתחה בלי מייל לא פותחת את העוזר');
    expect(s).toContain('במבחן שהעליתם בלי מפתח תשובות העוזר בודק את התשובות, וזה מסומן ליד כל שאלה.');
    expect(s).not.toContain('את התשובות של התרגילים בודקת האפליקציה, לא העוזר');
    for (const n of ['1201', '105', '100', '101']) expect(s).toContain(n);
  });
});

describe('what the law asks each text to say (TRUST-2 tests, TRUST-13)', () => {
  const datamap = JSON.parse(readFileSync(path.resolve(dir, '../../../../worker/datamap.json'), 'utf8'));
  const packet = readFileSync(path.resolve(dir, '../../../../docs/legal/LAWYER_PACKET.md'), 'utf8');
  const notes = (text) => [...String(text).matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1].trim());

  it('every document has a version or date line near the top, filled from the server', () => {
    const line = /^(?:גרסה \{\{TERMS_VERSION\}\} · )?עודכ(?:ן|נה) ב־\{\{(?:LEGAL_DATE|ACCESS_DATE)\}\}$/m;
    for (const f of files) {
      const top = read(f).split('\n').slice(0, 4).join('\n');
      expect(top, f).toMatch(line);
      expect(fillLegal(top, FULL), f).toMatch(/ב־\d{2}\.\d{2}\.2026$/m);
    }
    expect(read('privacy.md')).toContain('גרסה {{TERMS_VERSION}}');
    expect(read('terms.md')).toContain('גרסה {{TERMS_VERSION}}');
  });

  it('the privacy notice names the controller and the rights of access and correction by their legal names (s.11, s.13, s.14)', () => {
    const p = read('privacy.md');
    for (const t of ['זכות עיון', 'תיקון מידע', 'בעל השליטה', 'סעיף 13', 'סעיף 14']) expect(p, t).toContain(t);
    // s.11: voluntary or not, and what happens without; the purpose; who receives it; transfers abroad
    for (const t of ['אין חובה לפי חוק למסור לנו מידע', 'למה:', '## למי המידע עובר', 'העברת מידע אל מאגרי מידע שמחוץ לגבולות המדינה', 'לרשות להגנת הפרטיות']) expect(p, t).toContain(t);
    // every service the data map says receives data is named, with where it is
    // (the student lane's daily reminder adds the browser's push service, STUDENT-11)
    for (const name of ['Cloudflare', 'Anthropic', 'Resend', '{{PAYMENT_PROVIDER}}', 'שירות ההתראות של הדפדפן']) expect(section(p, 'share'), name).toContain(name);
    expect(Object.keys(datamap.recipients).sort()).toEqual(['anthropic', 'cloudflare', 'payment', 'push', 'resend']);
    expect(section(p, 'share')).toContain('{{DB_PLACE}}');
  });

  it('the privacy notice says what reaches the AI and what never does, as the data map does', () => {
    const ai = section(read('privacy.md'), 'ai');
    expect(datamap.ai.sent).toHaveLength(4);
    for (const t of ['השכבה (ז׳ או ח׳)', 'מה שהקלדתם בתרגיל הזה', 'שמות הטעויות', 'הודעות בשיחה, שאלה ליד תמונה, או הסבר ששלחתם למשוב', 'תמונות של דפים',
      'בתרגילים חדשים', 'שום דבר שכתבתם']) expect(ai, t).toContain(t);
    for (const t of ['לא נשלחים אף פעם: השם, הכיתה בבית הספר או קוד הכיתה, המספר של המכשיר, מייל, תאריכים', 'קובץ PDF לא נשלח', 'תוך 30 יום',
      'לא משתמשת בהן כדי לאמן', 'מדרגות לא שומרת את השיחות']) expect(ai, t).toContain(t);
    // the masking says exactly which words make a number an ID (shared/safety.js ID_WORD)
    expect(ai).toContain('"תעודת זהות", "מספר זהות" או "ת״ז"');
    // no line still says the old "email only" or "cannot be reversed"
    expect(read('privacy.md')).not.toMatch(/כתובת המייל בלבד|אי אפשר לשחזר/);
  });

  it('the terms carry the cancellation section, its 14 days and the one-year plan that never renews by itself', () => {
    const t = read('terms.md');
    for (const s of ['ביטול', '14 ימים', '{#cancel}', 'לפי המאוחר מביניהם', 'בלי דמי ביטול', 'מספר אישור', 'לא מתחדש מעצמו', 'בין 45 ל־30 ימים לפני הסוף']) expect(t, s).toContain(s);
    // no automatic renewal of the yearly plan anywhere (Consumer Protection Law s.13א, TRUST-10)
    expect(section(t, 'family')).not.toMatch(/לשנה[^.\n]*מתחדש אוטומטית/);
  });

  it('the accessibility statement names its coordinator, and claims only what a check backs (trust.spec.js "accessibility statement")', () => {
    const a = read('accessibility.md');
    expect(a).toContain('## רכז הנגישות {#contact}');
    for (const n of ['{{ACCESS_NAME}}', '{{ACCESS_PHONE}}', '{{ACCESS_EMAIL}}', '{{ACCESS_TESTED}}', '{{ACCESS_DATE}}']) expect(a, n).toContain(n);
    expect(a).toContain('## מה עוד לא נגיש {#not-yet}');
    expect(section(a, 'not-yet').split('\n').filter((l) => l.startsWith('- ')).length).toBeGreaterThanOrEqual(4);
  });

  it('a note for the lawyer is never shown, and every one is listed in the owner\'s packet', () => {
    const all = files.flatMap((f) => notes(read(f)).map((n) => [f, n]));
    expect(all.length).toBeGreaterThan(0);
    for (const [f, n] of all) {
      expect(n, f).toMatch(/^לעורך הדין/);
      expect(packet, `${f}: ${n}`).toContain(n);
      expect(html(read(f)), f).not.toContain(n);
    }
    for (const f of files) expect(html(read(f)), f).not.toMatch(/<!--|--&gt;/);
    expect(legalBody('# כותרת\n\nא. <!-- הערה -->\n\n<!-- עוד\nהערה -->\n\nב.')).toBe('א. \n\nב.');
  });
});

/** One "## … {#id}" section of a text, up to the next "## ". */
function section(text, id) {
  return String(text).split(/^## /m).find((s) => s.includes(`{#${id}}`)) || '';
}
