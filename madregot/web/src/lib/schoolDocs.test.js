// The pilot kit's documents and how they are filled in (spec TEACHER-10 §2, tests 1-8): every placeholder is known and
// filled, the parent letter's AI sentence follows the class's policy, the letter says what it must, nothing points to
// the owner's set-up, the Markdown prints right (no stray rule, every checkbox line its own block), the guide quotes
// the student's real screens, and the principal form cites items 3 and 8 of the Ministry's letter.
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import { SCHOOL_KEYS, BLANK, AI_LINES, aiLineOn, fillSchoolDoc, schoolContext, escapeMd, toPlainText, fieldsOf, topicsLine, dmyDots, MOE_FORM_PDF } from './schoolDocs.js';
import { topicsFor } from '@/content/index.js';
import { MOE_RULES } from '../../../shared/schoolRules.js';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const IDS = ['teacher-guide', 'parent-letter', 'principal-approval', 'pilot-plan', 'product-sheet'];
const DOCS = Object.fromEntries(IDS.map((id) => [id, read(`../content/schools/${id}.md`)]));
const SHORT = read('../content/schools/parent-letter-short.txt');
const placeholders = (t) => [...t.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]);
const html = (md) => renderToStaticMarkup(createElement(ReactMarkdown, null, md));

const BASE = 'https://madregot.example.test/';
const OFF = { students: 'off', canTurnOn: false, reason: 'not_in_catalogue', setting: 'school', consentPdfUrl: MOE_RULES.consentPdfUrl };
const ON = { students: 'on', canTurnOn: true, reason: 'ok', setting: 'school', consentPdfUrl: MOE_RULES.consentPdfUrl };
const full = (policy = OFF) => schoolContext({
  cls: { code: 'K7Q2MD', className: 'ז׳3', grade: '7' }, teacher: 'רונית כהן', policy, base: BASE, server: true, today: '2026-11-10',
  topics: topicsLine(topicsFor), pilot: { school: 'בית ספר לדוגמה', start: '2026-11-15', end: '2026-11-26', contact: 'teacher@example.test' },
});

describe('the pilot kit', () => {
  test('1. every {{X}} in the five documents and the short letter is a key fillSchoolDoc knows', () => {
    const used = new Set([...Object.values(DOCS), SHORT, AI_LINES.on].flatMap(placeholders));
    expect(used.size).toBeGreaterThan(10);
    for (const k of used) expect(SCHOOL_KEYS, k).toContain(k);
    // and the context fills every known key
    expect(Object.keys(full()).sort()).toEqual([...SCHOOL_KEYS].sort());
  });

  test('2. filled with a full context, no document has a {{ left, and no blank either', () => {
    for (const [id, text] of Object.entries(DOCS)) {
      const out = fillSchoolDoc(text, full(ON));
      expect(out, id).not.toContain('{{');
      // no blank added: the escaped underscores are only the document's own lines to write on
      expect(out.split('\\_').length, id).toBe(text.split('\\_').length);
    }
    expect(fillSchoolDoc(SHORT, full())).not.toContain('{{');
    const letter = fillSchoolDoc(DOCS['parent-letter'], full());
    expect(letter).toContain('בתקופה 15.11.2026–26.11.2026 כיתה ז׳3 תתרגל מתמטיקה');
    expect(letter).toContain('10.11.2026');
    expect(fillSchoolDoc(DOCS['principal-approval'], full())).toContain('(שכבה ז׳)');
    // the product sheet: the topics of both grades, and the demo address
    const sheet = fillSchoolDoc(DOCS['product-sheet'], full());
    expect(sheet).toContain('**הנושאים:** כיתה ז׳: מספרים מכוונים, מערכת צירים');
    // grade 8 in school order: the curriculum lane's ratio and percent units, then the introduction to functions (stage 5),
    // come before linear functions
    expect(sheet).toContain('; כיתה ח׳: יחס וקנה מידה, אחוזים, מבוא לפונקציות, פונקציה קווית');
    expect(sheet).toContain(`${escapeMd(BASE)}\\#/?start=demo`);
  });

  test('3. AI_LINE follows the class\'s policy: off before approval (or unknown), on when the students can have it', () => {
    expect(aiLineOn(null)).toBe(false);
    expect(aiLineOn(OFF)).toBe(false);
    expect(aiLineOn({ ...OFF, reason: 'grade' })).toBe(false);
    expect(aiLineOn(ON)).toBe(true);
    expect(aiLineOn({ students: 'off', canTurnOn: true, reason: 'consent_needed' })).toBe(true);
    const off = fillSchoolDoc(DOCS['parent-letter'], full(OFF));
    expect(off).toContain(AI_LINES.off);
    expect(off).not.toContain('Anthropic');
    const on = fillSchoolDoc(DOCS['parent-letter'], full(ON));
    expect(on).toContain('Claude של Anthropic');
    expect(on).toContain(`בטופס של משרד החינוך: ${escapeMd(MOE_RULES.consentPdfUrl)}`);
    expect(on).not.toContain(AI_LINES.off);
    expect(fillSchoolDoc('{{AI_LINE}}', { AI_LINE: AI_LINES.on })).toMatch(/משרד החינוך: \\_\\_/);
    // the form is the Ministry's printable one, from the policy or the same address when there is none
    expect(MOE_FORM_PDF).toBe(MOE_RULES.consentPdfUrl);
    expect(schoolContext({ policy: null }).MOE_FORM_URL).toBe(MOE_RULES.consentPdfUrl);
  });

  test('4. the parent letter: voluntary, the practice sheets for who does not take part, no ID number, the privacy address', () => {
    const letter = fillSchoolDoc(DOCS['parent-letter'], full());
    expect(letter).toContain('ההשתתפות בניסיון היא מרצון');
    expect(letter).toContain('יקבלו דפי תרגול על אותם נושאים');
    expect(letter).toContain('לא נדרשים מייל, טלפון או תעודת זהות.');
    expect(letter).toContain(`הפרטים במדיניות הפרטיות: ${escapeMd(`${BASE}#/privacy`)}`);
    expect(toPlainText(letter)).toContain(`הפרטים במדיניות הפרטיות: ${BASE}#/privacy`);
    // with no server there is no privacy address to print: a blank to fill by hand
    const noServer = fillSchoolDoc(DOCS['parent-letter'], { ...full(), PRIVACY_URL: schoolContext({ base: BASE, server: false }).PRIVACY_URL });
    expect(noServer).toContain(`הפרטים במדיניות הפרטיות: ${BLANK}`);
  });

  test('5. no document points to the owner\'s set-up', () => {
    for (const [id, text] of Object.entries({ ...DOCS, short: SHORT })) {
      expect(text, id).not.toContain('Cloudflare חשבון');
      expect(text, id).not.toContain('setup.ps1');
    }
  });

  test('6. rendered with an empty context: no rule but the parent letter\'s one cut line, and every ☐ line is its own block', () => {
    for (const [id, text] of Object.entries(DOCS)) {
      const out = html(fillSchoolDoc(text, {}));
      expect((out.match(/<hr\s*\/?>/g) || []).length, id).toBe(id === 'parent-letter' ? 1 : 0);
      expect(out, id).not.toContain('{{');
      // a blank prints as underscores, never as markup
      expect(out, id).not.toMatch(/<(em|strong)>_*<\/(em|strong)>/);
    }
    const letter = html(fillSchoolDoc(DOCS['parent-letter'], {}));
    expect(letter).toContain('__________');
    // the slip comes after the cut line
    expect(letter.indexOf('<hr')).toBeLessThan(letter.indexOf('אישור הורה (לגזור ולהחזיר למורה)'));
    for (const id of ['principal-approval', 'parent-letter']) {
      const source = DOCS[id];
      const out = html(fillSchoolDoc(source, {}));
      const blocks = [...out.matchAll(/<(p|li)>([\s\S]*?)<\/\1>/g)].map((m) => m[2]);
      const boxes = blocks.filter((b) => b.includes('☐'));
      expect(boxes.every((b) => b.split('☐').length === 2), id).toBe(true);
      expect(boxes.length, id).toBe(source.split('☐').length - 1);
    }
    // the labelled lines and the signature lines are paragraphs of their own
    const principal = html(fillSchoolDoc(DOCS['principal-approval'], {}));
    for (const label of ['בית הספר:', 'המורה:', 'הכיתה:', 'הכלי:', 'תקופה:']) expect(principal).toMatch(new RegExp(`<p><strong>${label}</strong>`));
    for (const line of ['שם המנהל/ת:', 'חתימה:', 'תאריך:']) expect(principal).toMatch(new RegExp(`<p>${line} _+</p>`));
  });

  test('7. the guide\'s way in for students quotes the student\'s own screens (Welcome.jsx)', () => {
    const welcome = read('../screens/Welcome.jsx');
    const guide = DOCS['teacher-guide'];
    for (const words of ['מתחילים', 'יש לכם קוד כיתה מהמורה?', 'אני']) {
      expect(guide, words).toContain(`"${words}"`);
      expect(welcome, words).toContain(words === 'אני' ? 'מהמסך "אני"' : words);
    }
    expect(guide).not.toContain('אני תלמיד או תלמידה');
  });

  test('8. the principal form cites items 3 and 8 of the Ministry\'s letter', () => {
    const p = DOCS['principal-approval'];
    expect(p).toContain('סעיף 3');
    expect(p).toContain('סעיף 8');
    expect(p).toContain('"יש לאסור רישום של תלמידים לכלים שלא קיבלו את אישור משרד החינוך"');
    expect(p).toContain('באחריותי לפי סעיף 8 במכתב המשרד');
  });
});

describe('filling, escaping and copying', () => {
  test('values cannot become Markdown: a list, a heading, a rule, emphasis or a link', () => {
    for (const v of ['- רשימה', '1. רשימה', '2) רשימה', '-', '# כותרת', '---', '===', '*כוכב*', '_קו_', '[קישור](http://x.test)', '<b>x</b>']) {
      const out = html(fillSchoolDoc('בית הספר: {{SCHOOL}}\n\n{{SCHOOL}}', { SCHOOL: v }));
      expect(out, v).not.toMatch(/<(ul|ol|h1|hr|em|strong|a|b)[\s>]/);
    }
    expect(escapeMd('  שורה\nשנייה  ')).toBe('שורה שנייה');
    expect(fillSchoolDoc('{{NOPE}} {{CLASS}}', { CLASS: '  ' })).toBe(`${BLANK} ${BLANK}`);
    expect(dmyDots('2026-01-05')).toBe('5.1.2026');
    expect(escapeMd('15.11.2026')).toBe('15.11.2026');
    expect(dmyDots('')).toBe('');
  });

  test('the copy is plain text: no marks, no escapes; the cut line stays a line', () => {
    const plain = toPlainText(fillSchoolDoc(DOCS['parent-letter'], full()));
    expect(plain.startsWith('מכתב להורים: תרגול מתמטיקה באפליקציה "מדרגות"')).toBe(true);
    expect(plain).not.toMatch(/\*\*|\\|^#/m);
    expect(plain).toContain('teacher@example.test');
    expect(plain).toMatch(/^- - - -/m);
    expect(toPlainText(fillSchoolDoc('{{SCHOOL}}', {}))).toBe('__________');
    const short = toPlainText(fillSchoolDoc(SHORT, full()));
    expect(short).toBe('הורים יקרים, בתאריכים 15.11.2026–26.11.2026 כיתה ז׳3 תתרגל מתמטיקה גם באפליקציה "מדרגות" (10–15 דקות ביום, בדפדפן, בלי התקנה ובלי פרסומות). נשמרים רק שם פרטי ואות משם המשפחה והתשובות בתרגול, ורק המורה רואה אותם. ההשתתפות מרצון. מי שלא משתתף מקבל דפי תרגול. המכתב המלא ואישור ההשתתפות יישלחו הביתה. לשאלות: teacher@example.test. רונית כהן');
  });

  test('the form shows only the fields a document uses', () => {
    expect(fieldsOf(DOCS['parent-letter'])).toEqual(['school', 'start', 'end', 'contact']);
    expect(fieldsOf(DOCS['principal-approval'])).toEqual(['school', 'start', 'end']);
    expect(fieldsOf(DOCS['product-sheet'])).toEqual(['contact']);
    expect(fieldsOf(DOCS['pilot-plan'])).toEqual([]);
  });
});
