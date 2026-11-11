// A fake Worker for the end-to-end tests (page.route: no Worker, no Claude, no email, no payment company): the paid
// tutor's endpoints, sign-in, checkout, the family link, the teacher's class, and a class student's progress. Moved
// from subscription.spec.js so every spec can use it (PARENTS-10): seed `ai.apiUrl` with API, then call fakeServer; its
// state and call log are returned. Since the move, POST /api/progress keeps the answers it is sent (st.answers) and
// acknowledges them, as the Worker does (DURABLE-7), and a device alone waits for a parent's OK (TRUST-9, `parentOk`).
// The teacher's account (TEACHER-1): GET /api/health, a new class bound to the email, the email's class list, binding a
// class and a new teacher key. The class K7Q2MD opens with its key, or with the session of the email it is bound to.
// The class settings (TEACHER-9): renaming a class, and deleting one (TRUST-7: the word DELETE, the owner's fresh code
// for a class bound to an email, 409 while a licence runs); a deleted class opens no more.
// Class work (TEACHER-4 and TEACHER-5): the teacher's assignments (list, create with a due date moved off Saturday, one
// with a row per student, a later date, delete), the dashboard's open assignments and the ids of the students behind
// each repeated mistake, and the student's side (GET /api/class/work with what they did, and their reports, merged so
// they never go backwards), with the class exam's frozen questions (the teacher sends one version; the student fetches
// its items). The class report (TEACHER-7): GET /api/teacher/report with its range rules, the students by name with set
// numbers (st.reportRows by id changes them), the assignments of the range and the mistakes, with no id anywhere.
// Help both ways (TEACHER-6): st.help holds the requests with their threads; the dashboard's rows, the teacher's reply
// (three at most, no contact details), ראיתי/טופל/לפתוח שוב, the owner's daily email switch (st.digest), and the
// student's side (GET /api/class/work's help, the student's answer only after the teacher's, /read).
// Each student's page (TEACHER-8): GET /api/teacher/students/:id (st.studentPages by id adds or replaces its parts:
// days14, levels, mistakes, work, help, exams), a PIN reset, and the board's rows with whose help it is, joinedOn and
// the late work count (a student in st.students may set lastPractice, week, late, joinedOn… for the attention list).
// Student AI by the Ministry's rules (TRUST-11): st.classAiOff makes a class student's AI calls and status 403
// class_ai_off, as the Worker answers both (st.staleStatus keeps the status as it was, as on a device that asked before
// the change).
// The teacher's side (TEACHER-9): st.ai is K7Q2MD's setting, switch and consent and the catalogue approval ({ setting,
// studentAi, consentAt, approval, fromGrade }; by default a school class while Madregot is not in the catalogue, as the
// Worker starts); the dashboard's aiPolicy from shared/schoolRules.js, the students' aiOff, POST /api/teacher/class/ai
// and /api/teacher/students/:id/ai, a new class's setting, and 409 school_ai_not_approved for a trial, a licence code
// or a class purchase while the rules do not allow selling to the class.
// `st.down = true` makes every call fail as a lost connection.
// The family lane's routes:
// POST /api/errors keeps each report it is sent (st.errors, DURABLE-9). The backup code's vault (DURABLE-5) keeps sealed
// copies by their X-Vault header in st.vaults, with the Worker's revisions: create with ifRev null (409 when it exists),
// compare-and-swap with ifRev n (409 with the current rev, 404 vault_gone), both reads, and delete (`failVaultDelete`
// makes the delete answer 500). Escrow (DURABLE-6): joining class K7Q2MD by name and PIN (st.members; a returning
// student with the right PIN gets back the code its class keeps), POST /api/vault/escrow and /delete by the class Bearer
// or X-Family-Device (st.escrows: the fake keeps the code as it came, the Worker seals it; `escrowOff` answers 503
// server_config, as a Worker with no VAULT_SECRET does), the family's GET /api/family/vaults and its delete, restoreFrom
// on claim and on devices/this, and the finish that hands the kept code to the new device. An unlink keeps the escrow
// in the account (device null). The parents' daily summary (PARENTS-3/4): the status carries linked.summary (from the
// plan, `report`, and each device's shareChild and shareParent switches, both on by default); POST /api/family/summary
// keeps the rows a linked device sends in st.summaries[deviceId][day] (401 not_linked, 402, 403 sharing_off and 503
// report_off as the Worker answers), and POST /api/family/summary/sharing is the child's switch (forget deletes the rows).
// The parent's side (PARENTS-5): GET /api/family/summary (each linked device with its rows), POST
// /api/family/devices/:id/sharing (the parent's switch), POST /api/family/devices/:id/history/delete, and POST
// /api/report/feedback (st.feedback; a second answer the same visit is 429 already_answered, as a second one a week is).
// The Sunday email (PARENTS-7): POST /api/account/report-email {on} sets st.reportEmail, which GET /api/account shows
// as reportEmail (503 report_off when turning it on with the report off, as the Worker answers).
// After the review of the family lane, as the Worker does: a deleted vault leaves a tombstone (st.tombstones: 410
// vault_deleted on every vault route); a vault write with the token of a device that was unlinked or left (st.gone) is
// 401 not_linked with X-AI-Linked: 0; a device that leaves by itself takes its escrow with it, an unlink keeps it only
// while the child's switch is on; restoreFrom on a still-linked device's escrow is 409 escrow_in_use; GET
// /api/family/summary gives each device `kept` (all its rows, also those older than the days asked for).
import { MOE_RULES, classAiPolicy, notSellable } from '../../shared/schoolRules.js';
import { detectDistress } from '../../shared/safety.js';

export const API = 'https://api.madregot.test';
export const PAY = 'https://pay.example.test';
export const CORS = {
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Expose-Headers': 'X-AI-Tier, X-AI-Group, X-AI-Left, X-AI-Economy, X-AI-Linked',
};
export const GROUP = { explain: 'tutor', chat: 'tutor', check: 'check', generate: 'generate', exam: 'exam' };
export const FAMILY = { tutor: 30, check: 6, generate: 5, exam: 2 };
export const CLASS = { tutor: 20, check: 3, generate: 3, exam: 1 };
export const PLANS = {
  paywall: true, online: true, vatMode: 'included', vatRate: 0.18, currency: 'ILS', termsVersion: '2026-11', checkoutHosts: ['pay.example.test'],
  plans: [
    { id: 'family_month', kind: 'family', interval: 'month', amountAgorot: 2990, vatAgorot: 456, renews: true },
    { id: 'family_year', kind: 'family', interval: 'year', amountAgorot: 24900, vatAgorot: 3798, renews: false, termMonths: 12 },
    { id: 'class_year', kind: 'class', interval: 'year', seatAgorot: 4900, minSeats: 10, maxSeats: 45, renews: false },
  ],
  limits: { family: { ...FAMILY, examMonthly: 10, devices: 3 }, class: CLASS, free: { tutor: 2 } },
  business: { name: 'מדרגות בדיקה', id: '000000000', kind: 'עוסק מורשה', address: 'רחוב הבדיקה 1, תל אביב', email: 'hello@example.test', phone: '03-0000000', provider: 'ספק בדיקה' },
  accessibility: { name: 'רכזת בדיקה', phone: '03-0000001', email: 'access@example.test', date: '2026-11-02', tested: 'axe, VoiceOver' },
  contact: 'hello@example.test',
  // the legal gate (trust spec TRUST-2 §5): approved here; st.legalApproved = false shows the draft banner
  legalDate: '2026-11-01', dbJurisdiction: 'eu', legalApproved: true, legalMissing: [],
};
export const TOKEN = (n) => String(n).padStart(64, 'a');
const shiftDay = (day, n) => { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d) + n * 864e5).toISOString().slice(0, 10); };

/** A live family plan, as GET /api/account shows it. */
export const livePlan = (over = {}) => ({
  id: '5ab0000000000001', plan: 'family_month', status: 'active', priceAgorot: 2990, periodEnd: '2026-12-10T10:00:00Z',
  cancelAtPeriodEnd: false, cancelRequestedAt: null, refundUntil: '2026-11-19T10:00:00Z', canRefundNow: true, canProrata: false,
  prorataAgorot: null, canResume: true, portal: false, economy: false, ...over,
});

/**
 * A fake Worker with the paid tutor's endpoints. `st` is its state (tests may change it); `log` lists every call.
 * `target` is a page or a whole browser context (two pages: the child's device and the parent's phone).
 * `parentOk` (trust spec TRUST-9): false, as on the real server, answers a device alone (no class, no linked device),
 * and a teacher whose class is neither bound to an email nor licensed, with the parent_ok_needed state and refusal;
 * tests about the tutor itself pass parentOk: true.
 */
export async function fakeServer(target, over = {}, base = 'http://127.0.0.1:4173/') {
  const st = {
    paywall: true, online: true, legalApproved: true, shared: null, breakNext: null, economy: false, parentOk: false,
    freeUsed: {}, freeLimit: 2, famUsed: { tutor: 0, check: 0, generate: 0, exam: 0 }, classLicence: false,
    plan: null, sessions: new Set(), recent: new Set(), devices: [], links: {}, orders: {}, n: 0,
    licence: { status: 'none', until: null, seats: null, students: 2, aiWeek: 0, joinLocked: false, request: null, legacyUntil: null, offer: { seatYearAgorot: 4900, minSeats: 10, vatMode: 'included', online: true } },
    classes: [], classPayments: [], failPayment: false,
    joinLocked: false, students: [{ id: 'a1', name: 'דנה' }, { id: 'b2', name: 'יואב' }],
    answers: [], loseProgressReplies: 0,
    forgets: [], failForget: false, // "delete all" on the server (TRUST-6): each request's headers; failForget answers 500
    owned: false, // the class K7Q2MD is bound to the signed-in account: its session opens it like the key (TEACHER-1)
    ownerEmail: null, // the email it is bound to (null: any signed-in session, as tests that seed a session expect)
    key: 'tkey-123', // K7Q2MD's teacher key (a new key replaces it)
    className: 'ז׳3', classGrade: '7',
    accountClasses: [], // more classes bound to the same email: [{ code, name, grade, teacherName, students }]
    email: true, // GET /api/health: the server can send sign-in codes
    deleted: [], // classes deleted through /api/teacher/class/delete
    today: '2026-11-05', // the server's day (Jerusalem): the e2e clock's Thursday
    mistakes: [], // the dashboard's repeated mistakes: [{ topic, cat, level, n, students, ids, names }]
    assignments: [], // [{ id, kind, skill, title, note, startsOn, dueOn, forAll, targets, createdAt, exam?: items, version? }]
    work: {}, // assignmentId -> studentId -> { state, stage, right, asked, passed, questions, tries, startedAt, doneAt, doneDay }
    studentTokens: { 'stok-a1': 'a1' }, // a student's class token -> their id
    down: false, // every call fails as a lost connection
    classAiOff: false, staleStatus: false, // a class student's AI is off by the class's rules (TRUST-11)
    // help requests with their threads (TEACHER-6): [{ id, studentId, name, topic, level, question, answer, note,
    // has_image, created_at, seen_at, done_at, messages: [{ id, from, body, at, read }] }]
    help: [],
    digest: null, // the owner's daily help email (null: the dashboard does not say, as for a key)
    lateBoundAt: null, // K7Q2MD was bound to someone's email after it was opened: key devices are told when
    rekeyFrom: null, // the owner may make a new key from then (a late bind's 7 days)
    errors: [], vaults: {}, tombstones: new Set(), gone: new Set(), members: [], escrows: [], escrowOff: false, // the family lane: error reports, vaults (and the deleted ones), class members, escrows
    // the parents' report (the Worker's PARENT_REPORT): off unless a spec turns it on, so the flows written before it
    // run as they did; report.spec.js turns it on
    report: false, summaries: {}, feedback: [], reportEmail: false,
    ...over,
  };
  // the class's student AI (TRUST-11): a school class, off, no consent, Madregot not in the catalogue, unless the test says
  st.ai = { setting: 'school', studentAi: 'off', consentAt: null, approval: 'none', fromGrade: 7, ...(over.ai || {}) };
  const policyOf = (a = st.ai) => classAiPolicy({ setting: a.setting, grade: st.classGrade, studentAi: a.studentAi, consentAt: a.consentAt }, { approval: a.approval, approvedFromGrade: a.fromGrade });
  const aiPolicy = () => ({
    ...policyOf(), setting: st.ai.setting, studentAi: st.ai.studentAi, consentAt: st.ai.consentAt, fromGrade: Math.max(st.ai.fromGrade, MOE_RULES.independentFromGrade),
    rulesVersion: MOE_RULES.version, rulesUrl: MOE_RULES.url, consentFormUrl: MOE_RULES.consentFormUrl, consentPdfUrl: MOE_RULES.consentPdfUrl,
  });
  const cannotSell = () => notSellable(policyOf());
  const emails = new Map(); // session token → the email it signed in with
  const log = [];
  const reply = (route, code, data, headers = {}) => route.fulfill({ status: code, contentType: 'application/json', headers: { ...CORS, ...headers }, body: JSON.stringify(data) });
  const famOf = (h) => st.devices.find((d) => d.token && d.token === h['x-family-device']) || null;
  const live = () => !!st.plan && ['active', 'past_due', 'canceled'].includes(st.plan.status);
  const tierOf = (h) => {
    if (!st.paywall) return 'open';
    if (h['x-class-code']) return ['trial', 'active', 'ending'].includes(st.licence.status) ? 'teacher' : 'free';
    if (h.authorization && st.classLicence) return 'class';
    if (famOf(h) && live()) return 'family';
    return 'free';
  };
  const who = (h) => h['x-family-device'] || h['x-device'] || h.authorization || h['x-class-code'] || 'anon';
  // A class's teacher is an adult only when the class is bound to a signed-in email (the session sent, K7Q2MD owned, or
  // another class of the account) or has a licence or trial in force (TRUST-9, the trust review): a key alone proves no
  // adult, as on the Worker (entitle.js classHasAdult).
  const adultClass = (h) => !!h['x-account-token'] || ['trial', 'active', 'ending'].includes(st.licence.status)
    || (h['x-class-code'] === 'K7Q2MD' ? st.owned : st.accountClasses.some((c) => c.code === h['x-class-code']));
  // a child alone, on a device no parent has approved, or a teacher of a class with no adult behind it (TRUST-9)
  const waits = (h) => !st.parentOk && !h.authorization && !famOf(h) && (!h['x-class-code'] || !adultClass(h));
  /** The summary's state for a device, derived as the Worker's summaryState is. */
  const summaryOf = (d) => {
    if (!st.paywall || !st.report) return 'off';
    if (!live()) return 'no_plan';
    const child = d.shareChild !== false; const parent = d.shareParent !== false;
    return child && parent ? 'on' : !child && !parent ? 'both_off' : !child ? 'child_off' : 'parent_off';
  };
  const limitsOf = (tier) => (tier === 'family' ? FAMILY : CLASS);
  const status = (h) => {
    if (waits(h)) return { paywall: st.paywall, tier: null, state: 'parent_ok_needed', kinds: [], groups: {}, resetsAt: '2026-11-06T00:00:00+02:00', aiReady: true };
    const tier = tierOf(h);
    const fam = famOf(h);
    if (tier === 'open') return { paywall: false, tier: 'open', kinds: Object.keys(GROUP), groups: { all: { left: 40, limit: 40 } }, aiReady: true, ...(fam ? { linked: { label: fam.label, summary: 'off' } } : {}) };
    const out = { paywall: true, tier, kinds: [], groups: { tutor: null, check: null, generate: null, exam: null }, economy: false, shared: null, resetsAt: '2026-11-06T00:00:00+02:00', linked: fam ? { label: fam.label, summary: summaryOf(fam) } : null, legacyUntil: null, aiReady: true };
    if (tier === 'free') {
      const limit = h['x-class-code'] ? 5 : st.freeLimit;
      out.kinds = ['explain', 'chat']; out.groups.tutor = { left: Math.max(0, limit - (st.freeUsed[who(h)] || 0)), limit }; out.shared = st.shared;
      return out;
    }
    const L = limitsOf(tier); const used = tier === 'family' ? st.famUsed : {};
    out.economy = st.economy;
    for (const [k, g] of Object.entries(GROUP)) {
      if (st.economy && !['explain', 'chat'].includes(k)) continue;
      out.kinds.push(k); out.groups[g] = { left: L[g] - (used[g] || 0), limit: L[g] };
    }
    return out;
  };
  const account = () => ({
    email: 'parent@example.test', billingHold: false, maxDevices: 3, plan: live() ? st.plan : null, reportEmail: !!st.reportEmail,
    // a claimed code the child's device has not collected yet is listed as pending, as the Worker does
    devices: st.devices.map((d) => ({
      id: d.id, label: d.label, linkedAt: d.linkedAt || '2026-11-05T09:00:00Z', lastSeen: '2026-11-05', ...(d.token ? {} : { pending: true }),
      sharing: summaryOf(d), sharingAt: d.sharingAt || null, lastSync: d.lastSync || null,
    })),
    usageWeek: { tutor: st.famUsed.tutor, check: st.famUsed.check, generate: 0, exam: 0 },
    payments: [...(live() ? [{ id: 'p000000000000001', subscriptionId: st.plan.id, planKind: 'family', at: '2026-11-05T09:00:00Z', amountAgorot: 2990, kind: 'charge', hasInvoice: true }] : []), ...st.classPayments],
    classes: st.classes, ownedClasses: st.owned ? 1 : 0,
  });
  // ---- class work, as worker/src/assignments.js keeps it
  const plus = (day, n) => { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  const saturday = (day) => new Date(`${day}T12:00:00Z`).getUTCDay() === 6;
  const forWhom = (a) => (a.forAll ? st.students.map((x) => x.id) : a.targets.filter((id) => st.students.some((x) => x.id === id)));
  const workOf = (a, sid) => st.work[a.id]?.[sid] || null;
  const lateOf = (a, w) => (w?.state === 'done' ? w.doneDay > a.dueOn : a.dueOn < st.today);
  const viewOf = (a) => {
    const who = forWhom(a); const ws = who.map((sid) => workOf(a, sid));
    const started = ws.filter((w) => w?.state === 'started').length; const done = ws.filter((w) => w?.state === 'done').length;
    return {
      id: a.id, kind: a.kind, skill: a.skill, title: a.title, note: a.note, startsOn: a.startsOn, dueOn: a.dueOn, forAll: a.forAll,
      targets: a.forAll ? [] : [...a.targets].sort(), createdAt: a.createdAt, hasExam: !!a.exam, examCount: a.exam ? a.exam.length : null, version: a.version || null,
      counts: { assigned: who.length, notStarted: who.length - started - done, started, done, late: who.filter((sid) => lateOf(a, workOf(a, sid))).length },
    };
  };
  const mineOf = (w) => (w ? { state: w.state, stage: w.stage ?? null, right: w.right ?? null, asked: w.asked ?? null, passed: w.passed ?? null, doneAt: w.doneAt || null } : null);
  const dashboard = (code = 'K7Q2MD') => ({
    class: code === 'K7Q2MD' ? { name: st.className, grade: st.classGrade, teacherName: 'רונית' }
      : (({ name, grade }) => ({ name, grade, teacherName: 'רונית' }))(st.accountClasses.find((c) => c.code === code)), joinLocked: st.joinLocked,
    help: code === 'K7Q2MD' ? st.help.map((x) => ({ ...x, messages: x.messages.slice(0, 6), unreadFromStudent: x.messages.filter((m) => m.from === 'student' && !m.read).length })) : [],
    helpDigest: st.digest, mistakes: st.mistakes, exams: [],
    today: st.today,
    assignments: st.assignments.filter((a) => a.dueOn >= plus(st.today, -7)).sort((a, b) => (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0)).slice(0, 10).map(viewOf),
    students: st.students.map((s) => ({ lastPractice: '2026-11-05T08:00:00Z', today: { n: 3 }, week: { n: 10, first: 8, days: 2 }, levels: {}, pinReset: false, joinedOn: '2026-09-02', late: 0, aiOff: false, ...s })),
    aiPolicy: aiPolicy(),
  });
  // one student's page, as worker/src/classReport.js studentDetail gives it
  const pageOf = (s) => {
    const row = dashboard().students.find((x) => x.id === s.id);
    return {
      student: { id: s.id, name: s.name, joinedOn: row.joinedOn, lastPractice: row.lastPractice, pinReset: !!row.pinReset, aiOff: !!row.aiOff },
      days14: Array.from({ length: 14 }, (_, i) => ({ day: plus(st.today, i - 13), n: 0, first: 0, minutes: 0 })),
      levels: row.levels || {}, mistakes: [],
      work: st.assignments.filter((a) => forWhom(a).includes(s.id)).map((a) => {
        const w = workOf(a, s.id);
        return { assignmentId: a.id, title: a.title, kind: a.kind, dueOn: a.dueOn, state: w?.state || 'none', stage: w?.stage ?? null, right: w?.right ?? null, asked: w?.asked ?? null, passed: w?.passed ?? null, late: lateOf(a, w) };
      }),
      help: st.help.filter((x) => x.studentId === s.id).map((x) => ({ id: x.id, topic: x.topic, question: x.question, createdAt: x.created_at, status: statusOf(x) })),
      exams: [],
      ...(st.studentPages?.[s.id] || {}),
    };
  };

  // ---- help both ways (TEACHER-6), as worker/src/help.js keeps it
  const contact = (t) => /https?:\/\/|www\.|[^\s@]+@[^\s@]+\.[^\s@]+|\.(com|co|il|net|org|test)\b/i.test(t) || /\d{7,}/.test(t.replace(/[\s.\-()]+/g, ''));
  const statusOf = (x) => (x.done_at ? 'done' : x.messages.some((m) => m.from === 'teacher') ? 'answered' : x.seen_at ? 'seen' : 'sent');
  const helpNow = () => `${st.today}T10:00:00.000Z`;
  let msgId = 1000;
  const myHelpOf = (sid) => st.help.filter((x) => x.studentId === sid)
    .map((x) => ({ id: x.id, topic: x.topic, level: x.level, question: x.question, createdAt: x.created_at, status: statusOf(x), messages: x.messages }));

  // ---- the class report (TEACHER-7), as worker/src/classReport.js gives it: rows by name, work by row index, no ids
  const REPORT_ROWS = [
    { activeDays: 3, exercises: 24, firstTry: 18, correct: 21, hinted: 2, minutes: 31, lastPractice: '2026-11-05T08:00:00Z',
      levels: { signed: { level: 2, max: 3 }, coord: { level: 1, max: 1 } }, topMistakes: [{ topic: 'signed', cat: 'sign', level: 1, n: 3 }] },
    { activeDays: 1, exercises: 6, firstTry: 3, correct: 4, hinted: 0, minutes: 7, lastPractice: '2026-11-03T14:00:00Z', levels: { signed: { level: 1, max: 1 } }, topMistakes: [] },
  ];
  const reportOf = (code, qFrom, qTo) => {
    const to = qTo && qTo < st.today ? qTo : st.today;
    let from = qFrom || plus(to, -13);
    if (from < plus(to, -399)) from = plus(to, -399);
    const rows = [...st.students].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const cls = dashboard(code).class;
    return {
      class: { name: cls.name, grade: cls.grade, teacherName: cls.teacherName }, from, to, today: st.today, generatedAt: `${st.today}T08:00:00.000Z`,
      students: rows.map((x, i) => ({
        name: x.name, joinedOn: '2026-09-02',
        ...(REPORT_ROWS[i] || { activeDays: 0, exercises: 0, firstTry: 0, correct: 0, hinted: 0, minutes: 0, lastPractice: null, levels: {}, topMistakes: [] }),
        ...(st.reportRows?.[x.id] || {}),
      })),
      assignments: st.assignments.filter((a) => a.dueOn >= from && a.startsOn <= to).map((a) => {
        const work = {};
        rows.forEach((x, i) => {
          if (!forWhom(a).includes(x.id)) return;
          const w = workOf(a, x.id);
          work[i] = { state: w?.state || 'none', stage: w?.stage ?? null, right: w?.right ?? null, asked: w?.asked ?? null, passed: w?.passed ?? null, tries: w?.tries || 0, late: lateOf(a, w) };
        });
        return { title: a.title, kind: a.kind, skill: a.skill, dueOn: a.dueOn, work };
      }),
      mistakes: st.mistakes.map(({ ids, ...m }) => m),
    };
  };

  const handler = async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url()); const path = url.pathname; const h = req.headers();
    // a reach count (lib/metrics.js, STUDENT-14) is a beacon with a plain name, answered 204 as the Worker does
    if (path === '/api/metrics') { log.push({ path, method: req.method(), body: req.postData(), headers: h }); return route.fulfill({ status: 204, headers: CORS }); }
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    log.push({ path, method: req.method(), body, headers: h });
    if (st.down) return route.abort('internetdisconnected');
    const token = h['x-account-token'];
    const signed = token && st.sessions.has(token);
    // ---- the child's side
    if (path === '/api/ai/status') {
      // a class student whose class has the AI off: the same 403 an AI call gets (worker/src/entitle.js aiStatus)
      if (h.authorization && st.classAiOff && !st.staleStatus) return reply(route, 403, { error: 'class_ai_off', message: 'class_ai_off' });
      return reply(route, 200, status(h), h['x-family-device'] && !famOf(h) ? { 'X-AI-Linked': '0' } : {});
    }
    // a reported answer (trust spec TRUST-4 §4.5): kept, never counted as a question
    if (path === '/api/ai/report') return reply(route, 200, { ok: true });
    if (path.startsWith('/api/ai/')) {
      const kind = path.split('/').pop(); const g = GROUP[kind]; const tier = tierOf(h);
      let left;
      if (st.breakNext) { const e = st.breakNext; st.breakNext = null; return reply(route, e.status, e.body); }
      if (h.authorization && st.classAiOff) return reply(route, 403, { error: 'class_ai_off', message: 'class_ai_off' });
      if (waits(h)) return reply(route, 403, { error: 'parent_ok_needed' }, h['x-family-device'] ? { 'X-AI-Linked': '0' } : {});
      if (tier === 'free') {
        if (!['explain', 'chat'].includes(kind)) return reply(route, 402, { error: 'paid_only', kind });
        if (st.shared === 'paused') return reply(route, 503, { error: 'free_paused' });
        if (st.shared) return reply(route, 429, { error: 'shared_limit', scope: st.shared });
        const limit = h['x-class-code'] ? 5 : st.freeLimit; const used = st.freeUsed[who(h)] || 0;
        if (used >= limit) return reply(route, 429, { error: 'daily_limit', tier: 'free', group: 'tutor', limit, left: 0 });
        st.freeUsed[who(h)] = used + 1;
        left = limit - used - 1;
      } else if (tier !== 'open') {
        if (st.economy && !['explain', 'chat'].includes(kind)) return reply(route, 429, { error: 'monthly_fair_use' });
        const L = limitsOf(tier);
        if (tier === 'family') { if (st.famUsed[g] >= L[g]) return reply(route, 429, { error: 'daily_limit', tier, group: g, limit: L[g], left: 0 }); st.famUsed[g] += 1; left = L[g] - st.famUsed[g]; } else left = L[g] - 1;
      } else left = 39;
      const hdr = { 'X-AI-Tier': tier, 'X-AI-Group': tier === 'open' ? 'all' : g, 'X-AI-Left': String(left), ...(h['x-family-device'] && !famOf(h) ? { 'X-AI-Linked': '0' } : {}) };
      if (kind === 'chat') return route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', headers: { ...CORS, ...hdr }, body: 'כדי לחבר מספרים עם סימנים שונים, מחסרים ושמים את הסימן של הגדול.' });
      if (kind === 'explain') return reply(route, 200, { text: 'הסבר קצר מהעוזר.' }, hdr);
      if (kind === 'check') return reply(route, 200, { readable: true, final: 'correct', steps: [{ text: '3 + 4 = 7', ok: true }], summary: 'יפה.' }, hdr);
      // new exercises (ai spec AI-4): the app's seeds come back in their own wording, each ending at the app's answer;
      // a test can write its own stories (st.genReply(body) → { items, dropped, fallback })
      if (kind === 'generate') {
        const seeds = Array.isArray(body.seeds) ? body.seeds : [];
        const echo = { items: seeds.map((sd) => ({ seed: sd.i, prompt: sd.text, hint: '', solution: [`התשובה: $= ${sd.answer}$`], kept: true, blind: 'skipped' })), dropped: {}, fallback: false };
        return reply(route, 200, st.genReply ? st.genReply(body) : echo, hdr);
      }
      return reply(route, 200, { questions: [{ prompt: '2+2', answer: '4', hint: 'חברו', solution: ['2+2=4'] }] }, hdr);
    }
    // the backup code's vault (DURABLE-5): sealed copies by X-Vault; the fake never opens them
    if (path === '/api/vault' || path === '/api/vault/rev' || path === '/api/vault/delete') {
      const id = String(h['x-vault'] || '');
      if (!/^[0-9a-f]{64}$/.test(id)) return reply(route, 400, { error: 'bad_vault' });
      const v = st.vaults[id];
      if (req.method() === 'GET') {
        if (!v) return reply(route, st.tombstones.has(id) ? 410 : 404, { error: st.tombstones.has(id) ? 'vault_deleted' : 'vault_not_found' });
        return reply(route, 200, path === '/api/vault' ? { rev: v.rev, blob: v.blob, updatedAt: v.updatedAt } : { rev: v.rev, updatedAt: v.updatedAt });
      }
      if (path === '/api/vault/delete') {
        // `failVaultDelete`: the server breaks on a delete (the device must then delete nothing either)
        if (st.failVaultDelete) return reply(route, 500, { error: 'server_error' });
        delete st.vaults[id]; st.tombstones.add(id); st.escrows = st.escrows.filter((e) => e.lookup !== id);
        return reply(route, 200, { deleted: v ? 1 : 0 });
      }
      // (the fake reuses a token for the next device linked in the same place: only a token no device holds now is gone)
      if (st.gone.has(h['x-family-device']) && !st.devices.some((d) => d.token === h['x-family-device'])) return reply(route, 401, { error: 'not_linked' }, { 'X-AI-Linked': '0' });
      if (st.tombstones.has(id)) return reply(route, 410, { error: 'vault_deleted' });
      const updatedAt = new Date().toISOString();
      if (body.ifRev === null) {
        if (v) return reply(route, 409, { error: 'vault_conflict', rev: v.rev });
        st.vaults[id] = { rev: 1, blob: body.blob, updatedAt };
        return reply(route, 200, { rev: 1, updatedAt });
      }
      if (!v) return reply(route, 404, { error: 'vault_gone' });
      if (v.rev !== body.ifRev) return reply(route, 409, { error: 'vault_conflict', rev: v.rev });
      st.vaults[id] = { rev: v.rev + 1, blob: body.blob, updatedAt };
      return reply(route, 200, { rev: v.rev + 1, updatedAt });
    }
    // ---- escrow (DURABLE-6): the code kept for a class student (Bearer) or a family device (X-Family-Device)
    if (path === '/api/vault/escrow' || path === '/api/vault/escrow/delete') {
      const bearer = String(h.authorization || '').replace(/^Bearer /, '');
      const m = bearer && st.members.find((x) => x.tokens.includes(bearer));
      const fd = !m && famOf(h);
      if (!m && !fd) return reply(route, 401, { error: 'not_signed_in' });
      const mine = (e) => (m ? e.kind === 'student' && e.owner === m.id : e.kind === 'account' && e.device === fd.id);
      if (path === '/api/vault/escrow/delete') {
        const before = st.escrows.length; st.escrows = st.escrows.filter((e) => !mine(e));
        return reply(route, 200, { deleted: before - st.escrows.length });
      }
      if (st.escrowOff) return reply(route, 503, { error: 'server_config' });
      if (!/^[A-HJ-KMNP-Z2-9]{16}$/.test(body.code || '') || !/^[0-9a-f]{64}$/.test(body.lookup || '')) return reply(route, 400, { error: 'bad_vault' });
      if (!st.vaults[body.lookup]) return reply(route, 404, { error: 'vault_not_found' });
      const at = new Date().toISOString();
      const e = st.escrows.find(mine);
      if (e) Object.assign(e, { code: body.code, lookup: body.lookup, updatedAt: at });
      else st.escrows.push({ id: `e${String(st.escrows.length + 1).padStart(15, '0')}`, kind: m ? 'student' : 'account', owner: m ? m.id : 'acct', device: m ? null : fd.id, label: m ? '' : fd.label, code: body.code, lookup: body.lookup, updatedAt: at });
      return reply(route, 200, { escrow: m ? 'class' : 'family' });
    }
    // joining class K7Q2MD: a name is a student; their first PIN is theirs; a returning student with that PIN gets a new
    // token (up to 3 devices) and the code the class keeps, when its vault is still there
    const join = path.match(/^\/api\/classes\/([A-Z0-9]+)\/join$/);
    if (join) {
      if (join[1] !== 'K7Q2MD') return reply(route, 404, { error: 'no_class' });
      if (!/^\d{4}$/.test(body.pin || '')) return reply(route, 400, { error: 'bad_pin' });
      let m = st.members.find((x) => x.name === body.name);
      if (m && m.pin !== body.pin) return reply(route, 403, { error: 'wrong_pin' });
      const returning = !!m;
      if (!m) { m = { id: `s${st.members.length + 1}`, name: body.name, pin: body.pin, tokens: [] }; st.members.push(m); }
      const token = `stu_${m.id}_${m.tokens.length + 1}`; m.tokens = [...m.tokens, token].slice(-3);
      st.studentTokens[token] = m.id; // the school lane's routes (class work, help) know the joined student too
      const e = st.escrows.find((x) => x.kind === 'student' && x.owner === m.id && st.vaults[x.lookup]);
      return reply(route, 200, { studentId: m.id, token, name: m.name, className: 'ז׳3', grade: '7', classCode: 'K7Q2MD', returning, ...(e ? { vault: { code: e.code } } : {}) });
    }
    // the app's error reports (DURABLE-9): a text/plain body holding JSON, kept as they came
    if (path === '/api/errors' && req.method() === 'POST') { st.errors.push(body); return reply(route, 202, { ok: true }); }
    // "delete all" (TRUST-6 §1): the server's part, as the Worker answers it (trust.spec.js routes it itself to hold or
    // break it); the joined student's token stops working
    if (path === '/api/me/forget' && req.method() === 'POST') {
      st.forgets.push({ ...h });
      if (st.failForget) return reply(route, 500, { error: 'server_error' });
      const bearer = String(h.authorization || '').replace(/^Bearer /, '');
      const sid = bearer && st.studentTokens[bearer];
      if (sid) for (const [t, id] of Object.entries(st.studentTokens)) if (id === sid) delete st.studentTokens[t];
      // the family device goes as the Worker's forget.js familyDeviceDeleteStmts deletes it: its row, the code the family
      // kept for it and the summaries it sent (as the device's own leave does)
      const fd = famOf(h);
      if (fd) {
        st.escrows = st.escrows.filter((e) => e.device !== fd.id);
        delete st.summaries[fd.id]; st.gone.add(fd.token);
        st.devices = st.devices.filter((x) => x !== fd);
      }
      return reply(route, 200, { ok: true, student: !!sid, familyDevice: !!fd, device: /^[a-f0-9]{32}$/.test(h['x-device'] || '') });
    }
    if (path === '/api/progress') {
      // a class student's answers, kept as the Worker keeps them: once per id (an answer without one, every time), and
      // every event sent is acknowledged. `loseProgressReplies`: store, then answer with an error (the reply was lost).
      if (!h.authorization) return reply(route, 401, { error: 'not_signed_in' });
      const events = (Array.isArray(body.events) ? body.events : []).slice(0, 500);
      for (const e of events) if (!e.id || !st.answers.some((a) => a.id === e.id)) st.answers.push(e);
      if (st.loseProgressReplies > 0) { st.loseProgressReplies -= 1; return reply(route, 503, { error: 'server_error' }); }
      return reply(route, 200, { saved: events.length });
    }
    // ---- the student's side of help (TEACHER-6): a new request, its thread, its answers
    if (path === '/api/help' && req.method() === 'POST') {
      const sid = st.studentTokens[String(h.authorization || '').replace(/^Bearer /, '')];
      if (!sid) return reply(route, 401, { error: 'not_signed_in' });
      const id = Math.max(0, ...st.help.map((x) => x.id)) + 1;
      st.help.unshift({ id, studentId: sid, name: st.students.find((x) => x.id === sid)?.name || '', topic: body.topic, level: body.level, question: body.question, answer: body.answer || '', note: body.note || '', has_image: body.image ? 1 : 0, created_at: helpNow(), seen_at: null, done_at: null, messages: [] });
      return reply(route, 200, { ok: true });
    }
    const hm = path.match(/^\/api\/help\/(\d+)\/(reply|read)$/);
    if (hm) {
      const sid = st.studentTokens[String(h.authorization || '').replace(/^Bearer /, '')];
      if (!sid) return reply(route, 401, { error: 'not_signed_in' });
      const x = st.help.find((r) => r.id === Number(hm[1]) && r.studentId === sid);
      if (!x) return reply(route, 404, { error: 'not_found' });
      const readTeacher = () => { x.messages = x.messages.map((m) => (m.from === 'teacher' ? { ...m, read: true } : m)); };
      if (hm[2] === 'read') { readTeacher(); return reply(route, 200, { ok: true }); }
      // as worker/src/help.js studentReply: the child's own words are read for distress before any other rule; a hit
      // marks the request for the teacher and opens it again, and a refusal after that says so (care: true)
      const own = body.quick === 'thanks' ? '' : String(body.body || '');
      const care = detectDistress(own).flag;
      if (care) { x.care = 1; x.done_at = null; }
      const refuse = (status, error) => reply(route, status, { error, ...(care ? { care: true } : {}) });
      if (!x.messages.some((m) => m.from === 'teacher')) return refuse(409, 'no_reply_yet');
      if (x.messages.filter((m) => m.from === 'student').length >= 3) return refuse(409, 'reply_limit');
      const text = body.quick === 'thanks' ? 'תודה, הבנתי' : String(body.body || '').trim() || (body.quick === 'still' ? 'עדיין לא ברור לי' : '');
      if (!text || text.length > 300) return refuse(400, 'bad_reply');
      if (contact(text)) return refuse(400, 'reply_has_contact');
      readTeacher();
      if (body.quick === 'still') x.done_at = null;
      const message = { id: msgId += 1, from: 'student', body: text, at: helpNow(), read: false };
      x.messages.push(message);
      return reply(route, 201, { message, status: statusOf(x) });
    }
    // ---- the student's class work (TEACHER-5)
    if (path.startsWith('/api/class/work')) {
      const sid = st.studentTokens[String(h.authorization || '').replace(/^Bearer /, '')];
      if (!sid) return reply(route, 401, { error: 'not_signed_in' });
      const mine = (a) => a.startsOn <= st.today && (a.forAll || a.targets.includes(sid));
      if (path === '/api/class/work') {
        const list = st.assignments.filter((a) => mine(a) && (a.dueOn >= plus(st.today, -14) || (workOf(a, sid)?.state !== 'done' && a.dueOn >= plus(st.today, -30))))
          .sort((a, b) => ((workOf(a, sid)?.state === 'done') - (workOf(b, sid)?.state === 'done')) || (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0));
        return reply(route, 200, {
          today: st.today, teacherName: 'רונית', help: myHelpOf(sid),
          assignments: list.map((a) => ({ id: a.id, kind: a.kind, skill: a.skill, title: a.title, note: a.note, startsOn: a.startsOn, dueOn: a.dueOn, createdAt: a.createdAt, hasExam: !!a.exam, examCount: a.exam ? a.exam.length : null, mine: mineOf(workOf(a, sid)) })),
        });
      }
      // a class exam's frozen questions, for a student it is assigned to
      const em = path.match(/^\/api\/class\/work\/([a-f0-9]{16})\/exam$/);
      if (em) {
        const a = st.assignments.find((x) => x.id === em[1]);
        if (!a || !mine(a) || !a.exam) return reply(route, 404, { error: 'not_found' });
        return reply(route, 200, { items: a.exam });
      }
      const wm = path.match(/^\/api\/class\/work\/([a-f0-9]{16})$/);
      const a = wm && st.assignments.find((x) => x.id === wm[1]);
      if (!a || !mine(a) || req.method() !== 'POST') return reply(route, 404, { error: 'not_found' });
      if (!['started', 'done'].includes(body.state)) return reply(route, 400, { error: 'bad_work', field: 'state' });
      // as the Worker's cleanWork: a finished class exam reports exactly its questions; a check is a mastery check of 5
      if (a.kind === 'exam' && body.state === 'done' && (body.asked !== a.exam.length || body.questions?.length !== a.exam.length)) return reply(route, 400, { error: 'bad_work', field: 'asked' });
      if (a.kind === 'check' && body.asked > 5) return reply(route, 400, { error: 'bad_work', field: 'asked' });
      const old = workOf(a, sid); const done = body.state === 'done'; const at = `${st.today}T10:00:00.000Z`;
      const max = (x, y) => (x == null ? (y ?? null) : y == null ? x : Math.max(x, y));
      const first = old?.doneAt ? old : done ? body : old || {};
      const w = {
        state: old?.state === 'done' || done ? 'done' : 'started', stage: max(old?.stage, body.stage), passed: max(old?.passed == null ? null : +old.passed, body.passed == null ? null : +body.passed),
        right: first.right ?? null, asked: first.asked ?? null, questions: first.questions ?? null, tries: (old?.tries || 0) + (done ? 1 : 0),
        startedAt: old?.startedAt || at, doneAt: old?.doneAt || (done ? at : null), doneDay: old?.doneDay || (done ? st.today : null),
      };
      w.passed = w.passed == null ? null : !!w.passed;
      (st.work[a.id] ||= {})[sid] = w;
      return reply(route, 200, { mine: mineOf(w) });
    }
    if (path === '/api/family/link/start') {
      if (!/^[a-f0-9]{32}$/.test(h['x-device'] || '')) return reply(route, 400, { error: 'need_device' });
      const code = 'K7M4QX';
      st.links[code] = { secret: body.secret, claimed: false, collected: false };
      return reply(route, 201, { code, expiresAt: '2026-11-05T11:00:00Z', url: `${base}parents/link?c=${code}` });
    }
    if (path === '/api/family/link/finish') {
      const l = st.links[body.code];
      if (!l || l.secret !== body.secret) return reply(route, 404, { error: 'link_not_found' });
      if (l.collected) return reply(route, 410, { error: 'link_expired' });
      if (!l.claimed) return reply(route, 202, { state: 'waiting' });
      l.collected = true; const d = st.devices.find((x) => x.id === l.device); d.token = `fd1.${String(st.devices.indexOf(d) + 1).repeat(64).slice(0, 64)}`;
      // the parent chose to continue from kept progress: it now belongs to this device, whose code comes with the token
      const kept = l.restoreFrom && st.escrows.find((e) => e.id === l.restoreFrom);
      if (kept) kept.device = d.id;
      return reply(route, 200, { deviceToken: d.token, label: d.label, ...(kept && st.vaults[kept.lookup] ? { vault: { code: kept.code } } : {}) });
    }
    if (path === '/api/family/devices/leave') {
      const d = st.devices.find((x) => x.token && x.token === h['x-family-device']);
      if (d) {
        // the child left: the code the family kept goes, and the summaries with the link (PARENTS-3)
        st.escrows = st.escrows.filter((e) => e.device !== d.id);
        delete st.summaries[d.id]; st.gone.add(d.token);
      }
      st.devices = st.devices.filter((x) => x !== d); return reply(route, 200, { ok: true });
    }
    // ---- the parents' daily summary from a linked device (X-Family-Device only)
    if ((path === '/api/family/summary' || path === '/api/family/summary/sharing') && req.method() === 'POST') {
      const fam = famOf(h);
      if (!fam) return reply(route, 401, { error: 'not_linked' }, h['x-family-device'] ? { 'X-AI-Linked': '0' } : {});
      if (path === '/api/family/summary/sharing') {
        if (typeof body.on !== 'boolean') return reply(route, 400, { error: 'bad_sharing' });
        if (body.on && (!st.paywall || !st.report)) return reply(route, 503, { error: 'report_off' });
        fam.shareChild = body.on; fam.sharingAt = new Date().toISOString();
        if (body.forget) delete st.summaries[fam.id];
        return reply(route, 200, { sharing: summaryOf(fam) });
      }
      if (!st.paywall || !st.report) return reply(route, 503, { error: 'report_off' });
      const days = Array.isArray(body.days) ? body.days : [];
      if (days.length < 1 || days.length > 8) return reply(route, 400, { error: 'bad_summary', field: 'days' });
      if (!live()) return reply(route, 402, { error: 'needs_subscription' });
      const state = summaryOf(fam);
      if (state !== 'on') return reply(route, 403, { error: 'sharing_off', sharing: state });
      st.summaries[fam.id] = { ...(st.summaries[fam.id] || {}) };
      for (const d of days) st.summaries[fam.id][d.d] = d;
      fam.lastSync = new Date().toISOString();
      return reply(route, 200, { ok: true, saved: days.length, sharing: 'on' });
    }
    // ---- sign-in
    if (path === '/api/account/code') return reply(route, 200, { sent: true, expiresInMinutes: 10, resendAfter: 60 });
    if (path === '/api/account/verify') {
      if (body.code !== '123456') return reply(route, 403, { error: 'wrong_code', left: 4 });
      if (token) st.sessions.delete(token);
      st.n += 1; const t = TOKEN(st.n); st.sessions.add(t); st.recent.add(t); emails.set(t, body.email);
      return reply(route, 200, { token: t, email: body.email });
    }
    // `planOnline` ({ family_month: false, … }): plans the provider cannot sell online here (each plan's own `online`)
    if (path === '/api/billing/plans') {
      const legal = st.legalApproved !== false;
      const plans = PLANS.plans.map((pl) => (st.planOnline && pl.id in st.planOnline ? { ...pl, online: st.planOnline[pl.id] } : pl));
      return reply(route, 200, { ...PLANS, plans, paywall: st.paywall, online: st.online && legal, report: st.paywall && st.report, legalApproved: legal, legalMissing: legal ? [] : ['LEGAL_APPROVED'] });
    }
    if (path.startsWith('/api/account') || path.startsWith('/api/billing') || path === '/api/family/link/claim' || path.startsWith('/api/family/devices') || path.startsWith('/api/family/vaults') || path === '/api/family/summary' || path === '/api/report/feedback' || path === '/api/teacher/licence/request') {
      if (path.startsWith('/api/teacher')) { /* checked below with the class too */ } else if (!signed) return reply(route, 401, { error: 'not_account' });
    }
    if (path === '/api/account') return reply(route, 200, account());
    if (path === '/api/account/signout') { if (body.all) st.sessions.clear(); else st.sessions.delete(token); return reply(route, 200, { ok: true, revoked: 1 }); }
    if (path === '/api/account/delete') {
      if (!st.recent.has(token) || st.needReauth) { st.needReauth = false; return reply(route, 401, { error: 'reauth_needed' }); }
      st.sessions.clear(); st.plan = null; st.devices = []; st.deleted = true;
      return reply(route, 200, { ok: true });
    }
    if (path === '/api/billing/checkout') {
      if (body.plan === 'class_year' && cannotSell()) return reply(route, 409, { error: 'school_ai_not_approved', reason: policyOf().reason });
      if (body.adult !== true) return reply(route, 400, { error: 'adult_required' });
      if (body.terms !== '2026-11') return reply(route, 400, { error: 'terms_required' });
      if (!/^[A-Za-z0-9_-]{16,64}$/.test(h['idempotency-key'] || '')) return reply(route, 400, { error: 'bad_idempotency_key' });
      const id = `0rd${'0'.repeat(12)}${Object.keys(st.orders).length + 1}`;
      st.orders[id] = { plan: body.plan, status: 'open', polls: 0, seats: body.seats };
      return reply(route, 201, { orderId: id, url: `${PAY}/checkout?order=${id}` });
    }
    if (path.startsWith('/api/billing/orders/')) {
      const o = st.orders[path.split('/').pop()];
      if (!o) return reply(route, 404, { error: 'not_found' });
      o.polls += 1;
      if (o.paidOnPage && o.polls >= 2 && o.status === 'open') {
        o.status = 'paid';
        if (o.plan !== 'class_year') st.plan = livePlan({ plan: o.plan });
      }
      return reply(route, 200, { status: o.status, plan: o.plan, subscription: o.status === 'paid' ? { status: 'active', periodEnd: '2026-12-05T10:00:00Z' } : null });
    }
    if (path === '/api/billing/cancel') {
      const lic = st.classes.find((c) => c.plan?.id === body.subscriptionId);
      if (lic) { lic.status = 'ended'; delete lic.plan; return reply(route, 200, { ok: true, status: 'ended', endsAt: '2026-11-05T10:00:00Z', refundAgorot: 58800, refundManual: false, synced: true, reference: 'C-1B00' }); }
      const p = st.plan;
      if (!p || p.id !== body.subscriptionId) return reply(route, 404, { error: 'no_subscription' });
      if (body.mode === 'refund_now') { st.plan = { ...p, status: 'ended' }; return reply(route, 200, { ok: true, status: 'ended', endsAt: '2026-11-05T10:00:00Z', refundAgorot: 2990, refundManual: false, synced: true, reference: 'C-7F3A' }); }
      st.plan = { ...p, status: 'canceled', cancelAtPeriodEnd: true, cancelRequestedAt: '2026-11-05T10:00:00Z', canRefundNow: false };
      return reply(route, 200, { ok: true, status: 'canceled', endsAt: p.periodEnd, refundAgorot: 0, refundManual: false, synced: true, reference: 'C-7F3A' });
    }
    if (path === '/api/billing/resume') { st.plan = { ...st.plan, status: 'active', cancelAtPeriodEnd: false, cancelRequestedAt: null }; return reply(route, 200, { ok: true, status: 'active', renewsAt: st.plan.periodEnd }); }
    // the purpose of a link (TRUST-9 §3): 'plan' needs a live plan, 'consent' (the default without one) the parent's tick
    const purposeOf = () => (['plan', 'consent'].includes(body.purpose) ? body.purpose : live() ? 'plan' : 'consent');
    if ((path === '/api/family/link/claim' || path === '/api/family/devices/this') && signed) {
      const purpose = purposeOf();
      if (purpose === 'plan' && !live()) return reply(route, 402, { error: 'needs_subscription' });
      if (purpose === 'consent' && body.consent !== true) return reply(route, 400, { error: 'consent_required' });
      st.purposes = [...(st.purposes || []), purpose];
    }
    // restoreFrom (DURABLE-6): an escrow of this account, else 404 escrow_not_found
    const restoreOf = () => (body.restoreFrom ? st.escrows.find((e) => e.kind === 'account' && e.id === body.restoreFrom) || false : null);
    if (path === '/api/family/link/claim') {
      const restore = restoreOf();
      if (restore === false) return reply(route, 404, { error: 'escrow_not_found' });
      if (restore?.device) return reply(route, 409, { error: 'escrow_in_use' });
      const l = st.links[body.code];
      if (!l) return reply(route, 404, { error: 'link_not_found' });
      if (l.claimed) return reply(route, 409, { error: 'link_used' });
      const d = { id: `d${'0'.repeat(14)}${st.devices.length + 1}`, label: body.label || '', token: null };
      st.devices.push(d); l.claimed = true; l.device = d.id; l.restoreFrom = restore?.id || null; st.claimedBy = token;
      return reply(route, 200, { ok: true, device: { id: d.id, label: d.label } });
    }
    if (path === '/api/family/devices/this') {
      const restore = restoreOf();
      if (restore === false) return reply(route, 404, { error: 'escrow_not_found' });
      if (restore?.device) return reply(route, 409, { error: 'escrow_in_use' });
      const d = { id: `d${'0'.repeat(14)}${st.devices.length + 1}`, label: body.label || '', token: `fd1.${'e'.repeat(64)}` };
      st.devices.push(d); st.sessions.delete(token);
      if (restore) restore.device = d.id;
      return reply(route, 200, { deviceToken: d.token, label: d.label, ...(restore && st.vaults[restore.lookup] ? { vault: { code: restore.code } } : {}) });
    }
    // ---- the parent's view of each device's progress (PARENTS-5)
    if (path === '/api/family/summary' && req.method() === 'GET') {
      const devices = st.devices.filter((d) => d.token).map((d) => ({
        id: d.id, label: d.label, linkedAt: d.linkedAt || '2026-11-05T09:00:00Z', lastSeen: '2026-11-05', sharing: summaryOf(d), sharingAt: d.sharingAt || null,
        lastSync: d.lastSync || null,
        // the last `days` days, counted from the tests' day (helpers.js NOW), as the Worker counts from its own today
        days: Object.values(st.summaries[d.id] || {}).filter((r) => r.d >= shiftDay(st.today, -((Number(url.searchParams.get('days')) || 56) - 1))).sort((a, b) => (a.d < b.d ? -1 : 1)),
        kept: (() => { const ds = Object.keys(st.summaries[d.id] || {}).sort(); return { n: ds.length, from: ds[0] || null, to: ds.at(-1) || null }; })(),
      }));
      return reply(route, 200, { retentionDays: 90, days: Number(url.searchParams.get('days')) || 56, devices });
    }
    const ds = path.match(/^\/api\/family\/devices\/([a-z0-9]+)\/(sharing|history\/delete)$/);
    if (ds) {
      const d = st.devices.find((x) => x.id === ds[1]);
      if (!d) return reply(route, 404, { error: 'not_found' });
      if (ds[2] === 'sharing') {
        if (typeof body.on !== 'boolean') return reply(route, 400, { error: 'bad_sharing' });
        d.shareParent = body.on;
        return reply(route, 200, { sharing: summaryOf(d) });
      }
      const deleted = Object.keys(st.summaries[d.id] || {}).length;
      delete st.summaries[d.id];
      return reply(route, 200, { ok: true, deleted });
    }
    if (path === '/api/account/report-email') {
      if (typeof body.on !== 'boolean') return reply(route, 400, { error: 'bad_report_email' });
      if (body.on && (!st.paywall || !st.report)) return reply(route, 503, { error: 'report_off' });
      st.reportEmail = body.on;
      return reply(route, 200, { reportEmail: body.on });
    }
    if (path === '/api/report/feedback') {
      if (typeof body.useful !== 'boolean') return reply(route, 400, { error: 'bad_feedback' });
      if (st.feedback.some((f) => f.token === token)) return reply(route, 429, { error: 'already_answered' });
      st.feedback.push({ token, useful: body.useful });
      return reply(route, 200, { ok: true });
    }
    if (/^\/api\/family\/devices\/[a-z0-9]+\/unlink$/.test(path)) {
      const id = path.split('/')[4];
      const d = st.devices.find((x) => x.id === id);
      // the device's escrow stays with the account ("התקדמות שמורה") while the child's switch is on; else it goes
      if (d && d.shareChild === false) st.escrows = st.escrows.filter((e) => e.device !== id);
      for (const e of st.escrows) if (e.device === id) e.device = null;
      delete st.summaries[id]; // the device's summaries go with it (PARENTS-3)
      if (d?.token) st.gone.add(d.token);
      st.devices = st.devices.filter((x) => x.id !== id); return reply(route, 200, { ok: true });
    }
    if (path === '/api/family/vaults') {
      const vaults = st.escrows.filter((e) => e.kind === 'account' && st.vaults[e.lookup]).map((e) => {
        const d = e.device && st.devices.find((x) => x.id === e.device);
        return { id: e.id, label: e.label, device: d ? { id: d.id, label: d.label } : null, updatedAt: e.updatedAt };
      });
      return reply(route, 200, { vaults });
    }
    const kd = path.match(/^\/api\/family\/vaults\/([a-z0-9]+)\/delete$/);
    if (kd) {
      if (!st.escrows.some((e) => e.kind === 'account' && e.id === kd[1])) return reply(route, 404, { error: 'not_found' });
      st.escrows = st.escrows.filter((e) => e.id !== kd[1]); return reply(route, 200, { ok: true });
    }
    // ---- the teacher
    if (path === '/api/health') return reply(route, 200, { ok: true, ai: true, email: st.email !== false, paywall: st.paywall, checkout: st.online });
    // the session's email is the one the class is bound to (or any session, when the test did not say which)
    const mine = () => signed && (!st.ownerEmail || emails.get(token) === st.ownerEmail);
    if (path === '/api/classes' && req.method() === 'POST') {
      // with a session the class is bound to its email at once; a session that has ended makes no class
      if (token && !signed) return reply(route, 401, { error: 'not_account' });
      const setting = body.setting ?? 'school';
      if (!['school', 'private'].includes(setting)) return reply(route, 400, { error: 'bad_request' });
      if (setting === 'private' && body.privateAttest !== true) return reply(route, 400, { error: 'private_attest_required' });
      st.ai = { ...st.ai, setting, studentAi: 'off', consentAt: null };
      st.className = body.className; st.classGrade = body.grade === '8' ? '8' : '7';
      if (signed) { st.owned = true; st.ownerEmail = emails.get(token) || null; }
      return reply(route, 200, { code: 'K7Q2MD', teacherKey: st.key, className: st.className, grade: st.classGrade, teacherName: body.teacherName, setting, ...(signed ? { owned: true } : {}) });
    }
    if (path === '/api/teacher/classes') {
      if (!signed) return reply(route, 401, { error: 'not_account' });
      const own = st.owned && mine() ? [{ code: 'K7Q2MD', name: st.className, grade: st.classGrade, teacherName: 'רונית', students: st.students.length, createdAt: '2026-11-01T08:00:00.000Z', boundAt: '2026-11-01T08:00:00.000Z' }] : [];
      return reply(route, 200, { classes: [...st.accountClasses, ...own] });
    }
    if (path.startsWith('/api/teacher/')) {
      // the key is checked first; else the session of the account the class is bound to; an ended session alone is not_account
      const code = h['x-class-code'];
      const gone = st.deleted.includes(code);
      const byKey = !gone && code === 'K7Q2MD' && h['x-teacher-key'] === st.key;
      const byAccount = !gone && [...(st.owned ? ['K7Q2MD'] : []), ...st.accountClasses.map((c) => c.code)].includes(code) && mine();
      if (path === '/api/teacher/class/owner') {
        if (!signed) return reply(route, 401, { error: 'not_account' });
        if (!byKey) return reply(route, 401, { error: 'not_teacher' });
        if (st.owned && !mine()) return reply(route, 409, { error: 'owned_by_other' });
        st.owned = true; st.ownerEmail = emails.get(token) || null;
        return reply(route, 200, { owner: 'you', email: emails.get(token) || 'teacher@example.test' });
      }
      if (path === '/api/teacher/class/rekey') {
        if (!signed) return reply(route, 401, { error: 'not_account' });
        if (!byAccount) return reply(route, 403, { error: 'not_owner' });
        // a late bind holds the key for 7 days (teacherAccount.js LATE_BIND_HOLD_DAYS)
        if (st.rekeyFrom) return reply(route, 409, { error: 'rekey_hold', until: st.rekeyFrom });
        if (!st.recent.has(token)) return reply(route, 401, { error: 'reauth_needed' });
        st.key = 'tkey-456';
        return reply(route, 200, { teacherKey: st.key });
      }
      if (!byKey && !byAccount) return reply(route, 401, { error: token && !signed && !h['x-teacher-key'] ? 'not_account' : 'not_teacher' });
      if (path === '/api/teacher/dashboard') {
        // the key is checked first, as requireTeacher does; a late bind is told to key devices, its hold to the owner
        const viaKey = byKey && !!h['x-teacher-key'];
        return reply(route, 200, {
          ...dashboard(code), helpDigest: byAccount && !viaKey ? st.digest : null,
          boundElsewhere: viaKey && !!st.lateBoundAt, boundAt: viaKey ? st.lateBoundAt || null : null, rekeyFrom: !viaKey ? st.rekeyFrom || null : null,
        });
      }
      const tm = path.match(/^\/api\/teacher\/help\/(\d+)(\/reply)?$/);
      if (tm) {
        const x = code === 'K7Q2MD' && st.help.find((r) => r.id === Number(tm[1]));
        if (!x) return reply(route, 404, { error: 'not_found' });
        const readStudent = () => { x.messages = x.messages.map((m) => (m.from === 'student' ? { ...m, read: true } : m)); };
        if (!tm[2]) {
          if (body.action === 'seen') x.seen_at ||= helpNow(); else if (body.action === 'done') x.done_at ||= helpNow(); else if (body.action === 'reopen') x.done_at = null;
          else return reply(route, 400, { error: 'bad_action' });
          readStudent();
          return reply(route, 200, { ok: true });
        }
        const text = String(body.body || '').trim();
        if (!text || text.length > 500) return reply(route, 400, { error: 'bad_reply' });
        if (contact(text)) return reply(route, 400, { error: 'reply_has_contact' });
        if (x.messages.filter((m) => m.from === 'teacher').length >= 3) return reply(route, 409, { error: 'reply_limit' });
        x.seen_at ||= helpNow(); readStudent();
        const message = { id: msgId += 1, from: 'teacher', body: text, at: helpNow(), read: false };
        x.messages.push(message);
        return reply(route, 201, { message });
      }
      if (path === '/api/teacher/class/digest') {
        if (!byAccount) return reply(route, 403, { error: 'not_owner' });
        if (typeof body.on !== 'boolean') return reply(route, 400, { error: 'bad_request' });
        st.digest = body.on;
        return reply(route, 200, { helpDigest: st.digest });
      }
      if (path === '/api/teacher/report') {
        const q = url.searchParams; const day = /^\d{4}-\d{2}-\d{2}$/;
        if ((q.get('from') && !day.test(q.get('from'))) || (q.get('to') && !day.test(q.get('to')))) return reply(route, 400, { error: 'bad_range' });
        return reply(route, 200, reportOf(code, q.get('from'), q.get('to')));
      }
      if (path === '/api/teacher/licence') return reply(route, 200, { ...st.licence, students: st.students.length, joinLocked: st.joinLocked });
      if (path === '/api/teacher/licence/request') {
        if (!signed) return reply(route, 401, { error: 'not_account' });
        if (body.wants !== 'quote' && cannotSell()) return reply(route, 409, { error: 'school_ai_not_approved', reason: policyOf().reason });
        st.licence = { ...st.licence, request: { wants: body.wants, at: '2026-11-05T10:00:00Z' } }; st.request = body;
        return reply(route, 200, { ok: true });
      }
      if (path === '/api/teacher/licence/claim') {
        if (cannotSell()) return reply(route, 409, { error: 'school_ai_not_approved', reason: policyOf().reason });
        if (body.code !== 'ABCD-EFGH-JK23') return reply(route, 400, { error: 'bad_licence_code' });
        st.licence = { ...st.licence, status: 'active', until: '2027-08-31T20:59:59Z', seats: 35, request: null };
        return reply(route, 200, { ok: true, until: st.licence.until, seats: 35 });
      }
      // student AI by the Ministry's rules (TRUST-11), as worker/src/classai.js decides it
      if (path === '/api/teacher/class/ai') {
        const has = (k) => body[k] !== undefined;
        if (!has('studentAi') && !has('consent') && !has('setting')) return reply(route, 400, { error: 'bad_request' });
        if ((has('studentAi') && !['on', 'off'].includes(body.studentAi)) || (has('consent') && body.consent !== true) || (has('setting') && !['school', 'private'].includes(body.setting))) return reply(route, 400, { error: 'bad_request' });
        let next = { ...st.ai };
        if (has('setting') && body.setting !== st.ai.setting) {
          if (body.setting === 'private' && body.privateAttest !== true) return reply(route, 400, { error: 'private_attest_required' });
          next = { ...next, setting: body.setting, studentAi: 'off', consentAt: null };
        }
        if (body.consent === true) next.consentAt = `${st.today}T10:00:00.000Z`;
        if (body.studentAi === 'on') {
          const p = policyOf(next);
          if (!p.canTurnOn) return reply(route, 409, { error: 'class_ai_locked', reason: p.reason });
          if (!next.consentAt) return reply(route, 409, { error: 'consent_needed' });
          next.studentAi = 'on';
        } else if (body.studentAi === 'off') next.studentAi = 'off';
        st.ai = next;
        return reply(route, 200, { policy: aiPolicy() });
      }
      const sam = path.match(/^\/api\/teacher\/students\/([a-z0-9]+)\/ai$/);
      if (sam) {
        const s = code === 'K7Q2MD' && st.students.find((x) => x.id === sam[1]);
        if (!s) return reply(route, 404, { error: 'not_found' });
        if (typeof body.off !== 'boolean') return reply(route, 400, { error: 'bad_request' });
        s.aiOff = body.off;
        return reply(route, 200, { id: s.id, aiOff: body.off });
      }
      if (path === '/api/teacher/class/lock') { st.joinLocked = !!body.locked; return reply(route, 200, { joinLocked: st.joinLocked }); }
      if (path === '/api/teacher/class/rename') {
        const name = String(body.className || '').replace(/\s+/g, ' ').trim().slice(0, 30);
        if (!name) return reply(route, 400, { error: 'missing_fields' });
        if (code === 'K7Q2MD') st.className = name; else st.accountClasses = st.accountClasses.map((c) => (c.code === code ? { ...c, name } : c));
        return reply(route, 200, { ok: true, className: name });
      }
      if (path === '/api/teacher/class/delete') {
        if (body.confirm !== 'DELETE') return reply(route, 400, { error: 'confirm_required' });
        // a class bound to an email: only its owner, with a code from the last 10 minutes
        const owned = code === 'K7Q2MD' ? st.owned : true;
        if (owned && !mine()) return reply(route, 403, { error: 'not_owner' });
        if (owned && !st.recent.has(token)) return reply(route, 401, { error: 'reauth_needed' });
        if (code === 'K7Q2MD' && ['trial', 'active', 'ending'].includes(st.licence.status)) return reply(route, 409, { error: 'class_has_licence' });
        const students = code === 'K7Q2MD' ? st.students.length : (st.accountClasses.find((c) => c.code === code)?.students || 0);
        st.deleted.push(code);
        st.accountClasses = st.accountClasses.filter((c) => c.code !== code);
        if (code === 'K7Q2MD') st.owned = false;
        return reply(route, 200, { ok: true, students });
      }
      // ---- the teacher's assignments (TEACHER-4)
      if (path === '/api/teacher/assignments' && req.method() === 'GET') {
        return reply(route, 200, { today: st.today, assignments: [...st.assignments].sort((a, b) => (a.dueOn < b.dueOn ? 1 : a.dueOn > b.dueOn ? -1 : 0)).slice(0, 60).map(viewOf) });
      }
      if (path === '/api/teacher/assignments') {
        const bad = (field) => reply(route, 400, { error: 'bad_assignment', field });
        if (!['stair', 'check', 'exam'].includes(body.kind)) return bad('kind');
        const exam = body.kind === 'exam';
        if (!exam && !/^[a-z]{2,10}:\d{1,2}$/.test(body.skill || '')) return bad('skill');
        if (exam && (!Array.isArray(body.exam?.items) || body.exam.items.length < 1 || body.exam.items.length > 14 || !['a', 'b'].includes(body.exam.version ?? 'a'))) return bad('exam');
        const raw = String(body.dueOn || '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || raw < st.today || raw > plus(st.today, 120)) return bad('dueOn');
        const targets = Array.isArray(body.targets) ? [...new Set(body.targets)] : [];
        if (targets.some((id) => !st.students.some((x) => x.id === id))) return bad('targets');
        if (st.assignments.filter((x) => x.dueOn >= plus(st.today, -14)).length >= 20) return reply(route, 409, { error: 'too_many_open' });
        let dueOn = raw; while (saturday(dueOn)) dueOn = plus(dueOn, 1);
        const a = {
          id: `a${String(st.assignments.length + 1).padStart(15, '0')}`, kind: body.kind, skill: exam ? null : body.skill, title: String(body.title || body.skill || 'מבחן תרגול').slice(0, 80),
          note: String(body.note || '').slice(0, 200), startsOn: st.today, dueOn, forAll: !targets.length, targets, createdAt: `${st.today}T10:00:00.000Z`,
          ...(exam ? { exam: JSON.parse(JSON.stringify(body.exam.items)), version: body.exam.version ?? 'a' } : {}),
        };
        st.assignments.push(a);
        return reply(route, 201, { assignment: viewOf(a), moved: dueOn !== raw });
      }
      const am = path.match(/^\/api\/teacher\/assignments\/([a-f0-9]{16})(\/delete)?$/);
      if (am) {
        const a = st.assignments.find((x) => x.id === am[1]);
        if (!a) return reply(route, 404, { error: 'not_found' });
        if (am[2]) { st.assignments = st.assignments.filter((x) => x !== a); delete st.work[a.id]; return reply(route, 200, { ok: true }); }
        if (req.method() === 'POST') {
          let moved = false;
          if (body.dueOn !== undefined) {
            const raw = String(body.dueOn);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || raw < st.today || raw > plus(st.today, 120)) return reply(route, 400, { error: 'bad_assignment', field: 'dueOn' });
            let d = raw; while (saturday(d)) d = plus(d, 1);
            a.dueOn = d; moved = d !== raw;
          }
          if (body.note !== undefined) a.note = String(body.note).slice(0, 200);
          if (body.title !== undefined) a.title = String(body.title).slice(0, 80);
          return reply(route, 200, { assignment: viewOf(a), moved });
        }
        const rank = (w) => (w?.state === 'done' ? 2 : w?.state === 'started' ? 1 : 0);
        const work = forWhom(a).map((sid) => ({ sid, name: st.students.find((x) => x.id === sid).name, w: workOf(a, sid) }))
          .sort((x, y) => rank(x.w) - rank(y.w) || x.name.localeCompare(y.name, 'he'))
          .map(({ sid, name, w }) => ({
            studentId: sid, name, state: w?.state || 'none', stage: w?.stage ?? null, right: w?.right ?? null, asked: w?.asked ?? null, passed: w?.passed ?? null,
            questions: w?.questions ?? null, tries: w?.tries || 0, startedAt: w?.startedAt || null, doneAt: w?.doneAt || null, late: lateOf(a, w),
          }));
        return reply(route, 200, { assignment: viewOf(a), exam: a.exam ? { items: a.exam } : null, work });
      }
      const rm = path.match(/^\/api\/teacher\/students\/([a-z0-9]+)\/remove$/);
      if (rm) { st.students = st.students.filter((s) => s.id !== rm[1]); return reply(route, 200, { ok: true }); }
      const pm = path.match(/^\/api\/teacher\/students\/([a-z0-9]+)(\/reset-pin)?$/);
      if (pm) {
        const s = code === 'K7Q2MD' && st.students.find((x) => x.id === pm[1]);
        if (!s) return reply(route, 404, { error: 'not_found' });
        if (pm[2]) { s.pinReset = true; return reply(route, 200, { ok: true }); }
        return reply(route, 200, pageOf(s));
      }
    }
    return reply(route, 404, { error: 'not_found' });
  };
  // the payment company's hosted page: one link pays, then goes back to the app's plain return address
  const payPage = async (route) => {
    const url = new URL(route.request().url()); const id = url.searchParams.get('order');
    if (st.orders[id] && st.failPayment) st.orders[id].status = 'expired'; // the card was declined and the order ran out
    else if (st.orders[id]) st.orders[id].paidOnPage = true;
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><p>דף התשלום לבדיקה</p><a href="${base}parents?order=${id}">חזרה לאתר</a>` });
  };
  /** The same server for another device (a second browser context). */
  const attach = async (t) => { await t.route(`${API}/**`, handler); await t.route(`${PAY}/**`, payPage); };
  await attach(target);
  return { st, log, attach };
}
