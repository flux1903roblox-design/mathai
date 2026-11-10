// Regenerates full-params.json: the exact params every AI kind sends in the full shape, for the main model and for the
// default model. paid.test.js compares the builders against this file byte for byte, so a prompt can only change on
// purpose: change the prompt, run this script, and say in the commit message that the prompts changed.
//
//   node test/fixtures/make-full-params.mjs           write the file
//   node test/fixtures/make-full-params.mjs --check   exit 1 when the file is not what the builders make now
//
// The inputs are the older app's flat fields (the context is read through legacyToV2), long enough to show every clip.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildRequest, AI_KINDS } from '../../../shared/ai.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'full-params.json');
const MAIN = 'claude-opus-5-5';

const turns = Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `turn ${i} ${i === 4 ? 'x'.repeat(2500) : ''}` }));
export const INPUTS = {
  explain: { grade: '8', topic: 'מספרים מכוונים', level: 'חיבור', question: `3 - 8 ${'y'.repeat(900)}`, correct: '-5', studentAnswer: '5', attempts: 2 },
  chat: { messages: turns, context: { grade: '7', question: '3 - 8' } },
  generate: { grade: '7', topic: 'מספרים מכוונים', level: 'חיבור', count: 3, examples: '1+1' },
  check: { grade: '8', image: 'data:image/jpeg;base64,/9j/4AAQ', mediaType: 'image/png', question: '2x=4' },
  exam: {
    grade: '8',
    pages: [{ data: 'data:image/jpeg;base64,/9j/4AAQ', mediaType: 'image/jpeg' }, { data: 'data:application/pdf;base64,JVBERi0x', mediaType: 'application/pdf' }],
    topics: [{ id: 'line', title: 'פונקציה קווית', levels: ['א', 'ב'] }],
    key: [{ prompt: 'מה השיפוע?', answer: '3' }],
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
  const text = JSON.stringify(make(), null, 1); // the layout the file has always had
  if (process.argv.includes('--check')) {
    const same = (() => { try { return readFileSync(OUT, 'utf8') === text; } catch { return false; } })();
    console.log(same ? 'full-params.json is up to date' : 'full-params.json differs from the builders: run node test/fixtures/make-full-params.mjs');
    process.exit(same ? 0 : 1);
  }
  writeFileSync(OUT, text);
  console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
}
