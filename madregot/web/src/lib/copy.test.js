// Small trust fixes in the app's words (trust spec TRUST-12 §2-3): the AI is never called a teacher, and a child joining
// a class is told which name the teacher will see.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorText } from './api.js';
import { nameClaimHint } from '@/screens/Welcome.jsx';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const TEXT = /\.(jsx?|tsx?|md|json|css|html)$/;
function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (TEXT.test(name)) yield p;
  }
}
// built from parts, so this file never matches itself
const PRIVATE_TEACHER = ['המורה', 'הפרטי'].join(' ');
const ANY_PRIVATE_TEACHER = new RegExp(['מורה', 'פרטי'].join('\\s+'));

describe('the AI is never called a teacher', () => {
  it(`no "${PRIVATE_TEACHER}" (or any private-teacher wording) anywhere in web/src`, () => {
    const hits = [];
    for (const f of files(SRC)) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => { if (ANY_PRIVATE_TEACHER.test(line)) hits.push(`${relative(SRC, f)}:${i + 1}`); });
    }
    expect(hits).toEqual([]);
  });
});

describe('the name a child takes in a class', () => {
  it('says which name the teacher will see, and how to tell two children apart', () => {
    expect(nameClaimHint('  נועה   כהן ')).toBe('המורה יראה את השם נועה כהן. אם יש בכיתה עוד מישהו עם אותו שם, חזרו אחורה והוסיפו אות משם המשפחה, למשל: נועה כ.');
  });
  it('a wrong PIN also says the name may be someone else\'s', () => {
    expect(errorText('wrong_pin')).toContain('אם זו הפעם הראשונה שלכם בכיתה, אולי מישהו כבר בחר את השם הזה: הוסיפו אות משם המשפחה.');
    expect(errorText('wrong_pin')).toMatch(/^הקוד האישי לא נכון\./);
  });
});
