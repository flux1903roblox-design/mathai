// Service email through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email): the sign-in code,
// and the notices outbox (welcome, cancellation, refund, payment failed, renewal reminder, device linked, licence
// ending, owner alerts and the owner's daily summary). Settings: RESEND_API_KEY (secret), EMAIL_FROM (a domain verified
// in Resend), CONTACT_EMAIL (reply-to), OWNER_EMAIL (owner alerts). Every inserted value is HTML-escaped. Nothing a
// parent or child typed goes into their own emails except the recipient address and a device label; a teacher's licence
// request (school, note) goes only to the owner. With EMAIL_DEV_LOG = "true" on a local Worker (PUBLIC_URL on
// localhost) and no Resend key, notices are printed to the log instead (subjects only, never a code).
import { HttpError, nowIso, sha256, TZ } from './util.js';

export function emailReady(env) {
  return !!(env.RESEND_API_KEY && env.EMAIL_FROM);
}
const LOCAL_HOSTS = ['localhost', '127.0.0.1'];
/** The notices dev log: EMAIL_DEV_LOG on a Worker whose PUBLIC_URL is on localhost (never in production). */
export function noticeDevLog(env) {
  if (String(env.EMAIL_DEV_LOG) !== 'true') return false;
  try { return LOCAL_HOSTS.includes(new URL(env.PUBLIC_URL).hostname); } catch { return false; }
}

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const para = (lines) => lines.filter((l) => l != null && l !== '').map((l) => `<p>${escapeHtml(l)}</p>`).join('\n');
const wrap = (inner) => `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#14161a">\n${inner}\n</div>`;

async function send(env, { to, subject, text, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text, html, ...(env.CONTACT_EMAIL ? { reply_to: env.CONTACT_EMAIL } : {}) }),
  });
  if (!res.ok) {
    console.error('email send failed', res.status);
    throw new HttpError(502, 'email_failed');
  }
}

/** The sign-in code. With devLog (EMAIL_DEV_LOG on localhost) it is printed to the Worker log instead, never returned. */
export async function sendLoginCode(env, to, code, { devLog = false } = {}) {
  const app = env.PUBLIC_URL || '';
  const subject = `קוד הכניסה שלכם למדרגות: ${code}`;
  const lines = [
    'שלום,',
    `קוד הכניסה שלכם למדרגות הוא: ${code}`,
    'הקוד תקף ל־10 דקות.',
    'לא ביקשתם קוד? אפשר להתעלם מהמייל הזה; בלי הקוד אי אפשר להיכנס.',
    app,
  ];
  if (devLog) { console.log(`[dev] login code: ${code}`); return; }
  if (!emailReady(env)) throw new HttpError(503, 'email_not_configured');
  const html = wrap(`<p>שלום,</p>
<p>קוד הכניסה שלכם למדרגות הוא:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;direction:ltr;text-align:right">${escapeHtml(code)}</p>
<p>הקוד תקף ל־10 דקות.</p>
<p style="color:#565b66">לא ביקשתם קוד? אפשר להתעלם מהמייל הזה; בלי הקוד אי אפשר להיכנס.</p>
${app ? `<p style="color:#565b66">${escapeHtml(app)}</p>` : ''}`);
  await send(env, { to, subject, text: lines.filter(Boolean).join('\n'), html });
}

// ---------------------------------------------------------------- notices
export const shekels = (agorot) => `₪${(Math.round(Number(agorot) || 0) / 100).toFixed(2)}`;
export const hebDate = (iso) => {
  try { return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }); } catch { return ''; }
};
const hebDateTime = (iso) => {
  try { return new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ }); } catch { return ''; }
};
const vatWords = (env) => (String(env.VAT_MODE) === 'exempt' ? 'המחיר סופי' : 'כולל מע״מ');
const PLAN_NAME = { family_month: 'מנוי משפחתי חודשי', family_year: 'מנוי משפחתי שנתי', class_year: 'רישיון כיתה לשנה', term: 'מנוי', trial: 'ניסיון לכיתה' };

function footer(env) {
  const parts = [`לביטול המנוי: ${env.PUBLIC_URL || ''}/cancel`, env.CONTACT_EMAIL, env.CONTACT_PHONE].filter(Boolean);
  return parts.join(' · ');
}
function business(env) {
  return [env.BUSINESS_NAME, env.BUSINESS_ID, env.BUSINESS_ADDRESS, env.CONTACT_EMAIL, env.CONTACT_PHONE].filter(Boolean).join(' · ');
}

/** Subject and lines of one notice, or null for a kind this Worker does not know. */
export function renderNotice(env, row) {
  const p = (() => { try { return JSON.parse(row.params || '{}'); } catch { return {}; } })();
  const base = String(row.kind).split(':')[0];
  const billing = (lines) => [...lines, '', footer(env)];
  switch (base) {
    case 'welcome': {
      const renews = p.plan === 'family_month' || p.plan === 'family_year';
      const per = p.plan === 'family_month' ? 'לחודש' : 'לשנה';
      return {
        subject: 'המנוי לעוזר החכם של מדרגות פעיל',
        lines: billing([
          'שלום,',
          renews
            ? `${PLAN_NAME[p.plan]}: ${shekels(p.priceAgorot)} ${per}, ${vatWords(env)}. מתחדש אוטומטית עד שמבטלים. החיוב הבא: ${hebDate(p.periodEnd)}.`
            : `${PLAN_NAME[p.plan] || 'מנוי'}: ${shekels(p.priceAgorot)}, ${vatWords(env)}. תשלום אחד, בלי חידוש אוטומטי. בתוקף עד ${hebDate(p.periodEnd)}.`,
          'אפשר לבטל בכל רגע באתר, במייל או בטלפון. ב־14 הימים הראשונים מקבלים החזר מלא.',
          'שימוש הוגן: יש מכסה יומית לכל סוג פעולה. בחודש עם שימוש גבוה במיוחד השיחה ממשיכה בגרסה קצרה, ובדיקות הצילום והמבחן חוזרות ב־1 בחודש.',
          `התקנון (גרסה ${env.TERMS_VERSION || ''}): ${env.PUBLIC_URL || ''}/terms`,
          business(env),
        ]),
      };
    }
    case 'canceled':
      return {
        subject: `אישור ביטול המנוי · ${p.reference || ''}`.trim(),
        lines: billing([
          'שלום,',
          `קיבלנו את הביטול ב־${hebDateTime(p.requestedAt)}. לא יהיו חיובים נוספים. העוזר החכם פתוח עד ${hebDate(p.endsAt)}.`,
          p.refundAgorot > 0 ? `ההחזר של ${shekels(p.refundAgorot)} יגיע לאמצעי התשלום תוך 14 ימים לכל היותר.` : '',
          p.reference ? `מספר אישור: ${p.reference}` : '',
        ]),
      };
    case 'refunded':
      return {
        subject: 'החזר כספי על המנוי',
        lines: billing(['שלום,', `החזרנו ${shekels(p.amountAgorot)} לאמצעי התשלום.${p.reason ? ` ${p.reason}` : ''}`]),
      };
    case 'payment_failed':
      return {
        subject: 'התשלום למנוי לא עבר',
        lines: billing([
          'שלום,',
          `חברת הסליקה תנסה שוב בימים הקרובים, והעוזר החכם ממשיך לעבוד עד ${hebDate(p.until)}. לעדכון אמצעי תשלום: ${p.portal || `${env.PUBLIC_URL || ''}/parents`}`,
        ]),
      };
    case 'renewal_reminder':
      return {
        subject: `המנוי השנתי מתחדש ב־${hebDate(p.periodEnd)}`,
        lines: billing(['שלום,', `המנוי השנתי מתחדש ב־${hebDate(p.periodEnd)} במחיר ${shekels(p.priceAgorot)}, ${vatWords(env)}.`]),
      };
    case 'device_linked':
      return {
        subject: 'מכשיר חדש חובר למנוי',
        lines: billing(['שלום,', `חובר מכשיר חדש${p.label ? ` (${p.label})` : ''} ב־${hebDate(p.at)}. לא אתם? אפשר לנתק אותו בעמוד ההורים: ${env.PUBLIC_URL || ''}/parents`]),
      };
    case 'licence_ending':
      return {
        subject: `רישיון הכיתה מסתיים ב־${hebDate(p.until)}`,
        lines: [
          'שלום,',
          `רישיון העוזר החכם של הכיתה${p.classCode ? ` ${p.classCode}` : ''} מסתיים ב־${hebDate(p.until)}.`,
          'לחידוש: השיבו למייל הזה או בקשו הצעת מחיר מלוח המורה.',
          [env.CONTACT_EMAIL, env.CONTACT_PHONE].filter(Boolean).join(' · '),
        ],
      };
    case 'owner': {
      const what = String(row.kind).slice('owner:'.length);
      if (what === 'licence_request') return licenceRequestNotice(p);
      if (what.startsWith('summary:')) return summaryNotice(p, what.slice('summary:'.length));
      return { subject: `[מדרגות] ${what}`, lines: [`${what}`, `ref: ${row.ref}`, ...Object.entries(p).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)] };
    }
    default:
      return null;
  }
}

/** A teacher asked for a trial or a quote. The owner answers by email and grants with npm run owner. */
function licenceRequestNotice(p) {
  const trial = p.wants === 'trial';
  return {
    subject: `[מדרגות] בקשה ${trial ? 'לניסיון' : 'להצעת מחיר'} לכיתה ${p.classCode || ''}`.trim(),
    lines: [
      trial ? 'מורה ביקש ניסיון של שבועיים לכיתה. ניסיון לא נפתח לבד: מאשרים אותו בסקריפט.' : 'מורה ביקש הצעת מחיר לבית הספר.',
      `בית הספר: ${p.school || ''}`,
      `כמה כיתות: ${p.classes ?? ''}`,
      p.students ? `תלמידים בכיתה: ${p.students}` : '',
      p.note ? `הערה: ${p.note}` : '',
      `קוד הכיתה: ${p.classCode || ''}`,
      `מייל המורה: ${p.email || 'לא ידוע (החשבון נמחק)'}`,
      trial ? `לאישור: npm run owner -- grant-class --class ${p.classCode || ''} --seats ${Math.min(40, Number(p.students) || 30)} --trial` : '',
      `כשמטפלים בבקשה: npm run owner -- request-done --id ${p.requestId || ''}`,
    ],
  };
}

/** The owner's daily summary: yesterday's spend and plans, what needs a hand, and the invariant checks. */
function summaryNotice(p, day) {
  const usd = (n) => `$${(Number(n) || 0).toFixed(2)}`;
  const v = Array.isArray(p.violations) ? p.violations : [];
  return {
    subject: `[מדרגות] סיכום יומי ${day}${v.length ? ` · ${v.length} בעיות` : ''}`,
    lines: [
      `סיכום ליום ${day}`,
      `עלות כוללת: ${usd(p.allUsd)} · שאלות בחינם: ${p.freeCalls ?? 0}`,
      `תשובות תמיכה (care): ${p.careCalls ?? 0} · ${usd(p.careUsd)}`,
      ...(Array.isArray(p.spend) ? p.spend : []).map((x) => `${x.pool}: ${usd(x.usd)} (${x.calls} קריאות)`),
      `מנויים ורישיונות חדשים: ${p.newPlans ?? 0} · ביטולים: ${p.canceled ?? 0} · הסתיימו: ${p.ended ?? 0}`,
      `ביטולים שהספק עוד לא אישר: ${p.unsyncedCancels ?? 0}`,
      `החזרים שצריך לעשות ידנית: ${p.manualRefunds ?? 0}`,
      `הודעות תשלום חריגות (mismatch, unknown, test_mode): ${p.badEvents ?? 0}`,
      `בקשות רישיון פתוחות: ${p.openRequests ?? 0}`,
      v.length ? 'בדיקות שנכשלו:' : 'כל הבדיקות עברו.',
      ...v.map((x) => `- ${x}`),
    ],
  };
}

export const MAX_NOTICE_TRIES = 6;

/** Send pending notices (the outbox). A failed send is retried by the next call, up to 6 tries. */
export async function flushNotices(env, { limit = 50 } = {}) {
  if (!emailReady(env) && !noticeDevLog(env)) return { sent: 0 };
  const pending = (await env.DB.prepare(
    'SELECT ref, kind, to_account, params, tries FROM notices WHERE sent_at IS NULL AND tries < ? ORDER BY created_at LIMIT ?',
  ).bind(MAX_NOTICE_TRIES, limit).all()).results || [];
  let sent = 0;
  for (const row of pending) {
    const done = (sql, ...a) => env.DB.prepare(sql).bind(...a, row.ref, row.kind).run();
    const to = row.to_account
      ? (await env.DB.prepare('SELECT email FROM accounts WHERE id = ?').bind(row.to_account).first())?.email
      : env.OWNER_EMAIL;
    let params = {};
    try { params = JSON.parse(row.params || '{}'); } catch { /* rendered with no values */ }
    // a cancellation recorded by the owner CLI gets its confirmation number here
    if (String(row.kind).startsWith('canceled:') && !params.reference && params.requestedAt) {
      params.reference = `C-${(await sha256(`${row.ref}${params.requestedAt}`)).slice(0, 4).toUpperCase()}`;
    }
    // a licence request names the teacher's address only in the owner's email, looked up now (never stored in the notice)
    if (row.kind === 'owner:licence_request') {
      const r = await env.DB.prepare('SELECT a.email FROM licence_requests r JOIN accounts a ON a.id = r.account_id WHERE r.id = ?').bind(row.ref).first();
      params.email = r?.email || null;
      params.requestId = row.ref;
    }
    const msg = renderNotice(env, { ...row, params: JSON.stringify(params) });
    if (!to || !msg) { await done('UPDATE notices SET tries = ? WHERE ref = ? AND kind = ?', MAX_NOTICE_TRIES); continue; }
    try {
      if (emailReady(env)) {
        const text = msg.lines.filter((l) => l !== '').join('\n');
        await send(env, { to, subject: msg.subject, text, html: wrap(para(msg.lines)) });
      } else {
        console.log(`[dev] notice ${row.kind}: ${msg.subject}`);
      }
      await done('UPDATE notices SET sent_at = ? WHERE ref = ? AND kind = ?', nowIso());
      sent++;
    } catch {
      await done('UPDATE notices SET tries = tries + 1 WHERE ref = ? AND kind = ?');
    }
  }
  return { sent };
}
