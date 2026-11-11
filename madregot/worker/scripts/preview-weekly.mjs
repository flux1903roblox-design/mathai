#!/usr/bin/env node
// The parents' Sunday email (PARENTS-7), rendered from synthetic data with the Worker's own code and no network:
//
//   node scripts/preview-weekly.mjs
//
// writes, under madregot/qa-evidence/parent-report/:
//   weekly-email.html / .txt         a family with two devices: one practised (the shared fixture week, 8.11–14.11.2026,
//                                    the same one the web's tests pin), one did not
//   weekly-email-empty.html / .txt   the first week with no practice on any device (PARENTS-6 state 10)
// Each file shows the headers the email is sent with (List-Unsubscribe, List-Unsubscribe-Post) above the message, as a
// mail program's "show original" would. Every name and address is synthetic (example.test); the unsubscribe token is
// made with a secret that exists only here. Real sending, DKIM and the Resend quota are the owner's steps
// (SUBSCRIPTION.md, "דוח להורים").
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { weeklyParams, unsubUrl } from '../src/report.js';
import { renderNotice, escapeHtml } from '../src/email.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '..', '..', 'qa-evidence', 'parent-report');
const fixture = JSON.parse(readFileSync(path.resolve(here, '..', '..', 'shared', 'week.fixture.json'), 'utf8'));

// a synthetic Worker env: no key, no secret that exists anywhere else
const env = {
  PUBLIC_URL: 'https://madregot.example.test',
  EMAIL_FROM: 'מדרגות <no-reply@example.test>',
  CONTACT_EMAIL: 'hello@example.test',
  CONTACT_PHONE: '03-0000000',
  BUSINESS_NAME: 'מדרגות (שם העסק לדוגמה)',
  BUSINESS_ID: '000000000',
  BUSINESS_ADDRESS: 'רחוב לדוגמה 1, תל אביב',
  AUTH_SECRET: 'preview-only-not-a-real-secret',
};
const ACCOUNT = '0123456789abcdef';
const TO = 'parent@example.test';
const OLD = '2026-09-01T00:00:00.000Z';
const start = fixture.start;
const end = new Date(Date.parse(`${start}T00:00:00Z`) + 6 * 864e5).toISOString().slice(0, 10);
const toRow = (device, r) => ({
  device_id: device, day: r.d, minutes: r.m, questions: r.q, lessons: r.ls, stages: r.st, reviews: r.rv, streak: r.sr,
  worked: JSON.stringify(r.sk), mastered: JSON.stringify(r.ma), fixes: JSON.stringify(r.fx), exam: r.ex ? JSON.stringify(r.ex) : null,
});
const device = (id, label) => ({ id, label, created_at: OLD, share_child: 1, share_parent: 1 });

async function render(name, devices, rows, account) {
  const p = weeklyParams(account, devices, rows, { start, end });
  if (!p) throw new Error(`${name}: weeklyParams sends nothing for this family`);
  const msg = renderNotice(env, { ref: ACCOUNT, kind: `weekly:${start}`, params: JSON.stringify({ ...p, unsub: await unsubUrl(env, ACCOUNT) }) });
  const head = [
    ['From', env.EMAIL_FROM], ['To', TO], ['Reply-To', env.CONTACT_EMAIL], ['Subject', msg.subject],
    ...Object.entries(msg.headers),
  ];
  const txt = `${head.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${msg.text}\n`;
  const html = `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(msg.subject)}</title>
<style>
body{margin:0;background:#f4f6f9;font-family:Arial,sans-serif;color:#14161a}
.mail{max-width:640px;margin:0 auto;padding:16px}
.head{margin:0 0 12px;padding:12px;border-radius:12px;background:#fff;border:2px solid #e4e7ec;font-size:13px;line-height:20px}
.head div{display:flex;gap:8px;overflow-wrap:anywhere}
.head dt{flex:none;min-width:9.5em;color:#565b66;direction:ltr;text-align:right}
.head dd{margin:0;min-width:0}
.head .ltr{direction:ltr;unicode-bidi:isolate;text-align:left}
.body{padding:16px;border-radius:12px;background:#fff;border:2px solid #e4e7ec;overflow-wrap:anywhere}
.note{margin:12px 4px 0;font-size:13px;line-height:20px;color:#565b66}
</style></head>
<body><div class="mail">
<dl class="head">
${head.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd class="${/^[\x20-\x7e]+$/.test(v) ? 'ltr' : ''}">${escapeHtml(v)}</dd></div>`).join('\n')}
</dl>
<div class="body">
${msg.html}
</div>
<p class="note">תצוגה מקדימה מנתונים לדוגמה (scripts/preview-weekly.mjs). לא נשלח מייל ולא נעשתה שום פנייה לרשת.</p>
</div></body></html>
`;
  writeFileSync(path.join(out, `${name}.html`), html);
  writeFileSync(path.join(out, `${name}.txt`), txt);
  return msg;
}

mkdirSync(out, { recursive: true });
const tablet = device('d000000000000001', 'הטאבלט');
const phone = device('d000000000000002', 'הטלפון');
const account = { reportEmailAt: OLD, live: true };
// the week before had practice, so the empty week is the first one (it is sent; a second one would not be)
const before = { v: 1, d: '2026-11-04', m: 15, q: 12, ls: 1, st: 0, sk: ['signed:1'], ma: [], rv: 0, fx: [], sr: 2, ex: null };
await render('weekly-email', [tablet, phone], fixture.rows.map((r) => toRow(tablet.id, r)), account);
await render('weekly-email-empty', [tablet], [toRow(tablet.id, before)], account);
console.log(`written to ${path.relative(process.cwd(), out) || out}: weekly-email.html, weekly-email.txt, weekly-email-empty.html, weekly-email-empty.txt`);
