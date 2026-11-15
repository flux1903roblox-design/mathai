// What is still missing before the server can go live (DURABLE-16), for `npm run owner -- doctor` (scripts/owner.mjs)
// and its tests. Pure: it reads a description of the deployment and never a secret's value (it only gets names).
//
//   readiness(cfg) → { ok, items: [{ id, area, ok, required, label, need, how }] }
//   cfg = { vars: {…the [vars] of wrangler.toml}, databaseId, secrets: Set<name> | name[], migrationsApplied: string[],
//           migrationsInRepo: string[], ratelimits: string[] (binding names), health: {…GET /api/health} | null,
//           local: true for the local Worker (its commands), configError: the first line of wrangler's own error when it
//           could not read wrangler.toml (scripts/wranglerConfig.mjs) }
// A wrangler.toml that wrangler cannot read is the one failing item: deploy, the secrets list and the migrations all read
// that file, so nothing else can be checked until it is fixed (COUNCIL2-10).
//
// One item per rule; `area` is the Hebrew name the printout groups it by, `label` names what is checked, `need` says what
// is missing in plain words and `how` is the exact command. `required: false` items are reminders: printed, never a
// failure. `ok` is true when every required item is. Rules exist only for what the owner turned on: the email when
// EMAIL_FROM is set, payments when AI_PAYWALL is "on" (and the open tier's dollar budget while it is off), the provider's
// own keys for the provider chosen, the backup's secret while VAULT is on, Turnstile with FREE_DEVICE_MINT "turnstile",
// the daily reminder's keys with PUSH "on" (STUDENT-11), the database's size notice (COUNCIL2-18), MODERATION and
// SAFETY_ALERTS as "off" or "on" and the email an alert needs (COUNCIL2-9). The legal gate (TRUST-1, TRUST-2, TRUST-13:
// billing.js legalMissing, the one check that keeps checkout closed) is required while the paid tutor is on and a
// reminder before; the Ministry's approval (TRUST-11) is always a reminder (FOLLOWUP-32). A lane that adds a secret or
// a switch adds its rule here in the same commit: test/readiness.test.js fails on a secret named in wrangler.toml's
// secrets comment that no rule covers.
import { legalMissing, termsVersion } from './billing.js';
import { rulesEnv } from '../../shared/schoolRules.js';

export const AREAS = {
  config: 'קובץ ההגדרות',
  db: 'בסיס הנתונים',
  login: 'כניסה במייל',
  mail: 'מיילים',
  pay: 'תשלום',
  vault: 'גיבוי מוצפן',
  ai: 'בינה מלאכותית',
  site: 'כתובת האתר',
  edge: 'הגנה מעומס',
  devices: 'מכשירים חדשים',
  push: 'תזכורת יומית',
  legal: 'משפט ואישורים',
};

const put = (name) => `npx wrangler secret put ${name}`;
const random = (name) => `openssl rand -hex 32 | npx wrangler secret put ${name}`;
const on = (v) => String(v ?? '').trim().toLowerCase();

/**
 * Secrets named in wrangler.toml that no rule checks, each with the reason (test/readiness.test.js accepts only these).
 */
export const NOT_CHECKED = {
  BILLING_WEBHOOK_SECRET: 'only for a provider that signs its webhooks: none of manual, test and grow does',
  BILLING_WEBHOOK_SECRET_OLD: 'set only while a signing secret is rotated',
  TEST_WEBHOOK_SECRET: 'the test provider, in .dev.vars only',
};
/** The [[ratelimits]] bindings wrangler.toml must have (src/edge.js, src/vault.js). */
export const EDGE_BINDINGS = ['RL_AUTH', 'RL_AI', 'RL_WRITE', 'VAULT_RL'];
/** The Worker secrets setup.ps1 / setup.sh make by themselves (random), and the ones the owner pastes. */
export const RANDOM_SECRETS = ['AUTH_SECRET', 'IP_HASH_SECRET', 'WEBHOOK_PATH_SECRET', 'VAULT_SECRET'];

/** The checks, in the order they print. */
export function readiness(cfg = {}) {
  const vars = cfg.vars || {};
  const secrets = cfg.secrets instanceof Set ? cfg.secrets : new Set(cfg.secrets || []);
  const has = (name) => secrets.has(name);
  const items = [];
  const add = (id, area, ok, label, need, how, required = true) => items.push({ id, area: AREAS[area], ok: !!ok, required, label, need, how });
  const secret = (area, name, why, how = put(name), required = true) => add(`secret:${name}`, area, has(name), name, `חסר ${name}${why ? ` (${why})` : ''}`, how, required);

  // ---- the file every other check reads
  const configError = String(cfg.configError || '').trim();
  add('config:toml', 'config', !configError, 'wrangler.toml נקרא כמו ש־wrangler קורא אותו',
    `wrangler לא מצליח לקרוא את worker/wrangler.toml, ולכן גם לא יעלה את השרת: ${configError}`,
    'לתקן את worker/wrangler.toml, ואז cd worker && node --test test/config.test.js');
  if (configError) return { ok: false, items };

  // ---- always
  const dbId = String(cfg.databaseId || '').trim();
  // in the EU from the start (TRUST-15 step 1): a database's jurisdiction is set only when it is created
  add('db:id', 'db', dbId && dbId !== 'REPLACE_WITH_DATABASE_ID', 'database_id', 'אין עדיין בסיס נתונים: database_id ב־wrangler.toml',
    'npx wrangler d1 create madregot --jurisdiction=eu  (ואז להעתיק את database_id אל worker/wrangler.toml ולכתוב לידו DB_JURISDICTION = "eu"; setup.sh ו־setup.ps1 עושים את שניהם)');
  if (dbId && dbId !== 'REPLACE_WITH_DATABASE_ID') {
    add('db:eu', 'db', on(vars.DB_JURISDICTION) === 'eu', 'DB_JURISDICTION = "eu"',
      'DB_JURISDICTION אינו "eu": בסיס הנתונים לא נוצר באיחוד האירופי, ולכן ההצטרפות באתר נשארת סגורה',
      'לפני שיש בו נתונים אמיתיים: למחוק אותו בלוח הבקרה של Cloudflare, להחזיר את database_id ל־REPLACE_WITH_DATABASE_ID ולהריץ שוב את setup.sh', false);
  }
  const applied = new Set(cfg.migrationsApplied || []);
  const missing = (cfg.migrationsInRepo || []).filter((m) => !applied.has(m));
  add('db:migrations', 'db', !missing.length, 'כל המיגרציות הורצו', `מיגרציות שלא הורצו: ${missing.join(', ')}`, cfg.local ? 'npm run db:migrate:local' : 'npm run db:migrate');
  secret('login', 'AUTH_SECRET', 'מפתח לקודי הכניסה', random('AUTH_SECRET'));
  secret('login', 'IP_HASH_SECRET', 'מונים בלי כתובות רשת', random('IP_HASH_SECRET'));
  secret('ai', 'ANTHROPIC_API_KEY', 'העוזר החכם');
  // the open tier's dollar breaker (COUNCIL2-19): with the paywall off it is the only dollar ceiling in the Worker, so it
  // must be a positive amount (empty uses the 25 USD default); the Anthropic workspace's spend limit stays the backstop
  if (on(vars.AI_PAYWALL) !== 'on') {
    const open = String(vars.OPEN_DAILY_BUDGET_USD ?? '').trim();
    add('ai:open-budget', 'ai', !open || Number(open) > 0, 'OPEN_DAILY_BUDGET_USD',
      'OPEN_DAILY_BUDGET_USD צריך להיות סכום חיובי בדולרים: בלי מנוי, זו התקרה היחידה של העלות ביום. וגם: להגדיר מגבלת הוצאה ב־workspace של Anthropic',
      'worker/wrangler.toml: OPEN_DAILY_BUDGET_USD = "25"  (ומגבלת הוצאה ל־workspace בלוח של Anthropic)');
    // its parts (one email, one class) and the room for requests in flight: each empty (the default) or a number, the
    // parts positive, so one email can never be given the whole day by a typo
    for (const [name, def, min] of [['OPEN_ACCOUNT_DAILY_USD', '3', 0.01], ['OPEN_CLASS_DAILY_USD', '3', 0.01], ['OPEN_INFLIGHT_USD', '20', 0]]) {
      const v = String(vars[name] ?? '').trim();
      add(`ai:${name.toLowerCase()}`, 'ai', !v || (Number.isFinite(Number(v)) && Number(v) >= min), name,
        `${name} צריך להיות סכום בדולרים${min ? ' גדול מאפס' : ' (אפס ומעלה)'}`, `worker/wrangler.toml: ${name} = "${def}"`);
    }
  }
  // the class and network write budgets' multiplier (src/writes.js): a whole number from 1 to 20, or empty
  const scale = String(vars.WRITE_BUDGET_SCALE ?? '').trim();
  add('db:write-scale', 'db', !scale || (Number.isInteger(Number(scale)) && Number(scale) >= 1 && Number(scale) <= 20), 'WRITE_BUDGET_SCALE',
    'WRITE_BUDGET_SCALE צריך להיות מספר שלם בין 1 ל־20 (מכפיל את תקרות הכתיבה של כיתה ושל רשת)', 'worker/wrangler.toml: WRITE_BUDGET_SCALE = "1"');
  const url = String(vars.PUBLIC_URL || '').trim();
  add('site:url', 'site', /^https:\/\/[^\s/]+/.test(url), 'PUBLIC_URL', 'PUBLIC_URL צריך להיות כתובת https של האתר', 'worker/wrangler.toml: PUBLIC_URL = "https://…"');
  add('site:contact', 'site', !!String(vars.CONTACT_EMAIL || '').trim(), 'CONTACT_EMAIL', 'חסר CONTACT_EMAIL (מופיע בדפי המשפט ובמיילים)', 'worker/wrangler.toml: CONTACT_EMAIL = "…"');
  if (url) {
    add('site:health', 'site', cfg.health?.ok === true, `${url}/api/health עונה`, cfg.health ? 'השרת עונה, אבל לא אומר ok' : `לא הצלחנו להגיע אל ${url}/api/health`, 'npx wrangler deploy');
  }
  // the database's size notice (COUNCIL2-18, src/dbsize.js): empty uses the 400 MB default; anything else must be a size a
  // D1 database can reach (10 GB on Workers Paid), or the owner would never hear of it
  const sizeMb = String(vars.DB_SIZE_NOTICE_MB ?? '').trim();
  add('db:size-notice', 'db', !sizeMb || (Number(sizeMb) > 0 && Number(sizeMb) <= 10240), 'DB_SIZE_NOTICE_MB',
    'DB_SIZE_NOTICE_MB צריך להיות מספר מגה־בייט בין 1 ל־10240 (ההודעה על גודל בסיס הנתונים)', 'worker/wrangler.toml: DB_SIZE_NOTICE_MB = "400"');
  const rl = new Set(cfg.ratelimits || []);
  add('edge:bindings', 'edge', EDGE_BINDINGS.every((n) => rl.has(n)), EDGE_BINDINGS.join(', '), `חסרות הגדרות [[ratelimits]] ב־wrangler.toml (${EDGE_BINDINGS.join(', ')})`, 'worker/wrangler.toml', false);

  // ---- email: codes, notices and the Sunday summary go through Resend once EMAIL_FROM is set
  if (String(vars.EMAIL_FROM || '').trim()) secret('mail', 'RESEND_API_KEY', 'שליחת מיילים דרך Resend');
  else add('mail:from', 'mail', false, 'EMAIL_FROM', 'המיילים כבויים: EMAIL_FROM ריק, אז אין כניסה במייל להורים ולמורים', 'worker/wrangler.toml: EMAIL_FROM = "…"', false);

  // ---- payments, when the paid tutor is on
  if (on(vars.AI_PAYWALL) === 'on') {
    secret('pay', 'WEBHOOK_PATH_SECRET', 'החלק הסודי בכתובת ההודעות מחברת הסליקה, 32 תווים לפחות', random('WEBHOOK_PATH_SECRET'));
    const provider = on(vars.BILLING_PROVIDER || 'manual');
    add('pay:online', 'pay', provider !== 'manual', `BILLING_PROVIDER = "${provider}"`, 'ההצטרפות באתר כבויה: BILLING_PROVIDER = "manual" (מנויים ניתנים רק עם npm run owner)',
      'worker/wrangler.toml: BILLING_PROVIDER = "grow"', false);
    const budget = Number(vars.FAMILY_MONTHLY_BUDGET_USD);
    add('pay:budget', 'pay', Number.isFinite(budget) && budget > 0 && budget <= 4, 'FAMILY_MONTHLY_BUDGET_USD', 'FAMILY_MONTHLY_BUDGET_USD צריך להיות 4 או פחות', 'worker/wrangler.toml: FAMILY_MONTHLY_BUDGET_USD = "4"');
    if (provider === 'grow') {
      for (const name of ['GROW_USER_ID', 'GROW_PAGE_CODE_ONCE', 'GROW_PAGE_CODE_RECURRING']) secret('pay', name, 'מ־Grow');
      secret('pay', 'GROW_API_KEY', 'רק אם Grow נתנו מפתח', put('GROW_API_KEY'), false);
      if (on(vars.BILLING_MODE) !== 'test') {
        add('pay:grow-base', 'pay', /^https:\/\/\S+\/$/.test(String(vars.GROW_API_BASE || '')), 'GROW_API_BASE', 'חסר GROW_API_BASE של הסביבה החיה (מדף "live environment" של Grow, מסתיים ב־/)',
          'worker/wrangler.toml: GROW_API_BASE = "https://…/"');
      }
      add('pay:hosts', 'pay', !!String(vars.BILLING_CHECKOUT_HOSTS || '').trim(), 'BILLING_CHECKOUT_HOSTS', 'BILLING_CHECKOUT_HOSTS ריק: דף התשלום לא ייפתח',
        'worker/wrangler.toml: BILLING_CHECKOUT_HOSTS = "<הכתובת שהבדיקה מדפיסה>"');
      add('pay:direct-debit', 'pay', on(vars.GROW_DIRECT_DEBIT_API) === 'on', 'GROW_DIRECT_DEBIT_API', 'המנוי החודשי כבוי עד ש־Grow מאשרים updateDirectDebit (GROW_DIRECT_DEBIT_API = "on")',
        'worker/wrangler.toml: GROW_DIRECT_DEBIT_API = "on"', false);
    }
    // the exam pass has no price until the owner decides one (wrangler.toml ships it empty, so a placeholder is never
    // published by the Grow switch or by the landing build): a reminder while a provider that sells is set
    if (provider !== 'manual' && !(Number(String(vars.PRICE_EXAM_PASS_AGOROT ?? '').trim()) > 0)) {
      add('pay:exam-pass-price', 'pay', false, 'PRICE_EXAM_PASS_AGOROT', 'חבילת המבחן לא נמכרת: PRICE_EXAM_PASS_AGOROT ריק. כשמחליטים על מחיר כותבים אותו באגורות, בשתי הטבלאות, ואז LEGAL_APPROVED',
        'worker/wrangler.toml: PRICE_EXAM_PASS_AGOROT = "…" ב־[vars] וב־[env.staging.vars]  (SUBSCRIPTION.md, "חבילת מבחן")', false);
    }
    if (provider === 'test') {
      add('pay:test', 'pay', on(vars.BILLING_MODE) === 'test' && on(vars.ALLOW_TEST_BILLING) === 'true', 'BILLING_MODE test', 'ספק הבדיקה עובד רק עם BILLING_MODE = "test" ו־ALLOW_TEST_BILLING = "true", ואף פעם לא באתר החי',
        'worker/wrangler.toml');
    }
  }

  // ---- the encrypted backup: the class and family copies of a code need VAULT_SECRET
  if (on(vars.VAULT || 'on') !== 'off') secret('vault', 'VAULT_SECRET', 'שמירת קוד הגיבוי בכיתה ובמנוי המשפחתי', random('VAULT_SECRET'));

  // ---- the daily reminder by web push (STUDENT-11), once PUSH is "on": the private key as a secret, the public key and
  //      a subject Apple accepts as vars (push.js pushConfigError checks the same, and sends nothing while one is wrong)
  if (on(vars.PUSH) === 'on') {
    secret('push', 'VAPID_PRIVATE_JWK', 'המפתח הפרטי של התזכורות', 'npm run push:keys  (ואז npx wrangler secret put VAPID_PRIVATE_JWK)');
    add('push:public-key', 'push', !!String(vars.VAPID_PUBLIC_KEY || '').trim(), 'VAPID_PUBLIC_KEY', 'חסר VAPID_PUBLIC_KEY (המפתח הציבורי ש־npm run push:keys מדפיס)',
      'worker/wrangler.toml: VAPID_PUBLIC_KEY = "…"');
    add('push:subject', 'push', /^(mailto:\S+@\S+|https:\/\/\S+)$/.test(String(vars.VAPID_SUBJECT || '').trim()), 'VAPID_SUBJECT',
      'VAPID_SUBJECT צריך להיות mailto: עם כתובת אמיתית, או כתובת https:', 'worker/wrangler.toml: VAPID_SUBJECT = "mailto:…"');
  }

  // ---- the legal gate (TRUST-2 §5-6, TRUST-13, TRUST-15 step 1): billing.js legalMissing, the same list that answers
  //      checkout with 503 legal_not_ready and shows the legal pages as "טיוטה". Required while the paid tutor is on (only
  //      then can checkout open: billing.js planOnline); before that a reminder, since the pages say "טיוטה" until it passes.
  const paid = on(vars.AI_PAYWALL) === 'on';
  const legal = legalMissing(vars);
  const tv = termsVersion(vars);
  const details = legal.filter((k) => k !== 'LEGAL_APPROVED' && k !== 'DB_JURISDICTION');
  add('legal:details', 'legal', !details.length, 'פרטי העסק בדפי המשפט', `חסרים פרטים שדפי המשפט והגילוי לפני התשלום מציגים: ${details.join(', ')}`,
    `worker/wrangler.toml: ${(details.length ? details : ['BUSINESS_NAME']).map((k) => `${k} = "${k === 'LEGAL_DATE' ? 'YYYY-MM-DD' : '…'}"`).join(', ')}  (ואז npx wrangler deploy)`, paid);
  add('legal:jurisdiction', 'legal', !legal.includes('DB_JURISDICTION'), 'DB_JURISDICTION = "eu"',
    'DB_JURISDICTION צריך להיות "eu": מדיניות הפרטיות מתארת רק בסיס נתונים באיחוד האירופי',
    'לפני שיש מידע אמיתי: sh setup.sh או setup.ps1, שיוצרים את בסיס הנתונים עם --jurisdiction=eu וכותבים DB_JURISDICTION = "eu" ב־worker/wrangler.toml', paid);
  add('legal:approved', 'legal', !legal.includes('LEGAL_APPROVED'), `LEGAL_APPROVED = "${tv}"`,
    `הטקסטים המשפטיים בגרסה ${tv} עוד לא אושרו: LEGAL_APPROVED צריך להיות "${tv}" אחרי שעורך הדין אישר אותם`,
    `worker/wrangler.toml: LEGAL_APPROVED = "${tv}"  (ואז npx wrangler deploy)`, paid);
  // ---- the Ministry of Education's approval (TRUST-11, shared/schoolRules.js): a reminder of what "none" means
  add('legal:moe', 'legal', rulesEnv(vars).approval === 'approved', 'MOE_AI_APPROVAL = "approved"',
    'MOE_AI_APPROVAL = "none": עד שמדרגות בקטלוג של משרד החינוך, העוזר החכם כבוי לתלמידים בכל כיתה של בית ספר, בקשת ניסיון מתקבלת רק מקבוצה פרטית (של בית ספר נענית 409), ורישיון עם העוזר לא נמכר לכיתה של בית ספר. בקשה להצעת מחיר נשארת פתוחה',
    'כשהאישור מגיע: worker/wrangler.toml: MOE_AI_APPROVAL = "approved" (ו־MOE_AI_FROM_GRADE), ואז npx wrangler deploy', false);
  // ---- the second reader and the adult's alert (COUNCIL2-9): each is "off" or "on"; an alert needs the email to reach a
  //      parent, and the owner turns it on only on the lawyer's word (legal/safety.md)
  const MOD = on(vars.MODERATION || 'off');
  add('ai:moderation', 'ai', MOD === 'off' || MOD === 'on', 'MODERATION', `MODERATION צריך להיות "off" או "on" (עכשיו "${vars.MODERATION}")`,
    'worker/wrangler.toml: MODERATION = "off"');
  const ALERTS = on(vars.SAFETY_ALERTS || 'off');
  add('ai:safety-alerts', 'ai', ALERTS === 'off' || ALERTS === 'on', 'SAFETY_ALERTS', `SAFETY_ALERTS צריך להיות "off" או "on" (עכשיו "${vars.SAFETY_ALERTS}")`,
    'worker/wrangler.toml: SAFETY_ALERTS = "off"');
  if (ALERTS === 'on') {
    add('mail:safety-alerts', 'mail', !!String(vars.EMAIL_FROM || '').trim(), 'EMAIL_FROM (התראות)',
      'SAFETY_ALERTS דולק אבל EMAIL_FROM ריק: הורה לא יקבל את ההתראה במייל (המורה עדיין רואה אותה בלוח)', 'worker/wrangler.toml: EMAIL_FROM = "…"');
    // a reminder, never a failure: the public safety page says no alert is sent unless the child chose it
    add('ai:safety-alerts-text', 'ai', false, 'safety.md וההתראות', 'SAFETY_ALERTS דולק: לוודא שהמשפט על התראות בדף הבטיחות הוחלף בנוסח של עורך הדין',
      'web/src/content/legal/safety.md (ההערה לעורך הדין ב"כשילד כותב משהו מדאיג")', false);
  }

  // ---- Turnstile for new devices on the free taste
  if (on(vars.FREE_DEVICE_MINT) === 'turnstile') {
    secret('devices', 'TURNSTILE_SECRET', 'Turnstile');
    secret('devices', 'DEVICE_SECRET', 'חתימת מכשירים', random('DEVICE_SECRET'));
    add('devices:site-key', 'devices', !!String(vars.TURNSTILE_SITE_KEY || '').trim(), 'TURNSTILE_SITE_KEY', 'חסר TURNSTILE_SITE_KEY', 'worker/wrangler.toml: TURNSTILE_SITE_KEY = "…"');
  }

  return { ok: items.every((i) => i.ok || !i.required), items };
}

/** The printout: one line per item ("✓ area: …" or "✗ area: need → how"), reminders marked "!". Never a value. */
export function formatReadiness(r) {
  return r.items.map((i) => (i.ok ? `✓ ${i.area}: ${i.label}` : `${i.required ? '✗' : '!'} ${i.area}: ${i.need} → ${i.how}`)).join('\n');
}
