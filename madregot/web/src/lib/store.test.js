import { describe, it, expect } from 'vitest';
import { migrateState, useApp, TEACHER_EXAMS } from './store.js';

const v2 = (ai) => ({ profile: { role: 'student', name: 'נועה', grade: '7' }, xp: 40, days: { '2026-11-05': { q: 3 } }, learn: { skills: {} }, ai });

describe('saved data v3: the parent account never lives in the child store', () => {
  it('drops ai.account and keeps everything else', () => {
    const out = migrateState(v2({ mode: 'server', apiUrl: 'https://x.example', key: '', device: 'a'.repeat(32), account: { token: 't'.repeat(64), email: 'p@example.test' } }), 2, { personal: false });
    expect(out.ai.account).toBeUndefined();
    expect(out.ai.device).toBe('a'.repeat(32));
    expect(out.ai.familyDevice).toBeNull();
    expect(out.ai.pendingLink).toBeNull();
    expect(out.xp).toBe(40);
    expect(out.days['2026-11-05'].q).toBe(3);
    expect(out.profile.name).toBe('נועה');
  });
  it('drops a personal key and personal mode where the build cannot use one', () => {
    const out = migrateState(v2({ mode: 'personal', key: 'k-123', apiUrl: '', device: '' }), 2, { personal: false });
    expect(out.ai.key).toBe('');
    expect(out.ai.mode).toBe('server');
  });
  it('keeps the personal key and the server address in a build made with VITE_ALLOW_PERSONAL_KEY=1', () => {
    const out = migrateState(v2({ mode: 'personal', key: 'k-123', apiUrl: 'https://my-class.example.test', device: '' }), 2, { personal: true });
    expect(out.ai.key).toBe('k-123');
    expect(out.ai.mode).toBe('personal');
    expect(out.ai.apiUrl).toBe('https://my-class.example.test');
  });
  it('drops a saved server address where the build has no setting to change or clear it', () => {
    const out = migrateState(v2({ mode: 'server', apiUrl: 'https://old-class-server.example.test', key: '', device: 'c'.repeat(32) }), 2, { personal: false });
    expect(out.ai.apiUrl).toBe('');
    expect(out.ai.device).toBe('c'.repeat(32));
    const v1 = migrateState({ gaps: {}, ai: { mode: 'server', apiUrl: 'https://old-class-server.example.test', key: '' } }, 1, { personal: false });
    expect(v1.ai.apiUrl).toBe('');
  });
  it('a v1 save gets the learning model and the v3 ai shape', () => {
    const out = migrateState({ gaps: {}, ai: { mode: 'server', apiUrl: '', key: '' } }, 1, { personal: false });
    expect(out.learn).toBeTruthy();
    expect(out.ai).toMatchObject({ mode: 'server', device: '', familyDevice: null, pendingLink: null, lastTier: null });
  });
  it('broken saved data falls back to the defaults', () => {
    const out = migrateState(null, 2, { personal: false });
    expect(out.ai.mode).toBe('server');
    expect(out.learn).toBeTruthy();
  });
  it('a v3 save is left as it is', () => {
    const ai = { mode: 'server', apiUrl: '', key: '', device: 'b'.repeat(32), familyDevice: { token: 'fd1.x', label: 'הטאבלט' }, pendingLink: null, lastTier: 'family' };
    expect(migrateState(v2(ai), 3, { personal: false }).ai).toEqual(ai);
  });
});

describe('saved data v5: class work from the teacher', () => {
  it('a v4 save gets an empty classWork and workOutbox, and keeps the rest', () => {
    const out = migrateState({ ...v2({ mode: 'server', apiUrl: '', key: '' }), path: {}, progress: {} }, 4, { personal: false });
    expect(out.classWork).toEqual({ at: null, today: null, teacherName: '', assignments: [], help: [], exams: {}, seenAt: null, noticed: {} });
    expect(out.workOutbox).toEqual({});
    expect(out.xp).toBe(40);
  });
});

describe('the teacher\'s class exams on the device (TEACHER-3 §2)', () => {
  const exam = (n) => ({ id: `e${String(n).padStart(11, '0')}`, classCode: 'K7Q2MD', at: `2026-11-0${(n % 9) + 1}T10:00:00.000Z`, title: `מבחן ${n}`, skills: ['signed:2'], count: 6, versions: [{ label: 'א', items: [] }], skipped: [], assignmentId: null });
  it('keeps the newest first, at most 8; a change reaches only that exam; a reset of progress keeps them; signing out clears them', () => {
    const st = useApp.getState();
    st.signOut();
    for (let n = 1; n <= 10; n += 1) useApp.getState().addTeacherExam(exam(n));
    const list = useApp.getState().teacherExams;
    expect(TEACHER_EXAMS).toBe(8);
    expect(list.map((x) => x.title)).toEqual(['מבחן 10', 'מבחן 9', 'מבחן 8', 'מבחן 7', 'מבחן 6', 'מבחן 5', 'מבחן 4', 'מבחן 3']);
    useApp.getState().updateTeacherExam(exam(9).id, { title: 'מבחן לפני החנוכה' });
    expect(useApp.getState().teacherExams.map((x) => x.title).slice(0, 3)).toEqual(['מבחן 10', 'מבחן לפני החנוכה', 'מבחן 8']);
    useApp.getState().addTeacherExam({ ...exam(9), title: 'שוב' }); // the same id again: one row, now first
    expect(useApp.getState().teacherExams.filter((x) => x.id === exam(9).id)).toHaveLength(1);
    expect(useApp.getState().teacherExams[0].title).toBe('שוב');
    useApp.getState().resetProgress();
    expect(useApp.getState().teacherExams).toHaveLength(8);
    useApp.getState().signOut();
    expect(useApp.getState().teacherExams).toEqual([]);
  });
});
