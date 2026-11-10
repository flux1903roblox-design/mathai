// What the tutor is told, built on the device from what the app already knows (ai spec AI-1 Design 3-6). One pure
// builder serves every surface: the lesson (explain, chat), the notebook's photo check, the assistant, the review of a
// checked exam. It returns the version-2 context the server renders into a system block (shared/tutorContext.js):
//
//   - the exercise and its answer, as the app computed them, with the app's worked solution;
//   - each wrong answer with the app's diagnosis, recomputed from the item (item.diagnosis for the stairs' diagnostic
//     models, item.diag for the generators) and labelled with catLabel, the name the student saw;
//   - the lines the screen showed ("מה כנראה קרה: …", the hint, the first step), from the same functions the screen uses;
//   - the stair's own teaching (idea, why, other ways) and that misconception's cause and explanation;
//   - a learner summary that is pedagogical only: no name, class, device, date or anything the student typed;
//   - the final-answer policy for this surface and phase (AI-3 enforces it).
//
// Every string is clipped here with the server's own limits, so what leaves the device is already what the server keeps.
import { TOPIC, catLabel, answerText, itemPlain, diagnosisLine } from '@/content/index.js';
import { contentOf } from '@/learn/content/index.ts';
import { skillId, parseSkill, ancestorsOf } from '@/learn/skills.ts';
import { masteryState, STATE_LABEL } from '@/learn/mastery.ts';
import { openMisconceptions, slipOf } from '@/learn/misconceptions.ts';
import { CLIP, CTX_VERSION, SURFACES } from '@shared/tutorContext.js';

export { CTX_VERSION };

/** Independent answers the learner summary counts (the same filter as independentAccuracy). */
export const RECENT_N = 10;
const PHASES = ['answer', 'retry', 'reveal', 'correct'];
const ANSWER_FROM = ['app', 'key', 'ai'];

const clip = (s, n) => String(s ?? '').trim().slice(0, n);
const lines = (list, max, n) => (Array.isArray(list) ? list : []).map((x) => clip(x, n)).filter(Boolean).slice(0, max);
/** Drop the keys whose value is undefined (the context holds only what is known). */
const tidy = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

// ---------------------------------------------------------------- the policy (AI-3 defines and enforces it)
const WHY = {
  withhold: 'The student is still solving this exercise and has not seen its answer.',
  reveal: 'The app already shows the answer and the worked solution.',
  homework: "The student's own question: the app does not know its answer.",
  exam: 'A checked exam: the answer and the result are on the screen.',
};
/** The final-answer policy of a surface in a phase: the assistant is homework, a checked exam reveal, a lesson by phase. */
export function policyFor(surface, phase) {
  if (surface === 'assistant') return { answer: 'homework', why: WHY.homework };
  if (surface === 'exam-review') return { answer: 'reveal', why: WHY.exam };
  return phase === 'reveal' || phase === 'correct' ? { answer: 'reveal', why: WHY.reveal } : { answer: 'withhold', why: WHY.withhold };
}

// ---------------------------------------------------------------- one wrong answer
/** The result of a wrong answer as the lesson computes it (lib/lesson.js answer()): { cat, diagnosis }. */
export const resultOf = (item, u) => ({
  cat: typeof item?.diag === 'function' ? item.diag(u) ?? null : null,
  diagnosis: typeof item?.diagnosis === 'function' ? item.diagnosis(u) ?? null : null,
});

/**
 * A wrong answer as the tutor gets it: the value as the screen writes it, and the app's diagnosis. A stair's diagnostic
 * model knows every misconception that predicts the number (ambiguous when more than one does) and calls a near miss a
 * slip; a generator names one category. 'unknown': the app looked, and no known mistake fits.
 */
export function describeWrong(item, u) {
  const value = clip(answerText(item, u), CLIP.answer);
  const label = (id) => clip(catLabel(item.topic, item.level, id) || id, CLIP.label);
  const misc = (ids, ambiguous) => ({ value, kind: 'misconception', ids, labels: ids.map(label), ambiguous });
  const { cat, diagnosis: d } = resultOf(item, u);
  if (d) {
    if (d.kind === 'misconception' && d.candidates?.length) return misc(d.candidates.slice(0, CLIP.labelsPer).map((c) => c.id), d.ambiguous === true);
    if (d.kind === 'slip') return { value, kind: 'slip', slip: d.why };
    return { value, kind: 'unknown' };
  }
  if (cat) return misc([cat], false);
  // a generator's number: a slip of the hand is still a slip (the same rule as the diagnostic models)
  if (item.form === 'num' && typeof u === 'number' && typeof item.answer === 'number') {
    const slip = slipOf(u, item.answer);
    if (slip) return { value, kind: 'slip', slip };
  }
  return { value, kind: 'unknown' };
}

// ---------------------------------------------------------------- the learner, pedagogical only
const openEntry = (r) => {
  const { topic, level } = parseSkill(r.skill);
  const label = catLabel(topic, level, r.id);
  return label ? { skill: r.skill, label: clip(label, CLIP.label), state: r.state } : null;
};

/**
 * What the student's record says about this stair, for choosing what to stress: how the stair is going (STATE_LABEL),
 * right of the last RECENT_N independent answers, open misconceptions of this stair and then of the stairs it leans on
 * (at most 3), the mistakes repeated in this lesson, and the teaching stages done. With no stair (the assistant), only
 * the 3 strongest open misconceptions. Never a name, a class, a device, a date or anything the student typed.
 */
export function learnerSummary(learn, skill, sCats = {}, now = new Date().toISOString()) {
  const open = openMisconceptions(learn?.miscon || {});
  if (!skill) return { open: open.map(openEntry).filter(Boolean).slice(0, CLIP.open) };
  const order = [skill, ...ancestorsOf(skill)];
  const mine = order.flatMap((sk) => open.filter((r) => r.skill === sk)).map(openEntry).filter(Boolean).slice(0, CLIP.open);
  const rec = learn?.skills?.[skill];
  const recent = (rec?.attempts || []).filter((a) => a.independent && a.purpose !== 'guided').slice(-RECENT_N);
  const { topic, level } = parseSkill(skill);
  const repeats = Object.entries(sCats || {}).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1])
    .map(([cat, n]) => ({ label: clip(catLabel(topic, level, cat) || '', CLIP.label), n })).filter((r) => r.label).slice(0, CLIP.open);
  const taught = ['A', 'B', 'C'].filter((k) => rec?.taught?.[k]);
  return tidy({
    stairState: STATE_LABEL[masteryState(rec, now)],
    recent: { right: recent.filter((a) => a.ok).length, asked: recent.length },
    open: mine,
    lessonRepeats: repeats.length ? repeats : undefined,
    taught: taught.length ? taught : undefined,
  });
}

// ---------------------------------------------------------------- the stair's teaching
function teachOf(content) {
  if (!content) return undefined;
  return { idea: clip(content.idea, CLIP.text), why: lines(content.why, CLIP.lines, CLIP.line), alt: lines(content.alt, CLIP.lines, CLIP.line) };
}

function misconOf(content, id, remedy) {
  const m = content?.misconceptions.find((x) => x.id === id);
  if (!m) return null;
  return { id, label: clip(catLabel(content.topic, content.level, id) || m.title, CLIP.label), cause: clip(m.cause, CLIP.line), explain: lines(m.explain, CLIP.lines, CLIP.line), remedy };
}

// ---------------------------------------------------------------- the surfaces
function lessonContext({ surface, item, s = {}, last, spec, guide = false, learn, grade, now }) {
  const topicId = item.topic || spec?.topic || s.topic;
  const level = item.level || spec?.level || s.level;
  const T = TOPIC[topicId];
  const skill = skillId(topicId, level);
  const content = contentOf(skill);
  // a check's wrong answers span its questions, and a check has no tutor: only practice answers are this exercise's
  const wrong = s.kind === 'check' ? [] : (s.wrong || []).slice(0, CLIP.answers);
  const phase = PHASES.includes(s.phase) ? s.phase : 'answer';
  const answers = wrong.map((u) => describeWrong(item, u));
  // the misconception the app explains: the newest answer with one clear mistake the stair knows
  const one = [...answers].reverse().find((a) => a.kind === 'misconception' && !a.ambiguous && a.ids.length === 1 && content?.misconceptions.some((m) => m.id === a.ids[0]));
  // the screen offers its repair ("בואו נראה את זה אחרת") for the newest result, as Lesson renders it
  const latest = last && !last.invalid && 'cat' in last ? last : wrong.length ? resultOf(item, wrong.at(-1)) : null;
  const offered = !!one && (phase === 'retry' || phase === 'reveal') && latest?.cat === one.ids[0] && (phase !== 'retry' || !latest.diagnosis?.ambiguous);
  // what the screen showed: the first miss's line, the hint, the first step of the solution
  const shown = [];
  if (wrong.length) { const line = diagnosisLine(topicId, level, resultOf(item, wrong[0])); if (line) shown.push(line); }
  if (s.hint && item.hint) shown.push(`רמז: ${item.hint}`);
  if (guide && item.solution?.[0]) shown.push(`איך מתחילים: ${item.solution[0]}`);
  return tidy({
    v: CTX_VERSION,
    surface,
    grade: grade || T?.grade ? String(grade || T.grade) : undefined,
    skill,
    topicId,
    topic: T?.title,
    stair: item.levelTitle || T?.levels[level - 1]?.title,
    item: tidy({
      text: clip(itemPlain(item), CLIP.text),
      form: item.form,
      answer: clip(answerText(item), CLIP.answer),
      answerFrom: 'app',
      solution: lines(item.solution, CLIP.steps, CLIP.step),
      hint: item.hint ? clip(item.hint, CLIP.line) : undefined,
      unit: item.unit ? clip(item.unit, 40) : undefined,
    }),
    tries: { answers, phase, hinted: !!(s.hint || guide) },
    shown: shown.map((x) => clip(x, CLIP.line)).slice(0, CLIP.shown),
    miscon: one ? misconOf(content, one.ids[0], offered) : null,
    teach: teachOf(content),
    learner: learnerSummary(learn, skill, s.cats, now),
    policy: policyFor(surface, phase),
  });
}

/**
 * Where a checked exam's correct answer came from: graded by key (AI-8), or a practice exam whose questions matched the
 * app's own (its answers are the app's key); otherwise the earlier AI exam check wrote it, and it may be wrong.
 */
export function examAnswerFrom(exam, q) {
  if (q?.graded === 'key') return 'key';
  if (q?.graded === 'ai') return 'ai';
  return exam?.source === 'practice' && q?.item ? 'key' : 'ai';
}

function examContext({ exam: q, grade, answerFrom }) {
  const T = TOPIC[q.topic];
  const level = Number(q.level);
  const skill = T && Number.isInteger(level) && level >= 1 && level <= T.levels.length ? skillId(q.topic, level) : null;
  const content = skill ? contentOf(skill) : null;
  // our own exercise when the exam was ours (a drawn item cannot be printed, so it is never there); else the transcription
  const text = q.item && q.item.form !== 'manip' ? itemPlain(q.item) : q.prompt;
  const typed = clip(q.studentAnswer, CLIP.answer);
  return tidy({
    v: CTX_VERSION,
    surface: 'exam-review',
    grade: grade ? String(grade) : undefined,
    skill: skill || undefined,
    topicId: T ? q.topic : undefined,
    topic: T?.title,
    stair: skill ? T.levels[level - 1].title : undefined,
    item: tidy({ text: clip(text, CLIP.text), answer: clip(q.correctAnswer, CLIP.answer), answerFrom: ANSWER_FROM.includes(answerFrom) ? answerFrom : 'ai' }),
    // the answer the exam check read from the page: not diagnosed by the app
    tries: { answers: typed ? [{ value: typed }] : [], phase: 'reveal', hinted: false },
    teach: teachOf(content),
    policy: policyFor('exam-review'),
  });
}

/**
 * The tutor's context for one surface:
 *   lesson, notebook  { item, s, last?, spec?, guide?, learn, grade, now }: the exercise on screen and the lesson state
 *                     (last: the result the screen shows; its cat decides the repair button, as the screen does)
 *   assistant         { grade, learn }: the student's own question, so the learner summary only (policy homework)
 *   exam-review       { grade, exam: the question, answerFrom }: a checked exam's question (policy reveal)
 */
export function buildTutorContext(opts = {}) {
  const surface = SURFACES.includes(opts.surface) ? opts.surface : 'lesson';
  if (surface === 'exam-review' && opts.exam) return examContext(opts);
  if ((surface === 'lesson' || surface === 'notebook') && opts.item) return lessonContext({ ...opts, surface });
  return tidy({
    v: CTX_VERSION,
    surface: 'assistant',
    grade: opts.grade ? String(opts.grade) : undefined,
    learner: learnerSummary(opts.learn, null),
    policy: policyFor('assistant'),
  });
}
