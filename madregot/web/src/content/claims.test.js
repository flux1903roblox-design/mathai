// The public claims (STUDENT-17): each one's words have no slot left once shown, a claim is shown exactly when its check
// holds, the app's own claims hold on this code, the other lanes' wait for their code (and turn on with it), and the
// number of named mistakes is counted from the content, never typed.
import { describe, it, expect } from 'vitest';
import { CLAIMS, CLAIM, claimStatus, visibleClaims, countNamedMistakes, programmeCoverage, claimData, claimText } from './claims.js';
import { TOPICS } from './index.js';
import { CONTENT } from '@/learn/content/index.ts';
import { codeWith, MERGED } from '@/lib/testing/claimCode.js';

const data = { ...claimData(), vars: {} };
const now = claimStatus({ code: codeWith(), data });
const byId = Object.fromEntries(now.map((s) => [s.id, s]));
const merged = claimStatus({ code: codeWith(MERGED), data: { ...data, coverage: 41 } });

describe('the claims', () => {
  it('have unique ids, Hebrew (or, for the reviewers\' notes, English) words, and a check', () => {
    expect(new Set(CLAIMS.map((c) => c.id)).size).toBe(CLAIMS.length);
    for (const c of CLAIMS) {
      expect(typeof c.check, c.id).toBe('function');
      if (c.lang === 'en') expect(c.en, c.id).toMatch(/^[A-Z][\x20-\x7e’–]+\.$/);
      else expect(c.he, c.id).toMatch(/[֐-׿]/);
      // a claim waiting for another lane says which; one of the app's own core may stop the build instead
      expect(!!c.required || !!c.needs || c.id === 'teachers', c.id).toBe(true);
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

  it('the other lanes\' claims are hidden on this branch, and shown once their code is here', () => {
    const waiting = CLAIMS.filter((c) => c.needs).map((c) => c.id);
    expect(waiting.sort()).toEqual(['assign-due', 'chatbot', 'class-delete', 'class-report', 'coverage', 'demo-class', 'parent-ok', 'pilot-kit', 'pilot-report', 'principal-form', 'report-answer', 'school-ai-off', 'teachers-assign', 'tutor-knows', 'weekly-share']);
    for (const id of waiting) expect(byId[id].visible, id).toBe(false);
    const after = Object.fromEntries(merged.map((s) => [s.id, s]));
    for (const id of waiting) expect(after[id].visible, `${id} after the merge`).toBe(true);
    expect(after.coverage.text).toBe('מכסה 41% משעות תכנית הלימודים במתמטיקה של כיתות ז׳ ו־ח׳.');
  });

  it('the teachers\' line is one of two: without assignments now, with them after the merge', () => {
    expect([byId.teachers.visible, byId['teachers-assign'].visible]).toEqual([true, false]);
    const after = Object.fromEntries(merged.map((s) => [s.id, s.visible]));
    expect([after.teachers, after['teachers-assign']]).toEqual([false, true]);
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
    expect(claimText(CLAIM.coverage, { data: {} })).toMatch(/\{\{COVERAGE\}\}/);
    expect(byId.coverage.visible).toBe(false);
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
    expect(n).toBe(claimData().mistakes);
  });
});

describe('programmeCoverage (CURRICULUM-1)', () => {
  it('is null until that lane\'s programme is here, then the share of both grades\' hours', () => {
    expect(programmeCoverage({})).toBeNull();
    const coverageOf = (g) => (g === '7' ? { hours: 100, taught: 60 } : { hours: 100, taught: 20 });
    expect(programmeCoverage({ '../learn/programme.ts': { coverageOf } })).toBe(40);
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
    for (const h of ['## המקום שלנו', '## מי עוד בשטח', '## מה אי אפשר להעתיק בשבוע', '## למה לא פשוט צ׳אטבוט חינמי?', '## הוכחות', '## מה עוד חסר']) expect(doc).toContain(h);
    expect(doc).toContain(`הקוד מכיר כרגע ${countNamedMistakes()} טעויות בשמן`);
  });
});
