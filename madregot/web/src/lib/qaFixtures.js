// Mocked tutor and parent states for the staging copy, which has no server (VITE_QA_HOOKS=1, or the debug flag on a
// test device). A link with ?qa-ai=<state> or ?qa-parent=<state> (in the address or after the #) renders that state
// with no request at all, so every state can be screenshotted. The choice is kept for the visit (sessionStorage).
//   qa-ai:      free2 | free1 | free0 | family | family-off | family-parent-off | class | shared | paused | economy | ended
//               (family: the parents' summary on; family-off: the child stopped it; family-parent-off: the parents did)
//   qa-parent:  signed-out | code | plans | confirming | active | refund-window | canceled | past_due | economy | pass | nosrv
//               report | report-empty | report-off (each device's progress: components/report/qaFamily.js)
//   qa-teacher: demo (the demo class of TEACHER-15, lib/demo.js: every teacher screen with no request)
//   qa-report:  week | empty (the weekly summary from a fixed week and clock: components/report/qaWeek.js)
//   qa-goal:    mid | reached | off   (the class goal of the week, STUDENT-4: shown with or without a class)
// The family state's tablet (qa-ai=family names it 'הטאבלט') keeps its backup code with the family, and an older phone's
// progress is kept in the account (DURABLE-6): every parents state with a plan lists both, so the device line, the kept
// list and the "continue from" choice can be seen without a server.
import { AI_KINDS, FREE_KINDS } from '@shared/aiKinds.js';
import { qaOn } from './qa.js';
// The tutor's canned answers (qaReply) and the parents page's states (qaParentView) are in lib/qaViews.js: only the
// tutor (lib/ai.js) and the parents page read them, so the first load does not carry them (budget.json lazyOnly).

const AI_STATES = ['free2', 'free1', 'free0', 'family', 'family-off', 'family-parent-off', 'class', 'shared', 'paused', 'economy', 'ended'];
const TEACHER_STATES = ['demo'];
const PARENT_STATES = ['signed-out', 'code', 'plans', 'confirming', 'active', 'refund-window', 'canceled', 'past_due', 'economy', 'pass', 'nosrv', 'report', 'report-empty', 'report-off', 'report-old'];
const REPORT_STATES = ['week', 'empty'];

function param(name, allowed) {
  if (typeof window === 'undefined' || !qaOn()) return null;
  let v = null;
  try {
    const hashQuery = window.location.hash.split('?')[1] || '';
    v = new URLSearchParams(window.location.search).get(name) || new URLSearchParams(hashQuery).get(name);
    if (v && allowed.includes(v)) sessionStorage.setItem(`madregot-${name}`, v);
    else v = sessionStorage.getItem(`madregot-${name}`);
  } catch { /* storage blocked */ }
  return v && allowed.includes(v) ? v : null;
}

export const qaAI = () => param('qa-ai', AI_STATES);
/**
 * ?qa-throw=render (DURABLE-9): the profile throws while it renders, so the error report, the error screen and
 * "מידע לתמיכה" can be tested. Read from the address only (never kept for the visit), and only where the hooks are on.
 */
export function qaThrow() {
  if (typeof window === 'undefined' || !qaOn()) return null;
  const hashQuery = window.location.hash.split('?')[1] || '';
  const v = new URLSearchParams(window.location.search).get('qa-throw') || new URLSearchParams(hashQuery).get('qa-throw');
  return v === 'render' ? v : null;
}

export const qaGoal = () => param('qa-goal', ['mid', 'reached', 'off']);

/** The class goal in a QA state, as GET /api/class/goal would answer it in the week that starts on `week`. */
export function qaGoalView(week, lastWeek) {
  switch (qaGoal()) {
    case 'mid': return { on: true, week, target: 60, have: 23, mine: 4, reached: false, last: { week: lastWeek, target: 55, have: 61, reached: true, mine: 7 } };
    case 'reached': return { on: true, week, target: 60, have: 64, mine: 9, reached: true, last: null };
    case 'off': return { on: false };
    default: return null;
  }
}
export const qaParent = () => param('qa-parent', PARENT_STATES);
export const qaTeacher = () => param('qa-teacher', TEACHER_STATES);
/** The weekly summary's QA week (PARENTS-2): 'week' | 'empty' | null. */
export const qaReport = () => param('qa-report', REPORT_STATES);
export const qaActive = () => !!qaAI();

// the next midnight, as the server sends it (a day ahead is close enough for screenshots)
const dayEnd = () => new Date(Date.now() + 864e5).toISOString();
const groups = (tutor, rest = null) => ({ tutor, check: rest, generate: rest, exam: rest });

/** The status the server would send in each state. */
export function qaStatus() {
  const s = qaAI();
  if (!s) return null;
  const free = (left) => ({ paywall: true, tier: 'free', kinds: [...FREE_KINDS], groups: groups({ left, limit: 2 }), economy: false, shared: null, resetsAt: dayEnd(), linked: null, legacyUntil: null, aiReady: true });
  const all = [...AI_KINDS];
  const S = {
    free2: free(2), free1: free(1), free0: free(0),
    family: { ...free(0), tier: 'family', kinds: all, groups: { tutor: { left: 27, limit: 30 }, check: { left: 6, limit: 6 }, generate: { left: 5, limit: 5 }, exam: { left: 2, limit: 2, monthLeft: 9 } }, linked: { label: 'הטאבלט', summary: 'on' } },
    class: { ...free(0), tier: 'class', kinds: all, groups: { tutor: { left: 18, limit: 20 }, check: { left: 3, limit: 3 }, generate: { left: 3, limit: 3 }, exam: { left: 1, limit: 1 } } },
    shared: { ...free(2), shared: 'network' },
    paused: { ...free(2), shared: 'paused' },
    economy: { ...free(0), tier: 'family', kinds: [...FREE_KINDS], economy: true, groups: groups({ left: 20, limit: 30 }), linked: { label: 'הטאבלט', summary: 'on' } },
    ended: free(2),
  };
  // the parents' summary switched off on the device, or by the parents (PARENTS-4)
  S['family-off'] = { ...S.family, linked: { label: 'הטאבלט', summary: 'child_off' } };
  S['family-parent-off'] = { ...S.family, linked: { label: 'הטאבלט', summary: 'parent_off' } };
  return { status: S[s], ended: s === 'ended' };
}
