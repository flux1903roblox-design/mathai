// EXAM-MATERIAL 1a: the matcher that reads a teacher's message on the device. Realistic messages of both grades, each
// with the stairs it should tick; misspellings, missing niqqud and geresh, exclusions, English letters, numbers with
// units; and the property that it never ticks a stair outside the grade's catalogue and the bridge unit under it.
import { describe, it, expect } from 'vitest';
import { matchMaterial, materialCatalogue, normWord, wordFit, tokenize, exerciseSpans, ltrRuns, fromSyllabus, prepOf, SYNONYMS, MATERIAL_MAX, UNKNOWN_MAX, EXCLUDE_AFTER, EXCLUDE_ANY } from './examMaterial.js';
import { rescueTopicsFor, rowStairs, bridgeTopicsFor } from '@/content/topics.js';
import { PROGRAMME } from '@shared/programme.js';
import { syllabusGradeStairs } from '@shared/ai.js';

const r = (topic, from, to) => Array.from({ length: to - from + 1 }, (_, i) => `${topic}:${from + i}`);
const sorted = (list, grade) => { const order = materialCatalogue(grade).map((s) => s.id); return [...list].sort((a, b) => order.indexOf(a) - order.indexOf(b)); };

/** [message, stairs it ticks, { unknown: pieces listed as not recognised (each must be there), out: stairs taken out }] */
const G7 = [
  ['שלום לכולם, המבחן ביום שלישי יהיה על פרק 3: משוואות ובעיות מילוליות. בהצלחה!', [...r('eq', 1, 5)], { unknown: ['פרק 3'] }],
  ['לחזור על חזקות ושורשים', ['signed:7', 'pyth:1']],
  ["חומר למבחן: עמ' 40-62, פיתגורס ושטחים", [...r('area', 1, 4), ...r('pyth', 1, 5)], { unknown: ["עמ' 40-62"] }],
  ['המבחן על מספרים מכוונים: חיבור, חיסור, כפל וחילוק, סדר פעולות', ['signed:1', 'signed:3', 'signed:4']],
  ['בוחן ביום ראשון על מערכת צירים ורביעים', r('coord', 1, 5)],
  ['המבחן יכלול: זוויות צמודות, זוויות קודקודיות וסכום זוויות במשולש', ['angles:1', 'angles:2', 'angles:3']],
  ['תלמידים יקרים, ביום חמישי מבחן בגאומטריה: זוויות בין ישרים מקבילים, משולש שווה שוקיים וזווית חיצונית. להביא מד זווית וסרגל.', ['angles:4', 'angles:5'], { unknown: [] }],
  ['משוואות, בלי שאלות תנועה ובלי משוואות עם מכנים', r('eq', 1, 4), { out: ['eq:6', 'eq:7'] }],
  ['חוק הפילוג וכינוס איברים דומים', ['expr:3', 'expr:4']],
  ['ביטויים אלגבריים - הצבה, כינוס איברים, חוק הפילוג ופישוט', ['expr:1', 'expr:3', 'expr:4', 'expr:5']],
  ['שטחים והיקפים: מלבן, משולש, מקבילית וטרפז', ['area:1', 'area:2', 'area:4']],
  ['המבחן על תיבה ומנסרה: פריסה, שטח פנים ונפח', r('solid', 1, 4)],
  ['נתונים ושכיחות, דיאגרמת עוגה ושכיחות יחסית', r('data', 1, 4)],
  ['המבחן: אחוזים (אחוז מכמות, איזה אחוז, הנחות והתייקרויות)', ['pct:2', 'pct:3', 'pct:5']],
  ['יש מבחן במשפט פיתגורס ושימושיו, כולל מרחק בין נקודות', r('pyth', 1, 5)],
  ['סטטיסטיקה: שכיח, חציון וממוצע', ['stats:1', 'stats:2', 'stats:3']],
  ['מבחן בעוד שבוע על ממוצע, חציון, שכיח וטווח', ['stats:1', 'stats:2', 'stats:3', 'stats:6']],
  ['טרנספורמציות: הזזה, שיקוף וסיבוב. בלי ריצוף', ['transf:1', 'transf:2', 'transf:3'], { out: ['transf:4'] }],
  ['המבחן על מבוא לפונקציות - קריאת גרף של מצב', ['func:1'], { unknown: [] }],
  ['פונקציה קווית: טבלת ערכים ושיפוע', ['line:1', 'line:3', 'line:4']],
  ['לחזור על שברים: צמצום והרחבה, השוואת שברים וחיבור שברים', ['frac:1', 'frac:2', 'frac:3']],
  ['מבחן מחר! מספרים מכוונים, ערך מוחלט ונקודות במערכת צירים', [...r('signed', 1, 6), ...r('coord', 1, 5)]],
  ['הבוחן יהיה על כפל וחילוק של מספרים מכוונים וסדר פעולות חשבון', ['signed:3', 'signed:4']],
  ['בעיות מילוליות ושאלות תנועה (דרך, מהירות, זמן)', ['eq:5', 'eq:6'], { unknown: [] }],
  ['המבחן יהיה על כל הפרק של משוואות, כולל משוואות עם סוגריים ונעלם בשני האגפים', r('eq', 1, 4)],
  ['משוואות עם x בשני האגפים ומשוואות עם מכנים', ['eq:3', 'eq:7']],
  ['הזזה ושיקוף במערכת צירים', ['transf:1', 'transf:2']],
  ['נפח ושטח פנים של תיבה וקובייה', ['solid:1', 'solid:2']],
  ['שאלות על אחוזים ויחס', r('pct', 1, 5), { unknown: ['יחס'] }],
  ['המבחן בפרק 4 בספר (עמודים 112-130). נושאים: הסתברות ושכיחות יחסית', ['data:2', 'data:4'], { unknown: ['פרק 4', 'עמודים 112-130'] }],
  ['לא יהיו שאלות על סטטיסטיקה. המבחן על משוואות ואחוזים', [...r('eq', 1, 4), ...r('pct', 1, 5)], { out: r('stats', 1, 8) }],
  ['הבוחן על הצבה בביטוי וכתיבת ביטוי מתוך סיפור', ['expr:1', 'expr:2'], { unknown: [] }],
  ['תרגלו את דפי העבודה על ריבועים ושורשים ועל חזקות של מספרים שליליים', ['signed:7', 'pyth:1']],
  ['המבחן יכלול את כל מה שלמדנו בנושא זוויות', r('angles', 1, 7), { unknown: [] }],
  ['מבחן מסכם: מספרים מכוונים, ביטויים אלגבריים ומשוואות', [...r('signed', 1, 6), ...r('expr', 1, 5), ...r('eq', 1, 4)]],
  ['חזרה למבחן: גרף של פונקציה, טבלת ערכים ומשוואת ישר y=mx+b', ['func:1', 'line:1', 'line:2', 'line:5']],
  ['שימו לב: בלי חזקות! רק סדר פעולות וסוגריים', ['signed:4', 'signed:5'], { out: ['signed:7'], unknown: [] }],
  // misspellings, missing niqqud and geresh
  ['המבחן על משואות, ביטויים אלגבריים וכינוס אברים', [...r('expr', 1, 5), ...r('eq', 1, 4)]],
  ['פיטגורס וזויות במשולש', ['angles:3', ...r('pyth', 1, 5)]],
  ['מִשְׁוָאוֹת וּבְעָיוֹת מִלּוּלִיּוֹת', r('eq', 1, 5)],
  ['המבחן: שטח מקבילית, שטח טרפז, והיקפים', ['area:1', 'area:4', 'area:5']],
  ['אחוזים - הנחה של 20%, מציאת השלם', ['pct:4', 'pct:5'], { unknown: [] }],
  ['המבחן ביום רביעי 18.11. חומר: פרק 5 ופרק 6 בספר', [], { unknown: ['פרק 5', 'פרק 6'] }],
  ['דיאגרמות, שכיחות, וממוצע', ['data:1', 'data:2', 'stats:3']],
  ['בבוחן יהיו 5 שאלות על משפט פיתגורס, כולל שאלה מילולית', r('pyth', 1, 5)],
  ['המבחן: משוואות ממעלה ראשונה עם x, ובעיות עם x ו-y', r('eq', 1, 4), { unknown: ['x ו-y'] }],
  ['השוואת שברים ועשרוניים ושברים מכוונים', ['signed:6', 'frac:2']],
  ['ערך מוחלט, ישר המספרים ומספרים נגדיים', ['signed:2']],
  ["נפח של מנסרה משולשת (בסמ\"ק) ופריסה של קובייה", ['solid:1', 'solid:4'], { unknown: [] }],
  ['זוית חיצונית ומשולש שווה-שוקיים', ['angles:5']],
];

const G8 = [
  // the word problems beside the equations are the equations' (eq:5), not the systems' (sys:4): "near" reads the topic beside them
  ['המבחן יהיה על פרק 3: משוואות ובעיות מילוליות', r('eq', 1, 5), { unknown: ['פרק 3'] }],
  ['לחזור על חזקות ושורשים', ['pyth:1'], { unknown: ['חזקות'] }],
  ['משוואות, בלי שאלות תנועה', r('eq', 1, 4), { out: ['eq:6'] }],
  ['לא כולל אי-שוויונות: מערכת משוואות ופונקציה קווית', [...r('line', 1, 8), 'sys:2', 'sys:3', 'sys:4'], { out: ['sys:5'] }],
  ['המבחן על יחס, פרופורציה וקנה מידה', r('ratio', 1, 4)],
  ['אחוזים: הגדלה והקטנה באחוזים ומציאת השלם', ['pct:4', 'pct:5']],
  ['בוחן במעגל: היקף מעגל ושטח עיגול', ['circle:1', 'circle:2']],
  ['גליל וחרוט - נפח ושטח פנים', ['circle:3', 'circle:4']],
  ['פונקציות: ייצוגים, עלייה וירידה וקצב שינוי', ['func:2', 'func:3', 'func:4']],
  ['פונקציה קווית - שיפוע, נקודות חיתוך עם הצירים ומשוואת ישר', ['line:3', 'line:4', 'line:5', 'line:6'], { unknown: [] }],
  ['מבחן בסטטיסטיקה: ממוצע, חציון, שכיח, טווח, ושני מקורות מידע', ['stats:1', 'stats:2', 'stats:3', 'stats:6', 'stats:7']],
  ['חפיפת משולשים ומשפטי החפיפה, כולל הוכחות', r('congr', 1, 5)],
  ['המבחן יכלול: חפיפת משולשים, תיכון במשולש וצלעות במשולש', r('congr', 1, 5)],
  ['דמיון משולשים ויחס שטחים', ['sim:2', 'sim:3', 'sim:4']],
  // the words of sim:1's own name
  ['שווה שוקיים ומשפטים הפוכים', ['sim:1']],
  ['שווה שוקיים וזווית חיצונית, ודמיון משולשים', ['angles:5', 'sim:2', 'sim:3', 'sim:4']],
  ['מערכת משוואות: שיטת ההצבה והשוואת מקדמים', ['sys:2', 'sys:3']],
  ['הסתברות: מאורע משלים וניסוי בשני שלבים', ['prob:2', 'prob:3']],
  ['אי שוויונות', ['sys:5']],
  ['אי שיוויונות ואישוויונות', ['sys:5']],
  ['פיתגורס במרחב - אלכסון בתיבה', ['space:1']],
  ['המבחן על טרנספורמציות וחפיפה', [...r('transf', 1, 4), 'congr:1', 'congr:2', 'congr:3']],
  ['זוויות בין ישרים מקבילים ומשפט פיתגורס', ['angles:4', ...r('pyth', 1, 5)]],
  ['נתונים ושכיחות, שכיחות יחסית ודיאגרמת עוגה', r('data', 1, 4)],
  ['קנה מידה ומפות', ['ratio:4']],
  ['משוואות עם אחוזים ובעיות עם שני נעלמים', ['sys:1', 'sys:4']],
  ['שאלות תנועה ומשוואות עם מכנים', ['eq:6', 'eq:7']],
  ['אינטרפולציה ואקסטרפולציה', ['stats:8']],
  ['y=mx+b, שיפוע ונקודת מפגש של שני ישרים', ['line:2', 'line:3', 'line:4', 'line:5', 'line:8'], { unknown: [] }],
  ['חרוט, גליל ופיתגורס במרחב', ['circle:3', 'circle:4', 'space:1', 'space:2']],
  ['פונקצייה קווית ושיפוע', r('line', 1, 8)],
  ['בבוחן לא יהיו שאלות על הסתברות', [], { out: ['data:4', ...r('prob', 1, 3)] }],
  ['המבחן מחר על כל החומר של יחידה 8.12', [], { unknown: ['יחידה 8.12'] }],
  ['קצב שינוי אחיד ולא אחיד, וגרפים של מצב', ['func:1', 'func:4'], { unknown: [] }],
  ['המבחן יהיה על נושא הסתברות (פרק 7), לא כולל ניסוי בשני שלבים', ['data:4', 'prob:1', 'prob:2'], { out: ['prob:3'], unknown: ['פרק 7'] }],
  ["שלום כיתה ח'2, הבוחן ביום ראשון. נושאים: פונקציה קווית ומערכות משוואות", [...r('line', 1, 8), 'sys:2', 'sys:3', 'sys:4'], { unknown: [] }],
  ['לתרגל דמיון משולשים, יחס הדמיון ויחס שטחים', ['sim:2', 'sim:3', 'sim:4']],
  ['גיליון עבודה: שכיחות יחסית וממוצע משוקלל', ['data:2', 'stats:4'], { unknown: [] }],
  ['מבחן מתכונת על כל השנה', [], { unknown: [] }],
  ['אֲחוּזִים וְיַחַס', [...r('pct', 1, 5), 'ratio:1', 'ratio:2']],
  ['תרגילים 1-15 בעמוד 88: חרוט', ['circle:4'], { unknown: ['עמוד 88'] }],
  ['בלי מחשבון! המבחן על שורשים ופיתגורס', r('pyth', 1, 5)],
  ['שאלות על זוויות בין מקבילים ובמשולש שווה שוקיים', ['angles:4', 'angles:5', 'sim:1']],
  ['ווקטורים ומטריצות', [], { unknown: ['ווקטורים ומטריצות'] }],
  ['טווח, ממוצע וחציון, ושינוי של כל הנתונים', ['stats:2', 'stats:3', 'stats:6']],
  ['היקף ושטח של מעגל (ס"מ, סמ"ר) ונפח של גליל בליטרים', ['circle:1', 'circle:2', 'circle:3'], { unknown: [] }],
  ['פיטגורס, משפט פיתגורס ההפוך ומרחק בין שתי נקודות', r('pyth', 1, 5)],
];

function check(grade, [text, want, opts = {}]) {
  const got = matchMaterial(text, grade);
  expect(got.skills, `${grade}: ${text}\nhits: ${JSON.stringify(got.hits)}`).toEqual(sorted(want, grade));
  if (opts.out) expect(got.excluded, `${grade} out: ${text}`).toEqual(sorted(opts.out, grade));
  if (opts.unknown) {
    if (!opts.unknown.length) expect(got.unknown, `${grade} unknown: ${text}`).toEqual([]);
    opts.unknown.forEach((u) => expect(got.unknown, `${grade} unknown: ${text}`).toContain(u));
  }
}

describe('a teacher\'s message, read on the device (EXAM-MATERIAL 1a)', () => {
  it('has at least 40 messages a grade', () => {
    expect(G7.length).toBeGreaterThanOrEqual(40);
    expect(G8.length).toBeGreaterThanOrEqual(40);
  });
  G7.forEach((c, i) => it(`ז׳ ${i + 1}: ${c[0]}`, () => check('7', c)));
  G8.forEach((c, i) => it(`ח׳ ${i + 1}: ${c[0]}`, () => check('8', c)));

  it('a chapter, a page or a unit number alone is listed as not recognised, never guessed', () => {
    for (const g of ['7', '8']) {
      for (const text of ['פרק 3', "עמ' 40-62", 'המבחן על פרק 2 בספר', 'יחידה 4', 'עמודים 10-20 ותרגילים 1-5']) {
        const got = matchMaterial(text, g);
        expect(got.skills, text).toEqual([]);
        expect(got.unknown.length, text).toBeGreaterThan(0);
      }
    }
  });

  it('groups what it found by topic, in the order Exam Rescue lists the topics', () => {
    const got = matchMaterial('פיתגורס, משוואות ומספרים מכוונים', '7');
    expect(got.byTopic.map((x) => x.topic)).toEqual(['signed', 'eq', 'pyth']);
    expect(got.byTopic[0].title).toBe('מספרים מכוונים');
    expect(got.byTopic.flatMap((x) => x.skills)).toEqual(got.skills);
  });

  it('an empty or meaningless text finds nothing and lists nothing', () => {
    for (const text of ['', '   ', 'בהצלחה לכולם!', '😀😀', '12.11 בשעה 8:00']) {
      const got = matchMaterial(text, '7');
      expect(got.skills, text).toEqual([]);
      expect(got.unknown, text).toEqual([]);
    }
  });

  it('reads at most MATERIAL_MAX characters, and lists at most UNKNOWN_MAX pieces', () => {
    const long = `${'משוואות '.repeat(10)}${'א'.repeat(MATERIAL_MAX)} פיתגורס`;
    expect(matchMaterial(long, '7').skills).toEqual(r('eq', 1, 4));
    const noise = Array.from({ length: 12 }, (_, i) => `פרק ${i + 1}`).join(', ');
    expect(matchMaterial(noise, '7').unknown).toHaveLength(UNKNOWN_MAX);
  });
});

describe('the catalogue and its words', () => {
  it('the catalogue is Exam Rescue\'s rows of the grade and the bridge unit, nothing else', () => {
    for (const g of ['7', '8']) {
      const want = [...rescueTopicsFor(g).flatMap((t) => rowStairs(t).map((s) => s.id)), ...bridgeTopicsFor(g).flatMap((t) => rowStairs(t).map((s) => s.id))];
      expect(materialCatalogue(g).map((s) => s.id)).toEqual([...new Set(want)]);
    }
    // a ז׳ catalogue has the functions unit through its guest stair only, and no ח׳ geometry
    const seven = materialCatalogue('7').map((s) => s.id);
    expect(seven.filter((s) => s.startsWith('func:'))).toEqual(['func:1']);
    expect(seven.some((s) => /^(congr|sim|circle|sys|prob|space|ratio):/.test(s))).toBe(false);
  });

  it('property: whatever the text, every stair it ticks or takes out is in the grade\'s catalogue', () => {
    // every phrase of every key, of both grades, the programme's titles, and noise, in random mixes
    const phrases = [...SYNONYMS.flatMap(([p]) => p.split('|')), ...PROGRAMME.units.flatMap((u) => [u.title, ...u.parts.map((p) => p.note || '')])].filter(Boolean);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const glue = [', ', ' ו', ' בלי ', ' לא כולל ', ': ', '\n', ' - ', ' (פרק 3) ', ' עמ׳ 12 '];
    for (let n = 0; n < 400; n += 1) {
      const parts = Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => phrases[Math.floor(rnd() * phrases.length)]);
      const text = parts.map((p, i) => (i ? glue[Math.floor(rnd() * glue.length)] : '') + p).join('');
      for (const g of ['7', '8']) {
        const ids = new Set(materialCatalogue(g).map((s) => s.id));
        const got = matchMaterial(text, g);
        [...got.skills, ...got.excluded].forEach((s) => expect(ids.has(s), `${g}: ${s} from "${text}"`).toBe(true));
        expect(got.skills.some((s) => got.excluded.includes(s)), text).toBe(false);
      }
    }
  });

  it('every stair of each grade\'s catalogue can be reached by some word', () => {
    for (const g of ['7', '8']) {
      const reach = new Set();
      SYNONYMS.forEach(([p]) => p.split('|').forEach((x) => matchMaterial(x, g).skills.forEach((s) => reach.add(s))));
      const missing = materialCatalogue(g).map((s) => s.id).filter((s) => !reach.has(s));
      // what no synonym reaches is reached by the stair's own name
      missing.forEach((s) => expect(matchMaterial(materialCatalogue(g).find((c) => c.id === s).title, g).skills, `${g} ${s}`).toContain(s));
    }
  });

  it('words: niqqud, geresh, final letters and a doubled ו or י are read as one spelling', () => {
    expect(normWord('מִשְׁוָאוֹת')).toBe(normWord('משוואות'));
    expect(normWord('זוויות')).toBe(normWord('זויות'));
    expect(normWord("עמ'")).toBe('עמ');
    expect(normWord('ס"מ')).toBe('סמ');
    expect(normWord('חציון')).toBe('חציונ');
    expect(normWord('שיוויון')).toBe(normWord('שיויון'));
  });

  it('word fit: a prefix, another form of the word, one letter off; never a different word', () => {
    const fit = (k, w) => wordFit(normWord(k), normWord(w));
    expect(fit('חזקה', 'ובחזקות')).toBeGreaterThan(0);
    expect(fit('חזקה', 'חזקים')).toBe(0); // strong, not powers
    expect(fit('פיתגורס', 'פיטגורס')).toBe(1);
    expect(fit('שכיח', 'שכיח')).toBe(3);
    expect(fit('שכיחות', 'שכיח')).toBe(0);
    expect(fit('משוואה', 'משוואות')).toBe(2);
    expect(fit('זווית', 'הזוויות')).toBe(2);
    expect(fit('יחס', 'ויחס')).toBe(3);
    expect(fit('יחס', 'נחס')).toBe(0);
    expect(fit('מנסרה', 'מינסרה')).toBe(1);
  });

  it('tokens keep their clause, their line, and whether a list follows them', () => {
    const t = tokenize('אחוזים: הנחה, ריבית\nפונקציה קווית - שיפוע');
    expect(t.map((x) => x.w)).toEqual(['אחוזימ', 'הנחה', 'ריבית', 'פונקציה', 'קוית', 'שיפוע']);
    expect(t.map((x) => x.head)).toEqual([true, false, false, false, true, false]);
    expect(t.map((x) => x.line)).toEqual([0, 0, 0, 1, 1, 1]);
    expect(t[1].clause).toBeGreaterThan(t[0].clause);
    // a decimal point is not the end of a clause
    const d = tokenize('יחידה 8.12 ופרק 3');
    expect(d[1].clause).toBe(d[2].clause);
  });
});

// The review of EXAM-MATERIAL (after 2437420): messages as teachers send them, with the logistics around the topics
// ("בשעה השנייה", "ניפגש בחדר 23", "מי שלא היה בשיעור"), everyday words that look like a topic's ("שיעור", "השוואה",
// "כשנתון", "קובייה" beside a coin), a topic named in its own sentence before its parts, and words that bind to the
// topic beside them. Each failed before the fix (the reviewers' scratch runs: 19 of 32 exact, 28 wrong stairs).
const MORE7 = [
  ["היי ז'3 🙂 תזכורת: מחר מבחן במתמטיקה בשעה השנייה. החומר: מספרים מכוונים (כל הפעולות), חזקות וסדר פעולות. להביא מחשבון ודף טיוטה. בהצלחה!!", r('signed', 1, 7), { unknown: [] }],
  ['שלום הורים ותלמידים, ביום שלישי הקרוב יתקיים מבחן במתמטיקה. החומר: משוואות (כולל משוואות עם סוגריים) ובעיות מילוליות. משך המבחן 90 דקות.', r('eq', 1, 5), { unknown: [] }],
  ['תזכורת!! מחר בוחן בגיאומטריה - זוויות בין ישרים מקבילים, זוויות צמודות וקודקודיות. להביא מחוגה ומד-זווית 📐', ['angles:1', 'angles:2', 'angles:4'], { unknown: [] }],
  ['המבחן על הפרק של אחוזים, כולל שאלות על הנחה ומחיר מקורי', r('pct', 1, 5), { unknown: [] }],
  ['חזרה למבחן: פונקציה קווית - שיפוע וחיתוך עם הצירים, ואיך מוצאים משוואת ישר לפי שתי נקודות', ['line:3', 'line:4', 'line:5', 'line:6'], { unknown: [] }],
  // a topic alone in its sentence, its parts in the next: those parts
  ["מבחן בסטטיסטיקה ביום א'. ממוצע, חציון, שכיח. לא יהיה טווח.", ['stats:1', 'stats:2', 'stats:3'], { out: ['stats:6'], unknown: [] }],
  ['חומר לבוחן: הצבה בביטויים ופישוט ביטויים (כינוס איברים דומים). לא כולל פתיחת סוגריים.', ['expr:1', 'expr:3', 'expr:5'], { out: ['expr:4'], unknown: [] }],
  // "בעיקר" stresses a part, it does not narrow the whole
  ['מבחן מחר על כל מה שלמדנו בטרנספורמציות. בעיקר שיקופים וסיבובים במערכת צירים', r('transf', 1, 4), { unknown: [] }],
  ['המבחן: פיתגורס (מציאת יתר וניצב), ושאלות מילוליות על פיתגורס', r('pyth', 1, 5), { unknown: [] }],
  ["ז'2 - בוחן על מערכת צירים: נקודות ברביעים, אורך קטע ושטח מלבן", r('coord', 1, 4), { unknown: [] }],
  ['שלום, המבחן יהיה על נתונים: קריאת דיאגרמות, טבלת שכיחויות ודיאגרמת עוגה. מי שלא היה בשיעור האחרון שיצלם מחבר.', ['data:1', 'data:2', 'data:3'], { unknown: [] }],
  ['מבחן על הסתברות ושכיחות יחסית, כולל שאלות על קובייה ומטבע', ['data:2', 'data:4'], { unknown: [] }],
  ['המבחן על אחוזים: חישוב אחוז מכמות, ומציאת 100% כשנתון החלק', ['pct:2', 'pct:4'], { unknown: [] }],
  ['תרגלו פתרון משוואות כמו 3x-7=2x+5 ו-4(x+2)=20, המבחן ביום ג׳ בשעה 8:15', r('eq', 1, 4), { unknown: [] }],
  ['חומר למבחן מחצית: מספרים מכוונים, ביטויים, משוואות ופונקציות (קריאת גרפים).', [...r('signed', 1, 6), ...r('expr', 1, 5), ...r('eq', 1, 4), 'func:1'], { unknown: [] }],
  // "שיעור" is a lesson, never the coordinates
  ['המבחן יהיה בשיעור השני ויכלול משוואות ובעיות מילוליות', r('eq', 1, 5), { unknown: [] }],
  ['בשיעור הבא נעשה חזרה על חוק הפילוג, ובשבוע הבא מבחן', ['expr:4'], { unknown: [] }],
  ['המבחן על מה שלמדנו בשיעורים האחרונים: אחוזים', r('pct', 1, 5), { unknown: [] }],
  ["שיעורי בית: עמ' 50. המבחן על אחוזים", r('pct', 1, 5), { unknown: ["עמ' 50"] }],
  ['הבוחן יהיה בחצי השעה האחרונה של השיעור. נושא: זוויות', r('angles', 1, 7), { unknown: [] }],
  ['המבחן על שיעורי נקודה ברביע הראשון', ['coord:1', 'coord:2'], {}],
];
const MORE8 = [
  // "שיטת השוואה" is the comparison method of a system, never an equation
  ["שלום ח'4, מחר מבחן! החומר: פונקציה קווית, מערכת משוואות (שיטת השוואה והצבה). להביא מחשבון. בהצלחה ❤️", [...r('line', 1, 8), 'sys:2', 'sys:3'], { unknown: [] }],
  ['תזכורת: בוחן ביום ב׳ על מעגל ועיגול: היקף, שטח, ו-π. בלי גליל וחרוט', ['circle:1', 'circle:2'], { out: ['circle:3', 'circle:4'], unknown: [] }],
  ['המבחן יהיה על דמיון משולשים, משפטי דמיון ויחס שטחים. אין צורך במחשבון.', ['sim:2', 'sim:3', 'sim:4'], { unknown: [] }],
  ['חזרה לקראת המבחן: אי-שוויונות, מערכות משוואות ובעיות מילוליות עם שני נעלמים', ['sys:2', 'sys:3', 'sys:4', 'sys:5'], { unknown: [] }],
  ['מבחן מחר על פונקציות: מעבר בין ייצוגים, תחומי עלייה וירידה. לא יהיה קצב שינוי.', ['func:2', 'func:3'], { out: ['func:4'], unknown: [] }],
  ['המבחן: סטטיסטיקה - ממוצע משוקלל, חציון בטבלת שכיחויות, וטווח', ['stats:2', 'stats:4', 'stats:6'], { unknown: [] }],
  ['חזרה למבחן: שיפוע מגרף, שיפוע בין שתי נקודות, וישרים מקבילים (שיפוע שווה)', ['line:3', 'line:4'], { unknown: [] }],
  ['מבחן במעגל: רדיוס, קוטר, היקף מעגל, שטח עיגול', ['circle:1', 'circle:2'], { unknown: [] }],
  ['שלום לכולם, המבחן ביום חמישי. חומר: פרקים 5-6 בספר (משוואות, מערכת משוואות, אי שוויונות). ניפגש בשעה 8:10 בחדר 23', [...r('eq', 1, 4), 'sys:2', 'sys:3', 'sys:4', 'sys:5'], { unknown: ['פרקים 5-6'] }],
  ['הבוחן על הסתברות: מאורעות שווי הסתברות, מאורע משלים וניסוי דו שלבי (עץ / טבלה)', r('prob', 1, 3), { unknown: [] }],
  ['מבחן: y=2x+3, מציאת m ו-b, שיפוע וחיתוך עם ציר y', ['line:2', 'line:3', 'line:4', 'line:6'], { unknown: [] }],
  ['המבחן על פיתגורס כולל פיתגורס במרחב (אלכסון בתיבה). מי שצריך עזרה - שעת שהייה ביום ב׳', [...r('pyth', 1, 5), 'space:1'], { unknown: [] }],
  ['המבחן על חישוב שטח עיגול. השוואה בין שטחים של עיגולים.', ['circle:2'], {}],
];

describe('the review: logistics, everyday words, context (EXAM-MATERIAL 1a)', () => {
  MORE7.forEach((c, i) => it(`ז׳ ${i + 1}: ${c[0]}`, () => check('7', c)));
  MORE8.forEach((c, i) => it(`ח׳ ${i + 1}: ${c[0]}`, () => check('8', c)));

  it('everyday words fit only themselves; a misspelling never changes the first letter or comes with a prefix', () => {
    const fit = (k, w) => wordFit(normWord(k), normWord(w));
    expect(fit('משוואה', 'השוואה')).toBe(0); // comparing, not an equation
    expect(fit('נתונים', 'כשנתון')).toBe(0); // "when given", not data
    expect(fit('שיעורים', 'בשיעור')).toBe(0); // a lesson, not coordinates
    expect(fit('קטרים', 'ווקטורים')).toBe(0);
    expect(fit('פיתגורס', 'פיטגורס')).toBe(1);
    expect(fit('ביטוי', 'בביטויים')).toBe(2); // a form is normalised too ("ביטויים" has one י then)
  });

  it('a word cut from the not-recognised line keeps its letters ("וקובייה" is shown as "קובייה")', () => {
    const got = matchMaterial('נפח של תיבה וקובייה', '8');
    expect(got.unknown).toContain('קובייה');
    expect(got.unknown.join(' ')).not.toContain('ובייה ');
    expect(got.unknown.some((u) => u === 'ובייה')).toBe(false);
    expect(matchMaterial('הצבה בביטויים', '7').hits.map((h) => h.text)).toEqual(['הצבה בביטויים']);
  });

  it('a sentence of logistics never fills the not-recognised line; a sentence about the material still does', () => {
    expect(matchMaterial('המבחן על משוואות. ניפגש בשעה 8:10 בחדר 23, מי שלא היה שיצלם מחבר.', '7').unknown).toEqual([]);
    expect(matchMaterial('המבחן על משוואות ועל ווקטורים', '7').unknown).toEqual(['ווקטורים']);
    expect(matchMaterial('המבחן על משוואות. וגם ווקטורים', '7').unknown).toEqual(['ווקטורים']);
    // "וגם" adds to the sentence before: the equations stay whole
    expect(matchMaterial('המבחן על משוואות. וגם שאלות תנועה.', '7').skills).toEqual([...r('eq', 1, 4), 'eq:6']);
  });
});

// The council's round 3: a real grade-8 teacher's message for the 17.11 exam (its topics as she listed them; the class
// and the date only). The matcher ticked func:1-4 and stats:7-8, which it never names, and listed "ומתאימות", "צירים",
// "תכונות" and "נמצאת" as not recognised though the app teaches them.
const MSG_1711 = `כיתות ח׳: המבחן יתקיים בתאריך ה-17.11. הנושאים למבחן:
זוויות מתחלפות ומתאימות בין ישרים מקבילים (המשך מכיתה ז׳).
הפונקציה הקווית- עמודים 73 עד 147 (כרך א׳). כולל: תכונות, האם נקודה נמצאת על הישר?, ייצוג אלגברי, ישרים מקבילים לצירים, מציאת שיפוע, מציאת הייצוג האלגברי של הקו הישר- באמצעות שתי נקודות, באמצעות נקודה ושיפוע ובאמצעות נקודה וישר המקביל, נקודות חיתוך של הישר עם הצירים, גרפים של שתי פונקציות, ייצוג תופעות בעזרת פונקציות קוויות.
פיתגורס (כרך א׳)- עמוד 338 עד 362
תחום אי הוודאות (סטטיסטיקה)- איסוף וארגון הנתונים, שכיחות, שכיח, שכיחות יחסית וטווח נתונים, ממוצע וחציון (עמוד 196 עד 239 בכרך ב׳!)`;
describe('the 17.11 exam message: only what it lists (the council\'s round 3)', () => {
  it('ticks the parallel angles, the linear function, Pythagoras and the statistics parts it names, and nothing else', () => {
    const got = matchMaterial(MSG_1711, '8');
    expect(got.skills).toEqual(sorted(['angles:4', ...r('line', 1, 8), ...r('pyth', 1, 5), 'stats:1', 'stats:2', 'stats:3', 'stats:6', 'data:1', 'data:2'], '8'));
    // no introduction to functions (the linear function's own words), no two sources and no interpolation
    ['func:1', 'func:2', 'func:3', 'func:4', 'stats:7', 'stats:8'].forEach((s) => expect(got.skills, s).not.toContain(s));
  });
  it('places every sub-topic of the linear function the app now teaches, and the corresponding angles with their ו', () => {
    const got = matchMaterial(MSG_1711, '8');
    ['ומתאימות', 'צירים', 'תכונות', 'נמצאת', 'כרך'].forEach((w) => expect(got.unknown.join(' | '), w).not.toContain(w));
    const hit = (t) => got.hits.find((h) => h.text.includes(t));
    expect(hit('נקודה נמצאת על הישר')?.skills).toEqual(['line:1']);
    expect(hit('מקבילים לצירים')?.skills).toEqual(['line:2']);
    expect(hit('נקודה וישר המקביל')?.skills).toEqual(['line:5']);
    expect(hit('חיתוך של הישר עם הצירים')?.skills).toEqual(['line:6']);
    expect(hit('גרפים של שתי פונקציות')?.skills).toEqual(['line:8']);
    // only the pages are listed: a page number is never guessed
    expect(got.unknown).toEqual(['עמודים 73', 'עמוד 338', 'עמוד 196']);
  });
  it('each new phrase reads the same alone, under a linear-function heading or not', () => {
    expect(matchMaterial('האם נקודה נמצאת על הישר', '8').skills).toEqual(['line:1']);
    expect(matchMaterial('ישרים מקבילים לצירים', '8').skills).toEqual(['line:2']);
    expect(matchMaterial('משוואת ישר באמצעות נקודה וישר המקביל לו', '8').skills).toEqual(['line:5']);
    expect(matchMaterial('זוויות מתחלפות ומתאימות', '8').skills).toEqual(['angles:4']);
    expect(matchMaterial('זוויות מתחלפות ומתאימות', '8').unknown).toEqual([]);
    // a heading closed by a bracket before its dash still heads its list
    expect(matchMaterial('תחום אי הוודאות (סטטיסטיקה)- ממוצע וחציון', '8').skills).toEqual(['stats:2', 'stats:3']);
  });
});

describe('every way a teacher leaves something out (EXAM-MATERIAL 1a)', () => {
  // each phrase as a teacher writes it; the reviewers found חוץ, צורך, צריך, ייכלל, נכלל and לא יכלול doing nothing
  const AFTER = ['בלי', 'ללא', 'חוץ מ', 'מלבד', 'פרט ל', 'לא כולל', 'לא כוללת', 'אין צורך ב', 'לא צריך', 'לא צריכים', 'לא נדרש', 'לא יכלול',
    'לא תכלול', 'לא יכללו', 'לא נכלול', 'אבל לא על', 'לא נלמד'];
  const ANY = ['לא יהיה', 'לא יהיו', 'לא תהיה', 'לא תהיינה', 'לא ייכלל', 'לא ייכללו', 'לא תיכלל', 'לא נכלל', 'לא נכללים', 'לא נכללות', 'לא יופיע',
    'לא יופיעו', 'לא תופיע', 'לא יישאלו', 'לא במבחן', 'לא בחומר', 'ירד מהחומר', 'ירדו מהחומר', 'יורד מהחומר', 'יורדים מהחומר'];
  it('every exclusion phrase of the matcher is tested here', () => {
    const norm = (x) => x.split(' ').map(normWord).join(' ');
    expect(EXCLUDE_AFTER.map((x) => x.join(' ')).sort()).toEqual([...new Set(AFTER.map((x) => norm(x.replace(/ (מ|ל|ב)$/, '').replace(/^אבל /, ''))))].sort());
    expect(EXCLUDE_ANY.map((x) => x.join(' ')).sort()).toEqual(ANY.map(norm).sort());
  });
  const glue = (p, rest) => (/ (מ|ל|ב)$/.test(p) ? `${p.slice(0, -2)} ${p.slice(-1)}${rest}` : `${p} ${rest}`);
  AFTER.forEach((p) => it(`"${p}": what follows it in its clause`, () => {
    for (const g of ['7', '8']) {
      const got = matchMaterial(`המבחן על משוואות, ${glue(p, 'שאלות תנועה')}`, g);
      expect(got.skills, `${g} ${p}`).toEqual(r('eq', 1, 4));
      expect(got.excluded, `${g} ${p}`).toEqual(['eq:6']);
      expect(got.unknown, `${g} ${p}`).toEqual([]);
    }
  }));
  ANY.forEach((p) => it(`"${p}": what follows it, or what came before it`, () => {
    const after = matchMaterial(`המבחן על משוואות ו${p} שאלות תנועה`, '7');
    expect(after.skills, p).toEqual(r('eq', 1, 4));
    expect(after.excluded, p).toEqual(['eq:6']);
    const before = matchMaterial(`המבחן על משוואות. שאלות תנועה ${p}`, '7');
    expect(before.skills, p).toEqual(r('eq', 1, 4));
    expect(before.excluded, p).toEqual(['eq:6']);
    expect(before.unknown, p).toEqual([]);
  }));
});

describe('the exercises of a message are read in linear time (EXAM-MATERIAL 1a)', () => {
  // the old pattern, kept here as the reference for short texts (on a long line with no "=" it backtracked cubically:
  // 14.7 s for 4,000 characters of "x ")
  const OLD = /[0-9a-z().\s]*[a-z][0-9a-z()+\-*/:^².\s]*[=<>][0-9a-z()+\-*/:^².\s-]*[0-9a-z)]/gi;
  const old = (t) => [...t.matchAll(OLD)].map((m) => ({ from: m.index, to: m.index + m[0].length }));
  it('finds what the old pattern found, on short texts', () => {
    const samples = ['3x+5=20', 'פתרו 2(x - 1) = 8 ו-x > 3', 'תרגלו פתרון משוואות כמו 3x-7=2x+5 ו-4(x+2)=20, המבחן',
      'y = 2x + 3', 'a=b=c', '5 = 5', 'x-y<3 וגם 2x>=y', '-4(x+2)=20', 'x =', '= x', 'מחר 8:15', 'A = 3', 'x²=9', '(x+1)/2 = 3.5'];
    samples.forEach((t) => expect(exerciseSpans(t), t).toEqual(old(t)));
    // random short mixes of the characters that matter
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const chars = ['x', 'y', '3', '0', ' ', '+', '-', '=', '<', '(', ')', '.', 'ש', '\n', '²', '/'];
    for (let n = 0; n < 2000; n += 1) {
      const t = Array.from({ length: 1 + Math.floor(rnd() * 14) }, () => chars[Math.floor(rnd() * chars.length)]).join('');
      expect(exerciseSpans(t), JSON.stringify(t)).toEqual(old(t));
    }
  });
  it('a long text of Latin letters, digits and spaces is read at once', () => {
    const english = 'Dear students. The test next week covers linear functions, slope and intercepts. Good luck! ';
    const texts = ['x '.repeat(MATERIAL_MAX / 2), 'ab'.repeat(MATERIAL_MAX / 2), english.repeat(Math.ceil(MATERIAL_MAX / english.length)).slice(0, MATERIAL_MAX),
      `${'3x + 5 '.repeat(500)}`.slice(0, MATERIAL_MAX), `${'משוואות, אחוזים ופיתגורס; בלי שאלות תנועה. '.repeat(100)}`.slice(0, MATERIAL_MAX)];
    for (const t of texts) {
      matchMaterial(t.slice(0, 50), '7'); // warm the grade's keys
      const t0 = performance.now();
      matchMaterial(t, '7');
      expect(performance.now() - t0, t.slice(0, 20)).toBeLessThan(150);
    }
  });
});

describe('numbers in a piece of the message keep their direction (EXAM-MATERIAL 4)', () => {
  const runs = (t) => ltrRuns(t).map((r) => (r.ltr ? `[${r.text}]` : r.text)).join('');
  it('each number or expression is its own left-to-right run', () => {
    expect(runs('עמודים 40 - 62')).toBe('עמודים [40 - 62]');
    expect(runs("עמ' 40-62")).toBe("עמ' [40-62]");
    expect(runs('למשל -3+5')).toBe('למשל [-3+5]');
    expect(runs('טמפרטורות -5 עד 10')).toBe('טמפרטורות [-5] עד [10]');
    expect(runs('תרגילים 3 - 15, יחידה 8.12.')).toBe('תרגילים [3 - 15], יחידה [8.12].');
    // a maqaf on a Hebrew letter is the word's, not a minus
    expect(runs('ו-4(x+2)=20')).toBe('ו-[4(x+2)=20]');
    expect(runs('x ו-y')).toBe('[x] ו-[y]');
    expect(runs('ווקטורים ומטריצות')).toBe('ווקטורים ומטריצות');
    // nothing is lost or added
    for (const t of ['עמודים 40 - 62', 'למשל -3+5', 'בשעה 8:15 (חדר 23)', 'π ו-√9', '']) expect(ltrRuns(t).map((r) => r.text).join('')).toBe(t);
  });
});

describe('the pictures\' way, on the device and on the Worker (EXAM-MATERIAL 1b)', () => {
  it('the Worker\'s stairs of a grade are this catalogue, exactly', () => {
    for (const g of ['7', '8']) expect(new Set(syllabusGradeStairs(g))).toEqual(new Set(materialCatalogue(g).map((s) => s.id)));
  });
  it('the confirm screen keeps only the grade\'s stairs, and an example\'s stair only when it is one of them', () => {
    const cat = materialCatalogue('7');
    const got = fromSyllabus({ readable: true, stairs: ['sys:5', 'eq:2', 'congr:3', 'eq:1'], unplaced: ['פרק 3'], examples: [{ text: 'x > 3', stair: 'sys:5' }, { text: '$2x=8$', stair: 'eq:1' }] }, cat);
    expect(got.skills).toEqual(['eq:1', 'eq:2']);
    expect(got.byTopic).toEqual([{ topic: 'eq', title: 'משוואות', skills: ['eq:1', 'eq:2'] }]);
    expect(got.examples).toEqual([{ text: 'x > 3', stair: '' }, { text: '$2x=8$', stair: 'eq:1' }]);
    expect(got.unknown).toEqual(['פרק 3']);
  });
  it('the request says the top band was cut only when it was cut on every picture', () => {
    expect(prepOf([{ prep: { crop: true, boxes: 1 } }, { prep: { crop: false, boxes: 0 } }])).toEqual({ crop: false, boxes: 1 });
    expect(prepOf([{ prep: { crop: true, boxes: 0 } }, { prep: { crop: true, boxes: 2 } }])).toEqual({ crop: true, boxes: 2 });
    expect(prepOf([])).toEqual({ crop: false, boxes: 0 });
  });
});
