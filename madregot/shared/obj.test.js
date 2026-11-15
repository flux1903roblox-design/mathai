// shared/obj.js, shared/alphabet.js and shared/stairs.js stairName (COUNCIL2-23): the one copy each that the app and the
// Worker import.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isObj } from './obj.js';
import { CODE_ALPHABET } from './alphabet.js';

const ROOT = new URL('..', import.meta.url).pathname;
/** Every source file (not a test) under a folder of the repo. */
function sources(dir) {
  const out = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const p = join(dir, name);
    if (statSync(join(ROOT, p)).isDirectory()) { if (name !== 'node_modules') out.push(...sources(p)); continue; }
    if (/\.(js|jsx|ts|tsx|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}
const FILES = [...sources('web/src'), ...sources('worker/src'), ...sources('shared')];

describe('isObj', () => {
  it('is true for a plain object only', () => {
    expect(isObj({})).toBe(true);
    expect(isObj({ a: 1 })).toBe(true);
    for (const v of [null, undefined, 0, 1, '', 'x', true, false, [], [1], () => {}]) expect(isObj(v), String(v)).toBe(false);
  });
  it('is the only copy: no source file defines its own', () => {
    const own = FILES.filter((f) => /\bconst isObj\s*=|function isObj\s*\(/.test(readFileSync(join(ROOT, f), 'utf8')));
    expect(own).toEqual(['shared/obj.js']);
  });
});

describe('CODE_ALPHABET', () => {
  it('31 symbols, none that looks like another (0, 1, I, L, O)', () => {
    expect(CODE_ALPHABET).toHaveLength(31);
    expect(new Set(CODE_ALPHABET).size).toBe(31);
    expect(CODE_ALPHABET).not.toMatch(/[01ILO]/);
  });
  it('is written out once, here: the app and the Worker import it', () => {
    const own = FILES.filter((f) => readFileSync(join(ROOT, f), 'utf8').includes(CODE_ALPHABET));
    expect(own).toEqual(['shared/alphabet.js']);
  });
});

describe('stairName', () => {
  it('is built in one place (shared/stairs.js); the report only wraps it with its words for a stair it does not know', () => {
    const own = FILES.filter((f) => /\b(const|function|let)\s+stairName\b/.test(readFileSync(join(ROOT, f), 'utf8')));
    expect(own.sort()).toEqual(['shared/stairs.js', 'web/src/learn/report.ts']);
    const report = readFileSync(join(ROOT, 'web/src/learn/report.ts'), 'utf8');
    expect(report).toMatch(/import \{ stairName as sharedStairName \} from '@shared\/stairs\.js'/);
    expect(report).toMatch(/export const stairName = \(skill: SkillId\): string => sharedStairName\(skill\) \?\? UNKNOWN_STAIR;/);
    // the Worker's emails use the same one
    expect(readFileSync(join(ROOT, 'worker/src/email.js'), 'utf8')).toMatch(/import \{ stairName \} from '\.\.\/\.\.\/shared\/stairs\.js'/);
  });
});
