// @ts-check
// Who may ask the AI tutor what, today, decided on the server for every POST /api/ai/:kind (and reported, without
// counting, by GET /api/ai/status).
//
// AI_PAYWALL = "off" (the default) keeps the limits from before the paid tutor: a class student AI_DAILY_LIMIT actions
// a day of any kind, a teacher TEACHER_DAILY_LIMIT, a student without a class SOLO_DAILY_LIMIT per network, all on
// CLAUDE_MODEL. AI_PAYWALL = "on" turns on the tiers below. A paid caller never falls to the free taste.
// The open tier has a dollar breaker too (COUNCIL2-13, COUNCIL2-19): the 'open' pool stops for the day at
// OPEN_DAILY_BUDGET_USD (503 free_paused and one owner notice, as the free taste), every request holds its worst case
// first (spend.js), the classes bound to one email share OPEN_ACCOUNT_DAILY_LIMIT, a class's students share
// OPEN_CLASS_DAILY_UNITS, and a device a parent approved has its own SOLO_DAILY_LIMIT, not the network's.
//
//   class / teacher  a class with a live licence: per student and per kind group, a class-wide cap in units
//   trial            an owner-approved class trial: tutor and check only, lower limits, a daily dollar breaker
//   legacy           a class created before BILLING_START, until LEGACY_CLASS_AI_UNTIL: the old 40 / 200 a day
//   family           a child's device linked to a live family plan (X-Family-Device): limits shared by the family
//   free             everyone else: 2 short questions a day on the low-cost model, with network, class, global and
//                    dollar ceilings behind the person's own count
//
// A chat message that reads as distress never comes here: resolveCare (below) answers it on its own capped keys, never
// counted against a question and never refused.
//
// Before any tier, the Ministry of Education's rules for the student's class (trust spec TRUST-11, shared/schoolRules.js):
// a class student whose class has the tutor off (a school class before the catalogue approval, a class without the
// parents' consent, or a teacher's switch) gets 403 class_ai_off, unless the device is linked to a family (then the
// request is the family's, not the class's). Teachers always pass.
//
// Then a parent's OK (trust spec TRUST-9): with AI_PARENT_OK = "required" (the default), a child alone (no class, no
// adult teacher, no device a parent linked) gets 403 parent_ok_needed, before the free taste and before the switch-off
// path. Opening a class needs no account, so a teacher key alone proves no adult (the trust review: a child tapped
// "אני מורה" and had the tutor). Nor does an email alone (COUNCIL2-2, COUNCIL2-5: a child with their own email could sign
// in as a teacher): a teacher counts as an adult only when the class is bound to an email whose holder declared "18+, a
// teacher or a tutor" (accounts.adult_confirmed_at, set by the teacher's sign-in or bind with { adultTeacher: true }, or
// by a checkout's adult tick), or has a licence or trial in force (an adult paid, or the owner approved it). A teacher
// of any other class is asked to sign in with an email, the same 403 parent_ok_needed with teacher copy on the screen.
// The same adult is needed before a class's student AI can be turned on (classai.js setClassAi: 403 adult_needed).
// In a school class the rules keep the teacher's own tutor to preparing materials (teacherAi 'prep', shared/
// schoolRules.js TEACHER_PREP_KINDS): checking or grading students' work there is 403 prep_only.
// A parent approves a device once, for free, from the parents' page (family.js, purpose 'consent'): the approval is a
// signed-in adult email, an audit row and an email with the AI and privacy summary. "off" is the one-variable rollback.
import { AI_KINDS, AI_GROUPS, KIND_GROUP, AI_UNITS, FREE_KINDS, LITE_MODEL, buildRequest, buildCare } from '../../shared/ai.js';
import {
  HttpError, key, take, peek, sha256, hmacHex, netKey, devKey, nowIso, addDays, dayOf, resetsAt, endOfDayIso, startOfDayIso, isDay, safeEqual, varOf,
} from './util.js';
import { daySpendUsd, monthSpendUsd, queueNotices, ownerNotice, worstCaseNano } from './spend.js';
import { classAiPolicy, studentAiAllowed, rulesEnv, TEACHER_PREP_KINDS } from '../../shared/schoolRules.js';
import { maskPersonal } from '../../shared/safety.js';
import { recordSafety, eventNet } from './safety.js';
import { accountFrom } from './account.js';
import { summaryState } from './report.js';
import { isObj } from '../../shared/obj.js';

/** @typedef {import('./types.js').Env} Env */
/** @typedef {import('./types.js').Row} Row */
/** @typedef {import('./util.js').Key} Key */
/** @typedef {typeof DEFAULT_LIMITS} Limits */
/** A class student as studentFrom reads them: their row with the class's AI rule. @typedef {Row} Student */
/** A class's row (requireTeacher), with how the teacher came in and whether an adult is behind it. */
/** @typedef {Row & { via: 'key' | 'account', accountId?: string, adultAt?: string | null, adult?: boolean }} Teacher */
/** @typedef {{ device_id: string, account_id: string, label: string, share_child: unknown, share_parent: unknown }} FamilyDevice */
/**
 * Everyone a child-side request speaks for (identify). classAiOff: the app said the class's AI is off (X-Class-AI: off).
 * @typedef {{ student: Student | null, teacher: Teacher | null, fam: FamilyDevice | null, famBad: boolean, device: string | null, classAiOff?: boolean }} Identity
 */
/**
 * A paid bucket of a caller (paidBuckets): its tier and pool, its limits or flat limit, the kinds it serves, the
 * counters of one request, and when its month's spend puts it in economy mode.
 * @typedef {{ tier: string, pool: string, subj: string, lim?: Record<string, number>, flat?: number, kinds: string[],
 *   keysFor: (kind: string) => Key[], economyAt: number | null, paused: boolean, economy?: boolean }} Bucket
 */
/**
 * What precheck decided and counted() takes: the open tier's keys, the usable paid buckets (and the refusals of the
 * others), or the free taste's keys.
 * @typedef {{ mode: 'open', keys: Key[], parts: Array<{ pool: string, usd: number, scope: 'class' | 'account', name: string }> }
 *   | { mode: 'paid', buckets: Bucket[], fails: HttpError[] }
 *   | { mode: 'free', keys: FreeKeys }} Plan
 */
/** @typedef {{ person: Key, tries: Key, net: Key | null, cls: Key | null, all: Key }} FreeKeys */
/** shared/ai.js's tables, read by a kind or group name that comes from a request. */
const GROUP_OF = /** @type {Record<string, string>} */ (KIND_GROUP);
const UNITS = /** @type {Record<string, number>} */ (AI_UNITS);

// ---------------------------------------------------------------- limits
export const DEFAULT_LIMITS = {
  // account: a day for all the classes bound to one email (class_owners), shared by their teachers; classUnits: a day
  // for all the students of one class, in AI_UNITS (an exam is 20), as the legacy window's class cap (COUNCIL2-19)
  open: { student: 40, teacher: 200, solo: 20, account: 200, classUnits: 600 },
  free: { student: 2, teacher: 5, net: 80, class: 80, global: 3000 },
  family: { tutor: 30, check: 6, generate: 5, exam: 2, examMonthly: 10, devices: 3 },
  class: { student: { tutor: 20, check: 3, generate: 3, exam: 1 }, teacher: { tutor: 100, check: 20, generate: 30, exam: 20 }, seatUnits: 25 },
  trial: { student: { tutor: 10, check: 2, generate: 0, exam: 0 }, teacher: { tutor: 50, check: 10, generate: 0, exam: 0 }, seatUnits: 10, maxSeats: 40, days: 14 },
  legacy: { student: 40, teacher: 200, classUnits: 600 },
  // openAccountDailyUsd, openClassDailyUsd: what one email (all its classes) and one class may cost of the open pool
  // in a day, so one of them pauses only itself; openInflightUsd: how far the holds of requests in flight may pass
  // what is left of a budget (util.js key slack)
  budgets: {
    freeDailyUsd: 5, openDailyUsd: 25, openAccountDailyUsd: 3, openClassDailyUsd: 3, openInflightUsd: 20, trialDailyUsd: 10, familyMonthlyUsd: 4,
    classSeatMonthlyUsd: 0.8, ownerAlertUsd: 20,
  },
  // care replies (trust spec TRUST-3 §3.4): a day, per person, per network and for everyone; past them the fixed reply
  care: { person: 5, net: 30, global: 1000 },
  graceDays: 3,
};
// Owner overrides through plain vars; AI_LIMITS (JSON) is deep-merged last for everything else.
/** @type {Array<[string, ...string[][]]>} */
const VARS = [
  ['AI_DAILY_LIMIT', ['open', 'student'], ['legacy', 'student']],
  ['TEACHER_DAILY_LIMIT', ['open', 'teacher'], ['legacy', 'teacher']],
  ['SOLO_DAILY_LIMIT', ['open', 'solo']],
  ['OPEN_ACCOUNT_DAILY_LIMIT', ['open', 'account']],
  ['OPEN_CLASS_DAILY_UNITS', ['open', 'classUnits']],
  ['OPEN_DAILY_BUDGET_USD', ['budgets', 'openDailyUsd']],
  ['OPEN_ACCOUNT_DAILY_USD', ['budgets', 'openAccountDailyUsd']],
  ['OPEN_CLASS_DAILY_USD', ['budgets', 'openClassDailyUsd']],
  ['OPEN_INFLIGHT_USD', ['budgets', 'openInflightUsd']],
  ['FREE_DAILY_LIMIT', ['free', 'student']],
  ['FREE_TEACHER_DAILY', ['free', 'teacher']],
  ['FREE_NET_DAILY', ['free', 'net']],
  ['FREE_CLASS_DAILY', ['free', 'class']],
  ['FREE_GLOBAL_DAILY', ['free', 'global']],
  ['FAMILY_EXAM_MONTHLY', ['family', 'examMonthly']],
  ['CLASS_SEAT_DAILY_UNITS', ['class', 'seatUnits']],
  ['LEGACY_CLASS_DAILY_UNITS', ['legacy', 'classUnits']],
  ['FREE_DAILY_BUDGET_USD', ['budgets', 'freeDailyUsd']],
  ['TRIAL_DAILY_BUDGET_USD', ['budgets', 'trialDailyUsd']],
  ['FAMILY_MONTHLY_BUDGET_USD', ['budgets', 'familyMonthlyUsd']],
  ['CLASS_SEAT_MONTHLY_BUDGET_USD', ['budgets', 'classSeatMonthlyUsd']],
  ['OWNER_ALERT_USD', ['budgets', 'ownerAlertUsd']],
  ['FAMILY_GRACE_DAYS', ['graceDays']],
];
/**
 * @param {Record<string, any>} into
 * @param {unknown} from
 */
function merge(into, from) {
  for (const [k, v] of Object.entries(from || {})) {
    if (isObj(v) && isObj(into[k])) merge(into[k], v);
    else if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && typeof into[k] === 'number') into[k] = v;
  }
  return into;
}
/** @type {(o: Record<string, any>, p: string[], v: number) => void} */
const setPath = (o, p, v) => { let t = o; for (const k of p.slice(0, -1)) t = t[k]; t[String(p.at(-1))] = v; };
/**
 * The limits in force: the defaults, the owner's vars, then AI_LIMITS.
 * @param {Env} env
 * @returns {Limits}
 */
export function limits(env) {
  const L = structuredClone(DEFAULT_LIMITS);
  for (const [name, ...paths] of VARS) {
    const raw = varOf(env, name);
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 0) continue;
    for (const p of paths) setPath(L, p, v);
  }
  if (env.AI_LIMITS) {
    try { merge(L, typeof env.AI_LIMITS === 'string' ? JSON.parse(env.AI_LIMITS) : env.AI_LIMITS); } catch { console.error('AI_LIMITS is not valid JSON; ignored'); }
  }
  return L;
}
/** @param {Env} env */
export const paywallOn = (env) => String(env.AI_PAYWALL || 'off') === 'on';
/** @param {Env} env */
const soloOff = (env) => String(env.ALLOW_SOLO_AI) === 'false';
/** Does a child alone need a parent's OK before the tutor (TRUST-9)? Anything but "off" means yes. */
/** @param {Env} env */
export const parentOkRequired = (env) => String(env.AI_PARENT_OK ?? 'required').trim() !== 'off';
/**
 * A teacher with an adult behind the class: bound to a signed-in email (class_owners) or with a licence or trial in
 * force. With AI_PARENT_OK "off" every teacher counts, as before (the one-variable rollback).
 */
/** @type {(env: Env, id: Identity) => boolean} */
const adultTeacher = (env, id) => !!id.teacher && (!parentOkRequired(env) || id.teacher.adult === true);
/** No student, no adult teacher and no device a parent linked: the free taste and the solo rules apply. */
/** @type {(env: Env, id: Identity) => boolean} */
const alone = (env, id) => !id.student && !adultTeacher(env, id) && !id.fam;
/**
 * A caller who would reach the tutor on their own, with no adult behind them: no class student (their class's rule
 * covers them), no adult teacher, and no device a parent linked (a plan or a free OK). With ALLOW_SOLO_AI "false"
 * such a caller has no tutor at all (solo_ai_off), and a parent's OK would not change that, so it is not asked for.
 */
/** @type {(env: Env, id: Identity) => boolean} */
const needsParentOk = (env, id) => parentOkRequired(env) && alone(env, id) && !soloOff(env);

/**
 * Is an adult behind this class: an email it is bound to whose holder declared they are 18 or over
 * (accounts.adult_confirmed_at, COUNCIL2-5), or a licence or trial in force?
 * @param {Env} env
 * @param {string} code
 */
export async function classHasAdult(env, code) {
  const owner = await env.DB.prepare(`SELECT 1 AS x FROM class_owners o JOIN accounts a ON a.id = o.account_id
    WHERE o.class_code = ? AND a.adult_confirmed_at IS NOT NULL`).bind(code).first();
  return !!owner || !!(await liveLicence(env, code));
}
/**
 * Is this teacher (requireTeacher's class row) an adult? One who came with the session of an email that declared it, or
 * any teacher of a class with an adult behind it (classHasAdult: a co-teacher with the key of such a class too).
 * @param {Env} env
 * @param {Teacher} cls
 * @returns {Promise<boolean>}
 */
export async function teacherIsAdult(env, cls) {
  return (cls.via === 'account' && !!cls.adultAt) || classHasAdult(env, cls.code);
}

/**
 * The Ministry's rule for a teacher's own tutor in their class (shared/schoolRules.js): 'prep' (preparing materials
 * only: TEACHER_PREP_KINDS) in a school class before the catalogue approval or below its grade, else 'on'.
 * @param {Env} env
 * @param {Teacher} cls
 */
export async function teacherAiRule(env, cls) {
  const row = await env.DB.prepare('SELECT setting, student_ai, ai_consent_at FROM class_settings WHERE code = ?').bind(cls.code).first();
  return classAiPolicy({ setting: row?.setting, grade: cls.grade, studentAi: row?.student_ai, consentAt: row?.ai_consent_at }, rulesEnv(env)).teacherAi;
}

// ---------------------------------------------------------------- who is asking
/**
 * The class student a request carries (Authorization: Bearer <token>), with what the Ministry's rules need (TRUST-11):
 * the class's setting, the teacher's switch and consent (no class_settings row: school, off, none), and whether the
 * teacher turned the AI off for this student. The token is one of the student's devices (DURABLE-6: up to 3 devices
 * each, in student_tokens; students.token_hash is no longer read). The token's last_seen is written at most once an
 * hour; a token unused for 400 days is purged at night.
 * @param {Request} req
 * @param {Env} env
 * @returns {Promise<Student | null>}
 */
export async function studentFrom(req, env) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || token.length > 128) return null;
  // the class's AI rule rides along (trust spec TRUST-11 §4): no class_settings row is a school class with student AI
  // off, and a student_ai_off row is the teacher's switch for this one student
  const hash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT s.id, s.name, s.class_code, s.created_at, c.grade, c.created_at AS class_created_at,
       COALESCE(cs.setting, 'school') AS setting, COALESCE(cs.student_ai, 'off') AS student_ai, cs.ai_consent_at, so.student_id IS NOT NULL AS ai_off,
       t.last_seen AS token_seen
     FROM student_tokens t JOIN students s ON s.id = t.student_id JOIN classes c ON c.code = s.class_code
     LEFT JOIN class_settings cs ON cs.code = s.class_code LEFT JOIN student_ai_off so ON so.student_id = s.id
     WHERE t.token_hash = ?`,
  ).bind(hash).first();
  if (!row) return null;
  const { token_seen: seen, ...student } = row;
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  if (!(seen >= hourAgo)) await env.DB.prepare('UPDATE student_tokens SET last_seen = ? WHERE token_hash = ?').bind(nowIso(), hash).run();
  return student;
}

/**
 * May this class student reach the tutor? The Ministry's rule for their class (shared/schoolRules.js), then their own switch.
 * @param {Env} env
 * @param {Student} s
 */
export function studentAiOn(env, s) {
  const policy = classAiPolicy({ setting: s.setting, grade: s.grade, studentAi: s.student_ai, consentAt: s.ai_consent_at }, rulesEnv(env));
  return studentAiAllowed(policy, { aiOff: !!s.ai_off });
}

/**
 * The class's AI switch for one AI request (trust spec TRUST-11 §4): 'on', 'home' or 'off'. A teacher always passes
 * (what a teacher may do with the tutor only changes the copy). A class student whose class, or whose own switch, has
 * the tutor off gets 'off', except on a device a parent linked to the family (X-Family-Device): that is home use by the
 * parent's choice, so the request is no longer the class's ('home': the student identity is dropped here, the request
 * is decided as the family's or as that device's free taste, and no class counter moves).
 * @param {Env} env
 * @param {Identity} id
 * @returns {'on' | 'home' | 'off'}
 */
function classGate(env, id) {
  if (!id.student || studentAiOn(env, id.student)) return 'on';
  if (id.fam) { id.student = null; return 'home'; }
  return 'off';
}

// Free text a teacher sends the tutor is masked like a child's (TRUST-11 §7, the Ministry's §5.1: nothing identifying
// goes into an AI tool). Every string of the request is masked except the pictures themselves.
const PICTURE = new Set(['image', 'data', 'mediaType']);
/**
 * @param {unknown} v
 * @param {string} [name]
 * @returns {unknown}
 */
function maskFields(v, name = '') {
  if (typeof v === 'string') return PICTURE.has(name) ? v : maskPersonal(v).text;
  if (Array.isArray(v)) return v.map((x) => maskFields(x));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, maskFields(x, k)]));
  return v;
}

/**
 * One more refused request in a class whose AI is off (ai_usage aioff:c:<code>, a day: the owner's view of it, purged
 * with the class's other counters in forget.js CLASS_COUNTERS). The teacher lane's counter, beside the safety event.
 */
/** @type {(env: Env, code: string) => Promise<unknown>} */
const noteClassOff = (env, code) => take(env, [key(`aioff:c:${code}`, 1e9)]).catch(() => null);
/**
 * @param {Request} req
 * @param {Env} env
 * @returns {Promise<Student>}
 */
export async function requireStudent(req, env) {
  const s = await studentFrom(req, env);
  if (!s) throw new HttpError(401, 'not_signed_in');
  return s;
}
/**
 * The teacher of a class: X-Class-Code with either the class's teacher key (X-Teacher-Key) or the session of the account
 * the class is bound to (X-Account-Token, table class_owners). The key is checked first and a valid key wins, so a
 * request that carries a key and a purchaser's session together behaves as before. Returns the class row plus
 * via: 'key' | 'account', and accountId when the account opened it. A wrong pair is 401 not_teacher; a request whose
 * only credential is a session that has ended (or never existed) is 401 not_account, so the page asks for the email.
 * @param {Request} req
 * @param {Env} env
 * @returns {Promise<Teacher>}
 */
export async function requireTeacher(req, env) {
  const code = String(req.headers.get('X-Class-Code') || '').toUpperCase();
  const k = req.headers.get('X-Teacher-Key') || '';
  const token = req.headers.get('X-Account-Token') || '';
  if (!code || code.length > 12 || k.length > 128 || (!k && !token)) throw new HttpError(401, 'not_teacher');
  const cls = await env.DB.prepare('SELECT * FROM classes WHERE code = ?').bind(code).first();
  if (!cls) throw new HttpError(401, 'not_teacher');
  if (k && safeEqual(cls.teacher_key_hash, await sha256(k))) return { ...cls, via: 'key' };
  if (token) {
    const a = await accountFrom(req, env);
    if (!a && !k) throw new HttpError(401, 'not_account');
    const owns = a && (await env.DB.prepare('SELECT 1 AS x FROM class_owners WHERE class_code = ? AND account_id = ?').bind(cls.code, a.id).first());
    // adultAt: when this email's holder declared they are 18 or over (COUNCIL2-5), or null
    if (owns) return { ...cls, via: 'account', accountId: a.id, adultAt: a.adultConfirmedAt || null };
  }
  throw new HttpError(401, 'not_teacher');
}

/**
 * A child's device linked to a family plan (X-Family-Device: fd1.<64 hex>), or null. With its two sharing switches for
 * the parents' report (report.js); the AI path ignores them.
 * @param {Env} env
 * @param {unknown} token
 * @returns {Promise<FamilyDevice | null>}
 */
export async function familyDeviceFrom(env, token) {
  if (!/^fd1\.[a-f0-9]{64}$/.test(String(token || ''))) return null;
  const row = await env.DB.prepare('SELECT id, account_id, label, last_seen, share_child, share_parent FROM family_devices WHERE token_hash = ?')
    .bind(await sha256(String(token))).first();
  if (!row) return null;
  const today = dayOf();
  if (row.last_seen !== today) await env.DB.prepare('UPDATE family_devices SET last_seen = ? WHERE id = ?').bind(today, row.id).run();
  return { device_id: row.id, account_id: row.account_id, label: row.label, share_child: row.share_child, share_parent: row.share_parent };
}

/**
 * The install's own id (X-Device). With FREE_DEVICE_MINT = "turnstile" only the signed form minted by POST /api/devices counts.
 * @param {Request} req
 * @param {Env} env
 * @returns {Promise<string | null>}
 */
export async function deviceFrom(req, env) {
  const raw = String(req.headers.get('X-Device') || '');
  const signed = raw.match(/^dv1\.([a-f0-9]{32})\.([a-f0-9]{32})$/);
  if (String(env.FREE_DEVICE_MINT || 'off') === 'turnstile') {
    if (!signed || !env.DEVICE_SECRET) return null;
    return safeEqual((await hmacHex(env.DEVICE_SECRET, `device:${signed[1]}`)).slice(0, 32), signed[2]) ? signed[1] : null;
  }
  if (signed) return signed[1];
  return /^[a-f0-9]{32}$/.test(raw) ? raw : null;
}

/**
 * Everyone a child-side request speaks for. X-Account-Token is read only together with X-Class-Code, as the owner's
 * teacher credential (requireTeacher); it never gives family or free-device AI: a parent session alone gives no AI.
 * X-Class-AI: off (the iPhone build made with VITE_STORE_CLASS_AI=0, STUDENT-12 / FOLLOWUP-44) says this device uses no
 * class licence: its student or teacher gets the free taste, as if the class had none (paidBuckets). It can only take
 * AI away, so it needs no proof.
 * @param {Request} req
 * @param {Env} env
 * @returns {Promise<Identity>}
 */
export async function identify(req, env) {
  /** @type {Identity} */
  const id = { student: null, teacher: null, fam: null, famBad: false, device: null };
  id.classAiOff = String(req.headers.get('X-Class-AI') || '').trim().toLowerCase() === 'off';
  id.student = await studentFrom(req, env);
  const asTeacher = req.headers.get('X-Teacher-Key') || (req.headers.get('X-Class-Code') && req.headers.get('X-Account-Token'));
  if (!id.student && asTeacher) {
    id.teacher = await requireTeacher(req, env);
    // read only when it matters (TRUST-9): a teacher of a class with no adult behind it is a child alone there. A
    // teacher who came with the owner's email session (via 'account') is that adult only when the email's holder
    // declared it (COUNCIL2-2, COUNCIL2-5): an email alone proves no age.
    const t = id.teacher;
    if (parentOkRequired(env)) id.teacher = { ...t, adult: await teacherIsAdult(env, t) };
  }
  const fd = req.headers.get('X-Family-Device');
  if (fd) { id.fam = await familyDeviceFrom(env, fd); id.famBad = !id.fam; }
  id.device = await deviceFrom(req, env);
  return id;
}

// ---------------------------------------------------------------- live plans
/** @type {(field: string) => string} */
const liveSql = (field) => `SELECT * FROM subscriptions WHERE kind = ? AND ${field} = ? AND (
  (status IN ('active', 'canceled') AND current_period_end > ?) OR (status = 'past_due' AND current_period_end > ?))
  ORDER BY current_period_end DESC LIMIT 1`;
/**
 * @param {Env} env
 * @param {'class' | 'family'} kind
 * @param {string} field
 * @param {unknown} value
 * @returns {Promise<Row | null>}
 */
async function live(env, kind, field, value) {
  if (!value) return null;
  const now = nowIso();
  const grace = addDays(now, -limits(env).graceDays);
  return env.DB.prepare(liveSql(field)).bind(kind, value, now, grace).first();
}
/** A class licence (or trial) that is in force: active or canceled until its end, past_due for the grace days after. */
/** @type {(env: Env, classCode: unknown) => Promise<Row | null>} */
export const liveLicence = (env, classCode) => live(env, 'class', 'class_code', String(classCode || '').toUpperCase());
/** A family plan that is in force, by the same rule. */
/** @type {(env: Env, accountId: unknown) => Promise<Row | null>} */
export const liveFamily = (env, accountId) => live(env, 'family', 'account_id', accountId);

/**
 * Is a class still in the legacy window (made before BILLING_START, before LEGACY_CLASS_AI_UNTIL ends)?
 * @param {Env} env
 * @param {unknown} classCreatedAt
 */
export function legacyWindow(env, classCreatedAt) {
  if (!isDay(env.BILLING_START) || !isDay(env.LEGACY_CLASS_AI_UNTIL) || !classCreatedAt) return false;
  return String(classCreatedAt) < startOfDayIso(env.BILLING_START) && nowIso() < endOfDayIso(env.LEGACY_CLASS_AI_UNTIL);
}

// ---------------------------------------------------------------- errors
/** @type {(tier: string, group: string, limit: number, period?: 'day' | 'month') => HttpError} */
const dailyErr = (tier, group, limit, period = 'day') => new HttpError(429, 'daily_limit', undefined, { tier, group, limit, left: 0, resetsAt: resetsAt(period) });
/** @param {string} scope */
const sharedErr = (scope) => new HttpError(429, 'shared_limit', undefined, { scope, resetsAt: resetsAt('day') });
const pausedErr = () => new HttpError(503, 'free_paused', undefined, { resetsAt: resetsAt('day') });
const fairUseErr = () => new HttpError(429, 'monthly_fair_use', undefined, { resetsAt: resetsAt('month') });
/** @param {string} kind */
const paidOnlyErr = (kind) => new HttpError(402, 'paid_only', undefined, { kind });
/** @type {Record<string, number>} */
const RANK = { daily_limit: 5, shared_limit: 4, monthly_fair_use: 3, free_paused: 2, paid_only: 1 };
/** The most useful of several refusals: daily_limit > shared_limit > monthly_fair_use > free_paused > paid_only. */
/** @type {(fails: HttpError[]) => HttpError} */
export const best = (fails) => fails.reduce((a, b) => ((RANK[b.code] || 0) > (RANK[a.code] || 0) ? b : a));

/**
 * @param {Env} env
 * @param {string} kind
 * @param {unknown} input
 * @param {'full' | 'economy' | 'lite'} shape
 */
function params(env, kind, input, shape) {
  const model = shape === 'full' ? env.CLAUDE_MODEL : (env.FREE_MODEL || LITE_MODEL);
  try { return buildRequest(kind, /** @type {any} */ (input), /** @type {any} */ ({ model, shape })); } catch (e) { throw new HttpError(400, 'bad_input', /** @type {Error} */ (e).message); }
}

// ---------------------------------------------------------------- the paid buckets of a caller
/**
 * The paid buckets that apply to this caller, class (or legacy) first, then family. Nothing is counted here.
 * @param {Env} env
 * @param {Identity} id
 * @returns {Promise<Bucket[]>}
 */
async function paidBuckets(env, id) {
  const L = limits(env);
  const cls = id.student?.class_code ?? id.teacher?.code ?? null;
  const createdAt = id.student?.class_created_at ?? id.teacher?.created_at ?? null;
  /** @type {Bucket[]} */
  const out = [];
  // a device whose build has class AI off (X-Class-AI: off) counts no class licence or legacy allowance: the free taste
  const classAi = !!cls && !id.classAiOff;
  const lic = classAi ? await liveLicence(env, cls) : null;
  if (lic) {
    const trial = lic.plan === 'trial';
    const T = trial ? L.trial : L.class;
    /** @type {Record<string, number>} */
    const lim = id.student ? T.student : T.teacher;
    const subj = id.student ? `s:${id.student.id}` : `t:${cls}`;
    const tier = trial ? 'trial' : id.student ? 'class' : 'teacher';
    out.push({
      tier, pool: trial ? 'trial' : `cls:${cls}`, subj, lim,
      kinds: AI_KINDS.filter((/** @type {string} */ k) => lim[GROUP_OF[k]] > 0),
      keysFor: (kind) => {
        const g = GROUP_OF[kind];
        return [
          key(`${subj}:${g}`, lim[g], { refundable: true, err: dailyErr(tier, g, lim[g]) }),
          key(`${subj}:${g}:tries`, 3 * lim[g], { err: dailyErr(tier, g, lim[g]) }),
          key(`cls:${cls}`, (lic.seats || 0) * T.seatUnits, { n: UNITS[kind], err: sharedErr('class') }),
        ];
      },
      economyAt: trial ? null : (lic.seats || 0) * L.budgets.classSeatMonthlyUsd,
      paused: trial ? (await daySpendUsd(env, 'trial')) >= L.budgets.trialDailyUsd : false,
    });
  } else if (classAi && legacyWindow(env, createdAt)) {
    const subj = id.student ? `s:${id.student.id}` : `t:${cls}`;
    const limit = id.student ? L.legacy.student : L.legacy.teacher;
    out.push({
      tier: 'legacy', pool: 'legacy', subj, kinds: AI_KINDS, flat: limit,
      keysFor: (kind) => [
        key(subj, limit, { refundable: true, err: dailyErr('legacy', 'all', limit) }),
        key(`cls:${cls}`, L.legacy.classUnits, { n: UNITS[kind], err: sharedErr('class') }),
      ],
      economyAt: null, paused: false,
    });
  }
  const sub = id.fam ? await liveFamily(env, id.fam.account_id) : null;
  if (sub && id.fam) {
    const a = id.fam.account_id;
    const F = L.family;
    out.push({
      tier: 'family', pool: `fam:${a}`, subj: `fam:${a}`, lim: F, kinds: AI_KINDS.filter((/** @type {string} */ k) => /** @type {Record<string, number>} */ (F)[GROUP_OF[k]] > 0),
      keysFor: (kind) => {
        const g = GROUP_OF[kind];
        const n = /** @type {Record<string, number>} */ (F)[g];
        return [
          key(`fam:${a}:${g}`, n, { refundable: true, err: dailyErr('family', g, n) }),
          key(`fam:${a}:${g}:tries`, 3 * n, { err: dailyErr('family', g, n) }),
          g === 'exam' && key(`fam:${a}:exam`, F.examMonthly, { period: 'month', refundable: true, err: dailyErr('family', 'exam', F.examMonthly, 'month') }),
        ].filter((x) => !!x);
      },
      economyAt: L.budgets.familyMonthlyUsd, paused: false,
    });
  }
  for (const b of out) b.economy = b.economyAt != null && (await monthSpendUsd(env, b.pool)) >= b.economyAt;
  return out;
}

/**
 * The free taste's counters for this caller and kind.
 * @param {Request} req
 * @param {Env} env
 * @param {Identity} id
 * @returns {Promise<{ keys: FreeKeys, anon: boolean, limit: number }>}
 */
async function freeKeys(req, env, id) {
  const L = limits(env).free;
  const cls = id.student?.class_code ?? id.teacher?.code ?? null;
  const anon = !id.student && !id.teacher && !id.fam;
  const net = anon ? await netKey(req, env) : null;
  const [person, limit] = id.student ? [`free:s:${id.student.id}`, L.student]
    : id.fam ? [`free:fd:${id.fam.device_id}`, L.student]
      : id.teacher ? [`free:t:${id.teacher.code}`, L.teacher]
        : id.device ? [`free:d:${await devKey(env, id.device)}`, L.student]
          : [`free:x:${net}`, L.student];
  const keys = {
    person: key(person, limit, { refundable: true, err: dailyErr('free', 'tutor', limit) }),
    tries: key(`${person}:tries`, 3 * limit, { err: dailyErr('free', 'tutor', limit) }),
    net: anon ? key(`free:n:${net}`, L.net, { err: sharedErr('network') }) : null,
    cls: cls ? key(`free:c:${cls}`, L.class, { err: sharedErr('class') }) : null,
    all: key('free:all', L.global, { err: pausedErr() }),
  };
  return { keys, anon, limit };
}

/**
 * The email a class is bound to (class_owners), or null: the teacher's session says so, else the table.
 * @param {Env} env
 * @param {Teacher} teacher
 * @returns {Promise<string | null>}
 */
async function classOwner(env, teacher) {
  if (teacher.accountId) return teacher.accountId;
  const row = await env.DB.prepare('SELECT account_id FROM class_owners WHERE class_code = ?').bind(teacher.code).first();
  return row?.account_id || null;
}

/**
 * With the switch off (the behaviour before the paid tutor, and the one-variable rollback), the counters of a request,
 * the person's own first: a class student (s:<id>) and their class's units (open:c:<code>, so students the class never
 * had cannot multiply its day); a teacher (t:<code>) and, when the class is bound to an email, that email's day
 * (open:a:<account>, shared by every class it owns: up to 20, teacherAccount.js MAX_OWNED); a device of a family whose
 * plan is still live (it keeps its own key, so a family that is still paying is never counted as a stranger on its
 * network, nor refused when ALLOW_SOLO_AI is "false"); with solo AI allowed, a device a parent approved for free, with
 * no class (its own key, open:fd:<device>, SOLO_DAILY_LIMIT: not the network's, which other children at that address
 * share); else the network's solo key. The class key counts in AI_UNITS and carries `units`; the others count actions.
 * `kind` sets the units (status asks with a chat: 1). strict: refuse with 403 solo_ai_off instead of returning null.
 * @param {Request} req
 * @param {Env} env
 * @param {Identity} id
 * @param {string} [kind]
 * @param {{ strict?: boolean }} [opts]
 * @returns {Promise<Key[] | null>}
 */
async function openKeys(req, env, id, kind = 'chat', { strict = false } = {}) {
  const L = limits(env).open;
  /** @type {(who: string, limit: number) => Key} */
  const own = (who, limit) => key(who, limit, { refundable: true, err: dailyErr('open', 'all', limit) });
  if (id.student) {
    return [own(`s:${id.student.id}`, L.student),
      { ...key(`open:c:${id.student.class_code}`, L.classUnits, { n: UNITS[kind] || 1, err: sharedErr('class') }), units: true }];
  }
  if (id.teacher) {
    const account = await classOwner(env, id.teacher);
    return [own(`t:${id.teacher.code}`, L.teacher), ...(account ? [own(`open:a:${account}`, L.account)] : [])];
  }
  if (id.fam && (await liveFamily(env, id.fam.account_id))) return [own(`fam:${id.fam.account_id}`, L.student)];
  if (soloOff(env)) { if (strict) throw new HttpError(403, 'solo_ai_off'); return null; }
  if (id.fam) return [own(`open:fd:${id.fam.device_id}`, L.solo)];
  return [own(`solo:n:${await netKey(req, env)}`, L.solo)];
}

/**
 * Is a pool's day spent (its ai_spend for today at or over budgetUsd)? Then the owner gets that day's notice, once
 * (owner:<pool>_paused:<day>): the free taste's and the open tier's breaker.
 * @param {Env} env
 * @param {string} pool
 * @param {number} budgetUsd
 */
async function poolSpent(env, pool, budgetUsd) {
  if ((await daySpendUsd(env, pool)) < budgetUsd) return false;
  const day = dayOf();
  await queueNotices(env, [ownerNotice(day, `owner:${pool}_paused:${day}`, { day, budgetUsd })]);
  return true;
}

/**
 * A request's dollar hold on a pool (COUNCIL2-19): its worst case (spend.js worstCaseNano) in usd:<pool>, taken with
 * its counters while the pool's spend today plus the holds is under the budget, given back when it has been priced.
 * The open pool's holds may pass what is left of the budget by OPEN_INFLIGHT_USD (a whole class asks at once, and a
 * real request costs a small part of its worst case); the free taste's may not.
 * @param {Env} env
 * @param {'open' | 'free'} pool
 * @param {string} kind
 * @param {unknown} params
 * @returns {Key}
 */
function holdKey(env, pool, kind, params) {
  const budgets = limits(env).budgets;
  const usd = pool === 'open' ? budgets.openDailyUsd : budgets.freeDailyUsd;
  const slack = pool === 'open' ? Math.floor(budgets.openInflightUsd * 1e9) : 0;
  return key(`usd:${pool}`, Math.floor(usd * 1e9), { n: worstCaseNano(params, kind, env), spend: pool, slack, err: pausedErr() });
}

/**
 * The parts of the open pool a caller belongs to (the review of COUNCIL2-19: one email spent the whole day's pool and
 * paused the tutor for every class): the class (open:c:<code>, OPEN_CLASS_DAILY_USD a day) and the email it is bound
 * to (open:a:<account>, OPEN_ACCOUNT_DAILY_USD for all its classes), for a class student and for a teacher alike. Each
 * is a pool of its own in ai_spend (the day only), held like the open pool itself, so a class or an email that spends
 * its part pauses only itself, and the owner's notice names it. A device with no class has no part: its own count is
 * small (SOLO_DAILY_LIMIT).
 * @param {Env} env
 * @param {Identity} id
 * @returns {Promise<Array<{ pool: string, usd: number, scope: 'class' | 'account', name: string }>>}
 */
async function openParts(env, id) {
  const B = limits(env).budgets;
  const code = id.student?.class_code || id.teacher?.code;
  if (!code) return [];
  const account = id.teacher ? await classOwner(env, id.teacher)
    : (await env.DB.prepare('SELECT account_id FROM class_owners WHERE class_code = ?').bind(code).first())?.account_id || null;
  return [
    { pool: `open:c:${code}`, usd: B.openClassDailyUsd, scope: /** @type {const} */ ('class'), name: String(code) },
    ...(account ? [{ pool: `open:a:${account}`, usd: B.openAccountDailyUsd, scope: /** @type {const} */ ('account'), name: String(account) }] : []),
  ];
}
/** The hold of one part (openParts): usd:<part pool>, with the same room for requests in flight as the pool's. */
/** @type {(env: Env, part: { pool: string, usd: number }, n: number) => Key} */
const partHold = (env, part, n) => key(`usd:${part.pool}`, Math.floor(part.usd * 1e9), {
  n, spend: part.pool, slack: Math.floor(limits(env).budgets.openInflightUsd * 1e9), err: pausedErr(),
});
/**
 * Is one part's day spent? Then the owner gets its notice, once that day: which class (its code) or which email (the
 * account's id, never the address).
 * @param {Env} env
 * @param {{ pool: string, usd: number, scope: string, name: string }} part
 */
async function partSpent(env, part) {
  if ((await daySpendUsd(env, part.pool)) < part.usd) return false;
  const day = dayOf();
  await queueNotices(env, [ownerNotice(part.pool, `owner:open_part_paused:${day}`, { day, budgetUsd: part.usd, scope: part.scope, [part.scope]: part.name })]);
  return true;
}

/**
 * Why a take() with a hold failed: a counter's own error, or, when a hold is what was refused, its pool's (or its
 * part's) day spent (503 free_paused and the owner's notice) or, while it is not, other requests holding the rest of
 * it right now (429 busy, Retry-After 30: they give it back within a minute).
 * @param {Env} env
 * @param {{ error?: HttpError, key: Key }} r
 * @param {Key} hold
 * @param {Array<{ pool: string, usd: number, scope: string, name: string }>} [parts]
 */
async function heldBack(env, r, hold, parts = []) {
  const part = parts.find((x) => r.key.who === `usd:${x.pool}`);
  if (r.key !== hold && !part) return r.error;
  const budgets = limits(env).budgets;
  if (part ? await partSpent(env, part)
    : await poolSpent(env, String(hold.spend), hold.spend === 'open' ? budgets.openDailyUsd : budgets.freeDailyUsd)) return pausedErr();
  return new HttpError(429, 'busy', undefined, undefined, { 'Retry-After': '30' });
}

// ---------------------------------------------------------------- resolve: decide and count one AI request
/**
 * Decide the tier for one AI request and count it. Returns
 * { tier, pool, group, shape, params, input, refund (keys to give back on failure), left, limit, economy, linkedBad }.
 * Throws the refusal as an HttpError (with X-AI-Linked: 0 when a family-device token was sent but is no longer valid).
 * The same as precheck() then counted(): the small text kinds read their body first (distress is checked before any
 * refusal), so both halves run here together.
 * @param {Request} req
 * @param {Env} env
 * @param {string} kind
 * @param {unknown} input
 */
export async function resolve(req, env, kind, input) {
  return counted(await precheck(req, env, kind), env, kind, input);
}

/**
 * The half of resolve() that needs no body (COUNCIL2-17): who is asking (an invalid teacher credential is 401 here),
 * the class's AI rule, the parent's OK, and whether any tier could serve this kind at all (paid_only, solo_ai_off, a
 * paused pool, fair use). Nothing is counted. handleAI runs it before reading the body of a photo kind (check, exam), so
 * a caller who would be refused is refused before megabytes are read. → { id, plan } for counted().
 * @param {Request} req
 * @param {Env} env
 * @param {string} kind
 * @returns {Promise<{ id: Identity, plan: Plan }>}
 */
export async function precheck(req, env, kind) {
  const id = await identify(req, env);
  try {
    return { id, plan: await planFor(req, env, kind, id) };
  } catch (e) {
    throw linkedHeader(e, id);
  }
}

/**
 * The counted half: the request built from the body, then the counters taken (util.js take()). → resolve()'s result.
 * @param {{ id: Identity, plan: Plan }} pre
 * @param {Env} env
 * @param {string} kind
 * @param {unknown} input
 */
export async function counted(pre, env, kind, input) {
  const { id, plan } = pre;
  try {
    // input: what the request was built from (a teacher's text masked), for a kind that sends more than one request
    const sent = id.teacher ? maskFields(input) : input;
    return { ...(await takePlan(env, kind, sent, plan)), input: sent, linkedBad: id.famBad, linked: id.fam };
  } catch (e) {
    throw linkedHeader(e, id);
  }
}

/** @type {(e: unknown, id: Identity) => unknown} */
const linkedHeader = (e, id) => {
  if (e instanceof HttpError && id.famBad) e.headers = { ...(e.headers || {}), 'X-AI-Linked': '0' };
  return e;
};

/**
 * Every refusal that needs no body, in the order the rules apply; the plan of what counted() will take.
 * @param {Request} req
 * @param {Env} env
 * @param {string} kind
 * @param {Identity} id
 * @returns {Promise<Plan>}
 */
async function planFor(req, env, kind, id) {
  const code = id.student?.class_code;
  if (classGate(env, id) === 'off') {
    // counted with no person and no text (trust spec TRUST-4 §4.4), at most EVENTS_PER_NET a day from one network, and
    // on the class's refusal counter; the child sees a calm sheet, never a price
    await recordSafety(env, { kind: 'class_ai_off', surface: kind, source: 'server' }, null, { net: eventNet(req, env) });
    await noteClassOff(env, String(code));
    throw new HttpError(403, 'class_ai_off');
  }
  if (needsParentOk(env, id)) {
    // counted the same way (the owner's summary shows how many networks had a child waiting for a parent); the child
    // sees a calm sheet that sends them to the screen for their parents (a teacher: to sign in with an email), never a price
    await recordSafety(env, { kind: 'parent_ok_needed', surface: kind, source: 'server' }, null, { net: eventNet(req, env) });
    throw new HttpError(403, 'parent_ok_needed');
  }
  // a teacher of a school class before the Ministry's approval prepares materials only (teacherAi 'prep'): no check or
  // exam of students' work, and no feedback on it (Trust skeptic add-on: the rule was returned and enforced nowhere)
  if (id.teacher && !TEACHER_PREP_KINDS.includes(kind) && (await teacherAiRule(env, id.teacher)) === 'prep') {
    throw new HttpError(403, 'prep_only', undefined, { kinds: TEACHER_PREP_KINDS });
  }
  if (!paywallOn(env)) {
    const keys = await openKeys(req, env, id, kind, { strict: true });
    // the open tier's day in dollars (COUNCIL2-19): the same calm answer and owner notice as the free taste's; then
    // the caller's own parts of it (the class, the email): one that is spent pauses only its own callers
    if (await poolSpent(env, 'open', limits(env).budgets.openDailyUsd)) throw pausedErr();
    const parts = await openParts(env, id);
    // every part that is spent is told to the owner (a class and its email often reach their day together)
    let spent = false;
    for (const part of parts) if (await partSpent(env, part)) spent = true;
    if (spent) throw pausedErr();
    return { mode: 'open', keys: keys || [], parts };
  }

  const buckets = await paidBuckets(env, id);
  if (buckets.length) {
    // what each bucket can say without a body: the kind is not in it, its pool is paused, or it is in economy mode and
    // the kind is not one economy answers
    /** @type {HttpError[]} */ const fails = []; /** @type {Bucket[]} */ const usable = [];
    for (const b of buckets) {
      if (!b.kinds.includes(kind)) fails.push(paidOnlyErr(kind));
      else if (b.paused) fails.push(pausedErr());
      else if (b.economy && !FREE_KINDS.includes(kind)) fails.push(fairUseErr());
      else usable.push(b);
    }
    if (!usable.length) throw best(fails);
    return { mode: 'paid', buckets: usable, fails };
  }

  // ---- the free taste
  if (!FREE_KINDS.includes(kind)) throw paidOnlyErr(kind);
  // a teacher of a class with no adult behind it is alone here too (TRUST-9): no tutor when solo is off
  if (alone(env, id) && soloOff(env)) throw new HttpError(403, 'solo_ai_off');
  if (await poolSpent(env, 'free', limits(env).budgets.freeDailyUsd)) throw pausedErr();
  return { mode: 'free', keys: (await freeKeys(req, env, id)).keys };
}

/**
 * Build the request from the body, then take the plan's counters, all or nothing. The open and free pools also take
 * the request's dollar hold (result.hold, given back by index.js handleAI once the reply is priced).
 * @param {Env} env
 * @param {string} kind
 * @param {unknown} input
 * @param {Plan} plan
 */
async function takePlan(env, kind, input, plan) {
  const g = GROUP_OF[kind];
  if (plan.mode === 'open') {
    const p = params(env, kind, input, 'full');
    const hold = holdKey(env, 'open', kind, p);
    const holds = [hold, ...plan.parts.map((part) => partHold(env, part, hold.n))];
    const r = await take(env, [...plan.keys, ...holds]);
    if (!r.ok) throw await heldBack(env, r, hold, plan.parts);
    // what the screen counts down: the fewest actions left of the person's own key and the email's (class units are
    // the class's, told by status as shared: 'class')
    const own = plan.keys.map((k, i) => (k.units ? Infinity : k.limit - r.counts[i]));
    const k = plan.keys[0];
    return {
      tier: 'open', pool: 'open', subs: plan.parts.map((part) => part.pool), group: 'all', shape: 'full', params: p,
      refund: plan.keys.filter((x) => x.refundable), hold: holds,
      left: Math.min(...own), limit: k.limit, economy: false,
    };
  }
  if (plan.mode === 'paid') {
    const fails = [...plan.fails];
    for (const b of plan.buckets) {
      const shape = b.economy ? 'economy' : 'full';
      const p = params(env, kind, input, shape);
      const keys = b.keysFor(kind);
      const r = await take(env, keys);
      if (r.ok) {
        return {
          tier: b.tier, pool: b.pool, group: b.flat ? 'all' : g, shape, params: p, refund: keys.filter((k) => k.refundable),
          left: keys[0].limit - r.counts[0], limit: keys[0].limit, economy: shape === 'economy',
        };
      }
      if (r.error) fails.push(r.error);
    }
    throw best(fails);
  }
  const { keys } = plan;
  const p = params(env, kind, input, 'lite');
  // the free taste's $5 day is held the same way (COUNCIL2-19): parallel questions pass it by one worst case at most
  const hold = holdKey(env, 'free', kind, p);
  const r = await take(env, [keys.person, keys.tries, keys.net, keys.cls, keys.all, hold]);
  if (!r.ok) throw await heldBack(env, r, hold);
  return {
    tier: 'free', pool: 'free', group: 'tutor', shape: 'lite', params: p, refund: [keys.person], hold: [hold], left: keys.person.limit - r.counts[0],
    limit: keys.person.limit, economy: false,
  };
}

// ---------------------------------------------------------------- care: a message that reads as distress
/** The answer when no AI reply is possible or allowed: the fixed care text (CARE_STATIC), no Claude call. */
/** @param {Identity | null} id */
const careStatic = (id) => ({ static: true, tier: 'care', pool: 'care', group: 'care', refund: [], linkedBad: !!id?.famBad });

/**
 * A chat message that reads as distress (trust spec TRUST-3 §3.4). Never counted against a question, never refused and
 * never paywalled: it takes its own keys, care:<who> (5 a day; who is s:<student>, fd:<family device>, t:<class>,
 * d:<device key> or x:<network>), care:n:<network> (30) and care:all (1,000), and builds a care-only request with no
 * maths in it. When any key is full, the server has no AI key, or anything about the caller cannot be read, it returns
 * { static: true }: the fixed reply, with no AI call. It never throws.
 * A class whose tutor is off for this student (TRUST-11), and a child alone whose parent has not approved the tutor
 * (TRUST-9), lead to { static: true } too: what such a child writes is not sent to the AI company at all.
 * @param {Request} req
 * @param {Env} env
 * @param {string} kind
 * @param {unknown} input
 */
export async function resolveCare(req, env, kind, input) {
  /** @type {Identity | null} */
  let id = null;
  try {
    const who0 = await identify(req, env);
    id = who0;
    // a class whose tutor is off for this student: the fixed reply, with no AI call (TRUST-11 §4); on a device a parent
    // linked, the care path is the family's, as any other request there
    if (classGate(env, who0) === 'off') return careStatic(id);
    // no parent's OK (TRUST-9): distress text is health data, and it does not go to a US AI company for a child whose
    // parent has not agreed to the tutor; the card and the fixed reply are there at once
    if (needsParentOk(env, who0)) return careStatic(id);
    if (!env.ANTHROPIC_API_KEY) return careStatic(id);
    const L = limits(env).care;
    const net = await netKey(req, env);
    const who = who0.student ? `s:${who0.student.id}`
      : who0.fam ? `fd:${who0.fam.device_id}`
        : who0.teacher ? `t:${who0.teacher.code}`
          : who0.device ? `d:${await devKey(env, who0.device)}`
            : `x:${net}`;
    const p = buildCare(/** @type {any} */ (input), /** @type {any} */ ({ model: env.CLAUDE_MODEL }));
    const r = await take(env, [key(`care:${who}`, L.person), key(`care:n:${net}`, L.net), key('care:all', L.global)]);
    if (!r.ok) return careStatic(id);
    return {
      tier: 'care', pool: 'care', group: 'care', shape: 'care', params: p, refund: [],
      left: L.person - r.counts[0], limit: L.person, economy: false, linkedBad: who0.famBad, linked: who0.fam,
    };
  } catch (e) {
    // a caller that cannot be read (a wrong teacher key, no hashing secret) still gets the fixed reply; nothing from the
    // request goes to the log
    if (!(e instanceof HttpError)) console.error('care: fixed reply after an error');
    return careStatic(id);
  }
}

// ---------------------------------------------------------------- status: the same decision, counting nothing
/** @type {(k: Key, count: number) => number} */
const left = (k, count) => Math.max(0, k.limit - count);

/**
 * What this device may ask today (GET /api/ai/status). Never an email, a plan or a price. A linked family device also
 * learns the state of its daily summary for the parents (linked.summary, report.js summaryState): with the paywall off
 * it is 'off', and linked is still there so Settings can show the device as linked.
 * @param {Request} req
 * @param {Env} env
 */
export async function aiStatus(req, env) {
  const id = await identify(req, env);
  const r = await statusFor(req, env, id);
  // a teacher whose class's rule is 'prep' (a school class before the approval): only the kinds that prepare materials,
  // so the screens do not offer a check they would refuse (prep_only)
  if (!id.teacher || !r.body.kinds?.length || (await teacherAiRule(env, id.teacher)) !== 'prep') return r;
  const kinds = r.body.kinds.filter((/** @type {string} */ k) => TEACHER_PREP_KINDS.includes(k));
  const groups = Object.fromEntries(Object.entries(r.body.groups || {})
    .map(([g, v]) => [g, AI_GROUPS.includes(g) && !kinds.some((/** @type {string} */ k) => GROUP_OF[k] === g) ? null : v]));
  return { ...r, body: { ...r.body, kinds, groups, prepOnly: true } };
}
/**
 * @param {Request} req
 * @param {Env} env
 * @param {Identity} id
 * @returns {Promise<{ headers: Record<string, string>, body: Record<string, any> }>}
 */
async function statusFor(req, env, id) {
  const aiReady = !!env.ANTHROPIC_API_KEY;
  /** @type {Record<string, string>} */
  const headers = id.famBad ? { 'X-AI-Linked': '0' } : {};
  // the class's tutor is off for this student (TRUST-11 §4): the same answer an AI request gets, so the screens show the
  // calm state before anything is asked
  if (classGate(env, id) === 'off') throw new HttpError(403, 'class_ai_off', undefined, undefined, headers);
  // a child alone with no parent's OK (TRUST-9): no tool and no count, only the state, so the screens show the calm
  // card before anything is asked (nothing is logged here: a screen that loads is not a request)
  if (needsParentOk(env, id)) {
    return { headers, body: { paywall: paywallOn(env), tier: null, state: 'parent_ok_needed', kinds: [], groups: {}, resetsAt: resetsAt('day'), aiReady } };
  }
  if (!paywallOn(env)) {
    const keys = await openKeys(req, env, id);
    const counts = keys ? await peek(env, keys) : [];
    // left: the fewest of the person's own and the email's (COUNCIL2-19); shared: the open pool's day is spent
    // ('paused'), or this student's class has no units left today ('class')
    const own = keys ? Math.min(...keys.map((k, i) => (k.units ? Infinity : left(k, counts[i])))) : 0;
    // paused: the pool's day, or this caller's own part of it (the class's, the email's)
    let paused = !!keys && (await daySpendUsd(env, 'open')) >= limits(env).budgets.openDailyUsd;
    if (keys && !paused) for (const part of await openParts(env, id)) if ((await daySpendUsd(env, part.pool)) >= part.usd) paused = true;
    const classFull = keys && keys.some((k, i) => k.units && counts[i] >= k.limit);
    const shared = paused ? 'paused' : classFull ? 'class' : null;
    return {
      headers,
      // resetsAt: when today's count starts again, so a screen that stays open asks again after midnight
      body: {
        paywall: false, tier: 'open', kinds: keys ? AI_KINDS : [], groups: { all: keys ? { left: own, limit: keys[0].limit } : null }, resetsAt: resetsAt('day'), aiReady,
        ...(shared ? { shared } : {}),
        ...(id.fam ? { linked: { label: id.fam.label || '', summary: 'off' } } : {}),
      },
    };
  }
  const L = limits(env);
  /** @type {Record<string, any>} */
  const out = {
    paywall: true, tier: 'free', kinds: [], groups: Object.fromEntries(AI_GROUPS.map((g) => [g, null])),
    economy: false, shared: null, resetsAt: resetsAt('day'),
    linked: id.fam ? { label: id.fam.label || '', summary: await summaryState(env, id.fam) } : null, legacyUntil: null, aiReady,
  };
  const buckets = await paidBuckets(env, id);
  if (buckets.length) {
    out.tier = buckets[0].tier;
    if (buckets.some((b) => b.tier === 'legacy')) out.legacyUntil = env.LEGACY_CLASS_AI_UNTIL;
    for (const b of buckets) {
      if (b.economy) out.economy = true;
      if (b.paused) { out.shared = 'paused'; continue; }
      for (const g of AI_GROUPS) {
        const kind = AI_KINDS.find((k) => GROUP_OF[k] === g && b.kinds.includes(k));
        if (!kind || (b.economy && !FREE_KINDS.includes(kind))) continue;
        const keys = b.keysFor(kind);
        const counts = await peek(env, keys);
        const groupLeft = left(keys[0], counts[0]);
        const prev = out.groups[g];
        if (prev && prev.left > 0) continue; // an earlier bucket still serves this group
        /** @type {{ left: number, limit: number, monthLeft?: number }} */
        const view = { left: groupLeft, limit: keys[0].limit };
        const monthly = keys.find((k) => k.period === 'month');
        if (monthly) view.monthLeft = left(monthly, counts[keys.indexOf(monthly)]);
        out.groups[g] = view;
        if (!out.kinds.includes(kind)) for (const k of AI_KINDS) if (GROUP_OF[k] === g && b.kinds.includes(k)) out.kinds.push(k);
      }
    }
    out.kinds = AI_KINDS.filter((/** @type {string} */ k) => out.kinds.includes(k));
    return { headers, body: out };
  }
  if (alone(env, id) && soloOff(env)) return { headers, body: out };
  const { keys } = await freeKeys(req, env, id);
  const [person, , net, cls, all] = await peek(env, [keys.person, keys.tries, keys.net, keys.cls, keys.all].map((k) => k || key('-', 0)));
  out.kinds = [...FREE_KINDS];
  out.groups.tutor = { left: left(keys.person, person), limit: keys.person.limit };
  const paused = (await daySpendUsd(env, 'free')) >= L.budgets.freeDailyUsd || all >= keys.all.limit;
  out.shared = paused ? 'paused' : keys.cls && cls >= keys.cls.limit ? 'class' : keys.net && net >= keys.net.limit ? 'network' : null;
  return { headers, body: out };
}
