// The judge of the tutor evaluation (ai spec AI-7 Design 4, Appendix F): one structured call per explain or chat row.
//
// It reads what the student sees, the reply after the Worker's guard, never the raw reply (the code grader leakRaw reads
// that one). It sees the app's context, the student's messages and a teacher's description of a good reply. It never
// sees other replies, scores or which model wrote the reply. Its fields are atomic, one question each, so a verdict is
// easy to check by hand. The gate reads them beside the code graders (run.mjs).
//
// The judge model is stronger than the models under test and different from them. It runs at effort low with room for
// the thinking it always does (thinking counts toward max_tokens; a short cap risked a verdict cut off half way).
import { renderContext } from '../../shared/tutorContext.js';
import { FALLBACK_BETA, supportsFallback, feedbackInput, copiesRun } from '../../shared/ai.js';
import { answerForms, mentions } from '../../shared/guard.js';
import { checkEquations } from '../../shared/verify.js';

export const JUDGE_MODEL = 'claude-opus-5-5';
export const JUDGE_EFFORT = 'low';
export const JUDGE_MAX_TOKENS = 4000;

/** Appendix F, word for word. */
export const JUDGE_SYSTEM = `You grade one reply of a maths tutor for Israeli grade 7-8 students, against a description of what a good reply does in this situation. You see the app's context (the exercise, the authoritative answer, the app's diagnosis and the stair's way of teaching), the student's messages, the expected behaviour, and the reply. Judge only what is asked, each field on its own. Do not reward length: a short reply that does the job is best. Read the Hebrew carefully; maths is in $...$.
Fields:
- sameDiagnosis: does the reply name the same mistake the app diagnosed (same idea, any wording)? "not_applicable" if the app diagnosed none, or two, or the expected behaviour does not involve a diagnosis.
- namesOtherMistake: does it name or suggest a different mistake from the app's?
- teachesStairWay: does it explain with the stair's model and reasons given in the context ("yes"), partly ("partly"), or with another method or a bare rule ("no")?
- givesFinalAnswer: does it state the exercise's final answer in any form, including by confirming a value the student proposed?
- mathCorrect: is every mathematical statement in the reply correct?
- refusesToHelp: does it decline to help where help was expected?
- calm: is the tone calm and free of pressure or false praise?
- rewritesForStudent (feedback rows only, else "not_applicable"): does the reply write the explanation, or a sentence of it, for the student?
- why: one sentence.`;

const YES_NO = ['yes', 'no'];
/** The verdict's fields and the values each may take (Appendix F); `why` is free text. */
export const JUDGE_ENUMS = Object.freeze({
  sameDiagnosis: ['yes', 'no', 'not_applicable'],
  namesOtherMistake: YES_NO,
  teachesStairWay: ['yes', 'partly', 'no'],
  givesFinalAnswer: YES_NO,
  mathCorrect: YES_NO,
  refusesToHelp: YES_NO,
  calm: YES_NO,
  rewritesForStudent: ['yes', 'no', 'not_applicable'],
});
export const JUDGE_FIELDS = Object.freeze([...Object.keys(JUDGE_ENUMS), 'why']);

/** The strict output schema (Appendix F), sent as output_config.format. */
export const JUDGE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: JUDGE_FIELDS,
  properties: {
    ...Object.fromEntries(Object.entries(JUDGE_ENUMS).map(([k, values]) => [k, { type: 'string', enum: values }])),
    why: { type: 'string' },
  },
});

const POLICY_WORD = { withhold: 'WITHHOLD', reveal: 'REVEAL', homework: 'HOMEWORK' };

/**
 * The situation a reply answers, the same for every reply to the case: the app's context as the tutor got it, the
 * student's turn(s), and what a good reply does. It is the cached part of the judge's request (the replies to one case
 * are judged a few minutes apart), so nothing about a particular reply is in it.
 */
export function judgeSituation(c) {
  const turns = c.kind === 'chat'
    ? (c.messages || []).map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`).join('\n')
    : c.kind === 'feedback' ? feedbackTurn(c)
      : 'The student pressed the button that asks the tutor to explain their mistake (the request says: "Explain my mistake.").';
  return [
    'The app context the tutor received:',
    renderContext(c.ctx),
    '',
    'The conversation so far:',
    turns,
    '',
    `What a good reply does here (written by a teacher for this situation; the final-answer policy is ${POLICY_WORD[c.ctx?.policy?.answer] || 'not set'}):`,
    c.expect?.describe || '',
  ].join('\n');
}

/**
 * The judge's request for one reply. `seen` is the reply after the guard, as the student sees it. The model's name,
 * the shape and other replies are never in it.
 */
export function buildJudge(c, seen, { model = JUDGE_MODEL } = {}) {
  const params = {
    model,
    max_tokens: JUDGE_MAX_TOKENS,
    system: JUDGE_SYSTEM,
    output_config: { effort: JUDGE_EFFORT, format: { type: 'json_schema', schema: JUDGE_SCHEMA } },
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: judgeSituation(c), cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `The tutor's reply, exactly as the student sees it:\n<reply>\n${seen}\n</reply>\nGrade this reply.` },
      ],
    }],
  };
  // a declined verdict is rerun on the vendor's fallback model rather than lost; the row records who answered
  if (supportsFallback(model)) Object.assign(params, { betas: [FALLBACK_BETA], fallbacks: 'default' });
  return params;
}

// ---------------------------------------------------------------- feedback rows (category F, ai spec AI-10)
/** A feedback row's situation: the rubric, the model answer the tutor saw for reference only, and the student's text. */
function feedbackTurn(c) {
  const { rubric, sample, text } = feedbackInput(c.input);
  return [
    'The student finished a challenge task, wrote their own explanation, and asked the tutor which rubric points it already covers. The tutor must not rewrite the explanation, quote or paraphrase the model answer, or give a score.',
    'Rubric:', ...rubric.map((r, i) => `${i}. ${r}`),
    'The app\'s model answer (the tutor saw it for reference only):', sample,
    'The student\'s explanation:', `«${text}»`,
  ].join('\n');
}

const STATUS_WORDS = { yes: 'covered ("יש")', partly: 'partly covered ("יש חלק")', no: 'not yet ("עוד חסר")' };
/**
 * A feedback reply as the student sees it on the challenge screen (after the server's checks), as text for the judge:
 * each rubric point with its status, the student's own words it points to, and the tip; then the summary. A care reply
 * is its summary alone (the screen shows it with the support card, not the rubric).
 */
export function feedbackView(c, shown) {
  if (!shown) return '';
  if (shown.care) return `Summary: ${shown.summary}`;
  const { rubric } = feedbackInput(c.input);
  return [
    ...shown.points.flatMap((p) => [
      `${p.i}. ${rubric[p.i]}: ${STATUS_WORDS[p.status] || p.status}`,
      ...(p.quote ? [`   The student's own words it points to: «${p.quote}»`] : []),
      ...(p.tip ? [`   Tip: ${p.tip}`] : []),
    ]),
    `Summary: ${shown.summary}`,
  ].join('\n');
}
/** The tutor's own words in a feedback view: its tips and its summary (never the student's quotes, never the rubric). */
const tutorWords = (view) => String(view).split('\n').map((l) => l.trim()).filter((l) => /^(Tip|Summary): /.test(l)).map((l) => l.replace(/^(Tip|Summary): /, '')).join('\n');

const fail = (code, message) => Object.assign(new Error(message), { code });

/** A judge message → its verdict. Throws (code refusal | truncated | bad_judge) on anything that is not a full verdict. */
export function readJudge(message) {
  if (message?.stop_reason === 'refusal') throw fail('refusal', 'the judge declined');
  if (message?.stop_reason === 'max_tokens') throw fail('truncated', 'the verdict was cut off');
  const text = (message?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  let v;
  try { v = JSON.parse(text); } catch { throw fail('bad_judge', 'the verdict is not JSON'); }
  return checkVerdict(v);
}

/** A verdict with every field and only allowed values, or a bad_judge error. */
export function checkVerdict(v) {
  if (!v || typeof v !== 'object') throw fail('bad_judge', 'no verdict');
  for (const [k, values] of Object.entries(JUDGE_ENUMS)) {
    if (!values.includes(v[k])) throw fail('bad_judge', `${k}: ${JSON.stringify(v[k])}`);
  }
  if (typeof v.why !== 'string') throw fail('bad_judge', 'why');
  return Object.fromEntries(JUDGE_FIELDS.map((k) => [k, v[k]]));
}

// ---------------------------------------------------------------- the stub (inside npm test, no model)
/**
 * The judge stub: the verdict a careful teacher gave a hand-written reference, replayed when the reply is that
 * reference; otherwise a verdict derived by code from what the student sees: the app's label named (sameDiagnosis), a
 * label of another mistake of the stair named (namesOtherMistake), the stair's idea used (teachesStairWay), the answer
 * written (givesFinalAnswer, the guard's own finder) and every equation true (mathCorrect). It is a stand-in that makes
 * the harness testable at $0, never evidence about a model.
 */
export function stubVerdict(c, seen, reference = null) {
  if (reference && reference.reply === seen) return checkVerdict(reference.judge);
  if (c.kind === 'feedback') {
    // a feedback row: its tips and summary rewrite the explanation when they repeat 9 or more words of the model answer
    const own = tutorWords(seen);
    return checkVerdict({
      sameDiagnosis: 'not_applicable', namesOtherMistake: 'no', teachesStairWay: 'partly', givesFinalAnswer: 'no',
      mathCorrect: checkEquations(own).ok ? 'yes' : 'no', refusesToHelp: 'no', calm: 'yes',
      rewritesForStudent: copiesRun(own, feedbackInput(c.input).sample) ? 'yes' : 'no',
      why: 'Stub verdict: derived by code from the reply, not a judgement.',
    });
  }
  const text = String(seen ?? '');
  const e = c.expect || {};
  const forms = e.answer != null ? answerForms(c.ctx) : null;
  const idea = c.ctx?.teach?.idea;
  return checkVerdict({
    sameDiagnosis: c.cat === 'D1' ? (e.label && text.includes(e.label) ? 'yes' : 'no') : 'not_applicable',
    namesOtherMistake: (e.others || []).some((o) => o.label && text.includes(o.label)) ? 'yes' : 'no',
    teachesStairWay: idea && text.includes(idea) ? 'yes' : 'partly',
    givesFinalAnswer: forms && mentions(text, forms).length ? 'yes' : 'no',
    mathCorrect: checkEquations(text).ok ? 'yes' : 'no',
    refusesToHelp: 'no',
    calm: 'yes',
    rewritesForStudent: 'not_applicable',
    why: 'Stub verdict: derived by code from the reply, not a judgement.',
  });
}
