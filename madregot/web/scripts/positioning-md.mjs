// The numbers docs/POSITIONING.md states about Madregot itself (COUNCIL2-38), generated from the code: the proofs table
// (named mistakes, programme coverage, topics and stairs; the rows that wait for the owner's data say so) and the
// named-mistake count in "מה אי אפשר להעתיק בשבוע". Both sit between <!-- generated:… --> markers in the document; the
// rest of it (the rivals, dated and sourced) is written by hand. src/content/claims.test.js fails when a generated part
// is stale, so the document can never say 92 while the app counts 119 again.
//
//   npm run positioning:md      writes the generated parts (vite-node scripts/positioning-md.mjs write)
//   npm run positioning:check   writes nothing; exits 1 when the committed document is stale
// (plain words, not --write/--check: those would also wake programme-md.mjs, which this file imports)
//
// It runs under vite-node for the same reason as programme-md.mjs: the counts come from the app's TypeScript content.
import { countNamedMistakes } from '@/content/claims.js';
import { coverageOf, GRADE_NAME } from '@/learn/programme';
import { countsOf } from './programme-md.mjs';

export const DOC = 'docs/POSITIONING.md';

/**
 * The share of both grades' programme hours the app teaches, as a whole percentage (claims.js programmeCoverage gives
 * each grade's own sentence since SK-BUYERS-3, so the document adds the two here).
 */
export const bothGrades = (g) => {
  const hours = (g['7']?.hours || 0) + (g['8']?.hours || 0);
  return hours ? Math.round((100 * ((g['7']?.taught || 0) + (g['8']?.taught || 0))) / hours) : null;
};

/** The generated parts, by marker name. */
export function parts() {
  const mistakes = countNamedMistakes();
  const g = Object.fromEntries(['7', '8'].map((x) => [x, coverageOf(x)]));
  const pct = bothGrades(g);
  const counts = countsOf();
  const grades = ['7', '8'].map((x) => `${GRADE_NAME[x]} ${g[x].taught} מתוך ${g[x].hours} שעות`).join(', ');
  return {
    mistakes: `- **מודל הטעויות.** הקוד מכיר כרגע ${mistakes} טעויות בשמן (\`countNamedMistakes()\` ב־\`web/src/content/claims.js\`; המספר בדפים
  הציבוריים מחושב, לא מוקלד), ולכל אחת יש הסבר, סיבה ותרגול שמתקן. לבנות את זה לכל מדרגה לוקח חודשים, וזה מה שהופך
  "תשובה לא נכונה" ל"מה כנראה קרה".`,
    proofs: [
      '| מה | מאיפה המספר | היום |',
      '|---|---|---|',
      `| טעויות בשמן | \`countNamedMistakes()\` ב־\`web/src/content/claims.js\`; אותו מספר בדף \`/mivchan/\` | ${mistakes} |`,
      `| כיסוי שעות התכנית | \`programmeCoverage()\` ו־\`coverageOf()\` (CURRICULUM-1); הפירוט ב־\`PROGRAMME.md\` | ${pct}% משעות שתי השכבות (${grades}) |`,
      `| נושאים ומדרגות | \`countsOf()\` ב־\`web/scripts/programme-md.mjs\` (\`store/counts.json\`) | ${counts.stairs} מדרגות ב־${counts.topics} נושאים |`,
      '| מספרי הפיילוט | TEACHER-11 `npm run owner -- pilot-report --class …` | עוד אין נתון: לא היה פיילוט |',
      '| הגעה (דפים, התקנות, תזכורות, אפליקציות החנות) | `npm run owner -- reach --days 28` (STUDENT-14) | עוד אין נתון: השרת לא הועלה |',
      '| עלות למשפחה | `npm run owner -- usage` ודוח AI-9 | עוד אין נתון: העוזר לא רץ מול מפתח אמיתי |',
    ].join('\n'),
  };
}

const mark = (name) => [`<!-- generated:${name} (npm run positioning:md) -->`, `<!-- /generated:${name} -->`];

/** The document with its generated parts replaced. Throws if a marker is missing. */
export function apply(doc, p = parts()) {
  let out = doc;
  for (const [name, text] of Object.entries(p)) {
    const [open, close] = mark(name);
    const a = out.indexOf(open); const b = out.indexOf(close);
    if (a < 0 || b < a) throw new Error(`${DOC}: the markers for "${name}" are missing`);
    out = `${out.slice(0, a + open.length)}\n${text}\n${out.slice(b)}`;
  }
  return out;
}

/** The generated part `name` as the document has it now. */
export function current(doc, name) {
  const [open, close] = mark(name);
  const a = doc.indexOf(open); const b = doc.indexOf(close);
  return a < 0 || b < a ? null : doc.slice(a + open.length, b).replace(/^\n|\n$/g, '');
}

const write = process.argv.slice(2).includes('write');
const check = process.argv.slice(2).includes('check');
if (write || check) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const file = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), DOC);
  const now = fs.readFileSync(file, 'utf8');
  const next = apply(now);
  if (now === next) console.log('up to date');
  else if (write) { fs.writeFileSync(file, next); console.log(`wrote ${DOC}`); }
  else { console.error(`out of date: ${DOC} (run npm run positioning:md)`); process.exit(1); }
}
