// For the claims' tests (STUDENT-17): code readers over the real repository with some files added or changed, so a test
// can say "after the merge" (another lane's code is here) or "the app lost a feature" without touching the files.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MADREGOT = fileURLToPath(new URL('../../../../', import.meta.url));

/** The repository as it is, with `extra` appended to (or, for a file that does not exist, standing as) a file's text. */
export function codeWith(extra = {}, { drop = [] } = {}) {
  const real = (p) => { try { return readFileSync(join(MADREGOT, p), 'utf8'); } catch { return null; } };
  return {
    has: (p) => !drop.includes(p) && (p in extra || existsSync(join(MADREGOT, p))),
    read: (p) => (drop.includes(p) ? '' : `${real(p) ?? ''}${p in extra ? `\n${extra[p]}` : ''}`),
  };
}

/** The names each other lane's code has where it was built (what web/src/content/claims.js looks for). */
export const MERGED = {
  'worker/src/assignments.js': 'a.due_on',
  'worker/src/index.js': "if (M === 'GET' && p === '/api/teacher/assignments') …\nif (M === 'POST' && p === '/api/teacher/class/delete') …\nif (M === 'POST' && p === '/api/ai/report') …",
  'web/src/lib/teacherCsv.js': "const type = 'text/csv;charset=utf-8';",
  'web/src/content/schools/teacher-guide.md': '# מדריך',
  'web/src/content/schools/parent-letter.md': '# מכתב',
  'web/src/content/schools/principal-approval.md': '# אישור',
  'worker/scripts/pilot.mjs': 'export function pilotReport() {}',
  'worker/scripts/owner.mjs': '//   pilot-report --class C',
  'web/src/components/report/ShareSheet.jsx': 'export function ShareSheet({ open, onOpenChange, start }) {}',
  'web/src/lib/teacherDemo.js': 'export const DEMO = {};',
  'web/src/screens/Welcome.jsx': "const wantsDemo = params.get('start') === 'demo';",
  'shared/schoolRules.js': "export function classAiPolicy(cls = {}, env = {}) { return { reason: 'not_in_catalogue' }; }",
  'shared/tutorContext.js': "export const POLICIES = Object.freeze(['withhold', 'reveal', 'homework']);",
  'shared/guard.js': 'export function withholdCheck() {}',
  'worker/src/family.js': "export const LINK_PURPOSES = Object.freeze(['plan', 'consent']);",
};
