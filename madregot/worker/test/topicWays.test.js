// The tutor's ways for curriculum stage 1 (curriculum spec CURRICULUM-3, -4, -5; ai spec AI-2's rules): each topic has
// its models, the app's words and the shortcuts never taught as a rule; each shortcut stated as a rule is caught, the
// app's own naming of the mistake is not, and no line of the app's teaching content trips any pattern.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { TOPIC_WAYS_STAGE1 as WAYS, SIGNED_FRACTIONS } from '../../shared/topicWays.js';

const read = (url) => readFileSync(url, 'utf8');
const any = (res, text) => res.some((r) => r.test(text));
const ALL = Object.values(WAYS).flatMap((w) => w.avoidRe);

test('frac, ratio and pct each have models, the app\'s words, and a pattern for every shortcut never taught as a rule', () => {
  assert.deepEqual(Object.keys(WAYS), ['frac', 'ratio', 'pct']);
  for (const [id, w] of Object.entries(WAYS)) {
    assert.ok(typeof w.models === 'string' && w.models.length > 200, `${id}: models`);
    assert.ok(Array.isArray(w.words) && w.words.length >= 5 && w.words.every((x) => /[א-ת]/.test(x)), `${id}: words`);
    assert.ok(Array.isArray(w.avoid) && w.avoid.length >= 3, `${id}: avoid`);
    assert.ok(w.avoidRe.length >= w.avoid.length && w.avoidRe.every((r) => r instanceof RegExp), `${id}: one pattern or more per shortcut`);
  }
  assert.match(WAYS.frac.models, /number line.*gaps, not the marks.*padding with zeros.*common denominator.*reciprocal.*signed-number rules/s);
  assert.match(WAYS.pct.models, /hundredths.*percent bar.*double number line.*more than \$100\\%\$.*before the change.*do not cancel/s);
  assert.match(WAYS.ratio.models, /order the question asks.*changes the ratio.*one unit.*double number line.*half the perimeter.*square of the scale factor/s);
  assert.match(SIGNED_FRACTIONS, /stair 6.*\$-2\.5 \+ 1\.2 = -1\.3\$.*farther from zero/);
});

test('a shortcut stated as a rule is caught', () => {
  const caught = {
    frac: [
      'מכנה גדול יותר נותן שבר גדול יותר.',
      'המכנה הגדול יותר זה השבר הגדול.',
      'ככל שהמכנה גדול יותר, השבר גדול יותר.',
      'מחברים מונה עם מונה ומכנה עם מכנה.',
      'פשוט מחברים את המונים ואת המכנים.',
      'כפל תמיד מגדיל.',
      'זכרו: כפל מגדיל וחילוק מקטין.',
      'כשכופלים ב־10 מזיזים את הנקודה העשרונית.',
      'מזיזים את הנקודה שני מקומות ימינה.',
      'כדי לחבר שברים עושים כפל בהצלבה.',
    ],
    ratio: [
      'מוסיפים אותו מספר לשני החלקים, והיחס נשאר.',
      'הוספה של אותו מספר לשני חלקי היחס שומרת על היחס.',
      'עושים כפל בהצלבה ומקבלים את התשובה.',
      'מחלקים את ההיקף ביחס 2 : 3.',
      'השטח גדל פי אותו מספר.',
      'השטח גדל כמו האורך.',
    ],
    pct: [
      'אחוז לא יכול להיות יותר מ־100.',
      'האחוזים אף פעם לא עוברים 100.',
      'אין יותר מ־$100\\%$.',
      'מורידים את האחוזים מהמחיר.',
      'התייקרות והוזלה באותו אחוז מבטלות זו את זו.',
      'עלייה וירידה באותו אחוז מחזירות את המחיר.',
      'מחלקים באחוז.',
    ],
  };
  for (const [id, lines] of Object.entries(caught)) lines.forEach((l) => assert.ok(any(WAYS[id].avoidRe, l), `${id}: ${l}`));
});

test('the app\'s own naming of the mistake, its quoted words and its right teaching pass', () => {
  const pass = [
    // the mistakes as the content names them ("חשבו ש…": a pattern never starts right after a Hebrew letter)
    'חשבו שמכנה גדול יותר נותן שבר גדול יותר',
    'חשבו שכפל תמיד מגדיל ושחילוק תמיד מקטין',
    'חשבו שהתייקרות והוזלה באותו אחוז מבטלות זו את זו',
    'חשבו שהוספה של אותו מספר לשני חלקי היחס שומרת עליו',
    'חשבו שהשטח גדל פי אותו מספר כמו האורכים',
    // quoted
    'הכלל "כפל תמיד מגדיל" לא נכון לשברים.',
    'אומרים "מכנה גדול יותר נותן שבר גדול יותר", אבל זה הפוך.',
    // right teaching, in the app's words
    'באותו מונה: מכנה גדול יותר הוא חלקים קטנים יותר.',
    'כפל במספר גדול מ־$1$ מגדיל: יותר מפעם אחת $12$.',
    'מחברים את המונים, והמכנה נשאר.',
    'מזיזים את הנקודה כי כל ספרה עוברת למקום של פי 10: עשיריות הופכות למאיות.',
    'מחלקים ביחס את חצי ההיקף.',
    'הזיזו את הנקודה אל $B(5, 2)$.',
    'מזיזים את הנקודה העשרונית ספרה אחת ימינה, כי עשיריות הופכות לשלמים.',
    'כשהאורכים גדלים פי $3$, השטח גדל פי $9$.',
    'השטח גדל פי אותו מספר בריבוע.',
    'יכול להיות יותר מ־$100\\%$?',
    'התייקרות והוזלה באותו אחוז לא מחזירות את המחיר.',
    'מחלקים ב־$100$ וכופלים ב־$20$.',
    'כפל בהצלבה הוא אותו דבר כמו לעבור דרך יחידה אחת.',
  ];
  pass.forEach((l) => assert.ok(!any(ALL, l), l));
});

test('no line of the app\'s teaching content, generators or challenges trips a pattern: the tutor may quote the app', () => {
  const dirs = ['../../web/src/learn/content/', '../../web/src/content/', '../../web/src/learn/challenges/'].map((d) => new URL(d, import.meta.url));
  const files = dirs.flatMap((dir) => readdirSync(dir).filter((f) => /\.(ts|js)$/.test(f) && !f.includes('.test.')).map((f) => new URL(f, dir)));
  assert.ok(files.length > 30, `${files.length} files`);
  for (const url of files) {
    read(url).split('\n').forEach((line, i) => assert.ok(!any(ALL, line), `${url.pathname.split('/').slice(-2).join('/')}:${i + 1} ${line.trim().slice(0, 90)}`));
  }
  // and the ways themselves name the shortcuts only in quotation marks or in English
  for (const w of Object.values(WAYS)) [w.models, ...w.avoid, ...w.words].forEach((t) => assert.ok(!any(ALL, t), t));
  assert.ok(!any(ALL, SIGNED_FRACTIONS));
});

test('no lookbehind: the file ships to the browser (Safari before 16.4 cannot load one)', () => {
  assert.equal(read(new URL('../../shared/topicWays.js', import.meta.url)).includes('(?<'), false);
  ALL.forEach((r) => assert.equal(r.source.includes('(?<'), false, r.source));
});
