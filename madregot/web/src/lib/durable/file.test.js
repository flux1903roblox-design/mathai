// The backup file (DURABLE-4): a round trip gives back the progress whole (only what belongs to the device stays
// behind), a file from an older version is brought up to date, and every file that cannot be used is refused with
// its own message.
import { describe, it, expect, vi } from 'vitest';
import { resolveObjectURL } from 'node:buffer';
import { exportBackup, importBackup, backupName, backupJson, FILE_ERRORS, SHARE_TITLE, SHARE_TEXT, BACKUP_MAX_BYTES } from './file.js';
import { snapshotForBackup } from './payload.js';
import { migrate, CURRENT_VERSION } from './migrations.js';
import { validateState } from './validate.js';
import { sumXp } from './xp.js';
import { heavyYear } from './testing.js';
import v3 from './fixtures/v3.json';

const NOW = new Date('2026-11-05T10:00:00');
/** A student's whole state (v5), with everything a device has: the tutor, a class token, an outbox, a backup. */
const student = () => ({
  ...migrate(heavyYear({ days: 20, events: 50, exams: 2, practiceExams: 1 }).state, 4),
  profile: { role: 'student', name: 'נועה כהן', grade: '7', classCode: 'K7Q2MD', className: 'ז׳3', token: 'tok-example', studentId: 's1' },
  outbox: [{ id: 'o1', topic: 'signed', level: 1, ok: true }],
  backup: { on: true, code: 'example-code' },
  setSound: () => {}, // a live store has its actions too
});

/** A browser that can share files, and remembers what it was given. */
const sharer = (result = Promise.resolve()) => { const nav = { given: [], canShare: vi.fn(() => true), share: vi.fn((data) => { nav.given.push(data); return result; }) }; return nav; };
/** A document whose links remember the download they would start. */
function downloader() {
  const doc = { downloads: [], body: { appendChild() {} } };
  doc.createElement = () => { const a = { click() { doc.downloads.push({ name: a.download, blob: resolveObjectURL(a.href) }); }, remove() {} }; return a; };
  return doc;
}
const fileOf = (data, name = 'b.json') => new File([typeof data === 'string' ? data : JSON.stringify(data)], name, { type: 'application/json' });

describe('saving the file', () => {
  it('the name: madregot-<name>-<date>.json, or גיבוי without a name, and nothing a file system refuses', () => {
    expect(backupName({ profile: { name: 'נועה כהן' } }, NOW)).toBe('madregot-נועה-כהן-2026-11-05.json');
    expect(backupName({ profile: null }, NOW)).toBe('madregot-גיבוי-2026-11-05.json');
    expect(backupName({ profile: { name: 'a/b:c?' } }, NOW)).toBe('madregot-abc-2026-11-05.json');
  });

  it('shares one JSON file with the title and the text where the browser can share files', async () => {
    const nav = sharer(); const doc = downloader();
    expect(await exportBackup(student(), { nav, doc, now: NOW })).toBe('shared');
    expect(nav.given).toHaveLength(1);
    const { files, title, text } = nav.given[0];
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('madregot-נועה-כהן-2026-11-05.json');
    expect(files[0].type).toBe('application/json');
    expect({ title, text }).toEqual({ title: SHARE_TITLE, text: SHARE_TEXT });
    expect(doc.downloads).toEqual([]);
    const data = JSON.parse(await files[0].text());
    expect(data).toMatchObject({ app: 'madregot', kind: 'backup', v: 1, at: NOW.toISOString(), schema: CURRENT_VERSION });
    expect(typeof data.release).toBe('string');
  });

  it('downloads where it cannot share, or when sharing fails; a closed share sheet saves nothing', async () => {
    const doc = downloader();
    expect(await exportBackup(student(), { nav: {}, doc, now: NOW })).toBe('downloaded');
    expect(await exportBackup(student(), { nav: { canShare: () => false, share: vi.fn() }, doc, now: NOW })).toBe('downloaded');
    expect(await exportBackup(student(), { nav: sharer(Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' }))), doc, now: NOW })).toBe('downloaded');
    expect(doc.downloads.map((d) => d.name)).toEqual(Array(3).fill('madregot-נועה-כהן-2026-11-05.json'));
    const closed = downloader();
    expect(await exportBackup(student(), { nav: sharer(Promise.reject(Object.assign(new Error('closed'), { name: 'AbortError' }))), doc: closed, now: NOW })).toBe('cancelled');
    expect(closed.downloads).toEqual([]);
  });

  it('round trip: what comes back equals what was saved, except what belongs to the device', async () => {
    const st = student();
    const doc = downloader();
    await exportBackup(st, { nav: {}, doc, now: NOW });
    const back = await importBackup(doc.downloads[0].blob);
    expect(back.ok).toBe(true);
    const { ai, outbox, durable, backup, classWork, workOutbox, setSound, ...rest } = st; // eslint-disable-line no-unused-vars
    const { token, studentId, ...profile } = st.profile; // eslint-disable-line no-unused-vars
    expect(back.state).toEqual({ ...rest, profile });
    for (const k of ['ai', 'outbox', 'durable', 'backup', 'classWork', 'workOutbox']) expect(back.state[k]).toBeUndefined();
    expect(back.at).toBe(NOW.toISOString());
    expect(validateState(back.state)).toEqual([]);
  });

  it('a teacher\'s file keeps the class keys (the only way back to a class with no email)', async () => {
    const teacher = { xp: 0, xpBy: {}, profile: { role: 'teacher', name: 'רונית', classes: [{ code: 'K7Q2MD', key: 'teacher-key-example', className: 'ז׳3' }], active: 'K7Q2MD' } };
    expect(snapshotForBackup(teacher).profile.classes[0].key).toBe('teacher-key-example');
    const back = await importBackup(fileOf(backupJson(teacher, { now: NOW })));
    expect(back.state.profile.classes).toEqual(teacher.profile.classes);
  });
});

describe('reading a file', () => {
  it('a file from the v3 era is brought up to date: the XP gets its counter, and nothing device-only comes in', async () => {
    const back = await importBackup(fileOf({ app: 'madregot', kind: 'backup', v: 1, at: '2026-09-10T10:00:00.000Z', schema: 3, state: v3.state }));
    expect(back.ok).toBe(true);
    expect(back.state.xp).toBe(v3.state.xp);
    expect(sumXp(back.state.xpBy)).toBe(v3.state.xp);
    expect(back.state.profile).not.toHaveProperty('token');
    expect(back.state.profile).not.toHaveProperty('studentId');
    expect(back.state.ai).toBeUndefined();
    expect(Object.values(back.state.path).some((u) => Object.values(u.done || {}).includes('kept'))).toBe(true); // the v4 step ran
    expect(validateState(back.state)).toEqual([]);
  });

  it('refuses a file that is too big', async () => {
    const big = { size: BACKUP_MAX_BYTES + 1, text: vi.fn() };
    expect(await importBackup(big)).toEqual({ ok: false, reason: 'size', message: 'הקובץ גדול מדי.' });
    expect(big.text).not.toHaveBeenCalled(); // never read
  });

  it('refuses a file that is not JSON, or has no state, as broken', async () => {
    expect(await importBackup(fileOf('{"app":"madregot",'))).toEqual({ ok: false, reason: 'broken', message: 'הקובץ פגום, ואי אפשר לשחזר ממנו. נסו קובץ אחר.' });
    expect((await importBackup(fileOf({ app: 'madregot', kind: 'backup', v: 1, schema: 5 }))).reason).toBe('broken');
    expect((await importBackup(null)).reason).toBe('broken');
  });

  it('refuses another app\'s file, or another kind of Madregot file', async () => {
    const foreign = { ok: false, reason: 'foreign', message: 'הקובץ הזה לא נראה כמו גיבוי של מדרגות.' };
    expect(await importBackup(fileOf({ app: 'other', kind: 'backup', state: {} }))).toEqual(foreign);
    expect(await importBackup(fileOf({ app: 'madregot', kind: 'export', state: {} }))).toEqual(foreign); // a parent's account export
    expect(await importBackup(fileOf([1, 2]))).toEqual(foreign);
  });

  it('refuses a state that is not sound after the migrations, whole', async () => {
    const st = snapshotForBackup(student());
    expect((await importBackup(fileOf({ app: 'madregot', kind: 'backup', v: 1, schema: 5, state: { ...st, xpBy: { a1b2c3d4: 'many' } } }))).reason).toBe('broken');
    expect((await importBackup(fileOf({ app: 'madregot', kind: 'backup', v: 1, schema: 5, state: { ...st, days: [] } }))).reason).toBe('broken');
    expect(Object.keys(FILE_ERRORS).sort()).toEqual(['broken', 'foreign', 'size']);
  });
});
