// EXAM-MATERIAL 1a: the matcher that reads a teacher's message on the device. Realistic messages of both grades, each
// with the stairs it should tick; misspellings, missing niqqud and geresh, exclusions, English letters, numbers with
// units; and the property that it never ticks a stair outside the grade's catalogue and the bridge unit under it.
import { describe, it, expect } from 'vitest';
import { matchMaterial, materialCatalogue, normWord, wordFit, tokenize, SYNONYMS, MATERIAL_MAX, UNKNOWN_MAX } from './examMaterial.js';
import { rescueTopicsFor, rowStairs, bridgeTopicsFor } from '@/content/topics.js';
import { PROGRAMME } from '@shared/programme.js';

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
  ['המבחן יהיה על פרק 3: משוואות ובעיות מילוליות', [...r('eq', 1, 5), 'sys:4'], { unknown: ['פרק 3'] }],
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
