import { useApp } from './store.js';

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

const MESSAGES = {
  no_server: 'העוזר לא מחובר בגרסה הזו. השיעורים והתרגול עובדים גם בלעדיו.',
  network: 'אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.',
  no_class: 'לא מצאנו כיתה עם הקוד הזה. בדקו את הקוד עם המורה.',
  wrong_pin: 'הקוד האישי לא נכון. אם שכחתם אותו, המורה יכול לאפס אותו.',
  bad_pin: 'הקוד האישי צריך להיות 4 ספרות.',
  missing_name: 'כתבו את השם שלכם.',
  missing_fields: 'מלאו את כל השדות.',
  not_signed_in: 'צריך להתחבר לכיתה מחדש. עברו למסך "אני".',
  not_teacher: 'קוד הכיתה או מפתח המורה לא נכונים.',
  // the tutor: calm, no pressure, never a price (the sheet that opens says more)
  need_device: 'צריך לרענן את האפליקציה כדי להמשיך.',
  paid_only: 'את הפעולה הזו עושה העוזר החכם המלא.',
  daily_limit: 'להיום סיימנו עם העוזר החכם. מחר הוא כאן שוב.',
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
  // teacher and class
  class_locked: 'הכיתה נעולה להצטרפות חדשה. בקשו מהמורה לפתוח אותה.',
  class_has_licence: 'לכיתה הזו כבר יש רישיון פעיל.',
  bad_licence_code: 'קוד הרישיון לא נכון, פג או כבר נוצל.',
  request_open: 'כבר שלחתם בקשה כזו. נחזור אליכם במייל.',
  too_many_requests: 'נשלחו היום הרבה בקשות מהכיתה הזו. נסו שוב מחר.',
  bad_request: 'משהו בפרטים לא תקין. בדקו ונסו שוב.',
  too_many_lookups: 'היו היום הרבה בדיקות קוד כיתה מהרשת הזו. נסו שוב מחר.',
  // the daily reminder (lib/push.js)
  too_many_push: 'היום כבר שינו את התזכורת הרבה פעמים. אפשר לנסות שוב מחר.',
  bad_endpoint: 'הדפדפן הזה לא תומך בתזכורות.',
  bad_keys: 'הדפדפן הזה לא תומך בתזכורות.',
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
  bad_input: 'משהו בבקשה לא תקין. נסו שוב.',
  upstream: 'העוזר לא זמין כרגע. אפשר להמשיך לתרגל ולנסות שוב בעוד כמה דקות.',
  server_error: 'השרת נתקל בתקלה. נסו שוב בעוד רגע.',
  not_found: 'השרת לא מכיר את הבקשה הזו. ייתכן שהאפליקציה צריכה רענון.',
  shared_limit: 'העוזר החכם עמוס היום. מחר הוא כאן שוב.',
  free_paused: 'העוזר החכם נח היום. מחר הוא חוזר.',
  monthly_fair_use: 'הבדיקות של החודש נגמרו. הן חוזרות ב־1 בחודש.',
  too_large: 'הקובץ גדול מדי. נסו תמונה קטנה יותר.',
};
export const errorText = (code) => MESSAGES[code] || 'משהו השתבש. נסו שוב.';

export class ApiError extends Error {
  constructor(code, status, data = {}) { super(errorText(code)); this.code = code; this.status = status; this.data = data; }
}

/**
 * One JSON call to the server. `auth: false` leaves out the student's class token (a parent's call on a child's
 * device carries only the parent's own headers). `onResponse(res)` sees the response first (its status and headers).
 */
export async function api(path, { method = 'GET', body, headers = {}, signal, auth = true, onResponse } = {}) {
  const base = apiBase();
  if (!base) throw new ApiError('no_server');
  const token = auth ? useApp.getState().profile?.token : null;
  let res;
  try {
    res = await fetch(base + path, {
      method, signal,
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

export const teacherHeaders = (cls) => ({ 'X-Class-Code': cls.code, 'X-Teacher-Key': cls.key });

/** The server reads at most this many class-goal steps a sync (worker/src/goal.js GOAL.maxItems). */
export const STEPS_PER_SYNC = 50;

/**
 * Send queued answers, current levels and the class goal's steps (STUDENT-4) to the class server. Steps go 50 at a time,
 * so a device that kept more (offline for a while) sends the rest in the next rounds; anything not saved goes back to
 * its queue and is sent again later (each step's id makes a resend count once). One sync at a time: a call while one
 * runs gets that one's promise.
 */
let inflight = null;
export function syncNow() {
  if (inflight) return inflight;
  const st = useApp.getState();
  if (!st.profile?.token || !hasServer()) return Promise.resolve();
  inflight = (async () => {
    for (let round = 0; round < 4; round += 1) {
      const app = useApp.getState();
      const events = app.takeOutbox(); const steps = app.takeSteps(STEPS_PER_SYNC);
      try {
        await api('/api/progress', { method: 'POST', body: { events, levels: app.progress, steps } });
      } catch (e) {
        const now = useApp.getState();
        now.returnOutbox(events); now.returnSteps(steps);
        if (e.code === 'not_signed_in') now.patchProfile({ token: null });
        return;
      }
      if (!useApp.getState().stepsOut?.length || !useApp.getState().profile?.token) return;
    }
  })().finally(() => { inflight = null; });
  return inflight;
}
