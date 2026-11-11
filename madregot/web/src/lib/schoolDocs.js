// The pilot kit's documents filled in for a class (spec TEACHER-10 §2): the Hebrew Markdown in content/schools/*.md
// carries {{KEY}} placeholders, and fillSchoolDoc puts the class's details in their place. Pure: no store, no network.
//
// Every value is escaped for Markdown, so a school name or a contact line can never turn into a heading, a list or a
// rule. A key that is unknown or empty prints as a line to fill in by hand, written as escaped underscores: a bare run of
// "_" alone on a line would be a Markdown thematic break and print as a horizontal rule, not a blank.

/** Every placeholder the documents may use. schoolDocs.test.js checks the five files against this list. */
export const SCHOOL_KEYS = Object.freeze([
  'CLASS', 'TEACHER', 'CODE', 'GRADE', 'SCHOOL', 'START', 'END', 'CONTACT',
  'AI_LINE', 'PRIVACY_URL', 'ACCESSIBILITY_URL', 'MOE_FORM_URL', 'TODAY', 'TOPICS', 'DEMO_URL',
]);
/** The pilot form's fields, saved on the class as profile.classes[i].pilot. */
export const PILOT_FIELDS = Object.freeze(['school', 'start', 'end', 'contact']);
const FIELD_KEY = { school: 'SCHOOL', start: 'START', end: 'END', contact: 'CONTACT' };

/** A line to write on by hand: ten escaped underscores. */
export const BLANK = '\\_'.repeat(10);

/** The Ministry's printable parent form for AI tools (trust §E.8; shared/schoolRules.js MOE_RULES.consentPdfUrl). */
export const MOE_FORM_PDF = 'https://meyda.education.gov.il/files/Pop/0files/lemida-metukshevet/AI/parents-consent-form-AI.pdf';

/** {{AI_LINE}} in the parent letter (Appendix B), word for word. "on" names the Ministry's form by {{MOE_FORM_URL}}. */
export const AI_LINES = Object.freeze({
  off: 'העוזר החכם (בינה מלאכותית) כבוי לתלמידים בכיתה הזו, לפי ההנחיות של משרד החינוך. ההסברים והמשוב באפליקציה כתובים מראש ונבדקים בקוד.',
  on: 'בכיתה הזו התלמידים יכולים להשתמש גם בעוזר חכם (בינה מלאכותית, Claude של Anthropic) לשאלות במתמטיקה. מה שהם כותבים או מצלמים נשלח ל־Anthropic בארה״ב כדי לקבל תשובה, בלי שם ובלי מייל, ומדרגות לא שומרת את השיחות. לשימוש בעוזר נדרש גם אישור הורים בטופס של משרד החינוך: {{MOE_FORM_URL}}',
});

/**
 * Whether the letter tells parents about the AI: when the class's students have it, or the teacher can turn it on
 * (the letter then goes out to gather consent). A school class before catalogue approval or below the approved grade,
 * or a policy not known yet, gets the "off" sentence (fail closed, as the server does).
 */
export const aiLineOn = (policy) => !!policy && (policy.students === 'on' || !!policy.canTurnOn);

const GRADE = { 7: 'ז׳', 8: 'ח׳' };
/** "15.11.2026" from "2026-11-15"; anything else, as it is. */
export const dmyDots = (day) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ''));
  return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]}` : String(day || '');
};

/** {{TOPICS}}: the topics of each grade, from the content (topicsFor('7') and topicsFor('8')). */
export const topicsLine = (topicsFor) => [['7', 'ז׳'], ['8', 'ח׳']]
  .map(([g, letter]) => `כיתה ${letter}: ${topicsFor(g).map((t) => t.title).join(', ')}`)
  .join('; ');

/**
 * The context for a class: { CLASS, TEACHER, ... } as strings ('' where nothing is known).
 *   cls      the class on the board ({ code, className, grade, pilot? })
 *   teacher  the teacher's name
 *   policy   the dashboard's aiPolicy (or null)
 *   base     the app's own public address (origin + path), '' when it has none worth printing
 *   server   whether a server serves this app (no server: no privacy or accessibility address on paper)
 *   today    YYYY-MM-DD
 *   topics   the TOPICS line
 *   pilot    the form's values (defaults to cls.pilot)
 */
export function schoolContext({ cls = {}, teacher = '', policy = null, base = '', server = false, today = '', topics = '', pilot = cls.pilot || {} } = {}) {
  const page = (hash) => (base && server ? `${base}${hash}` : '');
  return {
    CLASS: cls.className || '',
    TEACHER: teacher || '',
    CODE: cls.code || '',
    GRADE: GRADE[cls.grade] || '',
    SCHOOL: pilot.school || '',
    START: dmyDots(pilot.start),
    END: dmyDots(pilot.end),
    CONTACT: pilot.contact || '',
    AI_LINE: AI_LINES[aiLineOn(policy) ? 'on' : 'off'],
    PRIVACY_URL: page('#/privacy'),
    ACCESSIBILITY_URL: page('#/accessibility'),
    MOE_FORM_URL: policy?.consentPdfUrl || MOE_FORM_PDF,
    TODAY: dmyDots(today),
    TOPICS: topics,
    DEMO_URL: base ? `${base}#/?start=demo` : '',
  };
}

/** One line of text, safe inside a Markdown paragraph: nothing in it can start a block or turn into markup. */
export function escapeMd(value) {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  const inline = s.replace(/[\\`*_{}[\]<>#|~!+]/g, (c) => `\\${c}`);
  // a value that would open a list, a rule or a heading underline at the start of a line ("- ...", "---", "1. ...",
  // "1) ...", "==="); a date such as "15.11.2026" opens nothing and stays as it is
  return inline.replace(/^-(?=[\s-]|$)/, '\\-').replace(/^(\d+)([.)])(?=\s|$)/, '$1\\$2').replace(/^=/, '\\=');
}

/**
 * The document with every {{KEY}} filled from `ctx`: known keys with a value get it (escaped); unknown or empty keys
 * get BLANK. AI_LINE's own {{MOE_FORM_URL}} is filled the same way.
 */
export function fillSchoolDoc(text, ctx = {}) {
  const value = (k) => {
    if (!SCHOOL_KEYS.includes(k)) return BLANK;
    const v = String(ctx[k] ?? '').trim();
    if (!v) return BLANK;
    if (k === 'AI_LINE') {
      const form = String(ctx.MOE_FORM_URL ?? '').trim();
      return escapeMd(v.replaceAll('{{MOE_FORM_URL}}', form || '\u0000')).replaceAll('\u0000', BLANK);
    }
    return escapeMd(v);
  };
  return String(text).replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => value(k));
}

/** Which of the pilot form's fields a document uses (the form shows only those). */
export const fieldsOf = (text) => PILOT_FIELDS.filter((f) => String(text).includes(`{{${FIELD_KEY[f]}}}`));

/**
 * The filled Markdown as plain text, for the school's messaging system ("העתקה"): no heading marks, no bold marks, no
 * escapes; lists keep their "- "; the cut line stays a line of dashes.
 */
export function toPlainText(md) {
  return String(md)
    .split('\n')
    .map((line) => {
      if (/^\s*---\s*$/.test(line)) return '- - - - - - - - - - - - - - - - - - - -';
      return line
        .replace(/^#{1,6}\s+/, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/`([^`]*)`/g, '$1')
        .replace(/\\([\\`*_{}[\]()#+\-.!|<>~=])/g, '$1');
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
