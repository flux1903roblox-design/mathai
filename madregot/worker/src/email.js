// Service email through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email): the sign-in code,
// and the notices outbox (welcome, cancellation, refund, payment failed, owner alerts). Settings: RESEND_API_KEY
// (secret), EMAIL_FROM (a domain verified in Resend), CONTACT_EMAIL (reply-to), OWNER_EMAIL (owner alerts).
// Every inserted value is HTML-escaped; nothing the user typed goes into an email except the recipient address.
import { HttpError, nowIso, sha256, TZ } from './util.js';

export function emailReady(env) {
  return !!(env.RESEND_API_KEY && env.EMAIL_FROM);
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
        lines: billing(['שלום,', `חובר מכשיר ${p.label || 'מכשיר'} ב־${hebDate(p.at)}. לא אתם? אפשר לנתק אותו בעמוד ההורים: ${env.PUBLIC_URL || ''}/parents`]),
      };
    case 'licence_ending':
      return {
        subject: `רישיון הכיתה מסתיים ב־${hebDate(p.until)}`,
        lines: ['שלום,', 'לחידוש: השיבו למייל הזה או בקשו הצעת מחיר מלוח המורה.'],
      };
    case 'owner': {
      const what = String(row.kind).slice('owner:'.length);
      return { subject: `[מדרגות] ${what}`, lines: [`${what}`, `ref: ${row.ref}`, ...Object.entries(p).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)] };
    }
    default:
      return null;
  }
}

export const MAX_NOTICE_TRIES = 6;

/** Send pending notices (the outbox). A failed send is retried by the next call, up to 6 tries. */
export async function flushNotices(env, { limit = 50 } = {}) {
  if (!emailReady(env) && String(env.EMAIL_DEV_LOG) !== 'true') return { sent: 0 };
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
