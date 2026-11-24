// What the notices say (src/email.js renderNotice). Addresses are synthetic; nothing is sent here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderNotice } from '../src/email.js';
import { makeEnv } from './helpers.js';

const env = makeEnv({ BUSINESS_NAME: 'מדרגות בדיקה', BUSINESS_ID: '000000000', CONTACT_PHONE: '03-0000000' });
const render = (kind, params) => renderNotice(env, { ref: 'r1', kind, params: JSON.stringify(params) });

test('the welcome email tells someone who did not sign up how to get everything back (trust spec TRUST-8 §5)', () => {
  for (const plan of ['family_month', 'family_year', 'term']) {
    const m = render('welcome', { plan, priceAgorot: 2990, periodEnd: '2026-12-10T10:00:00Z' });
    const text = m.lines.join('\n');
    assert.match(text, /קיבלתם את המייל הזה כי נרשמתם למנוי במדרגות עם הכתובת הזו\. לא אתם נרשמתם\? השיבו למייל הזה ונבטל ונחזיר את כל הסכום\./, plan);
    // it stays above the business details and the cancel link
    const i = m.lines.findIndex((l) => l.includes('לא אתם נרשמתם'));
    assert.ok(i > 0 && i < m.lines.findIndex((l) => l.includes('מדרגות בדיקה')), plan);
    assert.ok(m.lines.at(-1).includes('/cancel'));
  }
});

test('the safety-spike alert holds counts only (trust spec TRUST-4 §4.4)', () => {
  const m = render('owner:safety_spike:2026-11-09', { distress: 4, pii_masked: 2, output_blocked: 7, refusal: 1, user_report: 3, distressAvg: 0.5, reported: true, distressHigh: true });
  assert.equal(m.subject, '[מדרגות] קפיצה באירועי בטיחות');
  assert.deepEqual(m.lines, [
    'ביום 2026-11-09 היו יותר אירועי בטיחות מהרגיל.',
    'אירועי בטיחות: מצוקה 4 · פרטים אישיים שהוסתרו 2 · תשובות שנעצרו 7 · סירובים 1 · דיווחים על תשובות 3',
    'ממוצע יומי של מצוקה ב־14 הימים שלפני: 0.5',
    'אין כאן שום דבר ממה שנכתב. הדיווחים על תשובות: npm run owner -- reports',
  ]);
});
