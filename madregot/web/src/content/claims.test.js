// The public claims (STUDENT-17): each one's words have no slot left once shown, a claim is shown exactly when its check
// holds, the app's own claims hold on this code, the other lanes' wait for their code (and turned on with it, here on
// the integrated branch), and the
// number of named mistakes is counted from the content, never typed.
import { describe, it, expect } from 'vitest';
import { CLAIMS, CLAIM, claimStatus, visibleClaims, countNamedMistakes, programmeCoverage, claimData, claimText } from './claims.js';
import { TOPICS } from './index.js';
import { loadAllContent } from '@/learn/content/index.ts';
import { codeWith, MERGED } from '@/lib/testing/claimCode.js';
import countsJson from '../../../store/counts.json?raw';
import { parts, current, apply, bothGrades } from '../../scripts/positioning-md.mjs';
import { coverageOf } from '@/learn/programme';

const data = { ...(await claimData()), vars: {} };
// every stair's teaching content (DURABLE-11: topics load on demand)
const CONTENT = await loadAllContent();
const now = claimStatus({ code: codeWith(), data });
const byId = Object.fromEntries(now.map((s) => [s.id, s]));
const COV = { '7': 'במדרגות יש כבר את החומר של 60 מתוך 100 שעות ההוראה של כיתה ז׳ (60%).', '8': 'במדרגות יש כבר את החומר של 20 מתוך 100 שעות ההוראה של כיתה ח׳ (20%).' };
const merged = claimStatus({ code: codeWith(MERGED), data: { ...data, coverage: COV } });

describe('the claims', () => {
  it('have unique ids, Hebrew (or, for the reviewers\' notes, English) words, and a check', () => {
    expect(new Set(CLAIMS.map((c) => c.id)).size).toBe(CLAIMS.length);
    for (const c of CLAIMS) {
      expect(typeof c.check, c.id).toBe('function');
      if (c.lang === 'en') expect(c.en, c.id).toMatch(/^[A-Z][\x20-\x7e’–]+\.$/);
      // a claim made only of slots (coverage: each grade's sentence) has its Hebrew in what fills them
      else if (/^(\s*\{\{\w+\}\}\s*)+$/.test(c.he)) expect(claimText(c, { data: { ...data, coverage: COV } }), c.id).toMatch(/^[^{}]*[֐-׿][^{}]*$/);
      else expect(c.he, c.id).toMatch(/[֐-׿]/);
      // a claim waiting for another lane says which, one that depends on how the deployment sells says that; one of the
      // app's own core may stop the build instead
      expect(!!c.required || !!c.needs || !!c.deploy || c.id === 'teachers', c.id).toBe(true);
    }
  });

  it('a shown claim has every slot filled; a claim is shown exactly when its check holds', () => {
    for (const s of [...now, ...merged]) {
      if (s.visible) expect(s.text, s.id).not.toMatch(/\{\{/);
      else expect(s.text, s.id).toBe('');
    }
    expect(visibleClaims({ code: codeWith(), data })).toEqual(Object.fromEntries(now.filter((s) => s.visible).map((s) => [s.id, s.text])));
    // a check that throws is false, with its reason
    const broken = claimStatus({ code: { has: () => { throw new Error('disk'); }, read: () => '' }, data });
    expect(broken.find((s) => s.id === 'tomorrow-board')).toMatchObject({ visible: false, why: 'disk' });
  });

  it('the app\'s own claims hold on this code', () => {
    const lost = now.filter((s) => s.required && !s.visible).map((s) => `${s.id}: ${s.why}`);
    expect(lost).toEqual([]);
    expect(byId.mistakes.text).toBe(`המערכת מזהה ${countNamedMistakes()} טעויות נפוצות בשמן, ומציעה דרך אחרת להבין כל אחת.`);
  });

  it('the other lanes\' claims are shown on the integrated branch, their code being here, and hide again without it', () => {
    const waiting = CLAIMS.filter((c) => c.needs).map((c) => c.id);
    expect(waiting.sort()).toEqual(['assign-due', 'chatbot', 'class-delete', 'class-report', 'coverage', 'demo-class', 'parent-ok', 'pilot-kit', 'pilot-report', 'principal-form', 'report-answer', 'school-ai-off', 'teachers-assign', 'tutor-knows', 'weekly-share']);
    for (const id of waiting) expect(byId[id].visible, id).toBe(true);
    // SK-BUYERS-3: each grade's share on its own, in the sentence store/counts.json holds (never one combined share)
    const counts = JSON.parse(countsJson).coverage;
    expect(byId.coverage.text).toBe(`${counts['7']} ${counts['8']}`);
    expect(byId.coverage.text).not.toMatch(/כיתות ז׳ ו־ח׳/);
    // the names each claim looks for are the merged code's: with them added again nothing changes
    const after = Object.fromEntries(merged.map((s) => [s.id, s]));
    for (const id of waiting) expect(after[id].visible, `${id} with the lanes' names`).toBe(true);
    expect(after.coverage.text).toBe(`${COV['7']} ${COV['8']}`);
    // and a lane's code gone hides its claims again
    const gone = Object.fromEntries(claimStatus({ code: codeWith({}, { drop: ['worker/src/assignments.js', 'web/src/lib/teacherCsv.js', 'shared/guard.js', 'worker/scripts/pilot.mjs'] }), data }).map((s) => [s.id, s.visible]));
    expect([gone['assign-due'], gone['class-report'], gone['tutor-knows'], gone['pilot-report']]).toEqual([false, false, false, false]);
  });

  it('the teachers\' line is one of two: with the assignments here, the one that names them', () => {
    expect([byId.teachers.visible, byId['teachers-assign'].visible]).toEqual([false, true]);
    const before = Object.fromEntries(claimStatus({ code: codeWith({}, { drop: ['worker/src/assignments.js'] }), data }).map((s) => [s.id, s.visible]));
    expect([before.teachers, before['teachers-assign']]).toEqual([true, false]);
  });

  it('"מבטלים באתר" only while a plan that renews is sold online; "subscribe on our website" while any family plan is (COUNCIL2-30)', () => {
    const at = (vars) => Object.fromEntries(claimStatus({ code: codeWith(), data: { ...data, vars } }).filter((s) => ['cancel-web', 'subscribe-web'].includes(s.id)).map((s) => [s.id, s.visible]));
    expect(at({ BILLING_PROVIDER: 'grow', GROW_DIRECT_DEBIT_API: 'on' })).toEqual({ 'cancel-web': true, 'subscribe-web': true });
    expect(at({ BILLING_PROVIDER: 'grow', GROW_DIRECT_DEBIT_API: 'off' })).toEqual({ 'cancel-web': false, 'subscribe-web': true });
    expect(at({ BILLING_PROVIDER: 'test' })).toEqual({ 'cancel-web': true, 'subscribe-web': true });
    expect(at({ BILLING_PROVIDER: 'manual' })).toEqual({ 'cancel-web': false, 'subscribe-web': false });
    expect(at({})).toEqual({ 'cancel-web': false, 'subscribe-web': false });
    // a /cancel route alone is not enough: the plan must renew and be sold
    const noRoute = claimStatus({ code: codeWith({}, { drop: ['web/src/App.jsx'] }), data: { ...data, vars: { BILLING_PROVIDER: 'test' } } }).find((s) => s.id === 'cancel-web');
    expect(noRoute.visible).toBe(false);
    expect(claimStatus({ code: codeWith(), data }).find((s) => s.id === 'cancel-web').why).toBe('not in this deployment: a plan that renews, sold online');
  });

  it('the school AI line follows the Worker\'s approval: hidden once the owner sets MOE_AI_APPROVAL = "approved"', () => {
    const on = claimStatus({ code: codeWith(MERGED), data: { ...data, vars: { MOE_AI_APPROVAL: 'none' } } }).find((s) => s.id === 'school-ai-off');
    const approved = claimStatus({ code: codeWith(MERGED), data: { ...data, vars: { MOE_AI_APPROVAL: 'approved' } } }).find((s) => s.id === 'school-ai-off');
    expect([on.visible, approved.visible]).toEqual([true, false]);
  });

  it('an app that lost a feature loses the claim: the stair content, the teacher\'s board, the class delete of a student', () => {
    expect(claimStatus({ code: codeWith(), data: { ...data, mistakes: 12 } }).find((s) => s.id === 'mistakes').visible).toBe(false);
    expect(claimStatus({ code: codeWith({}, { drop: ['web/src/screens/Teacher.jsx'] }), data }).find((s) => s.id === 'tomorrow-board').visible).toBe(false);
    expect(claimStatus({ code: codeWith({}, { drop: ['web/src/screens/PracticeExam.jsx'] }), data }).find((s) => s.id === 'free-list').visible).toBe(false);
    expect(claimStatus({ code: codeWith({}, { drop: ['web/scripts/check-dist.mjs'] }), data }).find((s) => s.id === 'no-ads').visible).toBe(false);
  });

  it('a claim with a slot and no value stays hidden', () => {
    expect(claimText(CLAIM.coverage, { data: {} })).toMatch(/\{\{COVERAGE_7\}\}/);
    expect(claimStatus({ code: codeWith(), data: { ...data, coverage: { '7': COV['7'] } } }).find((s) => s.id === 'coverage').visible).toBe(false);
    expect(claimStatus({ code: codeWith(), data: { ...data, coverage: null } }).find((s) => s.id === 'coverage').visible).toBe(false);
  });

  it('the student\'s removal is the one delete path (forget.js STUDENT_ROWS, run by licence.js removeStudent)', () => {
    expect(byId['student-remove'].visible).toBe(true);
    const gone = claimStatus({ code: codeWith({}, { drop: ['worker/src/forget.js'] }), data }).find((s) => s.id === 'student-remove');
    expect(gone.visible).toBe(false);
  });
});

// PRODUCT2-30: what the family plan gives the parent, each a checked claim the app's parents page and the landing plan
// card say in the same words (content/familyPlan.js): the daily synced report, the Sunday email and the exam ahead
/** The synced report as promised: on the days the child practises, while the child's sharing is on (never "every day"). */
const SYNCED = 'סיכום התרגול מגיע לבד מהמכשיר של הילד בכל יום שבו מתרגלים, כל עוד השיתוף פועל אצל הילד. אפשר לראות את 8 השבועות האחרונים.';
describe('the family plan\'s claims (PRODUCT2-30)', () => {
  it('promise no more than the product gives: a report on the days the child practises, while the child shares', async () => {
    // the review's case: "כל יום" promised daily delivery, but nothing comes on a day the device is not used, and the
    // child can stop sharing at any time (Parents.jsx CHECKOUT_REPORT)
    const { PLAN_TEXT, FREE_REPORT } = await import('./familyPlan.js');
    for (const t of [PLAN_TEXT['synced-report'], FREE_REPORT]) {
      expect(t).not.toMatch(/(^|[ ,])כל יום/);
      expect(t).toContain('בכל יום שבו מתרגלים');
    }
    expect(PLAN_TEXT['synced-report']).toContain('כל עוד השיתוף פועל אצל הילד');
  });

  it('hold on this code, in the words the parents\' page uses', () => {
    for (const id of ['synced-report', 'sunday-email', 'exam-ready']) {
      expect(byId[id].visible, id).toBe(true);
      expect(byId[id].required, id).toBe(true);
    }
    expect(byId['synced-report'].text).toBe(SYNCED);
    expect(byId['sunday-email'].text).toBe('סיכום שבועי במייל בכל יום ראשון, אם תבחרו.');
    expect(byId['exam-ready'].text).toBe('לפני מבחן: כמה מהמדרגות של המבחן כבר בשליטה, בעמוד ההורים ובמייל של יום ראשון.');
    // no claim of alerts: nothing in the app sends one
    expect(CLAIMS.some((c) => /התראה|התראות/.test(c.he || ''))).toBe(false);
  });
  it('hide when their code is gone: the stored daily rows, the Sunday email, the exam line', () => {
    const gone = (drop) => Object.fromEntries(claimStatus({ code: codeWith({}, { drop }), data }).map((s) => [s.id, s.visible]));
    expect(gone(['worker/src/report.js'])['synced-report']).toBe(false);
    expect(gone(['web/src/screens/parents/FamilyReport.jsx'])['synced-report']).toBe(false);
    expect(gone(['worker/src/report.js'])['sunday-email']).toBe(false);
    expect(gone(['worker/src/email.js'])['exam-ready']).toBe(false);
    expect(gone(['web/src/screens/parents/FamilyReport.jsx'])['exam-ready']).toBe(false);
  });
});

describe('countNamedMistakes', () => {
  it('counts distinct ids with a Hebrew title in the stairs and the topics\' categories, once each', () => {
    const content = {
      'a:1': { misconceptions: [{ id: 'sign', title: 'מחסרים במקום לחבר' }, { id: 'swap', title: 'מחליפים בין x ל־y' }] },
      'a:2': { misconceptions: [{ id: 'sign', title: 'סימן הפוך' }, { id: 'raw', title: 'no Hebrew here' }] },
    };
    const topics = [{ cats: { swap: 'החלפה', order: 'סדר פעולות', blank: '' } }];
    expect(countNamedMistakes(content, topics)).toBe(3); // sign, swap, order
    expect(countNamedMistakes({}, [])).toBe(0);
  });

  it('is at least 50 in the app, from the content itself', () => {
    const n = countNamedMistakes(CONTENT, TOPICS);
    expect(n).toBeGreaterThanOrEqual(50);
    expect(n).toBe(data.mistakes);
  });
});

describe('programmeCoverage (CURRICULUM-1, SK-BUYERS-3)', () => {
  it('is null until that lane\'s programme is here, then each grade\'s sentence on its own (never one combined share)', () => {
    expect(programmeCoverage({})).toBeNull();
    const coverageOf = (g) => (g === '7' ? { hours: 100, taught: 60, pct: 60 } : { hours: 100, taught: 20, pct: 20 });
    const coverageSentence = (g, c) => `${g}:${c.taught}/${c.hours} (${c.pct}%)`;
    expect(programmeCoverage({ '../learn/programme.ts': { coverageOf, coverageSentence } })).toEqual({ '7': '7:60/100 (60%)', '8': '8:20/100 (20%)' });
    // the app's own: the sentences store/counts.json holds, which the listing and the /programme page quote
    expect(programmeCoverage()).toEqual(JSON.parse(countsJson).coverage);
  });
});

describe('docs/POSITIONING.md', () => {
  const doc = Object.values(import.meta.glob('../../../docs/POSITIONING.md', { query: '?raw', import: 'default', eager: true }))[0];
  const rows = doc.split('## מי עוד בשטח')[1].split('\n## ')[0].split('\n').filter((l) => /^\| (?!מוצר|---)/.test(l));

  it('dates and sources every row of the rivals table (a link, or a named source with the gap said)', () => {
    expect(rows.length).toBeGreaterThanOrEqual(10);
    for (const row of rows) {
      const source = row.split('|').at(-2);
      expect(source, row.slice(0, 40)).toMatch(/\d{1,2}\.\d{1,2}\.20\d\d|\d{4}-\d{2}-\d{2}/);
      expect(source, row.slice(0, 40)).toMatch(/https:\/\/\S+|קישור ישיר: עוד לא נאסף/);
    }
    expect(rows.filter((r) => /קישור ישיר: עוד לא נאסף/.test(r)).length).toBeLessThanOrEqual(1);
  });

  it('has the sections the owner and the judges read, and states the named-mistake count the code computes', () => {
    for (const h of ['## המקום שלנו', '## מי עוד בשטח', '## פרויקט 720 ו־Kaltura', '## מה אי אפשר להעתיק בשבוע', '## למה לא פשוט צ׳אטבוט חינמי?', '## הוכחות', '## מה עוד חסר']) expect(doc).toContain(h);
    expect(doc).toContain(`הקוד מכיר כרגע ${countNamedMistakes()} טעויות בשמן`);
  });

  // COUNCIL2-38: the proofs table said 92 while the app counted 119. Its numbers, and the mistake count, are now the
  // generated parts of the document (npm run positioning:md); a stale one fails here.
  it('its generated parts are what the code gives today (npm run positioning:md)', () => {
    const now = parts();
    for (const name of Object.keys(now)) expect(current(doc, name), name).toBe(now[name]);
    expect(apply(doc)).toBe(doc);
    expect(now.proofs).toContain(`| ${countNamedMistakes()} |`);
    // the two grades' hours together (programmeCoverage gives each grade's sentence since SK-BUYERS-3)
    const both = bothGrades(Object.fromEntries(['7', '8'].map((g) => [g, coverageOf(g)])));
    expect(both).toBeGreaterThan(0);
    expect(now.proofs).toContain(`| ${both}% משעות שתי השכבות`);
  });

  it('states no other number of named mistakes anywhere in it', () => {
    const stated = [...doc.matchAll(/(\d+) טעויות/g)].map((m) => Number(m[1]));
    expect(stated.length).toBeGreaterThan(0);
    expect(stated.every((n) => n === countNamedMistakes())).toBe(true);
    // and a count the code no longer gives is caught: the document as it was before COUNCIL2-38
    expect(current(apply(doc, { ...parts(), proofs: parts().proofs.replace(`| ${countNamedMistakes()} |`, '| 92 |') }), 'proofs')).not.toBe(parts().proofs);
  });

  it('names the state\'s own grade 7-8 programme (Kaltura and 720, 3.11.2026) and the free tools a family already has', () => {
    for (const s of ['Kaltura', '720', '3.11.2026', 'ישראל היום', 'Gemini', 'Study Mode', 'Go Math', '₪179.99', 'id6748574236']) expect(doc, s).toContain(s);
  });
});
