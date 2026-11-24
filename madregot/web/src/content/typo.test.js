import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { itemPlain, answerText, figPlain } from './index.js';
import { itemFor } from '@/learn/items.ts';
import { loadAllContent } from '@/learn/content/index.ts';
import { ALL_SKILLS } from '@/learn/skills.ts';
import { seeded } from '@/learn/expr.ts';
import { countOf } from './util.js';

/**
 * PRODUCT2-9: the Hebrew and the notation a 13-year-old reads, kept clean by CI. Every generator, from every source a
 * lesson or a check draws (gen, diag, transfer), and every string of the teaching content are read as the student and
 * the AI see them: the question, its drawing in words, the answer, the hint, the worked solution and the choices.
 * (Ported from the council's typo scan, council2/math/typo.ts.)
 *
 * Banned: one written before a plural noun ($1$ חלקים: it is "חלק אחד"), one before כוס ("כוס אחת"), a definite article
 * doubled after ב, ל or כ (בהרביע, להסכום), a coefficient of 1 or 0 written out (1x, -1x, 0x), two signs in a row
 * (+ -3), a fraction over 1 (\frac{6}{1}), decimetres in a word problem, and a number that is not one (NaN, undefined).
 * A negative quantity keeps the plural (-1 מעלות), and a unit's short form is fine after one (1 ק״מ, $1$ ס״מ).
 */
const PLURALS = 'שעות|נקודות|מעלות|מטרים|חלקים|ימים|שנים|צעדים|ליטרים|כוסות|דקות|גולות|בולים|כדורים|תלמידים|קומות|משבצות|שקלים|רחובות|ספרים|עפרונות|מחברות|עטים|ילדים|קבוצות|אנשים|פעמים|מדבקות|עוגות|ארגזים|טיסנים|סיבובים|שאלות';
const DEFINITE = 'רביע|סכום|מספר|גובה|אורך|רוחב|מחיר|שטח|היקף|ציר|קופה|צמח|צורה|סולם|קיר|משולש|זווית|נקודה|ישר|גפרורים|מים|סוכר|מכנה|מונה';
// one as a number of its own: $1$, or a plain 1 after a space, a bracket or a maqaf that no sign stands before
// (n − 1 צעדים is an expression, −1 מעלות a negative)
const ONE = String.raw`(?:\$1\$|(?<![-−+=:·*/]\s)(?<=^|[\s(־])1)`;
const SLIPS = [
  ['one before a plural noun', new RegExp(`${ONE} (${PLURALS})(?=[\\s.,:?!)]|$)`)],
  ['one before כוס', new RegExp(`${ONE} כוס(?=[\\s.,:?!)]|$)`)],
  ['a doubled definite article', new RegExp(`(^|[\\s(״"'־])[בלכ]ה(${DEFINITE})`)],
  ['a coefficient of 1 or 0 written out', /(^|[^\d._])[-−]?[01]\s?[xyn](?![a-zA-Z])/],
  ['two signs in a row', /[+−-]\s*[-−]\s*\d/],
  ['a fraction over 1', /\\[dt]?frac\{-?\d+\}\{1\}/],
  ['decimetres', /דצ״מ|דצ"מ|דצימטר/],
  ['a number that is not one', /NaN|undefined|Infinity|\[object/],
];
// said on purpose: x is 1x, so 1 + 0.7 = 1.7 (sys:1, a worked example); −1x is written −x (expr:3's discovery); and the
// class's way of collecting (CLASSROOM-6, content/expr.js collectSolution, bracesTex, answerLines): when the x-terms
// cancel, 0x is written out and then dropped, "0x + 5 = 5"
const ALLOWED = ['$x$ הוא $1x$', 'יוצא $-1x$, שכותבים $-x$', /_\{0[a-z]\}/g, /= 0[a-z]\$/g, /\$0[a-z] [+-] \d+ = -?\d+\$/g];
/** The slips in a text, by name. */
function slipsIn(text) {
  const s = ALLOWED.reduce((t, a) => (typeof a === 'string' ? t.split(a).join('') : t.replace(a, '')), String(text ?? ''));
  return SLIPS.filter(([, re]) => re.test(s)).map(([name]) => name);
}

describe('the Hebrew and the notation are clean', () => {
  let CONTENT;
  const real = Math.random;
  beforeAll(async () => { CONTENT = await loadAllContent(); });
  afterAll(() => { Math.random = real; });

  it('knows each slip it bans, and passes the right wording', () => {
    expect(slipsIn('ו־$A$ נמצאת $1$ חלקים מ־$0$')).toEqual(['one before a plural noun']);
    expect(slipsIn('במתכון צריך 1 כוסות קמח')).toEqual(['one before a plural noun']);
    expect(slipsIn('לכל $1$ כוס סוכר')).toEqual(['one before כוס']);
    expect(slipsIn('נקודה בהרביע הראשון')).toEqual(['a doubled definite article']);
    expect(slipsIn('כתבו ביטוי להסכום בקופה')).toEqual(['a doubled definite article']);
    expect(slipsIn('$7x - 1x = 6x$')).toEqual(['a coefficient of 1 or 0 written out']);
    expect(slipsIn('ישר y = -1x + 4')).toEqual(['a coefficient of 1 or 0 written out']);
    expect(slipsIn('y = 0x - 3')).toEqual(['a coefficient of 1 or 0 written out']);
    expect(slipsIn('ישר y = 2x + -1')).toEqual(['two signs in a row']);
    expect(slipsIn('$m = \\frac{-5}{1} = -5$')).toEqual(['a fraction over 1']);
    expect(slipsIn('סולם באורך 23 דצ״מ')).toEqual(['decimetres']);
    expect(slipsIn('התשובה: NaN')).toEqual(['a number that is not one']);
    // the right wording, and what is fine
    ['ו־$A$ נמצאת חלק אחד מ־$0$', 'לכל כוס סוכר', 'נקודה ברביע הראשון', 'כתבו ביטוי לסכום בקופה', '$7x - x = 6x$',
      'ישר y = 2x - 1', 'y = -3', '$m = 5$', 'סולם באורך 2.3 מטר', 'ובפסגה -1 מעלות', '5 ס״מ במפה הם 1 ק״מ', '$10$ חלקים',
      '$21$ כוסות', '$-(-3)$', 'עד האיבר ה־$n$ יש $n - 1$ צעדים', 'n - 1 צעדים', '$m_1x + b_1$', '$x$ הוא $1x$, ו־$1 + 0.7 = 1.7$', '$\\frac{1}{2}$', 'שמים מים בכוס',
    ].forEach((t) => expect(slipsIn(t), t).toEqual([]));
    expect(countOf(1, 'חלק', 'חלקים')).toBe('חלק אחד');
    expect(countOf(1, 'כוס סוכר', 'כוסות סוכר', { oneWord: 'אחת' })).toBe('כוס סוכר אחת');
    expect(countOf(0.25, 'כוס', 'כוסות')).toBe('$0.25$ כוס');
    expect(countOf(3, 'חלק', 'חלקים')).toBe('$3$ חלקים');
    // the line of a graph in words, as a student writes it (it was y = 1x + -1)
    expect(figPlain({ type: 'coord', line: { m: 1, b: -1 } })).toBe('ישר y = x - 1');
    expect(figPlain({ type: 'coord', line: { m: -3, b: -5 } })).toBe('ישר y = -3x - 5');
    expect(figPlain({ type: 'coord', line: { m: 2, b: 0 } })).toBe('ישר y = 2x');
  });

  it('no generator, from any source, makes one', () => {
    Math.random = seeded(9);
    const found = {};
    // a lesson's questions and a check's (a stair with a check generator of its own, `testGen`, draws its check
    // questions from it: CURRICULUM-10)
    for (const skill of ALL_SKILLS) {
      for (const source of ['gen', 'diag', 'transfer']) {
        for (let i = 0; i < 300; i += 1) {
          const it = itemFor(skill, source, Math.random, undefined, undefined, { test: i % 2 === 1 });
          const parts = { question: itemPlain(it), drawing: figPlain(it.fig), answer: answerText(it), hint: it.hint, solution: [].concat(it.solution || []).join(' | ') };
          if (it.form === 'mc') parts.choices = it.choices.map((c) => c.tex ?? c.text).join(' / ');
          Object.entries(parts).forEach(([where, text]) => slipsIn(text).forEach((slip) => {
            const k = `${skill} ${source} ${String(it.key).split(':')[0]} ${where}: ${slip}`;
            found[k] ||= String(text).slice(0, 160);
          }));
        }
      }
    }
    expect(found).toEqual({});
  }, 120_000);

  it('the teaching content has none', () => {
    const found = {};
    const walk = (x, path) => {
      if (typeof x === 'string') { slipsIn(x).forEach((slip) => { found[`${path}: ${slip}`] ||= x.slice(0, 160); }); return; }
      if (Array.isArray(x)) x.forEach((v) => walk(v, path));
      else if (x && typeof x === 'object') Object.entries(x).forEach(([k, v]) => walk(v, `${path}.${k}`));
    };
    Object.entries(CONTENT).forEach(([skill, c]) => walk(c, skill));
    expect(found).toEqual({});
  });
});

// SK-MATH-3: no choice is offered twice (pyth:3 once offered the triangle 15, 27, 20 twice, in 10 of 770 questions).
// Two choices are the same when they read the same with spaces and TeX spacing left out.
describe('no choice is offered twice', () => {
  const real = Math.random;
  afterAll(() => { Math.random = real; });
  const same = (c) => String(c.tex ?? c.text).replace(/\\[,;:! ]|\s+/g, '').replace(/[{}]/g, '');
  it('in every choice question of every generator, from every source', async () => {
    await loadAllContent();
    Math.random = seeded(77);
    const found = {}; let n = 0;
    for (const skill of ALL_SKILLS) {
      for (const source of ['gen', 'diag', 'transfer']) {
        // a lesson's questions and a check's, as above
        for (let i = 0; i < 1000; i += 1) {
          const it = itemFor(skill, source, Math.random, undefined, undefined, { test: i % 2 === 1 });
          if (it.form !== 'mc') continue;
          n += 1;
          const shown = it.choices.map(same);
          if (new Set(shown).size < shown.length) found[`${skill} ${source} ${String(it.key).split(':')[0]}`] ||= shown.join(' / ');
        }
      }
    }
    expect(n).toBeGreaterThan(5000);
    expect(found).toEqual({});
  }, 120_000);
});
