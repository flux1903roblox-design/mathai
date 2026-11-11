// The teacher's work, on a student's device (spec TEACHER-5 §2): the list the server keeps for this student, and the
// reports of what they did on it. Everything here needs a class token and a server; without them it does nothing.
//
//   fetchClassWork()   GET /api/class/work, kept in the store (it shows offline too); at most every 5 minutes
//   reportWork(id, r)  a report joins workOutbox (merged with the same monotonic rules as the server) and is sent
//   flushWork()        sends each waiting report: confirmed (200) it leaves the outbox; a lost connection keeps it;
//                      404 (the teacher deleted it) or 400 drops it
//   reportStairs()     a stair the teacher gave reports its stage and done state, from the learning record
//   fetchExamItems(id) a class exam's frozen questions, kept on the device (classWork.exams)
//
// The reports are idempotent and never go backwards (worker/src/assignments.js postWork), so sending one again, late
// or out of order is safe.
import { useApp } from './store.js';
import { api, hasServer } from './api.js';
import { mergeWork, workFromLearn, adds } from '@/learn/assignments.ts';

const EVERY = 5 * 60_000;
// what the screens show (and the plan reads): pure, in lib/classRows.js
export { SHOWN, classAssignments, dueLine, workBanner, workRoute, EXAM_MIN_PER_Q, classRows, hasNewWork, urgentWork, urgentText } from './classRows.js';

const ready = () => { const p = useApp.getState().profile; return p?.role === 'student' && !!p.token && hasServer(); };

let fetching = null;
/** The class's work for this student. `force`: even if it was asked less than 5 minutes ago. */
export function fetchClassWork({ force = false } = {}) {
  if (!ready()) return Promise.resolve(null);
  if (fetching) return fetching;
  const last = useApp.getState().classWork?.at;
  if (!force && last && Date.now() - Date.parse(last) < EVERY) return Promise.resolve(null);
  fetching = api('/api/class/work').then((r) => {
    const cur = useApp.getState().classWork;
    useApp.setState({ classWork: {
      ...cur, at: new Date().toISOString(), today: r.today || null, teacherName: r.teacherName || '',
      assignments: Array.isArray(r.assignments) ? r.assignments : [], help: Array.isArray(r.help) ? r.help : [],
    } });
    return r;
  }, () => null).finally(() => { fetching = null; });
  return fetching;
}

/**
 * A class exam's questions (GET /api/class/work/:id/exam), kept in classWork.exams so the exam opens again offline.
 * Only the exams still in the list are kept. Resolves to the items, or rejects with the ApiError (404: not this
 * student's, or deleted).
 */
export async function fetchExamItems(id) {
  const cached = useApp.getState().classWork?.exams?.[id];
  if (cached?.length) return cached;
  if (!ready()) throw Object.assign(new Error('offline'), { status: 0 });
  const r = await api(`/api/class/work/${id}/exam`);
  const items = Array.isArray(r?.items) ? r.items : [];
  const cw = useApp.getState().classWork;
  const live = new Set((cw.assignments || []).map((a) => a.id));
  const exams = Object.fromEntries(Object.entries(cw.exams || {}).filter(([k]) => live.has(k)));
  useApp.setState({ classWork: { ...cw, exams: { ...exams, [id]: items } } });
  return items;
}

/** What is sent: the report's own fields (the device's time of a done report stays on the device). */
const wire = (rep) => Object.fromEntries(Object.entries(rep).filter(([k, v]) => k !== 'doneAt' && v != null));

/** A report confirmed (with the server's copy) or refused for good: it leaves the outbox unless a newer one joined it. */
function settle(id, sent, mine) {
  const st = useApp.getState();
  const box = { ...st.workOutbox };
  if (box[id] === sent) delete box[id];
  const cw = st.classWork;
  const assignments = mine ? cw.assignments.map((a) => (a.id === id ? { ...a, mine } : a)) : cw.assignments;
  useApp.setState({ workOutbox: box, classWork: { ...cw, assignments } });
}

let flushing = null; let again = false;
/** Send every waiting report, one at a time; a call while sending runs one more round after it. */
export function flushWork() {
  if (flushing) { again = true; return flushing; }
  flushing = (async () => {
    do {
      again = false;
      if (!ready()) return;
      for (const [id, rep] of Object.entries(useApp.getState().workOutbox || {})) {
        let r;
        try {
          r = await api(`/api/class/work/${id}`, { method: 'POST', body: wire(rep) });
        } catch (e) {
          if (e?.status === 404 || e?.status === 400) { settle(id, rep, null); continue; }
          return; // no connection, a busy server, a class token that ended: the reports wait for the next time
        }
        settle(id, rep, r?.mine || null);
      }
    } while (again);
  })().finally(() => { flushing = null; });
  return flushing;
}

/** A report of what the student did on an assignment: it waits in the outbox until the server has it. */
export function reportWork(id, report) {
  if (!ready() || !id || !report?.state) return Promise.resolve();
  const st = useApp.getState();
  const rep = report.state === 'done' && !report.doneAt ? { ...report, doneAt: new Date().toISOString() } : report;
  useApp.setState({ workOutbox: { ...st.workOutbox, [id]: mergeWork(st.workOutbox[id], rep) } });
  return flushWork();
}

/** The stairs the teacher gave: each reports its stage and done state when that adds to what the server has. */
export function reportStairs() {
  if (!ready()) return Promise.resolve();
  const st = useApp.getState();
  const sent = (st.classWork?.assignments || []).filter((a) => a.kind === 'stair').map((a) => {
    const w = workFromLearn(a, st.learn);
    return adds(mineOf(a, st.workOutbox), w) ? reportWork(a.id, w) : null;
  }).filter(Boolean);
  return Promise.all(sent);
}

/**
 * The assignment a mastery check counts for: the one its address names, else an open check the teacher gave on the
 * same stair (a student may well start it from the map).
 */
export function checkAssignment(skill, id) {
  if (!ready()) return null;
  if (id) return id;
  const st = useApp.getState();
  const a = (st.classWork?.assignments || []).find((x) => x.kind === 'check' && x.skill === skill && mineOf(x, st.workOutbox)?.state !== 'done');
  return a?.id || null;
}

/** When the student opened the missions tab: work given before that is no longer new. */
export function markSeen() {
  if (!ready()) return;
  const cw = useApp.getState().classWork;
  useApp.setState({ classWork: { ...cw, seenAt: new Date().toISOString() } });
}

// ---------------------------------------------------------------- what the screens show (the rest is lib/classRows.js)
/** The work as this device knows it: the server's copy with any report still waiting. */
export const mineOf = (a, box = useApp.getState().workOutbox || {}) => mergeWork(a.mine, box[a.id]);
