// The introduction before the first AI action follows the device's profile (FOLLOWUP-1): a teacher reads the facts and
// the Ministry's rule as an adult who prepares lessons, never the lines written for a child.
import { describe, it, expect } from 'vitest';
import { AI_INTRO, AI_INTRO_TEACHER, TEACHER_AI_RULE, introFor } from './aiSafety.js';
import { SUPPORT_LINK } from './support.js';

describe('the AI introduction follows the role', () => {
  it('a teacher gets the teacher\'s words; a student, a parent\'s device or no profile get the student\'s', () => {
    expect(introFor('teacher')).toBe(AI_INTRO_TEACHER);
    for (const role of ['student', 'parent', undefined, null, '']) expect(introFor(role)).toBe(AI_INTRO);
    expect(AI_INTRO_TEACHER.title).not.toBe(AI_INTRO.title);
  });

  it('the teacher\'s words: software that can be wrong, check before class; Anthropic in the US, nothing kept; the Ministry\'s rule and no names on a photo', () => {
    const all = AI_INTRO_TEACHER.lines.join(' ');
    expect(all).toContain('(Claude של Anthropic), לא אדם');
    expect(all).toContain('הוא יכול לטעות');
    expect(all).toContain('לפני שמביאים אותו לכיתה');
    expect(all).toContain('נשלח ל־Anthropic בארה״ב');
    expect(all).toContain('מדרגות לא שומרת את השיחות');
    expect(all).toContain(TEACHER_AI_RULE);
    expect(all).toContain('לא מצלמים דף שכתוב עליו שם');
    // the safety statement stays one tap away, and the button says the same
    expect(AI_INTRO_TEACHER.more).toBe(AI_INTRO.more);
    expect(AI_INTRO_TEACHER.ok).toBe(AI_INTRO.ok);
  });

  it('none of the lines written for a child reach a teacher', () => {
    const studentOnly = AI_INTRO.lines.filter((l) => !AI_INTRO_TEACHER.lines.includes(l));
    expect(studentOnly.length).toBe(4); // all but "where what is written goes"
    const all = AI_INTRO_TEACHER.lines.join(' ');
    for (const line of studentOnly) expect(all).not.toContain(line);
    expect(all).not.toContain(SUPPORT_LINK); // "צריכים לדבר עם מישהו?"
    expect(all).not.toMatch(/פותר במקומכם|שם מלא|תעודת זהות|מדאיג אתכם/);
  });

  it('the note above the teacher\'s assistant says the same rule in the same words', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const { default: TeacherAINote } = await import('@/components/teacher/TeacherAINote.jsx');
    expect(renderToStaticMarkup(createElement(TeacherAINote, { setting: 'school' }))).toContain(`${TEACHER_AI_RULE} בכיתה לא מציגים את העוזר לתלמידים.`);
    expect(renderToStaticMarkup(createElement(TeacherAINote, { setting: 'private' }))).toContain(TEACHER_AI_RULE);
  });
});
