// The printed practice exam (PRODUCT2-2, PRODUCT2-5, council round 2): every printed question can be answered with pen
// and paper, and a photographed exam is graded by the lesson's own rule. Over 500 exams per grade (all topics, 6, 10
// and 14 questions, students at every level): no question asks to tap, drag, turn or move anything, none is an object
// on the screen or a practice-only question, every printed key typed back is graded right by code, a counting
// question's key is a whole count, and an answer the lesson rejects (a rounding of 1/36 that is 1/35's, 0.59 for 7/12,
// a length off its exact value) is graded wrong. Synthetic data only.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TOPIC, topicsFor, bridgeTopicsFor, makeItem as realMakeItem, answerText, isCorrect, answerInput } from '@/content/index.js';
import { loadAllContent } from '@/learn/content/index.ts';
import { makePracticeExam, practiceItem, printable, examKey, makeClassExam } from './exam.js';
import { gradeByKey, choiceLetter } from './examGrade.js';

// every question the generators make, by its key as an exam keeps it: so a printed question can be traced back to the
// generator's own item (a frozen question no longer says whether it was practice-only)
const made = new Map();
vi.mock('@/content/index.js', async (importOriginal) => {
  const m = await importOriginal();
  return { ...m, makeItem: (...args) => { const it = m.makeItem(...args); made.set(examKey(it.key), it); return it; } };
});

await loadAllContent();

/** A small seeded generator (mulberry32), so a run can be repeated. */
const seeded = (seed) => { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; };
afterEach(() => { vi.restoreAllMocks(); });

/** The words of a question that only the screen can do (the council's list). */
const SCREEN = /הקישו|גררו|סובבו|שימו|הזיזו|הורידו מהכפות/;
/** A question that asks how many of something that is counted. */
const COUNTED = /כמה\s+(?:חרוזים|גולות|מדבקות|קלפים|בולים|מטבעות|כרטיסים|תרנגולות|ארנבים|טיסנים|עטים|ארגזים|צופים|ספרים|גפרורים|תלמידים|מספרים|מהמספרים|מהמשולשים|פעמים)/;
const q = (studentAnswer, status = 'wrong') => ({ number: '1', prompt: 'שאלה', studentAnswer, status, correctAnswer: '', feedback: '', solution: [] });
/** What the printed key line shows (PracticeExam.jsx KeyAnswer): the choice's letter, or the answer and its unit. */
const printedKey = (it) => (it.form === 'mc' ? choiceLetter(it.value) : `${it.answer}${it.unit ? ` ${it.unit}` : ''}`);

describe('the printed practice exam: pen and paper, graded by the lesson\'s rule', () => {
  it('500 exams per grade over all topics (6, 10 and 14 questions), and 100 on the fractions floor: nothing for the screen, every key typed back is right', () => {
    vi.spyOn(Math, 'random').mockImplementation(seeded(20261111));
    const rnd = seeded(77);
    const forms = new Set(); const stairs = new Set();
    let printed = 0; let counted = 0;
    // each grade's own topics, 500 exams each, and 100 more over the fractions floor (a bridge unit: its stairs are
    // practised and checked like any other)
    for (const [grade, N] of [['7', 500], ['8', 500], ['floor', 100]]) {
      const ids = (grade === 'floor' ? bridgeTopicsFor('7') : topicsFor(grade)).map((t) => t.id);
      for (let n = 0; n < N; n += 1) {
        // a new student (every topic at its first stair) one time in five, else a student somewhere on every topic
        const progress = n % 5 === 0 ? {} : Object.fromEntries(ids.map((id) => [id, { level: 1 + Math.floor(rnd() * TOPIC[id].levels.length) }]));
        const len = [6, 10, 14][n % 3];
        made.clear();
        const items = makePracticeExam(ids, len, progress);
        expect(items, `${grade} #${n}`).toHaveLength(len);
        expect(new Set(items.map((x) => x.key)).size).toBe(len);
        for (const it of items) {
          printed += 1; forms.add(it.form); stairs.add(`${it.topic}:${it.level}`);
          const raw = made.get(it.key);
          const where = `${it.topic}:${it.level} ${it.key}`;
          expect(raw, where).toBeTruthy();
          expect(it.form, where).not.toBe('manip');
          expect(raw.practiceOnly, where).not.toBe(true);
          expect(printable(raw), where).toBe(true);
          expect(it.text, where).not.toMatch(SCREEN);
          // stored as the lesson checks it: the flags travel, the key is the printed text
          for (const f of ['precise', 'reduced', 'askDec', 'exactDec']) expect(it[f] === true, `${where} ${f}`).toBe(raw[f] === true);
          if (raw.form === 'num' && Number.isFinite(raw.exact)) expect(it.exact).toBe(raw.exact);
          expect(it.answer).toBe(answerText(raw));
          expect(isCorrect({ ...it, answer: it.value }, answerInput(raw)), where).toBe(true);
          // the printed key, typed back as a student would write it, is right by code
          const out = gradeByKey(q(printedKey(it)), it);
          expect(out, `${where}: ${printedKey(it)}`).toMatchObject({ graded: 'key', status: 'correct' });
          // a counting question's key is a whole count
          if (it.form === 'num' && COUNTED.test(it.text)) { counted += 1; expect(Number.isInteger(it.value), `${where} ${it.answer}`).toBe(true); }
        }
      }
    }
    expect(printed).toBeGreaterThan(9000);
    expect(counted).toBeGreaterThan(50);
    for (const f of ['num', 'mc', 'pt', 'lin', 'line', 'frac']) expect(forms.has(f), f).toBe(true);
    // every stair with something printable is reached (all of them today)
    expect(stairs.size).toBeGreaterThan(60);
  }, 120_000);

  it('a stair whose questions are mostly on the screen still prints: coord:2, eq:1, stats:3, angles:1 and ratio:1 alone', () => {
    for (const [id, level] of [['coord', 2], ['eq', 1], ['stats', 3], ['angles', 1], ['ratio', 1], ['pct', 1]]) {
      const items = makePracticeExam([id], 10, { [id]: { level } });
      expect(items, `${id}:${level}`).toHaveLength(10);
      for (const it of items) { expect(it.form).not.toBe('manip'); expect(made.get(it.key).practiceOnly).not.toBe(true); }
    }
  });

  it('the class exam draws through the same rule: no practice-only question either', () => {
    for (const skill of ['ratio:1', 'pct:1', 'pct:2', 'ratio:3', 'eq:1', 'stats:2']) {
      for (const it of makeClassExam([skill], 6).items) {
        expect(it.form, skill).not.toBe('manip');
        expect(it.text, skill).not.toMatch(SCREEN);
      }
    }
  });

  it('the printable rule: objects, practice-only questions and screen words are out', () => {
    expect(printable({ form: 'num', text: 'חשבו:' })).toBe(true);
    expect(printable({ form: 'manip', text: 'מה אורך היתר?' })).toBe(false);
    expect(printable({ form: 'mc', text: 'מה גדול יותר?', practiceOnly: true })).toBe(false);
    expect(printable({ form: 'num', text: 'הזיזו את הסמן לתוצאה:' })).toBe(false);
    expect(printable(null)).toBe(false);
  });
});

describe('a counting question\'s key is a count', () => {
  it('beads to colour (ratio:1) and parts of a bar (pct:1): "k מתוך n", never a fraction', () => {
    let beads = 0; let bars = 0;
    for (let i = 0; i < 600; i += 1) {
      for (const [id, level] of [['ratio', 1], ['pct', 1]]) {
        const it = realMakeItem(id, level);
        if (it.form !== 'manip' || it.manip.kind !== 'fbar' || !it.manip.lockDen) continue;
        if (id === 'ratio') beads += 1; else bars += 1;
        const m = answerText(it).match(/^(\d+) מתוך (\d+)$/);
        expect(m, `${it.key} ${answerText(it)}`).toBeTruthy();
        expect(Number(m[2])).toBe(it.manip.start.den);
        expect(Number(m[1]) / Number(m[2])).toBeCloseTo(it.answer.value, 9);
      }
    }
    expect(beads).toBeGreaterThan(10); expect(bars).toBeGreaterThan(10);
    // the council's bead string: 20 beads, red to blue 4 : 1, colour 16
    const it = { form: 'manip', manip: { kind: 'fbar', start: { den: 20, shaded: 0 }, lockDen: true }, answer: { mode: 'value', value: 4 / 5 } };
    expect(answerText(it)).toBe('16 מתוך 20');
  });
});

describe('grading a photographed practice exam keeps the lesson\'s exactness', () => {
  const frozen = (raw) => practiceItem({ key: 'k', topic: 'frac', level: 3, levelTitle: '', text: 'חשבו:', form: 'num', solution: [], hint: '', ...raw });
  const grade = (said, it) => gradeByKey(q(said, 'correct'), it).status;

  it('a precise answer is compared exactly: 1/35 is wrong for 1/36, 0.59 is wrong for 7/12', () => {
    const d36 = frozen({ answer: 1 / 36, precise: true });
    expect(d36).toMatchObject({ precise: true, answer: '1/36' });
    expect([grade('1/36', d36), grade('$\\frac{1}{36}$', d36), grade('1/35', d36), grade('0.0285', d36)]).toEqual(['correct', 'correct', 'wrong', 'wrong']);
    const d712 = frozen({ answer: 7 / 12, precise: true });
    expect([grade('7/12', d712), grade('0.58', d712), grade('0.59', d712), grade('14/24', d712)]).toEqual(['correct', 'correct', 'wrong', 'correct']);
    // 0.125 is right, and so is its rounding to two places (0.13), never 0.12; an ordinary question keeps ±0.01
    const eighth = frozen({ answer: 0.125, precise: true, fmt: 'dec' });
    expect([grade('0.125', eighth), grade('1/8', eighth), grade('0.13', eighth), grade('0.12', eighth)]).toEqual(['correct', 'correct', 'correct', 'wrong']);
    const mean = frozen({ topic: 'stats', answer: 13 / 3 });
    expect([grade('4.33', mean), grade('4.3', mean)]).toEqual(['correct', 'wrong']);
  });

  it('a Pythagoras length is compared with its exact value, not the rounded key ± 0.05', () => {
    const root50 = frozen({ topic: 'pyth', level: 1, text: 'מה אורך היתר? אם יוצא מספר לא שלם, עגלו לעשירית.', answer: 7.1, exact: Math.sqrt(50), unit: 'ס״מ' });
    expect(root50).toMatchObject({ answer: '7.1', exact: Math.sqrt(50) });
    expect([grade('7.1', root50), grade('7.07', root50), grade('7.1 ס״מ', root50), grade('7.14', root50), grade('7', root50)]).toEqual(['correct', 'correct', 'correct', 'wrong', 'wrong']);
    // and by the lesson's rule (PRODUCT2-6, SK-MATH-2): a correct rounding at any finer place, never a wrong one
    expect([grade('7.071', root50), grade('7.12', root50), grade('7.05', root50)]).toEqual(['correct', 'wrong', 'wrong']);
  });

  it('a fraction in lowest terms is asked for: 8/10 is not the answer to "reduce 32/40"', () => {
    const it = practiceItem({ key: 'fr1r', topic: 'frac', level: 1, levelTitle: '', text: 'צמצמו עד הסוף:', display: '\\frac{32}{40}', form: 'frac', answer: 0.8, reduced: true, solution: [], hint: '' });
    expect(it).toMatchObject({ reduced: true, answer: '4/5', value: 0.8 });
    expect([grade('4/5', it), grade('\\frac{4}{5}', it), grade('8/10', it)]).toEqual(['correct', 'correct', 'wrong']);
    // a decimal is not a fraction: the lesson cannot read it, so the model's grade stays
    expect(gradeByKey(q('0.8', 'partial'), it)).toMatchObject({ graded: 'ai', status: 'partial' });
  });

  it('a question that asks for a decimal does not read a fraction; a number with its unit, thousands and a mixed number are read', () => {
    const dec = practiceItem({ key: 'fr2d:3:4', topic: 'frac', level: 2, levelTitle: '', text: 'כתבו כמספר עשרוני:', display: '\\frac{3}{4}', form: 'num', answer: 0.75, precise: true, fmt: 'dec', askDec: true, solution: [], hint: '' });
    expect(grade('0.75', dec)).toBe('correct');
    expect(gradeByKey(q('3/4', 'correct'), dec).graded).toBe('ai');
    const big = frozen({ topic: 'pct', answer: 2000 });
    expect([grade('2,000', big), grade('2000 ₪', big), grade('35%', frozen({ topic: 'pct', answer: 35 }))]).toEqual(['correct', 'correct', 'correct']);
    const mixed = frozen({ answer: 16 / 3, precise: true });
    expect([grade('5 1/3', mixed), grade('5\\frac{1}{3}', mixed), grade('16/3', mixed), grade('5 1/4', mixed)]).toEqual(['correct', 'correct', 'correct', 'wrong']);
  });

  it('a choice is read by the index the lesson keeps, and a line\'s key is written as a student writes it', () => {
    const mc = practiceItem({ key: 'm', topic: 'eq', level: 3, levelTitle: '', text: 'כמה פתרונות?', form: 'mc', choices: [{ text: 'אין פתרון' }, { text: 'פתרון אחד' }, { text: 'אין פתרון' }], answer: 1, solution: [], hint: '' });
    expect(mc).toMatchObject({ answer: 'פתרון אחד', value: 1 });
    expect([grade('ב', mc), grade('פתרון אחד', mc), grade('א', mc)]).toEqual(['correct', 'correct', 'wrong']);
    const line = practiceItem({ key: 'l', topic: 'line', level: 5, levelTitle: '', text: 'מצאו את משוואת הישר', form: 'line', answer: { m: -1, b: 1 }, solution: [], hint: '' });
    expect(line.answer).toBe('y = -x + 1');
    expect([grade('y = 1 - x', line), grade('y = -x - 1', line)]).toEqual(['correct', 'wrong']);
  });
});
