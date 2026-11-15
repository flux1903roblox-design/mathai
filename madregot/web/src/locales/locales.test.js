// The two languages (COUNCIL2-34): every key in both catalogues, the same values in each, plural sets complete, no
// Hebrew in the Arabic and no Hebrew left in the screens that were moved to the catalogues, the maths words of
// locales/terms.js, and the runtime of lib/i18n.js (lookup, plurals, numbers and dates per language).
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import SHELL_HE from './shell.he.json';
import SHELL_AR from './shell.ar.json';
import SETTINGS_HE from './settings.he.json';
import SETTINGS_AR from './settings.ar.json';
import { TERMS, termGaps } from './terms.js';
import { SUPPORT } from '@shared/safety.js';
import { t, fill, pluralForm, loadLocale, setLocale, locale, fmtNum, fmtDate, resetLocaleForTests, LOCALES, localized, importArabic } from '@/lib/i18n.js';

const PARTS = { shell: [SHELL_HE, SHELL_AR], settings: [SETTINGS_HE, SETTINGS_AR] };
const HEBREW = /[֐-׿]/;
const ARABIC = /[؀-ۿ]/;
const vars = (v) => new Set([...String(v).matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
const forms = (v) => (v && typeof v === 'object' ? Object.values(v) : [v]);
/** Values that need no Arabic letter: a digit, the grade's number. */
const NO_WORDS = new Set(['7', '8']);
/** A Hebrew placeholder an Arabic plural set does not need: the Hebrew word for "day" or "days" (shell.next.12/13). */
const DROPPED = { 'shell.next.14': ['p1'] };

/** The screens whose words were moved into the catalogues: no Hebrew string, template or JSX text is left in them. */
export const CONVERTED = [
  'App.jsx', 'components/MathText.jsx', 'components/Shell.jsx', 'components/Screen.jsx', 'components/SheetDialog.jsx', 'components/ui.jsx', 'components/GradeSwitch.jsx',
  'content/support.js', 'components/SupportCard.jsx', 'components/SupportSheet.jsx', 'components/LangPick.jsx',
  'screens/Welcome.jsx', 'lib/placementRules.js', 'lib/quests.js', 'components/durable/FileRestore.jsx', 'components/durable/RestorePreview.jsx',
  'screens/Learn.jsx', 'lib/path.js', 'learn/recommend.ts', 'learn/next.ts', 'learn/mission.ts', 'learn/mastery.ts', 'lib/classWork.js', 'lib/workDates.js',
  'lib/wardrobe.js', 'components/durable/InstallSheet.jsx', 'components/durable/StorageBanner.jsx', 'components/durable/OfflineChip.jsx',
  'components/durable/BackupLine.jsx', 'components/learn/RepairCard.jsx', 'components/learn/NextBanner.jsx', 'components/limitCopy.js',
  'components/LimitSheet.jsx', 'lib/wipe.js', 'lib/durable/wipeSteps.js', 'lib/reminder.js', 'components/SharingSheet.jsx',
  'screens/Settings.jsx', 'components/durable/SaveSection.jsx', 'components/durable/SupportInfo.jsx', 'lib/durable/copy.js',
  'lib/durable/useDurable.js', 'lib/durable/persist.js', 'components/durable/PersistInfoSheet.jsx', 'components/durable/BackupCodeSheet.jsx',
  // the class's rows, moved out of lib/classWork.js on the main branch (the boot split): their words are classWork's
  'lib/classRows.js',
];

/** The Hebrew strings, templates and JSX texts of a source file (comments are not tokens, so they do not count). */
export function hebrewLiterals(src, file) {
  const kind = /\.tsx?$/.test(file) ? ts.ScriptKind.TS : file.endsWith('x') ? ts.ScriptKind.JSX : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind);
  const out = [];
  const visit = (n) => {
    const text = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isJsxText(n) ? n.text
      : ts.isTemplateExpression(n) ? [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(' ') : '';
    if (HEBREW.test(text)) out.push(`${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}: ${text.trim().slice(0, 60)}`);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

afterEach(() => resetLocaleForTests('he'));

describe('the catalogues', () => {
  for (const [part, [he, ar]] of Object.entries(PARTS)) {
    it(`${part}: every key is in both languages`, () => {
      expect(Object.keys(ar).filter((k) => !(k in he)), 'keys only in Arabic').toEqual([]);
      expect(Object.keys(he).filter((k) => !(k in ar)), 'keys only in Hebrew').toEqual([]);
      expect(Object.keys(he).every((k) => k.startsWith(`${part}.`))).toBe(true);
    });
    it(`${part}: each Arabic text has the Hebrew one's values, and no other`, () => {
      const bad = [];
      for (const [k, v] of Object.entries(he)) {
        const want = vars(v);
        const got = new Set(forms(ar[k]).flatMap((f) => [...vars(f)]));
        const other = vars(typeof ar[k] === 'object' ? ar[k].other : ar[k]);
        const drop = new Set(DROPPED[k] || []);
        for (const x of got) if (!want.has(x)) bad.push(`${k}: {${x}} is not in the Hebrew`);
        for (const x of want) if (!other.has(x) && !drop.has(x)) bad.push(`${k}: {${x}} is missing`);
      }
      expect(bad).toEqual([]);
    });
    it(`${part}: no Hebrew in the Arabic, and every Arabic text is Arabic`, () => {
      const bad = Object.entries(ar).flatMap(([k, v]) => forms(v).filter((f) => HEBREW.test(f) || (!ARABIC.test(f) && !NO_WORDS.has(f.trim()))).map((f) => `${k}: ${f}`));
      expect(bad).toEqual([]);
    });
    it(`${part}: a plural set has every form the language needs`, () => {
      const need = new Intl.PluralRules(LOCALES.ar.intl).resolvedOptions().pluralCategories;
      for (const [k, v] of Object.entries(ar)) if (typeof v === 'object') expect(Object.keys(v).sort(), k).toEqual([...need].sort());
      expect(Object.values(he).every((v) => typeof v === 'string')).toBe(true);
    });
    it(`${part}: the maths words are the programme's Arabic terms (locales/terms.js)`, () => {
      const gaps = Object.entries(he).flatMap(([k, v]) => forms(ar[k]).flatMap((f) => termGaps(v, f).map((id) => `${k} (${id}): ${f}`)));
      expect(gaps).toEqual([]);
    });
  }
  it('the support services\' Hebrew names and hours are SUPPORT\'s own (shared/safety.js)', () => {
    expect(SHELL_HE['shell.support.svc.eran']).toBe(SUPPORT.eran.name);
    expect(SHELL_HE['shell.support.svc.sahar']).toBe(SUPPORT.sahar.name);
    expect(SHELL_HE['shell.support.svc.always']).toBe(SUPPORT.eran.phoneHours);
    expect(SHELL_HE['shell.support.svc.always']).toBe(SUPPORT.online.hours);
    expect(SHELL_HE['shell.support.svc.saharHours']).toBe(SUPPORT.sahar.hours);
  });
  it('the terms list is sound: each pattern compiles and names one idea once', () => {
    expect(new Set(TERMS.map((x) => x.id)).size).toBe(TERMS.length);
    for (const x of TERMS) { expect(() => new RegExp(x.he)).not.toThrow(); expect(() => new RegExp(x.ar)).not.toThrow(); }
    expect(termGaps('על ציר המספרים', 'على محور الأعداد')).toEqual([]);
    expect(termGaps('על ציר המספרים', 'على خط الأعداد')).toEqual(['number-line']);
    expect(termGaps('בעזרת מד־זווית', 'بالمنقلة')).toEqual([]); // a protractor is not an angle
  });
});

describe('the converted screens', () => {
  for (const file of CONVERTED) {
    it(`${file} holds no Hebrew words (they are in the catalogues)`, () => {
      const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      expect(hebrewLiterals(src, file)).toEqual([]);
    });
  }
  it('every key a converted screen asks for is in the catalogues', () => {
    const all = { ...SHELL_HE, ...SETTINGS_HE };
    const missing = CONVERTED.flatMap((file) => {
      const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      return [...src.matchAll(/\btr?\('((?:shell|settings)\.[\w.]+)'/g)].map((m) => m[1]).filter((k) => !(k in all)).map((k) => `${file}: ${k}`);
    });
    expect(missing).toEqual([]);
  });
});

describe('lib/i18n.js', () => {
  it('Hebrew is the default, unchanged', () => {
    expect(locale()).toBe('he');
    expect(t('shell.shell.1')).toBe('לימוד');
    expect(t('shell.path.3', { done: 2, stairs: 5 })).toBe('2 מתוך 5 מדרגות');
  });
  it('fills values and leaves an unknown one as it is', () => {
    expect(fill('a {x} b {y}', { x: 1 })).toBe('a 1 b {y}');
    expect(t('no.such.key')).toBe('no.such.key');
  });
  it('Arabic: loaded on demand, then every key in Arabic, with the plural form of the number', async () => {
    await loadLocale('ar');
    resetLocaleForTests('ar');
    expect(t('shell.shell.1')).toBe('تعلّم');
    expect(t('shell.path.5', { stairs: 1 })).toBe('درجة واحدة');
    expect(t('shell.path.5', { stairs: 2 })).toBe('درجتان');
    expect(t('shell.path.5', { stairs: 5 })).toBe('5 درجات');
    expect(t('shell.path.5', { stairs: 12 })).toBe('12 درجة');
    expect(pluralForm({ one: 'a', other: 'b' }, { n: 3 }, 'ar')).toBe('b');
  });
  it('numbers and dates are written in the language: Arabic with the digits 0-9 and Arabic month names', async () => {
    await loadLocale('ar');
    const day = new Date('2026-11-05T10:00:00');
    expect(fmtDate(day, { day: 'numeric', month: 'long' })).toBe('5 בנובמבר');
    expect(fmtNum(1234.5)).toBe('1,234.5');
    resetLocaleForTests('ar');
    expect(fmtDate(day, { day: 'numeric', month: 'long' })).toBe('5 نوفمبر');
    expect(fmtNum(1234.5)).toBe('1,234.5');
    expect(fmtNum(0.42, { style: 'percent' })).toMatch(/^‎?42‎?%‎?$/);
  });
  it('a constant with words is computed again in each language (localized), so importers read the new words', async () => {
    let words = localized(() => t('shell.shell.2'), (v) => { words = v; });
    expect(words).toBe('משימות');
    await setLocale('ar');
    expect(words).toBe('مهامّ');
    await setLocale('he');
    expect(words).toBe('משימות');
  });
  it('the Arabic words are one lazy import: both parts, nothing else', async () => {
    const all = await importArabic();
    expect(Object.keys(all).length).toBe(Object.keys(SHELL_AR).length + Object.keys(SETTINGS_AR).length);
  });
});
