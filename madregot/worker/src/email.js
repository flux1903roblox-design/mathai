// Service email through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email): the sign-in code,
// and the notices outbox (welcome, cancellation, refund, payment failed, the one-year plan's end-date emails, device
// linked and unlinked, licence ending, a class's teacher key replaced, a teacher's daily count of new help requests,
// owner alerts and the owner's daily summary). Settings: RESEND_API_KEY (secret), EMAIL_FROM (a domain verified
// in Resend), CONTACT_EMAIL (reply-to), OWNER_EMAIL (owner alerts). Every inserted value is HTML-escaped. Nothing a
// parent or child typed goes into their own emails except the recipient address, a device label and, to its own
// teacher, a class name; a teacher's licence request (school, note) goes only to the owner. With EMAIL_DEV_LOG = "true" on a local Worker (PUBLIC_URL on
// localhost) and no Resend key, notices are printed to the log instead (subjects only, never a code).
// The parents' Sunday email (PARENTS-7, kind 'weekly:<Sunday>') is rendered here but sent by report.js flushWeekly,
// through Resend's batch call (sendBatch), each message with its own List-Unsubscribe headers; flushNotices leaves it.
import { HttpError, nowIso, sha256, TZ } from './util.js';
import { rulesEnv } from '../../shared/schoolRules.js';
import { limits, paywallOn } from './entitle.js';
import { stairName } from '../../shared/stairs.js';

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

/** One message as Resend takes it, alone or in a batch: `headers` (optional) are the message's own mail headers. */
const message = (env, { to, subject, text, html, headers }) => ({
  from: env.EMAIL_FROM, to: [to], subject, text, html,
  ...(env.CONTACT_EMAIL ? { reply_to: env.CONTACT_EMAIL } : {}),
  ...(headers && Object.keys(headers).length ? { headers } : {}),
});
const post = (env, url, payload) => fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

async function send(env, msg) {
  const res = await post(env, 'https://api.resend.com/emails', message(env, msg));
  if (!res.ok) {
    console.error('email send failed', res.status);
    throw new HttpError(502, 'email_failed');
  }
}

/** Resend's batch call takes up to 100 messages; we send at most this many in one call. */
export const BATCH_MAX = 50;
/**
 * Up to 50 messages in one call (https://resend.com/docs/api-reference/emails/send-batch-emails), each with its own
 * headers. All or nothing: a failed call throws, and the caller counts a try on every message of the group.
 */
export async function sendBatch(env, msgs) {
  if (!msgs.length) return;
  if (msgs.length > BATCH_MAX) throw new Error(`a batch holds at most ${BATCH_MAX}`);
  const res = await post(env, 'https://api.resend.com/emails/batch', msgs.map((m) => message(env, m)));
  if (!res.ok) {
    console.error('email batch failed', res.status);
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
const PLAN_NAME = { family_month: 'מנוי משפחתי חודשי', family_year: 'מנוי משפחתי לשנה', class_year: 'רישיון כיתה לשנה', term: 'מנוי', trial: 'ניסיון לכיתה' };
/** The one-year plan's renewal link (trust spec TRUST-10 §2): the parents' page opens its renewal. */
const renewLink = (env) => `${env.PUBLIC_URL || ''}/parents?renew=year`;
/** The end-date email of a one-year plan, 30-45 days ahead (Appendix E §E.7). */
function yearEndingNotice(env, p) {
  const date = hebDate(p.periodEnd);
  const free = limits(env).free.student;
  return {
    subject: `המנוי לשנה מסתיים ב־${date}`,
    lines: [
      'שלום,',
      `המנוי לשנה לעוזר החכם של מדרגות מסתיים ב־${date}. הוא לא מתחדש מעצמו, ולא נחייב אתכם שוב.`,
      `רוצים להמשיך? אפשר לחדש לשנה נוספת ב־${shekels(p.priceAgorot)} (${vatWords(env)}): ${renewLink(env)}. אחרי ${date} אפשר להצטרף גם למנוי חודשי.`,
      `אם לא תעשו כלום, ב־${date} העוזר החכם יחזור ל־${free === 1 ? 'שאלה אחת' : `${free} שאלות`} ביום. השיעורים, התרגול וההתקדמות נשארים כמו שהם.`,
      '',
      footer(env),
    ],
  };
}

function footer(env) {
  const parts = [`לביטול המנוי: ${env.PUBLIC_URL || ''}/cancel`, env.CONTACT_EMAIL, env.CONTACT_PHONE].filter(Boolean);
  return parts.join(' · ');
}
export function business(env) {
  return [env.BUSINESS_NAME, env.BUSINESS_ID, env.BUSINESS_ADDRESS, env.CONTACT_EMAIL, env.CONTACT_PHONE].filter(Boolean).join(' · ');
}

/** The welcome email's receipt line when Grow is the payment company: it sends the receipt itself. */
export const RECEIPT_BY_GROW = 'הקבלה נשלחת אליכם במייל מ־Grow, חברת הסליקה.';

/** Subject and lines of one notice, or null for a kind this Worker does not know. */
export function renderNotice(env, row) {
  const p = (() => { try { return JSON.parse(row.params || '{}'); } catch { return {}; } })();
  const base = String(row.kind).split(':')[0];
  const billing = (lines) => [...lines, '', footer(env)];
  switch (base) {
    case 'welcome': {
      // only the monthly plan renews by itself (TRUST-10 §1); a one-year plan and a licence are one payment each. A
      // renewed year (welcome:<order>) is a new transaction with its own confirmation and its own 14 days.
      const renews = p.plan === 'family_month';
      return {
        subject: p.renewal ? 'המנוי לעוזר החכם של מדרגות חודש לשנה נוספת' : 'המנוי לעוזר החכם של מדרגות פעיל',
        lines: billing([
          'שלום,',
          renews
            ? `${PLAN_NAME[p.plan]}: ${shekels(p.priceAgorot)} לחודש, ${vatWords(env)}. מתחדש אוטומטית עד שמבטלים. החיוב הבא: ${hebDate(p.periodEnd)}.`
            : `${PLAN_NAME[p.plan] || 'מנוי'}: ${shekels(p.priceAgorot)}, ${vatWords(env)}. תשלום אחד, בלי חידוש אוטומטי. בתוקף עד ${hebDate(p.periodEnd)}.`,
          // Grow issues the receipt or tax invoice for every charge, to the payer's email (PARENTS-11)
          ...(String(env.BILLING_PROVIDER || '') === 'grow' ? [RECEIPT_BY_GROW] : []),
          p.renewal
            ? `ב־14 הימים הקרובים אפשר לבטל את החידוש ולקבל החזר מלא. המנוי הנוכחי ממשיך עד ${hebDate(p.prevEnd)}.`
            : 'אפשר לבטל בכל רגע באתר, במייל או בטלפון. ב־14 הימים הראשונים מקבלים החזר מלא.',
          'שימוש הוגן: יש מכסה יומית לכל סוג פעולה. בחודש עם שימוש גבוה במיוחד השיחה ממשיכה בגרסה קצרה, ובדיקות הצילום והמבחן חוזרות ב־1 בחודש.',
          `התקנון (גרסה ${env.TERMS_VERSION || ''}): ${env.PUBLIC_URL || ''}/terms`,
          // the payer's own mailbox is one of the real adult checks (trust spec TRUST-8 §5): someone who did not sign up
          // can say so, and gets everything back
          'קיבלתם את המייל הזה כי נרשמתם למנוי במדרגות עם הכתובת הזו. לא אתם נרשמתם? השיבו למייל הזה ונבטל ונחזיר את כל הסכום.',
          business(env),
        ]),
      };
    }
    case 'canceled':
      return {
        subject: `${p.renewal ? 'אישור ביטול החידוש' : 'אישור ביטול המנוי'} · ${p.reference || ''}`.trim(),
        lines: billing([
          'שלום,',
          p.renewal
            ? `קיבלנו את ביטול החידוש ב־${hebDateTime(p.requestedAt)}. המנוי לשנה ממשיך עד ${hebDate(p.endsAt)}, ולא יהיו חיובים נוספים.`
            : `קיבלנו את הביטול ב־${hebDateTime(p.requestedAt)}. לא יהיו חיובים נוספים. העוזר החכם פתוח עד ${hebDate(p.endsAt)}.`,
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
    case 'year_ending':
    // an older reminder still in the outbox: the yearly plan no longer renews by itself, so it says the same as year_ending
    case 'renewal_reminder':
      return yearEndingNotice(env, p);
    case 'year_ending_7':
      return {
        subject: 'עוד שבוע המנוי לשנה מסתיים',
        lines: billing([
          'שלום,',
          `המנוי לשנה מסתיים ב־${hebDate(p.periodEnd)} ולא מתחדש מעצמו. לחידוש לשנה נוספת: ${renewLink(env)}. אם לא תעשו כלום, לא נחייב אתכם.`,
        ]),
      };
    case 'device_linked':
      if (p.purpose === 'consent') return consentNotice(env, p);
      return {
        subject: 'מכשיר חדש חובר למנוי',
        lines: billing(['שלום,', `חובר מכשיר חדש${p.label ? ` (${p.label})` : ''} ב־${hebDate(p.at)}. לא אתם? אפשר לנתק אותו בעמוד ההורים: ${env.PUBLIC_URL || ''}/parents`]),
      };
    // a child's device deleted everything of itself from the server ("delete all", trust spec TRUST-6 §1): the parent
    // is told, with the label they gave it; for a device on the plan, as any billing email, else as the OK's email
    case 'device_unlinked': {
      const name = p.label ? `המכשיר (${p.label})` : 'אחד המכשירים';
      const lines = [
        'שלום,',
        `${name} נותק ${p.plan ? 'מהמנוי' : 'מהחשבון שלכם במדרגות'}, והמידע שלו נמחק מהשרת לבקשת מי שהשתמש בו.`,
        `אפשר לחבר אותו שוב מעמוד ההורים: ${env.PUBLIC_URL || ''}/parents`,
      ];
      return { subject: p.plan ? 'מכשיר נותק מהמנוי' : 'מכשיר נותק מהחשבון', lines: p.plan ? billing(lines) : [...lines, '', business(env)] };
    }
    // the parents' Sunday email (report.js flushWeekly renders it at send time, with the unsubscribe link in p.unsub)
    case 'weekly':
      return weeklyNotice(env, p);
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
    case 'class_rekeyed':
      return {
        subject: `מפתח המורה של הכיתה ${p.className || ''} הוחלף`.replace(/\s+/g, ' ').trim(),
        lines: [
          'שלום,',
          `נוצר מפתח מורה חדש לכיתה ${p.className || ''} (${p.code || ''}). מי שנכנס ללוח עם המייל לא צריך לעשות כלום. אם זה לא הייתם אתם, השיבו למייל הזה.`,
          '',
          [env.PUBLIC_URL, env.CONTACT_EMAIL, env.CONTACT_PHONE].filter(Boolean).join(' · '),
        ],
      };
    case 'help_digest': {
      // a count and the class's name only: no student's name, no exercise and nothing a student wrote (TEACHER-6 §5)
      const n = Math.max(1, Math.round(Number(p.n) || 1));
      return {
        subject: (n === 1 ? `בקשת עזרה חדשה בכיתה ${p.className || ''}` : `${n} בקשות עזרה חדשות בכיתה ${p.className || ''}`).trim(),
        lines: [
          'שלום,',
          'בקשות חדשות מחכות לכם בלוח המורה. כדי לא לשלוח פרטים של תלמידים במייל, השמות והתרגילים נמצאים רק בלוח.',
          `${env.PUBLIC_URL || ''}/#/teacher?tab=help`,
          'להפסקת המיילים: לוח המורה › הגדרות הכיתה.',
        ],
      };
    }
    case 'owner': {
      const what = String(row.kind).slice('owner:'.length);
      if (what === 'licence_request') return licenceRequestNotice(p, rulesEnv(env).approval === 'approved');
      if (what.startsWith('summary:')) return summaryNotice(p, what.slice('summary:'.length));
      if (what.startsWith('safety_spike:')) return safetySpikeNotice(p, what.slice('safety_spike:'.length));
      if (what.startsWith('errors:')) return errorsNotice(p, what.slice('errors:'.length));
      if (what === 'vault:70' || what === 'vault:90') return vaultShareNotice(p, Number(what.slice(-2)));
      if (what.startsWith('vault_drift:')) return vaultDriftNotice(p);
      return { subject: `[מדרגות] ${what}`, lines: [`${what}`, `ref: ${row.ref}`, ...Object.entries(p).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)] };
    }
    default:
      return null;
  }
}

/**
 * A parent approved the tutor on a child's device, for free (trust spec TRUST-9, Appendix E §E.4). This email is the
 * notice at the moment the child's data starts to be collected (Privacy Protection Law s.11): what the tutor is, what
 * goes to it and where, what happens when a child writes something worrying, and how to take the OK back. No price and
 * no plan: it is not a billing email. The number of free questions is read from the limits in force when it is sent.
 */
function consentNotice(env, p) {
  const base = env.PUBLIC_URL || '';
  const free = limits(env).free.student;
  const questions = free === 1 ? 'שאלה קצרה אחת' : `${free} שאלות קצרות`;
  // with the paywall off there is no free taste to count: the tutor is open, within the day's limits
  const what = paywallOn(env) ? `בחינם, העוזר עונה במכשיר הזה על ${questions} ביום במתמטיקה.` : 'כרגע העוזר פתוח בחינם, ועונה במכשיר הזה על שאלות במתמטיקה.';
  return {
    subject: 'אישרתם את העוזר החכם במכשיר של הילד',
    lines: [
      'שלום,',
      `ב־${hebDate(p.at)} אישרתם את העוזר החכם של מדרגות במכשיר ${p.label ? `"${p.label}"` : 'של הילד'}.`,
      `מה זה אומר: ${what} הוא תוכנת בינה מלאכותית (Claude של Anthropic), לא אדם, והוא יכול לטעות.`,
      'מה עובר אליו: התרגיל, התשובה של הילד ומה שהוא כותב או מצלם. לא שם, מייל או טלפון. המידע נשלח ל־Anthropic בארה״ב כדי לקבל תשובה, ומדרגות לא שומרת את השיחות.',
      'בטיחות: אם הילד כותב משהו מדאיג, העוזר מפסיק את המתמטיקה ומפנה למבוגר שסומכים עליו ולקווי סיוע (ער״ן 1201). אנחנו לא שולחים לכם את מה שהילד כתב.',
      `לביטול האישור: ${base}/parents, או השיבו למייל הזה.`,
      `מדיניות הפרטיות: ${base}/privacy`,
      'לא אתם אישרתם? השיבו למייל הזה ונבטל.',
      [env.CONTACT_EMAIL, env.CONTACT_PHONE].filter(Boolean).join(' · '),
    ],
  };
}

// ---------------------------------------------------------------- the parents' Sunday email (PARENTS-7)
const dm = (day) => { const [, m, d] = String(day).split('-').map(Number); return `${d}.${m}`; };
const plural = (one, two, many) => (n) => (n === 1 ? one : n === 2 ? two : many(n));
const heDays = plural('יום אחד', 'יומיים', (n) => `${n} ימים`);
const heStairs = plural('מדרגה אחת', 'שתי מדרגות', (n) => `${n} מדרגות`);
const heMistakes = plural('טעות אחת', 'שתי טעויות', (n) => `${n} טעויות`);
const fixedLine = plural('טעות אחת תוקנה השבוע', 'שתי טעויות תוקנו השבוע', (n) => `${n} טעויות תוקנו השבוע`);
const aboutMinutes = (m) => (m === 1 ? 'כדקה' : m === 2 ? 'כשתי דקות' : `כ־${m} דקות`);
/** The stair's name as the app shows it; a stair from another version of the app says so (as the page does). */
const stairText = (id) => stairName(id) ?? 'מדרגה מגרסה אחרת של האפליקציה';
export const WORKED_IN_EMAIL = 4;
export const WEEKLY_TEXT = {
  hello: 'שלום,',
  intro: (range) => `זה הסיכום של השבוע ${range}.`,
  off: (label) => `${label}: הסיכום מהמכשיר הזה כבוי.`,
  none: (label) => `${label}: השבוע לא היה תרגול.`,
  allEmpty: (labels) => (labels.length === 1 && labels[0] ? `השבוע לא היה תרגול במכשיר ${labels[0]}. זה קורה, ואפשר לחזור מתי שרוצים.`
    : labels.length === 1 ? 'השבוע לא היה תרגול במכשיר. זה קורה, ואפשר לחזור מתי שרוצים.'
      : 'השבוע לא היה תרגול באף אחד מהמכשירים. זה קורה, ואפשר לחזור מתי שרוצים.'),
  pause: 'אם גם בשבוע הבא לא יהיה תרגול, לא נשלח מייל עד שהתרגול יחזור.',
  noCheck: 'השבוע לא הייתה בדיקת שליטה',
  talk: (stair) => `רעיון לשיחה: בקשו שיסבירו לכם דוגמה אחת מ"${stair}".`,
  page: 'הפירוט המלא בעמוד ההורים:',
  why: 'קיבלתם את המייל כי ביקשתם סיכום שבועי. כדי להפסיק אותו:',
};

/** One device's lines in the Sunday email: counts and stair names only (never a mistake's name). */
function weeklyDevice(d) {
  const label = d.label || 'מכשיר';
  if (d.sharing !== 'on') return [WEEKLY_TEXT.off(label)];
  if (d.empty) return [WEEKLY_TEXT.none(label)];
  const worked = Array.isArray(d.worked) ? d.worked : [];
  const mastered = Array.isArray(d.mastered) ? d.mastered : [];
  const more = worked.length - WORKED_IN_EMAIL;
  const fixes = [d.open > 0 ? `${heMistakes(d.open)} בתיקון` : '', d.fixed > 0 ? fixedLine(d.fixed) : ''].filter(Boolean);
  return [
    { head: label },
    [`ימי תרגול: ${d.activeDays}`, d.minutes > 0 ? `זמן תרגול: ${aboutMinutes(d.minutes)}` : '', `שאלות: ${d.questions}`].filter(Boolean).join(' · '),
    mastered.length ? `חדש בשליטה: ${mastered.map(stairText).join(', ')}` : WEEKLY_TEXT.noCheck,
    worked.length ? `תורגלו: ${worked.slice(0, WORKED_IN_EMAIL).map(stairText).join(', ')}${more > 0 ? ` ועוד ${heStairs(more)}` : ''}` : '',
    fixes.length ? `טעויות שחוזרות: ${fixes.join(', ')}` : '',
    d.streak > 0 ? `רצף: ${heDays(d.streak)} (שבת לא שוברת רצף)` : '',
  ].filter(Boolean);
}

/**
 * The Sunday email from weeklyParams (report.js) and the unsubscribe link (p.unsub): the text and the HTML part, and
 * the RFC 8058 headers (List-Unsubscribe with the https link, List-Unsubscribe-Post). The footer is the business
 * details only: no price, no offer, nothing to buy.
 */
function weeklyNotice(env, p) {
  // never a Sunday email without its unsubscribe link
  if (!p.unsub || !/^https:\/\//.test(String(p.unsub)) || !p.start || !p.end) return null;
  const range = `${dm(p.start)}–${dm(p.end)}`;
  const devices = (Array.isArray(p.devices) ? p.devices : []).slice(0, 3);
  const page = `${String(env.PUBLIC_URL || '').replace(/\/+$/, '')}/parents`;
  const quiet = p.allEmpty && devices.every((d) => d.sharing === 'on');
  const talkStair = devices.find((d) => d.sharing === 'on' && !d.empty && d.worked?.length)?.worked[0];
  // blocks: a string is a line, { head } a device's name, { link } a line with its address, '' a gap
  const blocks = [
    WEEKLY_TEXT.hello, WEEKLY_TEXT.intro(range), '',
    ...(quiet ? [WEEKLY_TEXT.allEmpty(devices.map((d) => d.label || '')), WEEKLY_TEXT.pause, '']
      : [...devices.flatMap((d) => [...weeklyDevice(d), '']), ...(p.allEmpty && devices.some((d) => d.sharing === 'on') ? [WEEKLY_TEXT.pause, ''] : [])]),
    ...(talkStair ? [WEEKLY_TEXT.talk(stairText(talkStair))] : []),
    { link: page, text: WEEKLY_TEXT.page, label: 'לעמוד ההורים' },
    '',
    { link: p.unsub, text: WEEKLY_TEXT.why, label: 'להפסקת הסיכום השבועי', foot: true },
    { foot: business(env) },
  ];
  const lines = blocks.map((b) => (typeof b === 'string' ? b : b.head ? b.head : b.link ? `${b.text} ${b.link}` : b.foot)).filter((l) => l !== undefined);
  const text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  // the HTML part: the same blocks; a device's name as a small heading, the two addresses as links, the footer quieter
  const a = (href, label) => `<a href="${escapeHtml(href)}" style="color:#1246c4">${escapeHtml(label)}</a>`;
  const FOOT = 'margin:0 0 6px;font-size:14px;line-height:21px;color:#565b66';
  const htmlBlocks = [];
  for (const b of blocks) {
    if (b === '') htmlBlocks.push('<div style="height:10px"></div>');
    else if (typeof b === 'string') htmlBlocks.push(`<p style="margin:0 0 6px">${escapeHtml(b)}</p>`);
    else if (b.head) htmlBlocks.push(`<p style="margin:6px 0 4px;font-weight:700;font-size:18px">${escapeHtml(b.head)}</p>`);
    else if (b.link) htmlBlocks.push(`<p style="${b.foot ? FOOT : 'margin:0 0 6px'}">${escapeHtml(b.text)} ${a(b.link, b.label)}</p>`);
    // each detail kept whole on its line (a phone number never breaks at its dash)
    else if (b.foot) htmlBlocks.push(`<p style="${FOOT}">${b.foot.split(' · ').map((x) => `<span style="white-space:nowrap">${escapeHtml(x)}</span>`).join(' · ')}</p>`);
  }
  return {
    subject: `סיכום שבועי ממדרגות · ${range}`,
    lines,
    text,
    html: wrap(htmlBlocks.join('\n')),
    headers: { 'List-Unsubscribe': `<${p.unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  };
}

/**
 * A teacher asked for a trial or a quote. The owner answers by email and grants with npm run owner. Before the Ministry's
 * catalogue approval (MOE_AI_APPROVAL, trust spec TRUST-11 §5) a trial request can only come from a private group (the
 * server refuses a school's), so its command carries --private-ok; a school's quote is answered with the same rule.
 */
function licenceRequestNotice(p, approved = false) {
  const trial = p.wants === 'trial';
  return {
    subject: `[מדרגות] בקשה ${trial ? 'לניסיון' : 'להצעת מחיר'} לכיתה ${p.classCode || ''}`.trim(),
    lines: [
      trial ? 'מורה ביקש ניסיון של שבועיים לכיתה. ניסיון לא נפתח לבד: מאשרים אותו בסקריפט.' : 'מורה ביקש הצעת מחיר לבית הספר.',
      approved ? '' : trial
        ? 'הכיתה סומנה כקבוצה פרטית שלא פועלת במסגרת בית ספר. עד האישור בקטלוג של משרד החינוך, ניסיון ניתן רק לקבוצה כזו.'
        : 'עד האישור בקטלוג של משרד החינוך העוזר החכם כבוי לתלמידים בכיתות של בית ספר. כתבו בתשובה שהוא יופעל אחרי האישור.',
      `בית הספר: ${p.school || ''}`,
      `כמה כיתות: ${p.classes ?? ''}`,
      p.students ? `תלמידים בכיתה: ${p.students}` : '',
      p.note ? `הערה: ${p.note}` : '',
      `קוד הכיתה: ${p.classCode || ''}`,
      `מייל המורה: ${p.email || 'לא ידוע (החשבון נמחק)'}`,
      trial ? `לאישור: npm run owner -- grant-class --class ${p.classCode || ''} --seats ${Math.min(40, Number(p.students) || 30)} --trial${approved ? '' : ' --private-ok --note "<שם הקבוצה>"'}` : '',
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
      p.safety ? safetyLine(p.safety) : '',
      p.parentOkNeeded != null ? `רשתות שמהן ילדים ביקשו את העוזר ומחכים לאישור של הורה: ${p.parentOkNeeded}` : '',
      ...errorLines(p.errors),
      ...(p.vaults ? [`גיבויים מוצפנים: ${p.vaults.count ?? 0} (${p.vaults.mb ?? 0} MB) · חדשים: ${p.vaults.newYesterday ?? 0}`] : []),
      p.quality ? qualityLine(p.quality) : '',
      ...(p.reportFeedback ? [`משוב על הסיכום החודש: כן ${p.reportFeedback.yes ?? 0} · לא ממש ${p.reportFeedback.no ?? 0}`] : []),
      v.length ? 'בדיקות שנכשלו:' : 'כל הבדיקות עברו.',
      ...v.map((x) => `- ${x}`),
      ...reachLines(p.reach),
    ],
  };
}

/** A day's safety counts in one line (trust spec TRUST-4 §4.4): numbers only, never who or what was written. */
const safetyLine = (c) => `אירועי בטיחות: מצוקה ${c.distress ?? 0} · פרטים אישיים שהוסתרו ${c.pii_masked ?? 0} · תשובות שנעצרו ${c.output_blocked ?? 0} · סירובים ${c.refusal ?? 0} · דיווחים על תשובות ${c.user_report ?? 0}`;

/** The tutor's answers in one line (ai spec AI-3 Design 6): counts only. */
const qualityLine = (q) => `איכות העוזר: תשובות סופיות שהוסתרו ${q.masked ?? 0} · תשובות ריקות ${q.emptyStreams ?? 0} · תרגילים שנפסלו ${q.genDropped ?? 0} · בקשות תרגילים שנכשלו ${q.genAllFailed ?? 0}`;

/** Yesterday's safety events jumped (cron.js safetySpike): the counts only, and where to look next. */
function safetySpikeNotice(p, day) {
  return {
    subject: '[מדרגות] קפיצה באירועי בטיחות',
    lines: [
      `ביום ${day} היו יותר אירועי בטיחות מהרגיל.`,
      safetyLine(p),
      `ממוצע יומי של מצוקה ב־14 הימים שלפני: ${p.distressAvg ?? 0}`,
      'אין כאן שום דבר ממה שנכתב. הדיווחים על תשובות: npm run owner -- reports',
    ],
  };
}

/** The app's error reports of the day (cron.js, errors.js): the total and the most frequent. */
function errorLines(e) {
  if (!e || typeof e !== 'object') return [];
  const top = Array.isArray(e.top) ? e.top : [];
  return [
    `תקלות באפליקציה: ${e.total ?? 0}`,
    ...top.map((x) => `- ${x.count} × ${x.kind} ${x.route || ''} ${x.release || ''}: ${x.message || ''}`),
  ];
}

/** Many app errors yesterday: the owner hears it the same night, with the way to see them all. */
function errorsNotice(p, day) {
  return {
    subject: `[מדרגות] הרבה תקלות באפליקציה ב־${day}`,
    lines: [
      `ב־${day} היו ${p.total ?? 0} דיווחי תקלה מהאפליקציה${p.worst ? `, והתקלה השכיחה חזרה ${p.worst} פעמים` : ''}.`,
      ...errorLines({ total: p.total, top: p.top }).slice(1),
      'הפירוט: npm run owner -- errors --days 2',
    ],
  };
}

/** The encrypted vaults passed 70% of VAULT_MAX_MB (vault.js), once a month. */
function vaultShareNotice(p, pct) {
  return {
    subject: `[מדרגות] הגיבויים המוצפנים הגיעו ל־${pct}% מהמקום`,
    lines: [
      `הגיבויים המוצפנים בשרת תופסים ${p.mb ?? '?'} MB מתוך ${p.maxMb ?? '?'} MB (VAULT_MAX_MB).`,
      ...(pct >= 90 ? ['זה קרוב לגבול. אם זה קרה מהר, בדקו בסיכום היומי כמה גיבויים חדשים נוצרו אתמול.'] : []),
      'כשהם מגיעים לגבול, אי אפשר ליצור גיבויים חדשים, והאפליקציה מציעה לשמור קובץ במקום. גיבויים קיימים ממשיכים להתעדכן.',
      'בתוכנית Workers Paid אפשר להעלות את VAULT_MAX_MB בקובץ worker/wrangler.toml (עד 3000) ולפרסם מחדש.',
      'בתוכנית החינמית לא מעלים: כל מסד הנתונים נעצר ב־500 MB, והוא שומר גם את התשלומים.',
    ],
  };
}

/** The night job found the size meter different from the vaults' real total, and set it right (vault.js). */
function vaultDriftNotice(p) {
  return {
    subject: `[מדרגות] מונה הגיבויים תוקן ב־${p.day || ''}`.trim(),
    lines: [
      `מונה הנפח של הגיבויים המוצפנים הראה ${p.was ?? '?'} בתים, והסכום האמיתי היה ${p.now ?? '?'}. המונה תוקן.`,
      'אם זה חוזר כמה לילות ברצף, כדאי לבדוק את הקוד שכותב גיבויים (worker/src/vault.js).',
    ],
  };
}

/** The summary's reach block (cron.js reachSummary): counts by name, with no one behind them. */
function reachLines(r) {
  if (!r || typeof r !== 'object') return [];
  const counts = Object.entries(r.counts && typeof r.counts === 'object' ? r.counts : {});
  return [
    'הגעה (ספירות בלי זיהוי):',
    counts.length ? counts.map(([name, n]) => `${name} ${Number(n) || 0}`).join(' · ') : 'אתמול לא נספר כלום.',
    `תלמידי כיתות שלמדו ב־7 הימים האחרונים: ${Number(r.classStudents7) || 0}`,
    ...(r.reminders && typeof r.reminders === 'object'
      ? [`תזכורות יומיות: ${Number(r.reminders.on) || 0} פועלות · ${Number(r.reminders.paused) || 0} בהשהיה · ${Number(r.reminders.learned7) || 0} מהן של תלמידים שלמדו ב־7 הימים האחרונים`]
      : []),
    'לפי שבועות: npm run owner -- reach',
  ];
}

export const MAX_NOTICE_TRIES = 6;

/** Send pending notices (the outbox). A failed send is retried by the next call, up to 6 tries. */
export async function flushNotices(env, { limit = 50 } = {}) {
  if (!emailReady(env) && !noticeDevLog(env)) return { sent: 0 };
  // the Sunday emails have their own flush (report.js flushWeekly), so hundreds of them never hold back a legal notice
  const pending = (await env.DB.prepare(
    "SELECT ref, kind, to_account, params, tries FROM notices WHERE sent_at IS NULL AND tries < ? AND kind NOT LIKE 'weekly:%' ORDER BY created_at LIMIT ?",
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
    const welcome = isWelcome(row.kind);
    if (!to || !msg) {
      await done('UPDATE notices SET tries = ? WHERE ref = ? AND kind = ?', MAX_NOTICE_TRIES);
      if (welcome) await welcomeFailed(env, row, params);
      continue;
    }
    try {
      let at;
      if (emailReady(env)) {
        const text = msg.lines.filter((l) => l !== '').join('\n');
        await send(env, { to, subject: msg.subject, text, html: wrap(para(msg.lines)) });
        at = nowIso();
        // the written disclosure really left: the 14 days of the cooling-off run from now if that is later than the
        // payment (Consumer Protection Law s.14ג, trust spec TRUST-10 §5). The dev log below sends nothing, so it moves nothing.
        if (welcome) await welcomeSent(env, row.ref, at);
      } else {
        console.log(`[dev] notice ${row.kind}: ${msg.subject}`);
      }
      await done('UPDATE notices SET sent_at = ? WHERE ref = ? AND kind = ?', at || nowIso());
      sent++;
    } catch {
      await done('UPDATE notices SET tries = tries + 1 WHERE ref = ? AND kind = ?');
      if (welcome && row.tries + 1 >= MAX_NOTICE_TRIES) await welcomeFailed(env, row, params);
    }
  }
  return { sent };
}

// ---------------------------------------------------------------- the cooling-off clock (trust spec TRUST-10 §5)
export const REFUND_DAYS_AFTER_DISCLOSURE = 14;
export const REFUND_DAYS_NO_DISCLOSURE = 60;
const DAY_MS = 864e5;
/** A plan's confirmation email: the first payment's (welcome), or a renewed year's (welcome:<order>). */
const isWelcome = (kind) => kind === 'welcome' || String(kind).startsWith('welcome:');

/** The confirmation reached Resend: the refund window ends 14 days from now, unless the payment's 14 days end later. */
async function welcomeSent(env, subId, sentAt) {
  const until = new Date(Date.parse(sentAt) + REFUND_DAYS_AFTER_DISCLOSURE * DAY_MS).toISOString();
  await env.DB.prepare("UPDATE subscriptions SET refund_until = MAX(COALESCE(refund_until, ''), ?) WHERE id = ? AND first_paid_at IS NOT NULL")
    .bind(until, subId).run();
}

/**
 * The confirmation could not be sent after every try: the payer may never have received the disclosure, so the refund
 * window runs to 60 days after the payment, and the owner is told to send it by hand.
 */
async function welcomeFailed(env, row, params) {
  const sub = await env.DB.prepare('SELECT id, first_paid_at FROM subscriptions WHERE id = ?').bind(row.ref).first();
  if (!sub?.first_paid_at) return;
  const paid = Date.parse(params.paidAt || sub.first_paid_at);
  const until = new Date((Number.isFinite(paid) ? paid : Date.parse(sub.first_paid_at)) + REFUND_DAYS_NO_DISCLOSURE * DAY_MS).toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE subscriptions SET refund_until = MAX(COALESCE(refund_until, ''), ?) WHERE id = ?").bind(until, sub.id),
    env.DB.prepare('INSERT OR IGNORE INTO notices (ref, kind, to_account, params, created_at) VALUES (?, ?, NULL, ?, ?)')
      .bind(sub.id, `owner:welcome_failed:${sub.id}`, JSON.stringify({ subscription: sub.id, refundUntil: until }), nowIso()),
  ]);
}
