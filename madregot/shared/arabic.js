// The tutor in Arabic (COUNCIL2-34): what changes when the student uses the app in Arabic. The request carries
// input.locale = 'ar' (web/src/lib/ai.js); every other request is Hebrew and its bytes do not change. Plain JavaScript
// with no imports, read by the Worker and the browser. A native Arabic speaker and an Arabic-speaking maths teacher
// review these words (docs/ARABIC.md); web/src/locales/locales.test.js holds the terms to web/src/locales/terms.js.

/** The languages a request may ask for; anything else is Hebrew. */
export const TUTOR_LOCALES = Object.freeze(['he', 'ar']);
export const tutorLocale = (input) => (input && TUTOR_LOCALES.includes(input.locale) ? input.locale : 'he');

/** The programme's Arabic maths terms the tutor uses (term id → [Arabic, the Hebrew the app's other language uses]). */
export const ARABIC_TERMS = Object.freeze({
  directed: ['الأعداد الموجّهة', 'מספרים מכוונים'],
  'number-line': ['محور الأعداد', 'ציר המספרים'],
  opposite: ['العدد المعاكس', 'המספר הנגדי'],
  absolute: ['القيمة المطلقة', 'ערך מוחלט'],
  'order-ops': ['ترتيب العمليات الحسابية', 'סדר פעולות החשבון'],
  axes: ['هيئة المحاور', 'מערכת צירים'],
  quadrant: ['الربع', 'רביע'],
  coordinates: ['إحداثيّات النقطة', 'שיעורי הנקודה'],
  adjacent: ['زاويتان متجاورتان', 'זוויות צמודות'],
  vertical: ['زاويتان متقابلتان بالرأس', 'זוויות קודקודיות'],
  corresponding: ['زاويتان متناظرتان', 'זוויות מתאימות'],
  alternate: ['زاويتان متبادلتان', 'זוויות מתחלפות'],
  'co-interior': ['زاويتان متحالفتان', 'זוויות חד־צדדיות'],
  exterior: ['الزاوية الخارجية', 'זווית חיצונית'],
  isosceles: ['مثلث متساوي الساقين', 'משולש שווה שוקיים'],
  expression: ['التعبير الجبري', 'ביטוי אלגברי'],
  'like-terms': ['الحدود المتشابهة', 'איברים דומים'],
  distributive: ['قانون التوزيع', 'חוק הפילוג'],
  coefficient: ['المعامل', 'מקדם'],
  substitute: ['التعويض', 'הצבה'],
  equation: ['المعادلة', 'משוואה'],
  unknown: ['المجهول', 'נעלם'],
  numerator: ['البسط', 'מונה'],
  denominator: ['المقام', 'מכנה'],
  simplify: ['الاختزال', 'צמצום'],
  decimal: ['الكسر العشري', 'שבר עשרוני'],
  slope: ['الميل', 'שיפוע'],
});

/** Each topic's words, as the Arabic screens say them (the Hebrew list is TOPIC_WAYS[id].words, in the same order). */
export const TOPIC_WORDS_AR = Object.freeze({
  frac: ['البسط', 'المقام', 'التوسيع', 'الاختزال', 'المقام المشترك', 'المقلوب'],
  signed: ['محور الأعداد', 'الانتقال يمينًا ويسارًا', 'العدد المعاكس', 'رزمة'],
  coord: ['نقطة الأصل', 'إحداثي $x$', 'إحداثي $y$', 'الربع'],
  angles: ['زاويتان متجاورتان', 'متقابلتان بالرأس', 'متناظرتان', 'متبادلتان', 'متحالفتان', 'زاوية خارجية'],
  expr: ['التعويض', 'التعبير الجبري', 'الحدود المتشابهة', 'جمع الحدود المتشابهة', 'قانون التوزيع', 'المعامل', 'الحد الحر'],
  eq: ['المجهول', 'الطرف الأيمن', 'الطرف الأيسر', 'معادلات متكافئة', 'الفحص بالتعويض', '"نقوم بالعملية نفسها في الطرفين"'],
  ratio: ['النسبة', 'النسبة المختزلة', 'التقسيم بنسبة', 'التناسب', 'التناسب الطردي', 'للوحدة الواحدة', 'مقياس الرسم'],
  pct: ['النسبة المئوية', 'الكل', 'جزء من مئة', 'ارتفاع السعر', 'انخفاض السعر', 'التخفيض', 'أضعاف'],
  line: ['الميل', 'نقطة التقاطع', 'التعويض', 'درجة'],
  pyth: ['الوتر', 'الضلع القائم', 'المربع', 'الجذر'],
  stats: ['المنوال', 'الوسيط', 'المعدل', 'جدول التكرارات'],
  sys: ['النسبة المئوية من الكمية الأصلية', 'جهاز معادلات', 'طريقة التعويض', 'مساواة المعاملات', 'المتباينة', 'المجال', 'دائرة مملوءة', 'دائرة فارغة'],
});

/** The line that turns the tutor to Arabic: it replaces the Hebrew language line of the tutor block. */
export const LANGUAGE_AR = `Language: this student uses the app in Arabic. Always answer in Arabic (Modern Standard Arabic, as Arab schools in Israel teach mathematics), in plain words a 13-year-old understands, addressing the student in the plural ("جرّبوا", "انتبهوا", "لنفحص معًا"). Never answer in Hebrew, even when a phrase of the app below is quoted in Hebrew: the student sees the app's words in Arabic. Use the Arabic maths terms of the Ministry of Education's programme, and only these for these ideas: ${Object.values(ARABIC_TERMS).map(([ar, he]) => `${ar} (${he})`).join(', ')}. Variables stay Latin letters ($x$, $y$) and numbers use the digits 0-9, as in the app.`;

/** The safety block's language and the free services, in Arabic words (the same numbers as SUPPORT). */
export function safetyArabic(SUPPORT) {
  const { eran, sahar, online, police, mda } = SUPPORT;
  return {
    language: 'Answer in warm, simple Arabic, 3 to 5 short sentences, in the plural form.',
    services: `Give these free services exactly as written: عيران: اتصال ${eran.phone} على مدار الساعة، أو واتساب ${eran.whatsapp} (${eran.textHours})، من دون ذكر الاسم. سهر: دردشة في الموقع sahar.org.il أو واتساب ${sahar.whatsapp}، في المساء والليل. أذى على الإنترنت (مضايقات، تهديدات، شخص يطلب صورًا): ${online.phone}. في خطر فوري: الشرطة ${police}، الإسعاف (نجمة داود الحمراء) ${mda}.`,
    first: `If they say they are in danger right now (a plan or a way to hurt themselves now, or someone hurting them now), put الشرطة ${police}، الإسعاف ${mda} and عيران ${eran.phone} first, before anything else.`,
  };
}

/**
 * The safety block in Arabic: the Hebrew block (shared/safety.js safetyPrompt) with its three Hebrew lines (the
 * language, the services, danger first) in their Arabic form; every other rule is the same line. shared/ai.js safetyFor.
 */
export function arabicSafetyBlock(hebrew, SUPPORT) {
  const ar = safetyArabic(SUPPORT);
  const lines = hebrew.split('\n');
  const at = (start) => { const i = lines.findIndex((l) => l.startsWith(start)); if (i < 0) throw new Error(`safety: no line "${start}"`); return i; };
  const lang = at('- Answer in warm, simple Hebrew');
  lines[lang] = `- ${ar.language}${lines[lang].replace(/^- Answer in warm, simple Hebrew, 3 to 5 short sentences, in the plural or gender-neutral form\./, '')}`;
  lines[at('- Give these free services')] = `- ${ar.services}`;
  lines[at('- If they say they are in danger right now')] = `- ${ar.first}`;
  return lines.join('\n').replace('(היועצת או היועץ)', '(المستشارة أو المستشار)');
}

/** The fixed care reply in Arabic (the Hebrew one is CARE_STATIC in shared/safety.js): no AI, the same numbers. */
export const careStaticArabic = (SUPPORT) => `شكرًا لأنكم كتبتم. ما تشعرون به مهمّ، وهذا ليس ذنبكم. من حقّكم أن يتحدّث معكم شخص الآن: أحد الوالدين، أو المستشارة أو المستشار في المدرسة، أو معلّم. يمكن أيضًا الاتصال مجانًا ومن دون ذكر الاسم بعيران، ${SUPPORT.eran.phone}، على مدار الساعة. إذا كنتم في خطر الآن: الشرطة ${SUPPORT.police}، الإسعاف ${SUPPORT.mda}.`;
