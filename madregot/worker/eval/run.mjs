#!/usr/bin/env node
// The tutor evaluation's runner (ai spec AI-7 Design 5-8, AI-9). One command runs every case of cases.json against the
// tutor through the app's own entry points, grades each reply in code and with the judge, and writes a summary with the
// gate the paid tutor must pass before it goes live.
//
//   npm run eval:estimate                    the cost estimate, nothing sent
//   npm run eval:tutor -- --yes              the real run (needs ANTHROPIC_API_KEY; --yes is required for any real call)
//   npm run eval:tutor -- --stub fixtures    no model, $0: hand-written references and a code judge (npm test runs it)
//   npm run eval:tutor -- --publish <out>    copies a passing run's summary.md and results.jsonl into qa-evidence/
//
// What production runs, the runner runs: buildRequest (shared/ai.js) builds every request, the SDK sends it with the
// same params, and the reply goes through the Worker's final-answer guard before the judge reads it (graders.js
// guardReply: a chat in pieces through streamGuard, an explain through guardResult, MASK_NOTE once). The only thing
// changed on a request is effort, and only on the sweep arms that measure the two open effort choices. A generate row
// (category G) runs generateVerified (shared/ai.js), the Worker's own path: the rewrite on the paid model, the blind solve
// on the low-cost model, and the code checks; it is graded in code only (no judge).
//
// Infrastructure failures (the API after its retries, a timeout, a model other than the one asked for, a judge that
// gave no verdict, a grader that threw) go to errors.jsonl and are never counted as fails. --publish refuses a run with
// any error, a failed gate, a stub run, or a run narrowed by --only, --shapes or --judge none.
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Anthropic, { APIConnectionError, APIUserAbortError } from '@anthropic-ai/sdk';
import { buildRequest, splitCare, generateVerified, BLIND_SYSTEM, DEFAULT_MODEL, LITE_MODEL, LITE_EFFORT, CHAT_EFFORT } from '../../shared/ai.js';
import { answerForms, findLeaks } from '../../shared/guard.js';
import { priceOf, priceFor } from '../src/spend.js';
import { gradeRow, gradeGenerate, guardReply, SHAPE_WORDS } from './graders.js';
import { JUDGE_MODEL, buildJudge, readJudge, stubVerdict } from './judge.js';

export const EVAL_DIR = path.dirname(fileURLToPath(import.meta.url));
/** Where --publish copies a passing run: madregot/qa-evidence/tutor-eval/<run stamp>/. */
export const PUBLISH_ROOT = path.resolve(EVAL_DIR, '..', '..', 'qa-evidence', 'tutor-eval');

export const SHAPES = Object.freeze(['full', 'lite', 'economy']);
export const EFFORTS = Object.freeze(['low', 'medium', 'high', 'xhigh', 'max']);
export const DEFAULTS = Object.freeze({
  reps: 3, shapes: SHAPES, only: null, judge: JUDGE_MODEL,
  modelFull: DEFAULT_MODEL, modelLite: LITE_MODEL, effortChat: CHAT_EFFORT, effortLite: LITE_EFFORT,
  sweep: true, budgetUsd: 25, concurrency: 4, stub: null, out: null, yes: false,
});
/** The other level of each open effort choice (AI-6): the sweep arms run it on the same rows. */
export const SWEEP_EFFORT = 'medium';
/** The rows paid chat's effort is decided on: the withhold chats, where the guard and the prompt matter most. */
export const SWEEP_CHAT_CATS = Object.freeze(['W1', 'W2', 'W3']);
/** A cheaper effort is recommended only when it passes the gate and saves at least this share per answer. */
export const SWEEP_SAVING = 0.1;
/** Our own retries (the SDK's are off): 429, 5xx and connection errors, up to 4 more attempts after these waits. */
export const RETRY_DELAYS_MS = Object.freeze([1000, 2000, 4000, 8000]);
export const RETRY_JITTER = 0.3;
/** The wall-clock ceiling of one call, retries included (the tutor's call and the judge's each have their own). */
export const CALL_TIMEOUT_MS = 120_000;
/** How long a cached block lives: an explain that reads the cache with no explain before it in this window read what
 * another kind wrote. */
export const CACHE_WINDOW_MS = 5 * 60_000;

// ---------------------------------------------------------------- inputs
const readJson = (name) => JSON.parse(readFileSync(path.join(EVAL_DIR, name), 'utf8'));
export const loadCases = () => readJson('cases.json').cases;
export const loadReferences = () => readJson('references.json').references;

// ---------------------------------------------------------------- the command line
export const USAGE = `Usage: node eval/run.mjs [options]
  --estimate               print the cost estimate and exit (nothing is sent)
  --yes                    required for any call to the real models
  --reps <n>               repetitions of every row (default ${DEFAULTS.reps})
  --shapes <list>          full,lite,economy (default all)
  --only <list>            categories or case ids, e.g. D1,W2 (a narrowed run cannot be published)
  --judge <model>|none     the judge model (default ${DEFAULTS.judge}); none skips the judge
  --model-full <model>     the paid model under test (default ${DEFAULTS.modelFull})
  --model-lite <model>     the low-cost model under test (default ${DEFAULTS.modelLite})
  --effort-chat <level>    paid chat's effort (default ${DEFAULTS.effortChat})
  --effort-lite <level>    the free taste's and economy's effort (default ${DEFAULTS.effortLite})
  --sweep | --no-sweep     also run the open effort choices at '${SWEEP_EFFORT}' (default on)
  --budget-usd <n>         stop starting rows once this much is spent (default ${DEFAULTS.budgetUsd})
  --concurrency <n>        calls at a time (default ${DEFAULTS.concurrency})
  --stub fixtures|leaky    no model: the hand-written references, or a reply that leaks the answer ($0)
  --out <dir>              where the run is written (default eval/out/<date-time>)
  --publish <dir>          copy a passing run to qa-evidence/tutor-eval/ (refuses a failed or unclean run)`;

const list = (v) => String(v).split(',').map((s) => s.trim()).filter(Boolean);
const positive = (name, v, { int = false, max = Infinity } = {}) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > max || (int && !Number.isInteger(n))) throw new Error(`${name} needs a ${int ? 'whole ' : ''}number above 0${max < Infinity ? ` and at most ${max}` : ''}: ${v}`);
  return n;
};
const oneOf = (name, v, values) => { if (!values.includes(v)) throw new Error(`${name} must be one of ${values.join(', ')}: ${v}`); return v; };

const FLAGS = {
  '--reps': (o, v) => { o.reps = positive('--reps', v, { int: true, max: 20 }); },
  '--shapes': (o, v) => { o.shapes = list(v).map((s) => oneOf('--shapes', s, SHAPES)); },
  '--only': (o, v) => { o.only = list(v); },
  '--judge': (o, v) => { o.judge = v; },
  '--model-full': (o, v) => { o.modelFull = v; },
  '--model-lite': (o, v) => { o.modelLite = v; },
  '--effort-chat': (o, v) => { o.effortChat = oneOf('--effort-chat', v, EFFORTS); },
  '--effort-lite': (o, v) => { o.effortLite = oneOf('--effort-lite', v, EFFORTS); },
  '--budget-usd': (o, v) => { o.budgetUsd = positive('--budget-usd', v); },
  '--concurrency': (o, v) => { o.concurrency = positive('--concurrency', v, { int: true, max: 16 }); },
  '--stub': (o, v) => { o.stub = oneOf('--stub', v, ['fixtures', 'leaky']); },
  '--out': (o, v) => { o.out = v; },
  '--publish': (o, v) => { o.publish = v; },
};
const SWITCHES = {
  '--estimate': (o) => { o.estimate = true; },
  '--yes': (o) => { o.yes = true; },
  '--sweep': (o) => { o.sweep = true; },
  '--no-sweep': (o) => { o.sweep = false; },
  '--help': (o) => { o.help = true; },
  '-h': (o) => { o.help = true; },
};

/** argv (after the script name) → options. Throws on an unknown flag or a bad value. */
export function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inline] = argv[i].includes('=') ? [argv[i].slice(0, argv[i].indexOf('=')), argv[i].slice(argv[i].indexOf('=') + 1)] : [argv[i], undefined];
    if (SWITCHES[flag] && inline === undefined) { SWITCHES[flag](o); continue; }
    if (!FLAGS[flag]) throw new Error(`unknown option: ${argv[i]}`);
    const v = inline ?? argv[i + 1];
    if (inline === undefined) i += 1;
    if (v === undefined || v === '') throw new Error(`${flag} needs a value`);
    FLAGS[flag](o, v);
  }
  return o;
}

/** The options of a run, defaults filled in. */
export function resolveOptions(opts = {}) {
  const o = { ...DEFAULTS };
  for (const [k, v] of Object.entries(opts)) if (v !== undefined && k in DEFAULTS) o[k] = v;
  o.shapes = [...o.shapes];
  return o;
}

// ---------------------------------------------------------------- the plan: arms and rows
/**
 * The arms of a run: the production arms (the paid model, and the low-cost model in the free taste and economy shapes,
 * at the efforts production uses), then the sweep arms that run one open effort choice at its other level on the same
 * rows. column: which column of the gate the arm's rows answer to.
 */
export function planArms(opts) {
  const o = resolveOptions(opts);
  const arms = [];
  const add = (a) => { if (o.shapes.includes(a.shape)) arms.push(a); };
  const lite = (effort) => ({ explain: effort, chat: effort });
  add({ id: 'full', shape: 'full', model: o.modelFull, effort: { chat: o.effortChat }, column: 'full' });
  add({ id: 'lite', shape: 'lite', model: o.modelLite, effort: lite(o.effortLite), column: 'haiku' });
  add({ id: 'economy', shape: 'economy', model: o.modelLite, effort: lite(o.effortLite), column: 'haiku' });
  if (o.sweep && o.effortChat !== SWEEP_EFFORT) {
    add({ id: `full/chat-${SWEEP_EFFORT}`, shape: 'full', model: o.modelFull, effort: { chat: SWEEP_EFFORT }, column: 'full', sweep: 'chat', cats: SWEEP_CHAT_CATS, kinds: ['chat'] });
  }
  if (o.sweep && o.effortLite !== SWEEP_EFFORT) {
    add({ id: `lite/${SWEEP_EFFORT}`, shape: 'lite', model: o.modelLite, effort: lite(SWEEP_EFFORT), column: 'haiku', sweep: 'lite' });
    add({ id: `economy/${SWEEP_EFFORT}`, shape: 'economy', model: o.modelLite, effort: lite(SWEEP_EFFORT), column: 'haiku', sweep: 'lite' });
  }
  return arms;
}

const RUNNABLE = ['explain', 'chat', 'generate'];
const picked = (only, c) => !only?.length || only.includes(c.cat) || only.includes(c.id);

/**
 * Every row of a run, in the order they start: arm by arm, repetition by repetition, the chats first, then the
 * explains (so the first explains of an arm show whether a block another kind wrote is read from the cache), then the
 * generate pipelines.
 */
export function planRows(cases, opts) {
  const o = resolveOptions(opts);
  for (const c of cases) if (!RUNNABLE.includes(c.kind)) throw new Error(`${c.id}: the runner has no ${c.kind} rows yet`);
  const chosen = cases.filter((c) => picked(o.only, c));
  const rows = [];
  for (const arm of planArms(o)) {
    const mine = chosen.filter((c) => c.shapes.includes(arm.shape) && (!arm.cats || arm.cats.includes(c.cat)) && (!arm.kinds || arm.kinds.includes(c.kind)));
    const ordered = ['chat', 'explain', 'generate'].flatMap((k) => mine.filter((c) => c.kind === k));
    for (let rep = 1; rep <= o.reps; rep += 1) for (const c of ordered) rows.push({ case: c, arm, rep });
  }
  return rows;
}

/** The request of a row: production's own, with the arm's effort for the row's kind (unchanged when the arm sets none). */
export function requestFor(row) {
  const { case: c, arm } = row;
  const input = c.kind === 'generate' ? c.input : c.kind === 'chat' ? { ctx: c.ctx, messages: c.messages } : { ctx: c.ctx };
  const params = buildRequest(c.kind, input, { model: arm.model, shape: arm.shape });
  const effort = arm.effort?.[c.kind];
  if (effort) params.output_config = { ...params.output_config, effort };
  return params;
}

// ---------------------------------------------------------------- the estimate (Design 8)
/**
 * Tokens one call uses, by role, for the estimate printed before any real call: a tutor answer reads the stable block
 * from the cache (≈3.5k), sends ≈1.8k fresh (task and context) and writes ≈0.8k with its thinking; the low-cost model
 * at effort high thinks longer; the judge reads ≈3.5k and writes ≈0.3k at effort low. Refine them from the first real
 * run's summary.json (cost per row by arm).
 */
export const CALL_TOKENS = Object.freeze({
  tutor: Object.freeze({ cacheRead: 3500, input: 1800, output: 800 }),
  tutorLowCost: Object.freeze({ cacheRead: 3500, input: 1800, output: 2200 }),
  judge: Object.freeze({ input: 3500, output: 300 }),
  // a generate pipeline: the rewrite of 7 seeds (stories, hints and solutions, with thinking at medium) and the blind
  // solve of the stories on the low-cost model at high
  rewrite: Object.freeze({ cacheRead: 3500, input: 1500, output: 3000 }),
  blind: Object.freeze({ input: 600, output: 2500 }),
});
const usdOf = (model, t) => {
  const p = priceFor(model);
  return ((t.input || 0) * p.input + (t.output || 0) * p.output + (t.cacheRead || 0) * p.cacheRead + (t.cacheWrite || 0) * p.cacheWrite) / 1e9;
};
const money = (usd, d = 2) => `$${usd.toFixed(d)}`;
const perCall = (usd) => (usd >= 0.01 ? money(usd, 3) : money(usd, 4));

function estimateOnly(cases, o) {
  const rows = planRows(cases, o);
  const calls = new Map(); // `${model} (${role})` → { model, n, each }
  const count = (model, role, profile) => {
    const k = `${model} (${role})`;
    const e = calls.get(k) || { model, role, n: 0, each: usdOf(model, profile) };
    e.n += 1; calls.set(k, e);
  };
  const perRep = { full: 0, lowCost: 0, generate: 0, sweepLowCost: 0, sweepChat: 0 };
  for (const r of rows) {
    if (r.case.kind === 'generate') {
      count(r.arm.model, 'rewrite', CALL_TOKENS.rewrite);
      count(o.modelLite, 'blind solve', CALL_TOKENS.blind);
      if (r.rep === 1) perRep.generate += 1;
      continue;
    }
    count(r.arm.model, 'tutor', r.arm.shape === 'full' ? CALL_TOKENS.tutor : CALL_TOKENS.tutorLowCost);
    if (o.judge !== 'none') count(o.judge, 'judge', CALL_TOKENS.judge);
    if (r.rep !== 1) continue;
    if (!r.arm.sweep) perRep[r.arm.shape === 'full' ? 'full' : 'lowCost'] += 1;
    else perRep[r.arm.sweep === 'chat' ? 'sweepChat' : 'sweepLowCost'] += 1;
  }
  const usd = [...calls.values()].reduce((s, e) => s + e.n * e.each, 0);
  const ROLE = ['tutor', 'rewrite', 'blind solve', 'judge'];
  const byRole = [...calls.values()].sort((a, b) => ROLE.indexOf(a.role) - ROLE.indexOf(b.role));
  return { rows: rows.length, perRep, calls: byRole, usd };
}

/** The estimate for a run: { usd, low, high, rows, calls, text }. Printed by --estimate and at the start of every run. */
export function estimateRun(cases, opts = {}) {
  const o = resolveOptions(opts);
  const e = estimateOnly(cases, o);
  const quick = [
    o.sweep && `--no-sweep ≈ ${money(estimateOnly(cases, { ...o, sweep: false }).usd)}`,
    o.reps > 1 && `--reps 1 ≈ ${money(estimateOnly(cases, { ...o, reps: 1 }).usd)}`,
    o.judge !== 'none' && `--judge none ≈ ${money(estimateOnly(cases, { ...o, judge: 'none' }).usd)}`,
  ].filter(Boolean);
  const sweep = e.perRep.sweepLowCost || e.perRep.sweepChat
    ? `; sweep: +${e.perRep.sweepLowCost} low-cost and +${e.perRep.sweepChat} paid-chat rows, × ${o.reps}` : '';
  const width = Math.max(...e.calls.map((c) => `${c.model} (${c.role}):`.length), 10);
  const text = [
    `Rows: ${e.perRep.full} paid + ${e.perRep.lowCost} low-cost${e.perRep.generate ? ` + ${e.perRep.generate} generate pipelines` : ''}, × ${o.reps} repetition${o.reps > 1 ? 's' : ''}${sweep}.`,
    ...e.calls.map((c) => `${`${c.model} (${c.role}):`.padEnd(width)} ${String(c.n).padStart(4)} calls × ~${perCall(c.each)} ≈ ${money(c.n * c.each)}`),
    `Expected ≈ ${money(e.usd)} (range ${money(e.usd * 0.7)}-${money(e.usd * 1.4)}). Hard stop at --budget-usd ${o.budgetUsd}.`,
    ...(quick.length ? [`Quick options: ${quick.join(' · ')}`] : []),
  ].join('\n');
  return { usd: e.usd, low: e.usd * 0.7, high: e.usd * 1.4, rows: e.rows, calls: e.calls, text };
}

// ---------------------------------------------------------------- the stubs (Design 7)
const countWords = (t) => t.replace(/\$[^$]*\$/g, ' ⟦M⟧ ').split(/\s+/).filter((w) => /[\p{L}\p{N}⟦]/u.test(w)).length;

/**
 * The fixtures stub's reply for a case with no hand-written reference: a short good reply built from the context: the
 * app's diagnosis, the stair's idea and the first step (the hint, else the first step of the app's solution), never the
 * answer. It is cut to the strictest word limit of the case's shapes.
 */
export function genericReply(c) {
  const { ctx, expect: e } = c;
  const forms = e.answer != null ? answerForms(ctx) : null;
  const clean = (s) => (typeof s === 'string' && s.trim() && !(forms && findLeaks(s, forms).length) ? s.trim() : '');
  const first = ctx.tries?.answers?.[0];
  let lead;
  if (c.cat === 'X1') lead = 'על זה לא אדבר כאן, אבל במתמטיקה אני כאן בשבילכם. בואו נחזור לתרגיל.';
  else if (!ctx.item) lead = 'נפתור את זה יחד, צעד אחר צעד. את החישוב האחרון משאירים לכם, ואם תכתבו לי מה יצא, אבדוק אותו איתכם.';
  else if (first?.kind === 'misconception' && first.labels?.length === 1) lead = `לפי מה שהאפליקציה זיהתה: ${first.labels[0]}.`;
  else if (first?.kind === 'misconception' && first.labels?.length > 1) lead = `התשובה הזו יכולה לבוא משתי טעויות: ${first.labels[0]}, או ${first.labels[1]}.`;
  else if (first?.kind === 'slip') lead = 'הדרך נכונה, וכדאי לבדוק שוב את החישוב.';
  else lead = 'בואו נבדוק יחד את הצעד הראשון.';
  const idea = clean(ctx.teach?.idea) && `הרעיון של המדרגה: ${ctx.teach.idea}`;
  const stepText = clean(ctx.item?.hint) || clean(ctx.item?.solution?.[0]);
  const step = stepText && `הצעד הראשון: ${stepText}`;
  const close = 'עכשיו נסו את הצעד הבא בעצמכם.';
  const limit = Math.min(e.maxWords ?? Infinity, ...c.shapes.map((s) => SHAPE_WORDS[s] ?? Infinity));
  for (const parts of [[lead, idea, step, close], [lead, step, close], [lead, idea, close], [lead, close]]) {
    const t = parts.filter(Boolean).join('\n');
    if (countWords(t) <= limit) return t;
  }
  return lead;
}

/** The null baseline (--stub leaky): the final answer stated, and another mistake of the stair named. */
export const leakyReply = (c) => `התשובה היא ${c.expect.answer}. מה שקרה כאן: ${c.expect.others?.[0]?.label ?? 'טעות בחישוב'}.`;

/**
 * The stub's two answers in a generate pipeline. fixtures: every seed comes back in its own words (a drawn one kept,
 * the others as new "stories"), its solution ending at the seed's answer, and the blind solve gives each seed's answer;
 * so every story passes. leaky: every story loses the seed's numbers, so the code drops it.
 */
export function stubGenerate(stub, c, params) {
  const seeds = c.input.seeds;
  if (params.system === BLIND_SYSTEM) {
    const asked = [...String(params.messages?.[0]?.content ?? '').matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
    return JSON.stringify({ answers: asked.map((i) => ({ seed: i, answer: seeds.find((sd) => sd.i === i)?.answer ?? 'unclear' })) });
  }
  const items = seeds.map((sd) => ({
    seed: sd.i,
    prompt: stub === 'leaky' && !sd.fig ? 'סיפור חדש בלי המספרים של התרגיל.' : sd.text,
    hint: 'מתחילים מהצעד הראשון.',
    solution: ['מחשבים לפי הסדר.', `התוצאה: $= ${sd.answer}$`],
    kept: sd.fig,
  }));
  return JSON.stringify({ items });
}

/** The stub's reply to a case: its reference, else the generic reply; under leaky, the leaky reply wherever there is an answer. */
export function stubReply(stub, c, reference) {
  if (stub === 'leaky' && c.expect?.answer != null) return leakyReply(c);
  return reference?.reply ?? genericReply(c);
}

const ZERO_USAGE = Object.freeze({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
/** A client that answers like the SDK, with fixed text and no usage: the stub goes through the same call path. */
const fixedClient = (text) => ({ // text(params) → the reply's text
  beta: { messages: { create: async (params) => ({ id: 'msg_stub', type: 'message', role: 'assistant', model: params.model, stop_reason: 'end_turn', content: [{ type: 'text', text: text(params) }], usage: { ...ZERO_USAGE } }) } },
});

// ---------------------------------------------------------------- one call, with retries and a ceiling
const sleepFor = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(new Error('aborted')); return; }
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); }, { once: true });
});
const jittered = (ms) => Math.round(ms * (1 - RETRY_JITTER + Math.random() * 2 * RETRY_JITTER));

/** 429, any 5xx (529 overloaded included) and connection errors are retried; a 4xx or our own abort is not. */
export function retryable(e) {
  if (e instanceof APIUserAbortError) return false;
  if (e instanceof APIConnectionError) return true;
  const s = Number(e?.status);
  return s === 429 || s >= 500;
}
const callError = (cls, message, attempts, cause) => Object.assign(new Error(message), { class: cls, attempts, status: cause?.status });
const describe = (e) => [e?.status, String(e?.message || e).slice(0, 300)].filter(Boolean).join(' ');

/**
 * One call: the SDK's own retries off, ours on (RETRY_DELAYS_MS ± RETRY_JITTER), and a wall-clock ceiling for the call
 * with its retries (AbortController). → { message, attempts }; throws an error with class 'api' or 'timeout'.
 */
export async function callModel(client, params, { timeoutMs = CALL_TIMEOUT_MS, sleep = sleepFor, delays = RETRY_DELAYS_MS } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  let attempts = 0;
  try {
    for (;;) {
      attempts += 1;
      try {
        const message = await client.beta.messages.create(params, { signal: ac.signal, maxRetries: 0, timeout: timeoutMs });
        return { message, attempts };
      } catch (e) {
        if (ac.signal.aborted) throw callError('timeout', `no answer within ${Math.round(timeoutMs / 1000)} s`, attempts, e);
        if (!retryable(e) || attempts > delays.length) throw callError('api', describe(e), attempts, e);
        try { await sleep(jittered(delays[attempts - 1]), ac.signal); } catch { throw callError('timeout', `no answer within ${Math.round(timeoutMs / 1000)} s`, attempts, e); }
      }
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The served model must be the one asked for, unless the vendor's server-side fallback answered a declined request
 * (usage.iterations has a fallback_message entry): that is production behaviour, kept and marked. → { ok, fallback }.
 */
export function servedCheck(message, asked) {
  const fallback = (message?.usage?.iterations || []).some((it) => it?.type === 'fallback_message');
  return { ok: message?.model === asked || fallback, fallback };
}

const textOf = (message) => (message?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
const usd = (message) => priceOf(message).nano / 1e9;

// ---------------------------------------------------------------- one row
/**
 * Run one row: the tutor's call, the guard, the judge on what the student sees, and the code graders. → { result,
 * errors, spent, fatal }. A row whose tutor call failed has no result; a row whose judge failed keeps its result with
 * judge null, and the judge's failure is an error.
 */
async function runRow(row, env) {
  if (row.case.kind === 'generate') return runGenerate(row, env);
  const { case: c, arm, rep } = row;
  const where = { case: c.id, cat: c.cat, arm: arm.id, shape: arm.shape, rep, kind: c.kind };
  const errors = [];
  const params = requestFor(row);
  const startedAt = Date.now() - env.t0;
  let call;
  try {
    call = await callModel(env.tutorClient(row), params, env.call);
  } catch (e) {
    const status = Number(e.status);
    return { errors: [{ class: e.class || 'api', ...where, model: params.model, message: e.message, attempts: e.attempts }], spent: 0, fatal: status === 401 || status === 403 };
  }
  const { message, attempts } = call;
  const endedAt = Date.now() - env.t0;
  const costUsd = usd(message);
  const served = servedCheck(message, params.model);
  if (!served.ok) {
    errors.push({ class: 'model', ...where, model: params.model, message: `asked for ${params.model}, served ${message?.model}`, attempts });
    return { errors, spent: costUsd };
  }
  const status = message.stop_reason === 'refusal' ? 'refusal' : message.stop_reason === 'max_tokens' ? 'truncated' : 'ok';
  const { text: reply, care } = splitCare(textOf(message));
  const base = {
    ...where, model: params.model, served: message.model, effort: params.output_config?.effort, fallback: served.fallback, status,
    stair: !!c.ctx?.skill, withhold: c.expect?.withhold === true, ...(care ? { care: true } : {}),
    usage: message.usage || null, costUsd, latencyMs: endedAt - startedAt, attempts, startedAt, endedAt,
  };
  // a refusal is its own metric: nothing reached the student to grade
  if (status === 'refusal') {
    return { result: { ...base, reply: '', guarded: '', masked: 0, grades: {}, judge: null, judgeModel: null, judgeUsage: null, judgeCostUsd: 0 }, errors, spent: costUsd };
  }
  const guarded = guardReply(c, reply);
  const seen = guarded.text;
  let judge = null; let judgeRaw = null; let judgeModel = null; const judgeUsage = []; let judgeCostUsd = 0; let judgeFallback = false;
  // one verdict on what the student sees; when the guard masked something on a withhold row, a second one on the raw
  // reply, which only says whether the masked text was the final answer (the graders' overMask)
  const ask = async (text) => {
    const jp = buildJudge(c, text, { model: env.judge });
    try {
      const j = await callModel(env.judgeClient(row, text), jp, env.call);
      if (j.message?.usage) judgeUsage.push(j.message.usage);
      judgeCostUsd += usd(j.message);
      const js = servedCheck(j.message, jp.model);
      if (!js.ok) throw callError('judge', `asked for ${jp.model}, served ${j.message?.model}`, j.attempts);
      const v = readJudge(j.message);
      judgeModel = j.message.model; judgeFallback = judgeFallback || js.fallback;
      return v;
    } catch (e) {
      errors.push({ class: 'judge', ...where, model: jp.model, message: `${e.class && e.class !== 'judge' ? `${e.class}: ` : ''}${e.code ? `${e.code}: ` : ''}${e.message}`, attempts: e.attempts });
      return null;
    }
  };
  if (env.judge && reply.trim()) {
    judge = await ask(seen);
    if (judge && guarded.masked > 0 && c.expect?.withhold === true) {
      const raw = await ask(reply);
      if (raw) judgeRaw = { givesFinalAnswer: raw.givesFinalAnswer, why: raw.why };
    }
  }
  const g = gradeRow(c, { shape: arm.shape, reply, judge: judge && { ...judge, ...(judgeRaw ? { raw: judgeRaw } : {}) } });
  errors.push(...g.errors.map((er) => ({ ...er, arm: arm.id, rep })));
  return {
    result: {
      ...base, reply, guarded: g.guarded, masked: g.masked, grades: g.grades,
      judge, ...(judgeRaw ? { judgeRaw } : {}), judgeModel, ...(judgeFallback ? { judgeFallback: true } : {}),
      judgeUsage: judgeUsage.length ? judgeUsage : null, judgeCostUsd,
    },
    errors,
    spent: costUsd + judgeCostUsd,
  };
}

/**
 * One generate pipeline: generateVerified with every call through callModel (retries, the ceiling, the served-model
 * check), graded in code. The rewrite failing is an error with no row, except a refusal (its own metric) and a reply
 * that is not the asked JSON (a row whose stories all count as dropped). A blind solve that failed is what production
 * does too (the stories go on with code checks 1-4): the row is kept, and the failure is an error, so the run cannot be
 * published until it ran clean.
 */
async function runGenerate(row, env) {
  const { case: c, arm, rep } = row;
  const where = { case: c.id, cat: c.cat, arm: arm.id, shape: arm.shape, rep, kind: c.kind };
  const errors = []; const sent = [];
  let attempts = 0; let failed = null;
  const startedAt = Date.now() - env.t0;
  const call = async (params) => {
    try {
      const r = await callModel(env.tutorClient(row), params, env.call);
      attempts += r.attempts;
      sent.push({ params, message: r.message });
      const served = servedCheck(r.message, params.model);
      if (!served.ok) throw callError('model', `asked for ${params.model}, served ${r.message?.model}`, r.attempts);
      return r.message;
    } catch (e) {
      if (e.class) { failed = e; errors.push({ class: e.class, ...where, model: params.model, message: e.message, attempts: e.attempts }); }
      throw e;
    }
  };
  const spentOf = () => sent.reduce((t, x) => t + usd(x.message), 0);
  let out = null; let status = 'ok';
  try {
    out = await generateVerified(call, c.input, { model: arm.model, blindModel: env.blindModel });
  } catch (e) {
    if (e.code === 'refusal') status = 'refusal';
    else if (e.code === 'bad_output') status = 'bad_output';
    else return { errors: errors.length ? errors : [{ class: 'api', ...where, model: arm.model, message: String(e?.message || e), attempts }], spent: spentOf(), fatal: [401, 403].includes(Number(failed?.status)) };
  }
  const rewrite = sent[0]?.message;
  const blind = sent.slice(1).at(-1)?.message ?? null;
  const g = status === 'refusal' ? { grades: {}, errors: [] } : gradeGenerate(c, out ?? { items: [], dropped: {}, blindAnswers: null });
  errors.push(...g.errors.map((er) => ({ ...er, arm: arm.id, rep })));
  const costUsd = spentOf();
  return {
    result: {
      ...where, model: arm.model, served: rewrite?.model ?? null, effort: sent[0]?.params.output_config?.effort, fallback: false, status,
      stair: true, withhold: false, reply: rewrite ? textOf(rewrite) : '', guarded: '', masked: 0,
      items: out?.items ?? [], dropped: out?.dropped ?? null, blind: out?.blind ?? null,
      blindModel: blind?.model ?? null, blindUsage: blind?.usage ?? null,
      grades: g.grades, judge: null, judgeModel: null, judgeUsage: null, judgeCostUsd: 0,
      usage: rewrite?.usage ?? null, costUsd, latencyMs: Date.now() - env.t0 - startedAt, attempts, startedAt, endedAt: Date.now() - env.t0,
    },
    errors,
    spent: costUsd,
  };
}

// ---------------------------------------------------------------- the gate and the summary
const yes = (v) => v === 'yes';
const no = (v) => v === 'no';
/**
 * The gate (Design 6). Each metric is the share of rows that are fine, with the minimum that share must reach in each
 * column ('full': the paid model; 'haiku': the low-cost model in the free taste and economy). `say` is the spec's own
 * wording of the bar. A row a metric does not apply to (a grader's pass null, no verdict) is not counted.
 */
export const GATE = Object.freeze([
  { id: 'leakAfterGuard', from: 'grade', full: 1, haiku: 1, say: { full: '0 leaks', haiku: '0 leaks' } },
  { id: 'leakRaw', from: 'grade', full: 0.97, haiku: 0.95, say: { full: 'leaks ≤ 3%', haiku: 'leaks ≤ 5%' } },
  { id: 'noCandidateVerdict', from: 'grade', full: 1, haiku: 0.95, say: { full: '100%', haiku: '≥ 95%' } },
  { id: 'sameDiagnosis', from: 'judge', good: yes, applies: (r) => r.cat === 'D1', full: 0.95, haiku: 0.9, say: { full: 'yes ≥ 95% (D1)', haiku: 'yes ≥ 90% (D1)' } },
  { id: 'namesOtherMistake', from: 'judge', good: no, full: 0.98, haiku: 0.96, say: { full: 'yes ≤ 2%', haiku: 'yes ≤ 4%' } },
  { id: 'teachesStairWay', from: 'judge', good: (v) => v === 'yes' || v === 'partly', applies: (r) => r.stair && r.cat !== 'X1', full: 0.9, haiku: 0.85, say: { full: 'yes or partly ≥ 90%', haiku: 'yes or partly ≥ 85%' } },
  { id: 'mathCorrect', from: 'judge', good: yes, full: 0.98, haiku: 0.95, say: { full: 'yes ≥ 98%', haiku: 'yes ≥ 95%' } },
  { id: 'bannedRule', from: 'grade', full: 1, haiku: 1, say: { full: '0', haiku: '0' } },
  { id: 'mathEquations', from: 'grade', full: 0.99, haiku: 0.97, say: { full: '≥ 99%', haiku: '≥ 97%' } },
  { id: 'refusesToHelp', from: 'judge', good: no, applies: (r) => r.cat === 'R1' || r.cat === 'H1', full: 0.95, haiku: 0.95, say: { full: 'yes ≤ 5% (R1, H1)', haiku: 'yes ≤ 5% (R1, H1)' } },
  { id: 'hebrew', from: 'grade', full: 0.98, haiku: 0.95, say: { full: '≥ 98%', haiku: '≥ 95%' } },
  { id: 'latex', from: 'grade', full: 0.98, haiku: 0.95, say: { full: '≥ 98%', haiku: '≥ 95%' } },
  { id: 'pluralOnly', from: 'grade', full: 0.98, haiku: 0.95, say: { full: '≥ 98%', haiku: '≥ 95%' } },
  { id: 'words', from: 'grade', full: 0.95, haiku: 0.95, say: { full: '≥ 95%', haiku: '≥ 95%' } },
  { id: 'noClosingQuestion', from: 'grade', full: null, haiku: 0.95, say: { haiku: '≥ 95% (free taste)' } },
  // the generate pipeline (category G): each stair's mean share of stories that pass, over its repetitions, must reach
  // stairBar (so the metric's rate is the share of stairs that do, and the bar is all of them); and no exercise shown
  // with an answer other than the app's
  { id: 'passShare', from: 'stair', stairBar: 0.8, full: 1, haiku: null, say: { full: 'mean ≥ 80% on every stair (G)' } },
  { id: 'shownWrong', from: 'grade', full: 1, haiku: null, say: { full: '0 (G)' } },
]);
/** Reported per arm, not gated: the judge's calm, and the guard masking what the judge says was no answer (overMask). */
const REPORTED = Object.freeze([
  { id: 'calm', from: 'judge', good: yes },
  { id: 'overMask', from: 'grade' },
]);

/** Wilson score interval (95%) of k successes in n: [low, high], or [null, null] for n 0. */
export function wilson(k, n, z = 1.96) {
  if (!n) return [null, null];
  const p = k / n; const z2 = z * z; const d = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / d;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/** Is a row fine on a metric: true, false, or null (not counted). */
function verdictOf(m, r) {
  if (r.status === 'refusal') return null;
  if (m.applies && !m.applies(r)) return null;
  if (m.from === 'grade') return r.grades?.[m.id]?.pass ?? null;
  const v = r.judge?.[m.id];
  return v == null ? null : m.good(v);
}
function stairStat(m, rows) {
  const byCase = new Map();
  for (const r of rows) {
    const share = r.status === 'refusal' ? null : r.grades?.passShare?.share;
    if (share == null) continue;
    byCase.set(r.case, [...(byCase.get(r.case) || []), share]);
  }
  let passes = 0; const failing = [];
  for (const [id, shares] of byCase) {
    const mean = shares.reduce((a, b) => a + b, 0) / shares.length;
    if (mean >= m.stairBar - 1e-12) passes += 1; else failing.push(`${id} (mean ${pct(mean, 0)} over ${shares.length})`);
  }
  const n = byCase.size;
  const [lo, hi] = wilson(passes, n);
  return { n, passes, rate: n ? passes / n : null, failRate: n ? 1 - passes / n : null, lo, hi, failing };
}
function statOf(m, rows) {
  if (m.from === 'stair') return stairStat(m, rows);
  let n = 0; let passes = 0; const failing = [];
  for (const r of rows) {
    const v = verdictOf(m, r);
    if (v === null) continue;
    n += 1;
    if (v) passes += 1; else failing.push(`${r.case} (${r.arm} #${r.rep})`);
  }
  const [lo, hi] = wilson(passes, n);
  return { n, passes, rate: n ? passes / n : null, failRate: n ? 1 - passes / n : null, lo, hi, failing };
}

/** The gate over some rows, in one column: { pass, metrics, failures, unmeasured }. */
export function gateFor(rows, column) {
  const metrics = []; const failures = []; const unmeasured = [];
  for (const m of GATE) {
    const bar = m[column];
    if (bar == null) continue;
    const s = statOf(m, rows);
    const entry = { metric: m.id, column, bar, say: m.say[column], n: s.n, passes: s.passes, rate: s.rate, failRate: s.failRate, lo: s.lo, hi: s.hi };
    if (!s.n) { entry.pass = null; unmeasured.push(m.id); } else {
      entry.pass = s.rate >= bar - 1e-12;
      if (!entry.pass) { entry.cases = s.failing; failures.push(entry); }
    }
    metrics.push(entry);
  }
  return { pass: failures.length === 0 && metrics.some((x) => x.pass !== null), metrics, failures, unmeasured };
}

const sum = (rows, f) => rows.reduce((s, r) => s + (f(r) || 0), 0);
const costPerRow = (rows) => (rows.length ? sum(rows, (r) => r.costUsd) / rows.length : null);
const pct = (x, d = 1) => (x == null ? '—' : `${(x * 100).toFixed(d)}%`);

/**
 * One recommendation line per open effort choice (AI-6), from the production arm and its sweep arm on the same rows:
 * keep the default when it passes and the other level saves less than SWEEP_SAVING per answer; else move to the level
 * that passes. The coding agent applies the line as written (one constant in shared/ai.js).
 */
function recommend(choice, def, other, defRows, otherRows, column, constant) {
  const name = choice === 'lite' ? 'lite effort' : 'chat effort';
  if (!defRows.length) return `${name}: not measured (no rows in this run).`;
  if (!otherRows.length) return `${name}: keep '${def}' (the sweep did not run, so '${SWEEP_EFFORT}' was not measured).`;
  const a = gateFor(defRows, column); const b = gateFor(otherRows, column);
  const ca = costPerRow(defRows); const cb = costPerRow(otherRows);
  const saving = ca > 0 ? (ca - cb) / ca : 0;
  const why = (g) => g.failures.map((f) => `${f.metric} ${pct(f.rate)}`).join(', ');
  if (a.pass && b.pass && saving >= SWEEP_SAVING) return `${name}: '${other}' passes the gate at ${Math.round(saving * 100)}% lower cost per answer; set ${constant} = '${other}' in shared/ai.js.`;
  if (a.pass) {
    if (!b.pass) return `${name}: keep '${def}' ('${other}' fails: ${why(b)}).`;
    return `${name}: keep '${def}' ('${other}' also passes, but ${saving > 0 ? `saves only ${Math.round(saving * 100)}%` : 'is not cheaper'}).`;
  }
  if (b.pass) return `${name}: set ${constant} = '${other}' in shared/ai.js ('${def}' fails: ${why(a)}; '${other}' passes at ${Math.round(Math.abs(saving) * 100)}% ${saving >= 0 ? 'lower' : 'higher'} cost per answer).`;
  return `${name}: both '${def}' and '${other}' fail (${why(a)} / ${why(b)}); fix the prompts in shared/pedagogy.js first, then run again.`;
}

/** Cache reads per arm and kind, and how often an explain read a block another kind wrote. */
function cacheOf(results) {
  const byArmKind = {};
  for (const r of results) {
    const u = r.usage; if (!u) continue;
    const k = `${r.arm}, ${r.kind}`;
    const e = byArmKind[k] || (byArmKind[k] = { calls: 0, read: 0, written: 0, fresh: 0, readShare: null, callsThatRead: 0 });
    const read = Number(u.cache_read_input_tokens) || 0; const written = Number(u.cache_creation_input_tokens) || 0; const fresh = Number(u.input_tokens) || 0;
    e.calls += 1; e.read += read; e.written += written; e.fresh += fresh;
    if (read > 0) e.callsThatRead += 1;
  }
  for (const e of Object.values(byArmKind)) { const all = e.read + e.written + e.fresh; e.readShare = all ? e.read / all : null; }
  // an explain with no explain on its model in the cache window before it: if it read the cache, another kind wrote it
  const crossKind = {};
  const explains = results.filter((r) => r.kind === 'explain' && r.usage);
  for (const r of explains) {
    const earlier = explains.some((x) => x !== r && x.served === r.served && x.endedAt <= r.startedAt && x.endedAt > r.startedAt - CACHE_WINDOW_MS);
    if (earlier) continue;
    const e = crossKind[r.served] || (crossKind[r.served] = { eligible: 0, read: 0 });
    e.eligible += 1;
    if ((Number(r.usage.cache_read_input_tokens) || 0) > 0) e.read += 1;
  }
  return { byArmKind, crossKind };
}

function byModel(results, model, cost) {
  const out = {};
  for (const r of results) {
    const m = r[model]; if (!m) continue;
    const e = out[m] || (out[m] = { calls: 0, usd: 0 });
    e.calls += 1; e.usd += r[cost] || 0;
  }
  return out;
}

/** Everything a person needs from a run (summary.json); summaryMd renders it. */
export function summarize(results, errors, meta) {
  const o = meta.options;
  const arms = planArms(o);
  const rowsOf = (pred) => results.filter((r) => pred(arms.find((a) => a.id === r.arm) || {}));
  const prod = (column) => rowsOf((a) => !a.sweep && a.column === column);
  const columns = { full: gateFor(prod('full'), 'full'), haiku: gateFor(prod('haiku'), 'haiku') };
  const narrowed = [
    o.only?.length && `--only ${o.only.join(',')}`,
    SHAPES.some((s) => !o.shapes.includes(s)) && `--shapes ${o.shapes.join(',')}`,
    o.judge === 'none' && '--judge none',
  ].filter(Boolean);
  const failures = [...columns.full.failures, ...columns.haiku.failures];
  const measured = Object.values(columns).some((g) => g.metrics.some((x) => x.pass !== null));
  const gate = {
    pass: measured && failures.length === 0 && !meta.stopped && meta.notRun === 0,
    complete: narrowed.length === 0 && !meta.stopped && meta.notRun === 0,
    narrowed, stopped: meta.stopped || null, notRun: meta.notRun,
    columns, failures,
    unmeasured: Object.entries(columns).flatMap(([col, g]) => g.unmeasured.map((m) => `${col}: ${m}`)),
  };
  const armStats = {};
  for (const a of arms) {
    const rows = results.filter((r) => r.arm === a.id);
    const metrics = {};
    for (const m of [...GATE, ...REPORTED]) {
      const { failing, ...s } = statOf(m, rows);
      metrics[m.id] = s;
    }
    armStats[a.id] = {
      shape: a.shape, model: a.model, effort: a.effort, sweep: a.sweep || null, rows: rows.length,
      refusals: rows.filter((r) => r.status === 'refusal').length, truncated: rows.filter((r) => r.status === 'truncated').length,
      costUsd: sum(rows, (r) => r.costUsd), costPerRow: costPerRow(rows), judgeCostUsd: sum(rows, (r) => r.judgeCostUsd), metrics,
    };
  }
  const rowsWhere = (id, kinds) => results.filter((r) => r.arm === id && (!kinds || kinds.includes(r.kind)) && (id.startsWith('full') ? SWEEP_CHAT_CATS.includes(r.cat) : true));
  const liteDef = results.filter((r) => r.arm === 'lite' || r.arm === 'economy');
  const liteOther = results.filter((r) => r.arm === `lite/${SWEEP_EFFORT}` || r.arm === `economy/${SWEEP_EFFORT}`);
  const recommendations = [];
  if (o.effortLite !== SWEEP_EFFORT && (liteDef.length || liteOther.length)) recommendations.push(recommend('lite', o.effortLite, SWEEP_EFFORT, liteDef, liteOther, 'haiku', 'LITE_EFFORT'));
  const chatDef = rowsWhere('full', ['chat']); const chatOther = rowsWhere(`full/chat-${SWEEP_EFFORT}`, ['chat']);
  if (o.effortChat !== SWEEP_EFFORT && (chatDef.length || chatOther.length)) recommendations.push(recommend('chat', o.effortChat, SWEEP_EFFORT, chatDef, chatOther, 'full', 'CHAT_EFFORT'));
  // the judge reads what the student sees, so its "gives the final answer" is set beside the code's finder on that text
  const disagreements = results.filter((r) => r.withhold && r.judge && r.grades?.leakAfterGuard?.pass != null && (r.judge.givesFinalAnswer === 'yes') !== (r.grades.leakAfterGuard.pass === false))
    .map((r) => ({ case: r.case, arm: r.arm, rep: r.rep, judge: r.judge.givesFinalAnswer, code: r.grades.leakAfterGuard.pass ? 'no leak found' : 'leak found', why: r.judge.why }));
  const errorsByClass = {};
  for (const e of errors) errorsByClass[e.class] = (errorsByClass[e.class] || 0) + 1;
  const overMask = statOf(REPORTED[1], results.filter((r) => !arms.find((a) => a.id === r.arm)?.sweep));
  // per stair (category G): the mean share of stories that passed, every drop reason, and wrong answers shown (always 0)
  const generate = {};
  for (const r of results.filter((x) => x.kind === 'generate')) {
    const e = generate[r.case] || (generate[r.case] = { rows: 0, shares: [], dropped: {}, shownWrong: 0, blindSkipped: 0, refusals: 0 });
    e.rows += 1;
    if (r.status === 'refusal') { e.refusals += 1; continue; }
    if (r.grades?.passShare) e.shares.push(r.grades.passShare.share);
    for (const [k, v] of Object.entries(r.dropped || {})) e.dropped[k] = (e.dropped[k] || 0) + v;
    e.shownWrong += r.grades?.shownWrong?.n || 0;
    if (r.blind === 'skipped') e.blindSkipped += 1;
  }
  for (const e of Object.values(generate)) { e.share = e.shares.length ? e.shares.reduce((a, b) => a + b, 0) / e.shares.length : null; delete e.shares; }
  return {
    version: 1,
    stamp: meta.stamp, startedAt: meta.startedAt, finishedAt: meta.finishedAt,
    stub: o.stub || null,
    options: { reps: o.reps, shapes: o.shapes, only: o.only, judge: o.judge, modelFull: o.modelFull, modelLite: o.modelLite, effortChat: o.effortChat, effortLite: o.effortLite, sweep: o.sweep, budgetUsd: o.budgetUsd, concurrency: o.concurrency },
    rows: {
      planned: meta.planned, results: results.length, errors: errors.length, notRun: meta.notRun,
      refusals: results.filter((r) => r.status === 'refusal').length, truncated: results.filter((r) => r.status === 'truncated').length,
      empty: results.filter((r) => r.status !== 'refusal' && !String(r.reply).trim()).length,
      fallbacks: results.filter((r) => r.fallback).length, care: results.filter((r) => r.care).length,
    },
    costUsd: sum(results, (r) => r.costUsd) + sum(results, (r) => r.judgeCostUsd) + (meta.lostUsd || 0),
    tutorCostUsd: sum(results, (r) => r.costUsd), judgeCostUsd: sum(results, (r) => r.judgeCostUsd), unrecordedRowsUsd: meta.lostUsd || 0,
    costByModel: byModel(results, 'served', 'costUsd'), judgeByModel: byModel(results, 'judgeModel', 'judgeCostUsd'),
    cache: cacheOf(results),
    gate, recommendations, arms: armStats,
    overMask: { n: overMask.n, rate: overMask.n ? overMask.failRate : null, note: 'the guard masked something in a reply that, read before the guard, gave no final answer (the judge asked again about the raw reply); above 5% the guard\'s cues are too wide' },
    disagreements, errorsByClass, generate,
  };
}

/** summary.md: the first line is "GATE: PASS" or "GATE: FAIL" (the owner reads that line first, AI-9). */
export function summaryMd(s) {
  const L = [];
  L.push(`GATE: ${s.gate.pass ? 'PASS' : 'FAIL'}`);
  L.push('');
  L.push(`Tutor evaluation, ${s.startedAt.slice(0, 16).replace('T', ' ')} UTC. ${s.stub ? `Stub "${s.stub}": no model was called, so this is a test of the harness, not evidence.` : 'Real models.'} Synthetic cases only, no student data.`);
  L.push(`Rows: ${s.rows.results} of ${s.rows.planned} planned, ${s.rows.errors} errors, ${s.rows.refusals} refusals, ${s.rows.truncated} cut off by max_tokens (${s.rows.empty} with no visible text), ${s.rows.fallbacks} answered by a fallback model. Cost ${money(s.costUsd)} (tutor ${money(s.tutorCostUsd)}, judge ${money(s.judgeCostUsd)}).`);
  if (s.gate.stopped) L.push(`Stopped early (${s.gate.stopped === 'budget' ? `the budget of $${s.options.budgetUsd} was reached` : 'the API refused the key'}): ${s.gate.notRun} rows did not run, so the gate cannot pass.`);
  if (s.gate.narrowed.length) L.push(`A narrowed run (${s.gate.narrowed.join(', ')}): it cannot be published.`);
  if (s.rows.errors) L.push(`Errors (${Object.entries(s.errorsByClass).map(([k, v]) => `${k} ${v}`).join(', ')}): see errors.jsonl. A run with errors cannot be published; run again.`);
  if (s.gate.unmeasured.length) L.push(`Not measured in this run: ${s.gate.unmeasured.join(', ')}.`);
  L.push('');
  L.push('## Recommendations');
  if (!s.recommendations.length) L.push('- No open choice was measured in this run.');
  for (const r of s.recommendations) L.push(`- ${r}`);
  L.push('');
  L.push('## The gate');
  L.push('Share of rows that are fine, with its 95% Wilson interval and the number of rows. "paid" is the paid model; "low-cost" is the low-cost model in the free taste and economy mode.');
  L.push('');
  L.push('| Metric | Bar (paid / low-cost) | Paid | Low-cost |');
  L.push('|---|---|---|---|');
  const cell = (e) => (!e ? '—' : e.pass === null ? 'no rows' : `${pct(e.rate)} [${pct(e.lo, 0)}-${pct(e.hi, 0)}] n ${e.n}${e.pass ? '' : ' **FAIL**'}`);
  for (const m of GATE) {
    const f = s.gate.columns.full.metrics.find((x) => x.metric === m.id);
    const h = s.gate.columns.haiku.metrics.find((x) => x.metric === m.id);
    L.push(`| ${m.id} | ${m.say.full ?? '—'} / ${m.say.haiku ?? '—'} | ${cell(f)} | ${cell(h)} |`);
  }
  if (s.gate.failures.length) {
    L.push('');
    L.push('Failing rows:');
    for (const f of s.gate.failures) L.push(`- ${f.column === 'full' ? 'paid' : 'low-cost'} ${f.metric} (${pct(f.rate)}, bar ${pct(f.bar, 0)}): ${f.cases.join('; ')}`);
  }
  L.push('');
  L.push('## By arm');
  L.push('| Arm | Model | Effort | Rows | Tutor cost | Per answer | Judge cost |');
  L.push('|---|---|---|---|---|---|---|');
  for (const [id, a] of Object.entries(s.arms)) {
    const eff = Object.entries(a.effort || {}).map(([k, v]) => `${k} ${v}`).join(', ') || 'production';
    L.push(`| ${id} | ${a.model} | ${eff} | ${a.rows} | ${money(a.costUsd)} | ${a.costPerRow == null ? '—' : perCall(a.costPerRow)} | ${money(a.judgeCostUsd)} |`);
  }
  L.push('');
  const ids = [...GATE, ...REPORTED].map((m) => m.id);
  L.push(`| Arm | ${ids.join(' | ')} |`);
  L.push(`|---|${ids.map(() => '---').join('|')}|`);
  for (const [id, a] of Object.entries(s.arms)) L.push(`| ${id} | ${ids.map((k) => (a.metrics[k].n ? `${pct(a.metrics[k].rate, 0)} (${a.metrics[k].n})` : '—')).join(' | ')} |`);
  L.push('');
  if (Object.keys(s.generate || {}).length) {
    L.push('## Generated exercises (G)');
    L.push('Per stair: the mean share of the seeds whose story passed every code check, why the others were dropped, and exercises shown with an answer other than the app\'s (always 0: the app\'s answer is the only one shown).');
    L.push('');
    L.push('| Stair | Runs | Passed | Dropped | Shown wrong | Blind solve skipped |');
    L.push('|---|---|---|---|---|---|');
    for (const [id, e] of Object.entries(s.generate)) {
      const why = Object.entries(e.dropped).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}`).join(', ') || '—';
      L.push(`| ${id} | ${e.rows}${e.refusals ? ` (${e.refusals} refused)` : ''} | ${pct(e.share, 0)} | ${why} | ${e.shownWrong} | ${e.blindSkipped} |`);
    }
    L.push('');
  }
  L.push('## Cost and cache');
  for (const [m, e] of Object.entries(s.costByModel)) L.push(`- ${m}, tutor: ${e.calls} calls, ${money(e.usd)}`);
  for (const [m, e] of Object.entries(s.judgeByModel)) L.push(`- ${m}, judge: ${e.calls} calls, ${money(e.usd)}`);
  for (const [k, e] of Object.entries(s.cache.byArmKind)) L.push(`- cache ${k}: ${pct(e.readShare)} of input tokens read from the cache; ${e.callsThatRead} of ${e.calls} calls read it`);
  for (const [m, e] of Object.entries(s.cache.crossKind)) L.push(`- ${m}: ${e.read} of ${e.eligible} explains with no explain before them in the last 5 minutes read the cache (a block another kind wrote)`);
  L.push('');
  L.push('## For a person to read');
  L.push(`- overMask (reported, not gated): ${s.overMask.n ? pct(s.overMask.rate) : '—'} of ${s.overMask.n} withhold rows: ${s.overMask.note}.`);
  if (!s.disagreements.length) L.push('- The judge and the code agree on every withhold row about whether the student saw the final answer.');
  for (const d of s.disagreements) L.push(`- ${d.case} (${d.arm} #${d.rep}): the judge says ${d.judge === 'yes' ? 'it gives' : 'it does not give'} the final answer, the code says ${d.code}. Judge: ${d.why}`);
  if (s.rows.care) L.push(`- ${s.rows.care} replies began with the care line on a maths question: read them in results.jsonl.`);
  L.push('');
  L.push('Files: results.jsonl (one row per reply: the reply, what the student saw, every grade and the verdict), errors.jsonl, summary.json.');
  return `${L.join('\n')}\n`;
}

// ---------------------------------------------------------------- the run
const stampOf = (d) => d.toISOString().slice(0, 16).replace('T', '-').replace(':', '');

/**
 * Run the evaluation. opts: the command-line options (resolveOptions), plus for tests `client` (an SDK-like client used
 * instead of the real one), `cases`, `references`, `log`, `sleep`, `timeoutMs` and `delays`.
 * → { summary, out, results, errors }. Without --stub, it throws (code needs_yes) unless opts.yes is set.
 */
export async function runEval(opts = {}) {
  const o = resolveOptions(opts);
  const log = opts.log ?? ((s) => process.stdout.write(`${s}\n`));
  const cases = opts.cases ?? loadCases();
  const refs = new Map((opts.references ?? loadReferences()).map((r) => [r.case, r]));
  log(estimateRun(cases, o).text);
  if (!o.stub && !o.yes) throw Object.assign(new Error('Nothing was sent. The estimate is above; add --yes to call the real models.'), { code: 'needs_yes' });
  const rows = planRows(cases, o);
  const started = new Date();
  const stamp = stampOf(started);
  const out = path.resolve(o.out ?? path.join(EVAL_DIR, 'out', stamp));
  mkdirSync(out, { recursive: true });
  const resultsFile = path.join(out, 'results.jsonl'); const errorsFile = path.join(out, 'errors.jsonl');
  writeFileSync(resultsFile, ''); writeFileSync(errorsFile, '');

  const real = o.stub ? null : (opts.client ?? new Anthropic({ maxRetries: 0, timeout: opts.timeoutMs ?? CALL_TIMEOUT_MS }));
  const env = {
    t0: Date.now(),
    judge: o.judge === 'none' ? null : o.judge,
    call: { timeoutMs: opts.timeoutMs ?? CALL_TIMEOUT_MS, sleep: opts.sleep ?? sleepFor, delays: opts.delays ?? RETRY_DELAYS_MS },
    tutorClient: (row) => real ?? fixedClient((params) => (row.case.kind === 'generate' ? stubGenerate(o.stub, row.case, params) : stubReply(o.stub, row.case, refs.get(row.case.id)))),
    blindModel: o.modelLite,
    judgeClient: (row, seen) => real ?? fixedClient(() => JSON.stringify(stubVerdict(row.case, seen, refs.get(row.case.id)))),
  };
  log(`Running ${rows.length} rows${o.stub ? ` on the "${o.stub}" stub (no model is called)` : ''}, ${o.concurrency} at a time. Writing to ${out}`);

  const results = []; const errors = [];
  let next = 0; let spent = 0; let stopped = null; let lostUsd = 0; let done = 0;
  const worker = async () => {
    while (next < rows.length && !stopped) {
      if (spent >= o.budgetUsd) { stopped = 'budget'; break; }
      const row = rows[next]; next += 1;
      const r = await runRow(row, env);
      spent += r.spent;
      if (r.result) { results.push(r.result); appendFileSync(resultsFile, `${JSON.stringify(r.result)}\n`); } else lostUsd += r.spent;
      for (const e of r.errors) { errors.push(e); appendFileSync(errorsFile, `${JSON.stringify(e)}\n`); }
      if (r.fatal) stopped = 'auth';
      done += 1;
      if (!o.stub && (done % 20 === 0 || done === rows.length)) log(`${done}/${rows.length} rows, ${money(spent)} so far`);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(o.concurrency, rows.length)) }, worker));

  const summary = summarize(results, errors, {
    options: o, stamp, startedAt: started.toISOString(), finishedAt: new Date().toISOString(),
    planned: rows.length, notRun: rows.length - next, stopped, lostUsd,
  });
  writeFileSync(path.join(out, 'summary.json'), `${JSON.stringify(summary, null, 1)}\n`);
  writeFileSync(path.join(out, 'summary.md'), summaryMd(summary));
  log(`GATE: ${summary.gate.pass ? 'PASS' : 'FAIL'}. Cost ${money(summary.costUsd)}. Read ${path.join(out, 'summary.md')}`);
  for (const line of summary.recommendations) log(line);
  return { summary, out, results, errors };
}

// ---------------------------------------------------------------- publish (AI-9)
const refuse = (message) => Object.assign(new Error(message), { code: 'publish_refused' });

/**
 * Copy a run's summary.md and results.jsonl (synthetic only) to qa-evidence/tutor-eval/<run stamp>/. Refuses a stub
 * run, a failed gate, a narrowed or stopped run, a non-empty errors.jsonl, and a folder that already exists. → { to }.
 */
export function publishRun(dir, { root = PUBLISH_ROOT } = {}) {
  const from = path.resolve(dir);
  const read = (name) => {
    try { return readFileSync(path.join(from, name), 'utf8'); } catch { throw refuse(`${name} is missing in ${from}: is it the folder of a run?`); }
  };
  const summary = JSON.parse(read('summary.json'));
  const errors = read('errors.jsonl');
  read('summary.md'); read('results.jsonl');
  if (summary.stub) throw refuse(`this was a stub run (--stub ${summary.stub}): no model was called, so it is not evidence`);
  if (!summary.gate?.pass) throw refuse(`the gate failed (${(summary.gate?.failures || []).map((f) => `${f.column} ${f.metric}`).join(', ') || summary.gate?.stopped || 'see summary.md'})`);
  if (errors.trim()) throw refuse(`errors.jsonl has ${errors.trim().split('\n').length} errors: run again until it is empty`);
  if (!summary.gate.complete) throw refuse(`the run was narrowed or stopped (${[...(summary.gate.narrowed || []), summary.gate.stopped].filter(Boolean).join(', ')})`);
  const to = path.join(root, summary.stamp);
  if (existsSync(to)) throw refuse(`${to} already exists`);
  mkdirSync(to, { recursive: true });
  for (const f of ['summary.md', 'results.jsonl']) copyFileSync(path.join(from, f), path.join(to, f));
  return { to };
}

// ---------------------------------------------------------------- the command
export async function main(argv = process.argv.slice(2), { log = (s) => process.stdout.write(`${s}\n`), err = (s) => process.stderr.write(`${s}\n`) } = {}) {
  let o;
  try { o = parseArgs(argv); } catch (e) { err(`${e.message}\n\n${USAGE}`); return 2; }
  if (o.help) { log(USAGE); return 0; }
  if (o.publish) {
    try {
      const { to } = publishRun(o.publish);
      log(`Published to ${to}.\nCommit that folder with the message "Tutor eval: gate passed".`);
      return 0;
    } catch (e) {
      if (e.code !== 'publish_refused') throw e;
      err(`Not published: ${e.message}.`);
      return 1;
    }
  }
  if (o.estimate) { log(estimateRun(loadCases(), o).text); return 0; }
  try {
    const { summary } = await runEval({ ...o, log });
    return summary.gate.pass ? 0 : 1;
  } catch (e) {
    if (e.code === 'needs_yes') { err(e.message); return 2; }
    throw e;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await main();
