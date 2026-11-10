// Sending the sign-in code by email, through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
// Secrets and settings: RESEND_API_KEY (secret), EMAIL_FROM (e.g. "מדרגות <no-reply@your-domain>", a domain verified in
// Resend). Without a key the Worker cannot send codes and says so (503 email_not_configured); for local development only,
// EMAIL_DEV_LOG = "true" prints the code to the Worker log instead.
import { HttpError } from './util.js';

export function emailReady(env) {
  return !!(env.RESEND_API_KEY && env.EMAIL_FROM) || String(env.EMAIL_DEV_LOG) === 'true';
}

export async function sendLoginCode(env, to, code) {
  const subject = `קוד הכניסה שלכם למדרגות: ${code}`;
  const text = [
    'שלום,',
    '',
    `קוד הכניסה שלכם למדרגות הוא: ${code}`,
    'הקוד תקף ל־10 דקות. מקלידים אותו באפליקציה, במסך המנוי.',
    '',
    'לא ביקשתם קוד? אפשר להתעלם מהמייל הזה; בלי הקוד אי אפשר להיכנס.',
  ].join('\n');
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#14161a">
<p>שלום,</p>
<p>קוד הכניסה שלכם למדרגות הוא:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;direction:ltr;text-align:right">${code}</p>
<p>הקוד תקף ל־10 דקות. מקלידים אותו באפליקציה, במסך המנוי.</p>
<p style="color:#565b66">לא ביקשתם קוד? אפשר להתעלם מהמייל הזה; בלי הקוד אי אפשר להיכנס.</p>
</div>`;

  if (!(env.RESEND_API_KEY && env.EMAIL_FROM)) {
    if (String(env.EMAIL_DEV_LOG) === 'true') { console.log(`[dev] login code for ${to}: ${code}`); return; }
    throw new HttpError(503, 'email_not_configured');
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text, html }),
  });
  if (!res.ok) {
    console.error('email send failed', res.status, await res.text().catch(() => ''));
    throw new HttpError(502, 'email_failed');
  }
}
