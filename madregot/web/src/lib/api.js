import { useApp, toWire } from './store.js';
import { keepaliveBudget, bodyBytes } from './durable/moments.js';
import { randomHex } from './random.js';
import { flushWork, fetchClassWork } from './classWork.js';

/**
 * The Worker's address: Settings override, else the one baked in at build time.
 * VITE_API_URL="/" means the Worker serves this app too: same address, no CORS.
 */
export function apiBase() {
  const fromSettings = useApp.getState().ai.apiUrl?.trim();
  // Default: a production build is served by the Worker (same address); `npm run dev` uses the local Worker.
  const url = fromSettings || import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/' : 'http://127.0.0.1:8787');
  if (url === 'none') return ''; // a build with no server: solo practice only (e.g. a preview page)
  if (url === '/') return typeof window !== 'undefined' ? window.location.origin : '';
  return url.replace(/\/+$/, '');
}
export const hasServer = () => !!apiBase();
/**
 * The server is this page's own address (production: the Worker serves the app). Only then may a request use
 * `keepalive`: across origins the class token makes it need a CORS preflight, which keepalive does not get everywhere.
 */
export function sameOrigin() {
  try { return new URL(apiBase()).origin === globalThis.location?.origin; } catch { return false; }
}

const MESSAGES = {
  no_server: 'העוזר לא מחובר בגרסה הזו. השיעורים והתרגול עובדים גם בלעדיו.',
  network: 'אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.',
  no_class: 'לא מצאנו כיתה עם הקוד הזה. בדקו את הקוד עם המורה.',
  wrong_pin: 'הקוד האישי לא נכון. אם שכחתם אותו, המורה יכול לאפס אותו. אם זו הפעם הראשונה שלכם בכיתה, אולי מישהו כבר בחר את השם הזה: הוסיפו אות משם המשפחה.',
  bad_pin: 'הקוד האישי צריך להיות 4 ספרות.',
  missing_name: 'כתבו את השם שלכם.',
  missing_fields: 'מלאו את כל השדות.',
  not_signed_in: 'צריך להתחבר לכיתה מחדש. עברו למסך "אני".',
  not_teacher: 'קוד הכיתה או מפתח המורה לא נכונים.',
  // the tutor: calm, no pressure, never a price (the sheet that opens says more)
  need_device: 'צריך לרענן את האפליקציה כדי להמשיך.',
  paid_only: 'את הפעולה הזו עושה העוזר החכם המלא.',
  daily_limit: 'להיום סיימנו עם העוזר החכם. מחר הוא כאן שוב.',
  class_ai_off: 'בכיתה הזו העוזר החכם כבוי.',
  parent_ok_needed: 'כדי לשאול את העוזר החכם צריך אישור של הורה, פעם אחת.',
  // sign-in and the parent's account
  bad_email: 'כתובת המייל לא נראית תקינה. בדקו אותה ונסו שוב.',
  bad_code: 'הקוד צריך להיות 6 ספרות.',
  wrong_code: 'הקוד לא נכון.',
  code_expired: 'הקוד כבר לא בתוקף. בקשו קוד חדש.',
  too_many_tries: 'היו יותר מדי ניסיונות. בקשו קוד חדש.',
  wait_to_resend: 'קוד חדש אפשר לבקש בעוד דקה.',
  too_many_codes: 'נשלחו היום הרבה קודים. נסו שוב מחר.',
  email_not_configured: 'שליחת קודים במייל עוד לא הוגדרה בשרת.',
  email_failed: 'לא הצלחנו לשלוח את המייל. נסו שוב בעוד רגע.',
  reauth_needed: 'כדי להמשיך, שלחנו קוד חדש למייל.',
  not_account: 'צריך להיכנס שוב עם המייל.',
  confirm_required: 'צריך לאשר את המחיקה.',
  // checkout
  checkout_not_configured: 'ההצטרפות באתר עוד לא פתוחה. כתבו לנו ונפעיל את המנוי לחשבון.',
  already_subscribed: 'יש לכם כבר מנוי פעיל.',
  adult_required: 'כדי להמשיך צריך לאשר שאתם מעל גיל 18 וההורים או האפוטרופוס.',
  terms_required: 'כדי להמשיך צריך לאשר את התקנון ואת מדיניות הביטול.',
  billing_hold: 'יש בירור פתוח על תשלום קודם. כתבו לנו ונסדר את זה.',
  paywall_off: 'כרגע העוזר החכם פתוח בלי מנוי.',
  bad_checkout_url: 'דף התשלום לא נפתח. נסו שוב בעוד רגע.',
  bad_plan: 'המסלול שנבחר לא קיים.',
  too_many_checkouts: 'היו הרבה ניסיונות תשלום בשעה האחרונה. נסו שוב בעוד שעה.',
  bad_idempotency_key: 'משהו בבקשה לא תקין. נסו שוב.',
  order_closed: 'ההזמנה הקודמת כבר נסגרה. נסו שוב.',
  // cancel and resume
  no_subscription: 'לא מצאנו מנוי פעיל בחשבון הזה.',
  refund_window_closed: 'עברו 14 הימים להחזר מלא. אפשר לבטל, והעוזר נשאר פתוח עד סוף התקופה.',
  prorata_not_offered: 'החזר יחסי יש רק במנוי שנתי, אחרי 14 הימים הראשונים.',
  not_resumable: 'אי אפשר לחדש את המנוי הזה. אפשר להצטרף שוב.',
  no_portal: 'עדכון אמצעי תשלום נעשה מול חברת הסליקה. כתבו לנו ונעזור.',
  // linking a child's device
  link_expired: 'הקוד פג. במכשיר של הילד יוצרים קוד חדש.',
  link_not_found: 'לא מצאנו את הקוד. בדקו אותו במכשיר של הילד.',
  link_used: 'הקוד הזה כבר שימש לחיבור.',
  device_limit: 'כבר מחוברים 3 מכשירים. נתקו אחד כדי לחבר מכשיר חדש.',
  needs_subscription: 'כדי לחבר מכשיר צריך מנוי פעיל.',
  too_many_links: 'נוצרו היום הרבה קודים במכשיר הזה. נסו שוב מחר.',
  slow_down: 'רגע, נסו שוב בעוד כמה שניות.',
  bad_secret: 'צריך לרענן את האפליקציה כדי להמשיך.',
  // the parent's free OK for the tutor on a child's device (trust spec TRUST-9, Appendix E §E.8)
  consent_required: 'כדי לאשר צריך לסמן שאתם ההורים ומאשרים.',
  // teacher and class
  class_locked: 'הכיתה נעולה להצטרפות חדשה. בקשו מהמורה לפתוח אותה.',
  class_has_licence: 'לכיתה הזו כבר יש רישיון פעיל.',
  // the Ministry of Education's AI rules for a class (trust spec TRUST-11, Appendix E §E.8)
  class_ai_locked: 'לפי ההנחיות של משרד החינוך אי אפשר עדיין להפעיל את העוזר לתלמידים בכיתה הזו.',
  consent_needed: 'קודם צריך לאשר שיש הסכמת הורים.',
  school_ai_not_approved: 'רישיון עם עוזר חכם לתלמידים בבית ספר אפשר לקנות אחרי האישור בקטלוג. בינתיים אפשר לבקש הצעת מחיר.',
  private_attest_required: 'כדי לבחור קבוצה פרטית צריך לאשר שהיא לא פועלת במסגרת בית ספר.',
  bad_licence_code: 'קוד הרישיון לא נכון, פג או כבר נוצל.',
  owned_by_other: 'הכיתה הזו כבר מקושרת לחשבון אחר. אם זו טעות, כתבו לנו.',
  not_owner: 'את זה יכול לעשות רק מי שהכיתה מקושרת למייל שלו.',
  too_many_classes_owned: 'אפשר לקשר עד 20 כיתות לחשבון אחד. כתבו לנו אם צריך יותר.',
  too_many_lists: 'ביקשתם את רשימת הכיתות הרבה פעמים בשעה האחרונה. נסו שוב בעוד שעה.',
  request_open: 'כבר שלחתם בקשה כזו. נחזור אליכם במייל.',
  too_many_requests: 'נשלחו היום הרבה בקשות מהכיתה הזו. נסו שוב מחר.',
  bad_request: 'משהו בפרטים לא תקין. בדקו ונסו שוב.',
  too_many_lookups: 'היו היום הרבה בדיקות קוד כיתה מהרשת הזו. נסו שוב מחר.',
  // class work (TEACHER-4)
  bad_assignment: 'משהו בפרטי המשימה לא תקין. בדקו את התאריך ואת המדרגה.',
  too_many_assignments: 'נוצרו היום הרבה משימות בכיתה הזו. אפשר להמשיך מחר.',
  // other
  bot_check: 'לא הצלחנו לאשר את המכשיר. נסו שוב.',
  server_config: 'השרת עוד לא הוגדר עד הסוף.',
  too_many_classes: 'נוצרו היום הרבה כיתות מהרשת הזו. אפשר ליצור כיתה נוספת מחר.',
  too_many_joins: 'היום היו הרבה הצטרפויות מהרשת הזו. נסו שוב מחר, או בקשו מהמורה עזרה.',
  too_many_pin: 'היו יותר מדי ניסיונות עם קוד אישי שגוי. המורה יכול לאפס את הקוד שלכם מלוח המורה.',
  ai_not_configured: 'לשרת עוד לא חובר מפתח Claude.',
  solo_ai_off: 'העוזר פתוח רק לתלמידים בכיתה. הצטרפו לכיתה במסך "אני".',
  server_key: 'מפתח ה־Claude בשרת לא תקין. צריך לעדכן אותו.',
  busy: 'העוזר עמוס כרגע. נסו שוב בעוד דקה.',
  refusal: 'העוזר לא יכול לענות על זה. נסו לנסח אחרת, על התרגיל עצמו.',
  bad_output: 'התשובה של העוזר לא הגיעה שלמה. נסו שוב.',
  too_many_open: 'יש כבר הרבה בקשות פתוחות למורה. חכו שהמורה יענה.',
  too_many_reports: 'היום כבר נשלחו הרבה דיווחים מהמכשיר הזה. אפשר לדווח שוב מחר.',
  bad_input: 'משהו בבקשה לא תקין. נסו שוב.',
  upstream: 'העוזר לא זמין כרגע. אפשר להמשיך לתרגל ולנסות שוב בעוד כמה דקות.',
  server_error: 'השרת נתקל בתקלה. נסו שוב בעוד רגע.',
  not_found: 'השרת לא מכיר את הבקשה הזו. ייתכן שהאפליקציה צריכה רענון.',
  shared_limit: 'העוזר החכם עמוס היום. מחר הוא כאן שוב.',
  free_paused: 'העוזר החכם נח היום. מחר הוא חוזר.',
  monthly_fair_use: 'הבדיקות של החודש נגמרו. הן חוזרות ב־1 בחודש.',
  too_large: 'הקובץ גדול מדי. נסו תמונה קטנה יותר.',
};
/**
 * A code the server uses for two things, told apart by the status: too_many_open is 429 for a student's help requests
 * and 409 for a class's open assignments.
 */
const BY_STATUS = {
  'too_many_open:409': 'יש כבר 20 משימות פתוחות בכיתה. אפשר למחוק משימות ישנות ולנסות שוב.',
};
export const errorText = (code, status) => BY_STATUS[`${code}:${status}`] || MESSAGES[code] || 'משהו השתבש. נסו שוב.';

export class ApiError extends Error {
  constructor(code, status, data = {}) { super(errorText(code, status)); this.code = code; this.status = status; this.data = data; }
}

/**
 * One JSON call to the server. `auth: false` leaves out the student's class token (a parent's call on a child's
 * device carries only the parent's own headers). `onResponse(res)` sees the response first (its status and headers).
 * `keepalive: true` lets the request finish after the page is gone (the caller has claimed its bytes; see moments.js).
 */
export async function api(path, { method = 'GET', body, headers = {}, signal, auth = true, onResponse, keepalive = false } = {}) {
  const base = apiBase();
  if (!base) throw new ApiError('no_server');
  const token = auth ? useApp.getState().profile?.token : null;
  let res;
  try {
    res = await fetch(base + path, {
      method, signal, ...(keepalive ? { keepalive: true } : {}),
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError('network');
  }
  onResponse?.(res);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'server_error', res.status, data);
  return data;
}

/**
 * The server's GET /api/health, asked once per visit: what it is set up for (email codes, the tutor, checkout). null
 * with no server, or when it does not answer (asked again next time).
 */
let health = null;
export function serverHealth() {
  if (!hasServer()) return Promise.resolve(null);
  health ||= api('/api/health', { auth: false }).catch(() => { health = null; return null; });
  return health;
}

/** At most this many answers in one request (the server takes 500), and this many requests in one sync. */
export const SYNC_BATCH = 300;
const SYNC_ROUNDS = 5;

/**
 * Send a class student's queued answers and current levels to the class server (DURABLE-7), in batches of 300, up to
 * 5 a time. An answer leaves the outbox only once the server has acknowledged it (`saved` counts from the start of the
 * batch), so a lost request, a closed page or an answer given meanwhile loses nothing; the server ignores an answer it
 * already has. `hidden`: the page is going out of view, so a batch is sent with keepalive when this page and the server
 * share an address and the bytes fit the hidden moment's budget. `levels`: send the levels even with no answers waiting
 * (just after joining a class, so the teacher sees where the student stands). Then the reports of the teacher's work
 * waiting on this device, and the teacher's work as the server has it now (lib/classWork.js, at most every 5 minutes).
 */
let syncing = false;
export async function syncNow({ hidden = false, levels = false } = {}) {
  const st = useApp.getState();
  if (syncing || !st.profile?.token || !hasServer()) return;
  // answers saved before they had ids get one now, so they too can be acknowledged one by one
  if (st.outbox.some((e) => !e.id)) useApp.setState({ outbox: useApp.getState().outbox.map((e) => (e.id ? e : { ...e, id: randomHex(6) })) });
  syncing = true;
  try {
    for (let round = 0; round < SYNC_ROUNDS; round += 1) {
      const batch = useApp.getState().outbox.slice(0, SYNC_BATCH);
      if (!batch.length && !(levels && round === 0)) break;
      const body = { events: batch.map(toWire), levels: useApp.getState().progress };
      const keepalive = hidden && sameOrigin() && keepaliveBudget.claim(bodyBytes(body));
      const r = await api('/api/progress', { method: 'POST', body, keepalive });
      const n = Math.max(0, Math.min(Number(r?.saved) || 0, batch.length));
      useApp.getState().ackOutbox(batch.slice(0, n).map((e) => e.id));
      if (n < batch.length || !batch.length) break;
    }
    await flushWork();
    // a page going out of view sends what is waiting, and fetches nothing new
    if (!hidden) await fetchClassWork();
  } catch (e) {
    // everything not acknowledged stays queued for the next moment
    if (e.code === 'not_signed_in') useApp.getState().patchProfile({ token: null });
  } finally { syncing = false; }
}
