// When the browser's storage is full, the save is made smaller once before giving up on it (DURABLE-1). Only what can
// be lost without changing anything the app teaches or counts goes: the oldest half of the analytics log, the long
// written feedback of old checked exams (their questions, answers and scores stay), and old printable practice exams.
// Skills, attempts, mastery, misconceptions, days, the path, progress, XP and the class outbox stay whole.

/** Analytics events kept when compacting (the log itself keeps up to MAX_EVENTS, 3,000). */
export const KEEP_EVENTS = 1500;
/** Checked exams (newest first) that keep their written feedback and worked solutions. */
export const KEEP_EXAM_FEEDBACK = 10;
/** Printable practice exams kept (newest first). */
export const KEEP_PRACTICE_EXAMS = 5;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** A smaller copy of the store's state; the state given is not changed. */
export function compactForQuota(state) {
  if (!isObj(state)) return state;
  const out = { ...state };
  if (isObj(state.learn) && Array.isArray(state.learn.events) && state.learn.events.length > KEEP_EVENTS) {
    out.learn = { ...state.learn, events: state.learn.events.slice(-KEEP_EVENTS) }; // the log grows at its end
  }
  if (Array.isArray(state.exams) && state.exams.length > KEEP_EXAM_FEEDBACK) {
    out.exams = state.exams.map((ex, i) => {
      if (i < KEEP_EXAM_FEEDBACK || !Array.isArray(ex?.result?.questions)) return ex;
      return { ...ex, result: { ...ex.result, questions: ex.result.questions.map((q) => (isObj(q) ? { ...q, feedback: null, solution: null } : q)) } };
    });
  }
  if (Array.isArray(state.practiceExams) && state.practiceExams.length > KEEP_PRACTICE_EXAMS) {
    out.practiceExams = state.practiceExams.slice(0, KEEP_PRACTICE_EXAMS);
  }
  return out;
}
