// Who may ask the AI tutor what, today, decided on the server for every POST /api/ai/:kind (and reported, without
// counting, by GET /api/ai/status).
//
// AI_PAYWALL = "off" (the default) keeps the limits from before the paid tutor: a class student AI_DAILY_LIMIT actions
// a day of any kind, a teacher TEACHER_DAILY_LIMIT, a student without a class SOLO_DAILY_LIMIT per network, all on
// CLAUDE_MODEL. AI_PAYWALL = "on" turns on the tiers below. A paid caller never falls to the free taste.
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
// teacher, no device a parent linked) gets 403 parent_ok_needed, before the free taste and before the switch-off path.
// A parent approves a device once, for free, from the parents' page (family.js, purpose 'consent'): the approval is a
// signed-in adult email, an audit row and an email with the AI and privacy summary. "off" is the one-variable rollback.
import { AI_KINDS, AI_GROUPS, KIND_GROUP, AI_UNITS, FREE_KINDS, LITE_MODEL, buildRequest, buildCare } from '../../shared/ai.js';
import {
  HttpError, key, take, peek, sha256, hmacHex, netKey, devKey, nowIso, addDays, dayOf, resetsAt, endOfDayIso, startOfDayIso, isDay, safeEqual,
} from './util.js';
import { daySpendUsd, monthSpendUsd, queueNotices, ownerNotice } from './spend.js';
import { classAiPolicy, studentAiAllowed, rulesEnv } from '../../shared/schoolRules.js';
import { maskPersonal } from '../../shared/safety.js';
import { recordSafety } from './safety.js';
import { accountFrom } from './account.js';

// ---------------------------------------------------------------- limits
export const DEFAULT_LIMITS = {
  open: { student: 40, teacher: 200, solo: 20 },
  free: { student: 2, teacher: 5, net: 80, class: 80, global: 3000 },
  family: { tutor: 30, check: 6, generate: 5, exam: 2, examMonthly: 10, devices: 3 },
  class: { student: { tutor: 20, check: 3, generate: 3, exam: 1 }, teacher: { tutor: 100, check: 20, generate: 30, exam: 20 }, seatUnits: 25 },
  trial: { student: { tutor: 10, check: 2, generate: 0, exam: 0 }, teacher: { tutor: 50, check: 10, generate: 0, exam: 0 }, seatUnits: 10, maxSeats: 40, days: 14 },
  legacy: { student: 40, teacher: 200, classUnits: 600 },
  budgets: { freeDailyUsd: 5, trialDailyUsd: 10, familyMonthlyUsd: 4, classSeatMonthlyUsd: 0.8, ownerAlertUsd: 20 },
  // care replies (trust spec TRUST-3 §3.4): a day, per person, per network and for everyone; past them the fixed reply
  care: { person: 5, net: 30, global: 1000 },
  graceDays: 3,
};
// Owner overrides through plain vars; AI_LIMITS (JSON) is deep-merged last for everything else.
const VARS = [
  ['AI_DAILY_LIMIT', ['open', 'student'], ['legacy', 'student']],
  ['TEACHER_DAILY_LIMIT', ['open', 'teacher'], ['legacy', 'teacher']],
  ['SOLO_DAILY_LIMIT', ['open', 'solo']],
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
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function merge(into, from) {
  for (const [k, v] of Object.entries(from || {})) {
    if (isObj(v) && isObj(into[k])) merge(into[k], v);
    else if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && typeof into[k] === 'number') into[k] = v;
  }
  return into;
}
const setPath = (o, p, v) => { let t = o; for (const k of p.slice(0, -1)) t = t[k]; t[p.at(-1)] = v; };
/** The limits in force: the defaults, the owner's vars, then AI_LIMITS. */
export function limits(env) {
  const L = structuredClone(DEFAULT_LIMITS);
  for (const [name, ...paths] of VARS) {
    const raw = env[name];
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
export const paywallOn = (env) => String(env.AI_PAYWALL || 'off') === 'on';
const soloOff = (env) => String(env.ALLOW_SOLO_AI) === 'false';
/** Does a child alone need a parent's OK before the tutor (TRUST-9)? Anything but "off" means yes. */
export const parentOkRequired = (env) => String(env.AI_PARENT_OK ?? 'required').trim() !== 'off';
/**
 * A caller who would reach the tutor on their own, with no adult behind them: no class student (their class's rule
 * covers them), no teacher (an adult), and no device a parent linked (a plan or a free OK). With ALLOW_SOLO_AI "false"
 * such a caller has no tutor at all (solo_ai_off), and a parent's OK would not change that, so it is not asked for.
 */
const needsParentOk = (env, id) => parentOkRequired(env) && !id.student && !id.teacher && !id.fam && !soloOff(env);

// ---------------------------------------------------------------- who is asking
export async function studentFrom(req, env) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || token.length > 128) return null;
  // the class's AI rule rides along (trust spec TRUST-11 §4): no class_settings row is a school class with student AI
  // off, and a student_ai_off row is the teacher's switch for this one student
  const row = await env.DB.prepare(
    `SELECT s.id, s.name, s.class_code, c.grade, c.created_at AS class_created_at,
       COALESCE(cs.setting, 'school') AS setting, COALESCE(cs.student_ai, 'off') AS student_ai, cs.ai_consent_at, so.student_id IS NOT NULL AS ai_off
     FROM students s JOIN classes c ON c.code = s.class_code
     LEFT JOIN class_settings cs ON cs.code = s.class_code LEFT JOIN student_ai_off so ON so.student_id = s.id
     WHERE s.token_hash = ?`,
  ).bind(await sha256(token)).first();
  return row || null;
}

/** May this class student reach the tutor? The Ministry's rule for their class (shared/schoolRules.js), then their own switch. */
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
 */
function classGate(env, id) {
  if (!id.student || studentAiOn(env, id.student)) return 'on';
  if (id.fam) { id.student = null; return 'home'; }
  return 'off';
}

// Free text a teacher sends the tutor is masked like a child's (TRUST-11 §7, the Ministry's §5.1: nothing identifying
// goes into an AI tool). Every string of the request is masked except the pictures themselves.
const PICTURE = new Set(['image', 'data', 'mediaType']);
function maskFields(v, name = '') {
  if (typeof v === 'string') return PICTURE.has(name) ? v : maskPersonal(v).text;
  if (Array.isArray(v)) return v.map((x) => maskFields(x));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, maskFields(x, k)]));
  return v;
}
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
    if (owns) return { ...cls, via: 'account', accountId: a.id };
  }
  throw new HttpError(401, 'not_teacher');
}

/** A child's device linked to a family plan (X-Family-Device: fd1.<64 hex>), or null. */
export async function familyDeviceFrom(env, token) {
  if (!/^fd1\.[a-f0-9]{64}$/.test(String(token || ''))) return null;
  const row = await env.DB.prepare('SELECT id, account_id, label, last_seen FROM family_devices WHERE token_hash = ?').bind(await sha256(token)).first();
  if (!row) return null;
  const today = dayOf();
  if (row.last_seen !== today) await env.DB.prepare('UPDATE family_devices SET last_seen = ? WHERE id = ?').bind(today, row.id).run();
  return { device_id: row.id, account_id: row.account_id, label: row.label };
}

/** The install's own id (X-Device). With FREE_DEVICE_MINT = "turnstile" only the signed form minted by POST /api/devices counts. */
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
 */
export async function identify(req, env) {
  const id = { student: null, teacher: null, fam: null, famBad: false, device: null };
  id.student = await studentFrom(req, env);
  const asTeacher = req.headers.get('X-Teacher-Key') || (req.headers.get('X-Class-Code') && req.headers.get('X-Account-Token'));
  if (!id.student && asTeacher) id.teacher = await requireTeacher(req, env);
  const fd = req.headers.get('X-Family-Device');
  if (fd) { id.fam = await familyDeviceFrom(env, fd); id.famBad = !id.fam; }
  id.device = await deviceFrom(req, env);
  return id;
}

// ---------------------------------------------------------------- live plans
const liveSql = (env, field) => `SELECT * FROM subscriptions WHERE kind = ? AND ${field} = ? AND (
  (status IN ('active', 'canceled') AND current_period_end > ?) OR (status = 'past_due' AND current_period_end > ?))
  ORDER BY current_period_end DESC LIMIT 1`;
async function live(env, kind, field, value) {
  if (!value) return null;
  const now = nowIso();
  const grace = addDays(now, -limits(env).graceDays);
  return env.DB.prepare(liveSql(env, field)).bind(kind, value, now, grace).first();
}
/** A class licence (or trial) that is in force: active or canceled until its end, past_due for the grace days after. */
export const liveLicence = (env, classCode) => live(env, 'class', 'class_code', String(classCode || '').toUpperCase());
/** A family plan that is in force, by the same rule. */
export const liveFamily = (env, accountId) => live(env, 'family', 'account_id', accountId);

/** Is a class still in the legacy window (made before BILLING_START, before LEGACY_CLASS_AI_UNTIL ends)? */
export function legacyWindow(env, classCreatedAt) {
  if (!isDay(env.BILLING_START) || !isDay(env.LEGACY_CLASS_AI_UNTIL) || !classCreatedAt) return false;
  return String(classCreatedAt) < startOfDayIso(env.BILLING_START) && nowIso() < endOfDayIso(env.LEGACY_CLASS_AI_UNTIL);
}

// ---------------------------------------------------------------- errors
const dailyErr = (tier, group, limit, period = 'day') => new HttpError(429, 'daily_limit', undefined, { tier, group, limit, left: 0, resetsAt: resetsAt(period) });
const sharedErr = (scope) => new HttpError(429, 'shared_limit', undefined, { scope, resetsAt: resetsAt('day') });
const pausedErr = () => new HttpError(503, 'free_paused', undefined, { resetsAt: resetsAt('day') });
const fairUseErr = () => new HttpError(429, 'monthly_fair_use', undefined, { resetsAt: resetsAt('month') });
const paidOnlyErr = (kind) => new HttpError(402, 'paid_only', undefined, { kind });
const RANK = { daily_limit: 5, shared_limit: 4, monthly_fair_use: 3, free_paused: 2, paid_only: 1 };
/** The most useful of several refusals: daily_limit > shared_limit > monthly_fair_use > free_paused > paid_only. */
export const best = (fails) => fails.reduce((a, b) => ((RANK[b.code] || 0) > (RANK[a.code] || 0) ? b : a));

function params(env, kind, input, shape) {
  const model = shape === 'full' ? env.CLAUDE_MODEL : (env.FREE_MODEL || LITE_MODEL);
  try { return buildRequest(kind, input, { model, shape }); } catch (e) { throw new HttpError(400, 'bad_input', e.message); }
}

// ---------------------------------------------------------------- the paid buckets of a caller
/** The paid buckets that apply to this caller, class (or legacy) first, then family. Nothing is counted here. */
async function paidBuckets(env, id) {
  const L = limits(env);
  const cls = id.student?.class_code ?? id.teacher?.code ?? null;
  const createdAt = id.student?.class_created_at ?? id.teacher?.created_at ?? null;
  const out = [];
  const lic = cls ? await liveLicence(env, cls) : null;
  if (lic) {
    const trial = lic.plan === 'trial';
    const T = trial ? L.trial : L.class;
    const lim = id.student ? T.student : T.teacher;
    const subj = id.student ? `s:${id.student.id}` : `t:${cls}`;
    const tier = trial ? 'trial' : id.student ? 'class' : 'teacher';
    out.push({
      tier, pool: trial ? 'trial' : `cls:${cls}`, subj, lim,
      kinds: AI_KINDS.filter((k) => lim[KIND_GROUP[k]] > 0),
      keysFor: (kind) => {
        const g = KIND_GROUP[kind];
        return [
          key(`${subj}:${g}`, lim[g], { refundable: true, err: dailyErr(tier, g, lim[g]) }),
          key(`${subj}:${g}:tries`, 3 * lim[g], { err: dailyErr(tier, g, lim[g]) }),
          key(`cls:${cls}`, (lic.seats || 0) * T.seatUnits, { n: AI_UNITS[kind], err: sharedErr('class') }),
        ];
      },
      economyAt: trial ? null : (lic.seats || 0) * L.budgets.classSeatMonthlyUsd,
      paused: trial ? (await daySpendUsd(env, 'trial')) >= L.budgets.trialDailyUsd : false,
    });
  } else if (cls && legacyWindow(env, createdAt)) {
    const subj = id.student ? `s:${id.student.id}` : `t:${cls}`;
    const limit = id.student ? L.legacy.student : L.legacy.teacher;
    out.push({
      tier: 'legacy', pool: 'legacy', subj, kinds: AI_KINDS, flat: limit,
      keysFor: (kind) => [
        key(subj, limit, { refundable: true, err: dailyErr('legacy', 'all', limit) }),
        key(`cls:${cls}`, L.legacy.classUnits, { n: AI_UNITS[kind], err: sharedErr('class') }),
      ],
      economyAt: null, paused: false,
    });
  }
  const sub = id.fam ? await liveFamily(env, id.fam.account_id) : null;
  if (sub) {
    const a = id.fam.account_id;
    const F = L.family;
    out.push({
      tier: 'family', pool: `fam:${a}`, subj: `fam:${a}`, lim: F, kinds: AI_KINDS.filter((k) => F[KIND_GROUP[k]] > 0),
      keysFor: (kind) => {
        const g = KIND_GROUP[kind];
        return [
          key(`fam:${a}:${g}`, F[g], { refundable: true, err: dailyErr('family', g, F[g]) }),
          key(`fam:${a}:${g}:tries`, 3 * F[g], { err: dailyErr('family', g, F[g]) }),
          g === 'exam' && key(`fam:${a}:exam`, F.examMonthly, { period: 'month', refundable: true, err: dailyErr('family', 'exam', F.examMonthly, 'month') }),
        ].filter(Boolean);
      },
      economyAt: L.budgets.familyMonthlyUsd, paused: false,
    });
  }
  for (const b of out) b.economy = b.economyAt != null && (await monthSpendUsd(env, b.pool)) >= b.economyAt;
  return out;
}

/** The free taste's counters for this caller and kind. */
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
 * With the switch off (the behaviour before the paid tutor, and the one-variable rollback): a class student, a
 * teacher, a device of a family whose plan is still live (it keeps its own key, so a family that is still paying is
 * never counted as a stranger on its network, nor refused when ALLOW_SOLO_AI is "false"), else the network's solo key.
 * strict: refuse with 403 solo_ai_off instead of returning null.
 */
async function openKey(req, env, id, { strict = false } = {}) {
  const L = limits(env).open;
  if (id.student) return key(`s:${id.student.id}`, L.student, { refundable: true, err: dailyErr('open', 'all', L.student) });
  if (id.teacher) return key(`t:${id.teacher.code}`, L.teacher, { refundable: true, err: dailyErr('open', 'all', L.teacher) });
  if (id.fam && (await liveFamily(env, id.fam.account_id))) {
    return key(`fam:${id.fam.account_id}`, L.student, { refundable: true, err: dailyErr('open', 'all', L.student) });
  }
  if (soloOff(env)) { if (strict) throw new HttpError(403, 'solo_ai_off'); return null; }
  return key(`solo:n:${await netKey(req, env)}`, L.solo, { refundable: true, err: dailyErr('open', 'all', L.solo) });
}

// ---------------------------------------------------------------- resolve: decide and count one AI request
/**
 * Decide the tier for one AI request and count it. Returns
 * { tier, pool, group, shape, params, refund (keys to give back on failure), left, limit, economy, linkedBad }.
 * Throws the refusal as an HttpError (with X-AI-Linked: 0 when a family-device token was sent but is no longer valid).
 */
export async function resolve(req, env, kind, input) {
  const id = await identify(req, env);
  try {
    return { ...(await decide(req, env, kind, id.teacher ? maskFields(input) : input, id)), linkedBad: id.famBad, linked: id.fam };
  } catch (e) {
    if (e instanceof HttpError && id.famBad) e.headers = { ...(e.headers || {}), 'X-AI-Linked': '0' };
    throw e;
  }
}

async function decide(req, env, kind, input, id) {
  const g = KIND_GROUP[kind];
  if (classGate(env, id) === 'off') {
    // counted with no person and no text (trust spec TRUST-4 §4.4); the child sees a calm sheet, never a price
    await recordSafety(env, { kind: 'class_ai_off', surface: kind, source: 'server' });
    throw new HttpError(403, 'class_ai_off');
  }
  if (needsParentOk(env, id)) {
    // counted the same way (the owner's summary shows how many children wait for a parent); the child sees a calm
    // sheet that sends them to the screen for their parents, never a price
    await recordSafety(env, { kind: 'parent_ok_needed', surface: kind, source: 'server' });
    throw new HttpError(403, 'parent_ok_needed');
  }
  if (!paywallOn(env)) {
    const k = await openKey(req, env, id, { strict: true });
    const p = params(env, kind, input, 'full');
    const r = await take(env, [k]);
    if (!r.ok) throw r.error;
    return { tier: 'open', pool: 'open', group: 'all', shape: 'full', params: p, refund: [k], left: k.limit - r.counts[0], limit: k.limit, economy: false };
  }

  const buckets = await paidBuckets(env, id);
  if (buckets.length) {
    const fails = [];
    for (const b of buckets) {
      if (!b.kinds.includes(kind)) { fails.push(paidOnlyErr(kind)); continue; }
      if (b.paused) { fails.push(pausedErr()); continue; }
      let shape = 'full';
      if (b.economy) {
        if (!FREE_KINDS.includes(kind)) { fails.push(fairUseErr()); continue; }
        shape = 'economy';
      }
      const p = params(env, kind, input, shape);
      const keys = b.keysFor(kind);
      const r = await take(env, keys);
      if (r.ok) {
        return {
          tier: b.tier, pool: b.pool, group: b.flat ? 'all' : g, shape, params: p, refund: keys.filter((k) => k.refundable),
          left: keys[0].limit - r.counts[0], limit: keys[0].limit, economy: shape === 'economy',
        };
      }
      fails.push(r.error);
    }
    throw best(fails);
  }

  // ---- the free taste
  if (!FREE_KINDS.includes(kind)) throw paidOnlyErr(kind);
  const anon = !id.student && !id.teacher && !id.fam;
  if (anon && soloOff(env)) throw new HttpError(403, 'solo_ai_off');
  if ((await daySpendUsd(env, 'free')) >= limits(env).budgets.freeDailyUsd) {
    const day = dayOf();
    await queueNotices(env, [ownerNotice(day, `owner:free_paused:${day}`, { day })]);
    throw pausedErr();
  }
  const { keys } = await freeKeys(req, env, id);
  const p = params(env, kind, input, 'lite');
  const list = [keys.person, keys.tries, keys.net, keys.cls, keys.all];
  const r = await take(env, list);
  if (!r.ok) throw r.error;
  return { tier: 'free', pool: 'free', group: 'tutor', shape: 'lite', params: p, refund: [keys.person], left: keys.person.limit - r.counts[0], limit: keys.person.limit, economy: false };
}

// ---------------------------------------------------------------- care: a message that reads as distress
/** The answer when no AI reply is possible or allowed: the fixed care text (CARE_STATIC), no Claude call. */
const careStatic = (id) => ({ static: true, tier: 'care', pool: 'care', group: 'care', refund: [], linkedBad: !!id?.famBad });

/**
 * A chat message that reads as distress (trust spec TRUST-3 §3.4). Never counted against a question, never refused and
 * never paywalled: it takes its own keys, care:<who> (5 a day; who is s:<student>, fd:<family device>, t:<class>,
 * d:<device key> or x:<network>), care:n:<network> (30) and care:all (1,000), and builds a care-only request with no
 * maths in it. When any key is full, the server has no AI key, or anything about the caller cannot be read, it returns
 * { static: true }: the fixed reply, with no AI call. It never throws.
 * A class whose tutor is off for this student (TRUST-11), and a child alone whose parent has not approved the tutor
 * (TRUST-9), lead to { static: true } too: what such a child writes is not sent to the AI company at all.
 */
export async function resolveCare(req, env, kind, input) {
  let id = null;
  try {
    id = await identify(req, env);
    // a class whose tutor is off for this student: the fixed reply, with no AI call (TRUST-11 §4); on a device a parent
    // linked, the care path is the family's, as any other request there
    if (classGate(env, id) === 'off') return careStatic(id);
    // no parent's OK (TRUST-9): distress text is health data, and it does not go to a US AI company for a child whose
    // parent has not agreed to the tutor; the card and the fixed reply are there at once
    if (needsParentOk(env, id)) return careStatic(id);
    if (!env.ANTHROPIC_API_KEY) return careStatic(id);
    const L = limits(env).care;
    const net = await netKey(req, env);
    const who = id.student ? `s:${id.student.id}`
      : id.fam ? `fd:${id.fam.device_id}`
        : id.teacher ? `t:${id.teacher.code}`
          : id.device ? `d:${await devKey(env, id.device)}`
            : `x:${net}`;
    const p = buildCare(input, { model: env.CLAUDE_MODEL });
    const r = await take(env, [key(`care:${who}`, L.person), key(`care:n:${net}`, L.net), key('care:all', L.global)]);
    if (!r.ok) return careStatic(id);
    return {
      tier: 'care', pool: 'care', group: 'care', shape: 'care', params: p, refund: [],
      left: L.person - r.counts[0], limit: L.person, economy: false, linkedBad: id.famBad, linked: id.fam,
    };
  } catch (e) {
    // a caller that cannot be read (a wrong teacher key, no hashing secret) still gets the fixed reply; nothing from the
    // request goes to the log
    if (!(e instanceof HttpError)) console.error('care: fixed reply after an error');
    return careStatic(id);
  }
}

// ---------------------------------------------------------------- status: the same decision, counting nothing
const left = (k, count) => Math.max(0, k.limit - count);

/** What this device may ask today (GET /api/ai/status). Never an email, a plan or a price. */
export async function aiStatus(req, env) {
  const id = await identify(req, env);
  const aiReady = !!env.ANTHROPIC_API_KEY;
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
    const k = await openKey(req, env, id);
    const [c] = k ? await peek(env, [k]) : [0];
    return {
      headers,
      // resetsAt: when today's count starts again, so a screen that stays open asks again after midnight
      body: { paywall: false, tier: 'open', kinds: k ? AI_KINDS : [], groups: { all: k ? { left: left(k, c), limit: k.limit } : null }, resetsAt: resetsAt('day'), aiReady },
    };
  }
  const L = limits(env);
  const out = {
    paywall: true, tier: 'free', kinds: [], groups: Object.fromEntries(AI_GROUPS.map((g) => [g, null])),
    economy: false, shared: null, resetsAt: resetsAt('day'),
    linked: id.fam ? { label: id.fam.label || '' } : null, legacyUntil: null, aiReady,
  };
  const buckets = await paidBuckets(env, id);
  if (buckets.length) {
    out.tier = buckets[0].tier;
    if (buckets.some((b) => b.tier === 'legacy')) out.legacyUntil = env.LEGACY_CLASS_AI_UNTIL;
    for (const b of buckets) {
      if (b.economy) out.economy = true;
      if (b.paused) { out.shared = 'paused'; continue; }
      for (const g of AI_GROUPS) {
        const kind = AI_KINDS.find((k) => KIND_GROUP[k] === g && b.kinds.includes(k));
        if (!kind || (b.economy && !FREE_KINDS.includes(kind))) continue;
        const keys = b.keysFor(kind);
        const counts = await peek(env, keys);
        const groupLeft = left(keys[0], counts[0]);
        const prev = out.groups[g];
        if (prev && prev.left > 0) continue; // an earlier bucket still serves this group
        const view = { left: groupLeft, limit: keys[0].limit };
        const monthly = keys.find((k) => k.period === 'month');
        if (monthly) view.monthLeft = left(monthly, counts[keys.indexOf(monthly)]);
        out.groups[g] = view;
        if (!out.kinds.includes(kind)) for (const k of AI_KINDS) if (KIND_GROUP[k] === g && b.kinds.includes(k)) out.kinds.push(k);
      }
    }
    out.kinds = AI_KINDS.filter((k) => out.kinds.includes(k));
    return { headers, body: out };
  }
  const anon = !id.student && !id.teacher && !id.fam;
  if (anon && soloOff(env)) return { headers, body: out };
  const { keys } = await freeKeys(req, env, id);
  const [person, , net, cls, all] = await peek(env, [keys.person, keys.tries, keys.net, keys.cls, keys.all].map((k) => k || key('-', 0)));
  out.kinds = [...FREE_KINDS];
  out.groups.tutor = { left: left(keys.person, person), limit: keys.person.limit };
  const paused = (await daySpendUsd(env, 'free')) >= L.budgets.freeDailyUsd || all >= keys.all.limit;
  out.shared = paused ? 'paused' : keys.cls && cls >= keys.cls.limit ? 'class' : keys.net && net >= keys.net.limit ? 'network' : null;
  return { headers, body: out };
}
