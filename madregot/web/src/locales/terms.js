// The maths words of the Arabic screens (COUNCIL2-34): one Arabic term for each idea, the terms of the Arabic-language
// maths programme and textbooks of the Ministry of Education for grades 7-8, as Arab schools in Israel use them
// (Latin letters for the variables and the axes, the digits 0-9). Every pair of texts the app holds in both languages
// (the catalogues of locales/, and the teaching content's Arabic) uses these: where the Hebrew says the term, the
// Arabic says its term (locales/locales.test.js). An Arabic-speaking maths teacher confirms the list (owner step,
// docs/ARABIC.md); a change is one line here, and the test then names every text that has to follow it.
//
// he:  where the Hebrew uses the term (a regular expression on the Hebrew text, prefixes ו ה ב ל מ ש כ allowed)
// ar:  what the Arabic must then contain (a regular expression: an Arabic stem, so the article and the plural pass)
// not: Hebrew phrases that only look like the term (removed before `he` is tried)

const HEB = (w) => `(?:^|[^֐-׿])[והבלמשכ]{0,2}${w}`;

export const TERMS = Object.freeze([
  { id: 'directed', he: HEB('(?:מספר(?:ים)? )?מכוונ'), ar: 'موج[ّ]?ه', en: 'directed (signed) number' },
  { id: 'positive', he: HEB('חיובי'), ar: 'موجب', en: 'positive' },
  { id: 'negative', he: HEB('שלילי'), ar: 'سالب', en: 'negative' },
  { id: 'number-line', he: HEB('ציר (?:ה)?מספרים'), ar: 'محور (?:ال)?أعداد', en: 'number line' },
  { id: 'opposite', he: HEB('נגדי'), ar: 'معاكس', en: 'opposite number' },
  { id: 'absolute', he: HEB('ערך מוחלט'), ar: 'مطلق', en: 'absolute value' },
  { id: 'order-ops', he: HEB('סדר (?:ה)?פעולות'), ar: 'ترتيب (?:ال)?عمليات', en: 'order of operations' },
  { id: 'axes', he: HEB('מערכת (?:ה)?צירים'), ar: 'هيئة (?:ال)?محاور', en: 'coordinate system' },
  { id: 'quadrant', he: HEB('רביע'), ar: 'ربع|أرباع', en: 'quadrant' },
  { id: 'coordinates', he: HEB('שיעורי (?:ה)?נקוד'), ar: 'إحداثي', en: 'coordinates of a point' },
  { id: 'protractor', he: HEB('מד[־ -]?זווית'), ar: 'منقلة', en: 'protractor' },
  { id: 'angle', he: HEB('זווי(?:ת|ות)'), not: 'מד[־ -]?זווית', ar: 'زاوي|زوايا', en: 'angle' },
  { id: 'right-angle', he: HEB('זווית ישרה'), ar: 'قائم', en: 'right angle' },
  { id: 'acute', he: HEB('(?:זווית )?חדה'), ar: 'حاد', en: 'acute' },
  { id: 'obtuse', he: HEB('(?:זווית )?קהה'), ar: 'منفرج', en: 'obtuse' },
  { id: 'straight-angle', he: HEB('זווית שטוחה'), ar: 'مستقيم', en: 'straight angle' },
  { id: 'vertical', he: HEB('(?:זוויות )?קודקודיות'), ar: 'متقابل(?:ت(?:ان|ين)|ة|ات)? بالرأس', en: 'vertically opposite angles' },
  { id: 'adjacent', he: HEB('(?:זוויות )?צמודות'), ar: 'متجاور|مجاور', en: 'adjacent angles (a linear pair)' },
  { id: 'corresponding', he: HEB('(?:זוויות )?מתאימות'), ar: 'متناظر', en: 'corresponding angles' },
  { id: 'alternate', he: HEB('(?:זוויות )?מתחלפות'), ar: 'متبادل', en: 'alternate angles' },
  { id: 'co-interior', he: HEB('חד[־ -]?צדדיות'), ar: 'متحالف', en: 'co-interior angles' },
  { id: 'parallel', he: HEB('מקביל'), ar: 'متواز|توازي|مواز', en: 'parallel' },
  { id: 'isosceles', he: HEB('שווה[־ -]?שוקיים'), ar: 'متساوي الساقين', en: 'isosceles' },
  { id: 'exterior', he: HEB('זווית חיצונית'), ar: 'خارجي', en: 'exterior angle' },
  { id: 'triangle', he: HEB('משולש'), ar: 'مثلث', en: 'triangle' },
  { id: 'vertex', he: HEB('קודקוד(?!יות)'), ar: 'رأس|رؤوس', en: 'vertex' },
  { id: 'side', he: HEB('צלע'), ar: 'ضلع|أضلاع', en: 'side' },
  { id: 'perimeter', he: HEB('היקף'), ar: 'محيط', en: 'perimeter' },
  { id: 'area', he: HEB('שטח'), ar: 'مساح', en: 'area' },
  { id: 'rectangle', he: HEB('מלבן'), ar: 'مستطيل', en: 'rectangle' },
  { id: 'expression', he: HEB('ביטוי(?:ים)? אלגברי'), ar: 'تعبير|تعابير', en: 'algebraic expression' },
  { id: 'like-terms', he: HEB('איברים דומים'), ar: 'متشابه', en: 'like terms' },
  { id: 'distributive', he: HEB('חוק הפילוג'), ar: 'توزيع', en: 'distributive law' },
  { id: 'coefficient', he: HEB('מקדם'), ar: 'معامل', en: 'coefficient' },
  { id: 'substitute', he: HEB('(?:הצבה|מציבים|הציבו|נציב)'), ar: 'عو[ّ]?ض|تعويض', en: 'substitute' },
  { id: 'equation', he: HEB('משווא'), ar: 'معادل', en: 'equation' },
  // "the minus disappears" (נעלם, the verb) is not the unknown
  { id: 'unknown', he: HEB('נעלם'), not: 'המינוס(?: של \\$\\d+\\$)?(?: לא)? נעלם', ar: 'مجهول', en: 'the unknown' },
  { id: 'fraction', he: HEB('שבר(?:ים)?(?![א-ת])'), ar: 'كسر|كسور', en: 'fraction' },
  // "eight" (שמונה) is not the numerator
  { id: 'numerator', he: HEB('מונה'), not: 'שמונה', ar: 'بسط', en: 'numerator' },
  { id: 'denominator', he: HEB('מכנה'), ar: 'مقام', en: 'denominator' },
  { id: 'simplify', he: HEB('(?:צמצום|מצמצמים|צמצמו|לצמצם)'), ar: 'اختزال|نختزل|اختزلوا|نختصر|اختصار', en: 'simplify (a fraction)' },
  { id: 'decimal', he: HEB('עשרוני'), ar: 'عشري', en: 'decimal' },
  { id: 'decimal-point', he: HEB('נקודה עשרונית'), ar: 'فاصلة عشرية', en: 'decimal point' },
  { id: 'times-table', he: HEB('לוח הכפל'), ar: 'جدول الضرب', en: 'times table' },
  { id: 'slope', he: HEB('שיפוע'), ar: 'ميل', en: 'slope' },
]);

/** The terms a Hebrew text uses, and for each whether the Arabic text says it too. */
export function termGaps(he, ar) {
  const gaps = [];
  for (const term of TERMS) {
    const text = term.not ? String(he).replace(new RegExp(term.not, 'g'), ' ') : String(he);
    if (!new RegExp(term.he).test(text)) continue;
    if (!new RegExp(term.ar).test(String(ar))) gaps.push(term.id);
  }
  return gaps;
}
