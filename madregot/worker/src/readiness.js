// What is still missing before the server can go live (DURABLE-16), for `npm run owner -- doctor` (scripts/owner.mjs)
// and its tests. Pure: it reads a description of the deployment and never a secret's value (it only gets names).
//
//   readiness(cfg) → { ok, items: [{ id, area, ok, required, label, need, how }] }
//   cfg = { vars: {…the [vars] of wrangler.toml}, databaseId, secrets: Set<name> | name[], migrationsApplied: string[],
//           migrationsInRepo: string[], ratelimits: string[] (binding names), health: {…GET /api/health} | null,
//           local: true for the local Worker (its commands) }
//
// One item per rule; `area` is the Hebrew name the printout groups it by, `label` names what is checked, `need` says what
// is missing in plain words and `how` is the exact command. `required: false` items are reminders: printed, never a failure. `ok` is true when every
// required item is. Rules exist only for what the owner turned on: the email when EMAIL_FROM is set, payments when
// AI_PAYWALL is "on", the provider's own keys for the provider chosen, the backup's secret while VAULT is on, Turnstile
// with FREE_DEVICE_MINT "turnstile", the daily reminder's keys with PUSH "on" (STUDENT-11). A lane that adds a secret or a switch adds its rule here in the same commit:
// test/readiness.test.js fails on a secret named in wrangler.toml's secrets comment that no rule covers.

export const AREAS = {
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

  // ---- always
  const dbId = String(cfg.databaseId || '').trim();
  add('db:id', 'db', dbId && dbId !== 'REPLACE_WITH_DATABASE_ID', 'database_id', 'אין עדיין בסיס נתונים: database_id ב־wrangler.toml',
    'npx wrangler d1 create madregot  (ואז להעתיק את database_id אל worker/wrangler.toml)');
  const applied = new Set(cfg.migrationsApplied || []);
  const missing = (cfg.migrationsInRepo || []).filter((m) => !applied.has(m));
  add('db:migrations', 'db', !missing.length, 'כל המיגרציות הורצו', `מיגרציות שלא הורצו: ${missing.join(', ')}`, cfg.local ? 'npm run db:migrate:local' : 'npm run db:migrate');
  secret('login', 'AUTH_SECRET', 'מפתח לקודי הכניסה', random('AUTH_SECRET'));
  secret('login', 'IP_HASH_SECRET', 'מונים בלי כתובות רשת', random('IP_HASH_SECRET'));
  secret('ai', 'ANTHROPIC_API_KEY', 'העוזר החכם');
  const url = String(vars.PUBLIC_URL || '').trim();
  add('site:url', 'site', /^https:\/\/[^\s/]+/.test(url), 'PUBLIC_URL', 'PUBLIC_URL צריך להיות כתובת https של האתר', 'worker/wrangler.toml: PUBLIC_URL = "https://…"');
  add('site:contact', 'site', !!String(vars.CONTACT_EMAIL || '').trim(), 'CONTACT_EMAIL', 'חסר CONTACT_EMAIL (מופיע בדפי המשפט ובמיילים)', 'worker/wrangler.toml: CONTACT_EMAIL = "…"');
  if (url) {
    add('site:health', 'site', cfg.health?.ok === true, `${url}/api/health עונה`, cfg.health ? 'השרת עונה, אבל לא אומר ok' : `לא הצלחנו להגיע אל ${url}/api/health`, 'npx wrangler deploy');
  }
  const rl = new Set(cfg.ratelimits || []);
  add('edge:bindings', 'edge', ['RL_AUTH', 'RL_AI', 'VAULT_RL'].every((n) => rl.has(n)), 'RL_AUTH, RL_AI, VAULT_RL', 'חסרות הגדרות [[ratelimits]] ב־wrangler.toml (RL_AUTH, RL_AI, VAULT_RL)', 'worker/wrangler.toml', false);

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
