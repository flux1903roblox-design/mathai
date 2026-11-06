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
  no_server: 'האפליקציה עוד לא מחוברת לשרת. אפשר להגדיר כתובת שרת במסך "אני".',
  network: 'אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.',
  no_class: 'לא מצאנו כיתה עם הקוד הזה. בדקו את הקוד עם המורה.',
  wrong_pin: 'הקוד האישי לא נכון. אם שכחתם אותו, המורה יכול לאפס אותו.',
  bad_pin: 'הקוד האישי צריך להיות 4 ספרות.',
  missing_name: 'כתבו את השם שלכם.',
  missing_fields: 'מלאו את כל השדות.',
  not_signed_in: 'צריך להתחבר לכיתה מחדש. עברו למסך "אני".',
  not_teacher: 'קוד הכיתה או מפתח המורה לא נכונים.',
  daily_limit: 'הגעתם למכסה היומית של העוזר. אפשר לחזור מחר.',
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
};
export const errorText = (code) => MESSAGES[code] || 'משהו השתבש. נסו שוב.';

export class ApiError extends Error {
  constructor(code, status) { super(errorText(code)); this.code = code; this.status = status; }
}

export async function api(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const base = apiBase();
  if (!base) throw new ApiError('no_server');
  const token = useApp.getState().profile?.token;
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'server_error', res.status);
  return data;
}

export const teacherHeaders = (cls) => ({ 'X-Class-Code': cls.code, 'X-Teacher-Key': cls.key });

/** Send queued answers and current levels to the class server. */
let syncing = false;
export async function syncNow() {
  const st = useApp.getState();
  if (syncing || !st.profile?.token || !hasServer()) return;
  const events = st.takeOutbox();
  syncing = true;
  try {
    await api('/api/progress', { method: 'POST', body: { events, levels: st.progress } });
  } catch (e) {
    useApp.getState().returnOutbox(events);
    if (e.code === 'not_signed_in') useApp.getState().patchProfile({ token: null });
  } finally { syncing = false; }
}
