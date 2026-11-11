// Regenerates full-params.json: the exact params every AI kind sends in the full shape, for the main model and for the
// default model. paid.test.js compares the builders against this file byte for byte, so a prompt can only change on
// purpose: change the prompt, run this script, and say in the commit message that the prompts changed.
// It also writes stable-system.txt: the stable first block of every request (stableSystem(), shared/pedagogy.js) as
// plain text, so a reviewer can read what the tutor is told (pedagogy.test.js compares it).
//
//   node test/fixtures/make-full-params.mjs           write both files
//   node test/fixtures/make-full-params.mjs --check   exit 1 when a file is not what the builders make now
//
// The inputs are the older app's flat fields (the context is read through legacyToV2), long enough to show every clip.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildRequest, AI_KINDS, stableSystem } from '../../../shared/ai.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'full-params.json');
const STABLE = path.join(here, 'stable-system.txt');
const MAIN = 'claude-opus-5-5';

const turns = Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `turn ${i} ${i === 4 ? 'x'.repeat(2500) : ''}` }));
export const INPUTS = {
  explain: { grade: '8', topic: 'מספרים מכוונים', level: 'חיבור', question: `3 - 8 ${'y'.repeat(900)}`, correct: '-5', studentAnswer: '5', attempts: 2 },
  chat: { messages: turns, context: { grade: '7', question: '3 - 8' } },
  generate: {
    grade: '7', skill: 'signed:1', topic: 'מספרים מכוונים', stair: 'חיבור וחיסור', count: 3,
    seeds: [{ i: 0, text: 'חשבו: 3 - (-5)', answer: '8', round: false, fig: false }, { i: 1, text: `מחיר ${'z'.repeat(700)}`, answer: '3/4', round: true, fig: false }, { i: 2, text: 'בטבלה: 3 → 7', answer: '-1', round: false, fig: true }],
  },
  check: { grade: '8', image: 'data:image/jpeg;base64,/9j/4AAQ', mediaType: 'image/png', question: '2x=4' },
  exam: {
    grade: '8',
    pages: [{ data: 'data:image/jpeg;base64,/9j/4AAQ', mediaType: 'image/jpeg' }, { data: 'data:application/pdf;base64,JVBERi0x', mediaType: 'application/pdf' }],
    topics: [{ id: 'line', title: 'פונקציה קווית', levels: ['א', 'ב'] }],
    key: [{ prompt: 'מה השיפוע?', answer: '3' }],
  },
  // a finished challenge (ai spec AI-10): the app's context, the rubric, the model answer and the student's explanation,
  // long enough to show every clip, with a phone number the request masks
  feedback: {
    ctx: {
      v: 2, surface: 'challenge', grade: '7', skill: 'expr:4', topicId: 'expr', topic: 'ביטויים אלגבריים', stair: 'חוק הפילוג',
      item: { text: 'הסבירו למה $3(x + 4) = 3x + 12$.' }, policy: { answer: 'reveal', why: 'A finished challenge.' },
    },
    rubric: ['הסברתי בעזרת שטח של מלבן', `אמרתי למה כל איבר בסוגריים נכפל ${'w'.repeat(300)}`],
    sample: `מלבן ברוחב $3$ ובאורך $x + 4$ ${'s'.repeat(700)}`,
    text: `ציירתי מלבן, תתקשרו 050-1234567 ${'t'.repeat(1500)}`,
  },
};

export function make() {
  return Object.fromEntries(AI_KINDS.map((kind) => [kind, {
    input: INPUTS[kind],
    opus: buildRequest(kind, INPUTS[kind], { model: MAIN }),
    dflt: buildRequest(kind, INPUTS[kind]),
  }]));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = [[OUT, JSON.stringify(make(), null, 1)], [STABLE, `${stableSystem()}\n`]]; // the layout full-params.json has always had
  if (process.argv.includes('--check')) {
    const stale = files.filter(([f, text]) => { try { return readFileSync(f, 'utf8') !== text; } catch { return true; } }).map(([f]) => path.basename(f));
    console.log(stale.length ? `${stale.join(' and ')} differ from the builders: run node test/fixtures/make-full-params.mjs` : 'full-params.json and stable-system.txt are up to date');
    process.exit(stale.length ? 1 : 0);
  }
  for (const [f, text] of files) { writeFileSync(f, text); console.log(`wrote ${path.relative(process.cwd(), f)}`); }
}
