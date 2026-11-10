// Settings › שמירת ההתקדמות, drawn on the server (no browser needed): the file buttons and the note on who can read
// the file (a teacher's says the class keys are in it). The undo is in e2e/backup-file.spec.js (a server render reads
// the store's first state).
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import SaveSection, { BACKUP_NOTE } from './SaveSection.jsx';
import FileRestore from './FileRestore.jsx';
import { shareText, CODE_SHEET } from './BackupCodeSheet.jsx';

const html = (el) => renderToStaticMarkup(<MemoryRouter>{el}</MemoryRouter>);

describe('SaveSection', () => {
  it('a student: saving the file, the restore screen for a code or a file, and the note that anyone with the file can read it', () => {
    const out = html(<SaveSection />);
    expect(out).toContain('לשמור קובץ גיבוי');
    expect(out).toContain('לשחזר מקובץ');
    // with a server (the tests have one) the restore screen takes the code or the file
    expect(out).toContain('לשחזר מקוד או מקובץ');
    expect(out).toContain('בקובץ יש את כל ההתקדמות, כולל השם. מי שמקבל אותו יכול לקרוא אותו.');
    expect(out).not.toContain('לבטל את השחזור האחרון');
  });

  it('a teacher: the note says the class keys are in the file, so keep it to yourself', () => {
    const out = html(<SaveSection role="teacher" />);
    expect(out).toContain('בקובץ יש גם את מפתח המורה של הכיתות. מי שמקבל אותו יכול להיכנס ללוח הכיתה, אז שמרו אותו רק אצלכם.');
    expect(out).not.toContain('כולל השם');
  });

  it('the file input (Settings without a server, Welcome, the restore screen) has the button\'s words as its name', () => {
    const out = html(<FileRestore onLoaded={() => {}} />);
    expect(out).toContain('לשחזר מקובץ');
    const id = out.match(/<label[^>]*class="[^"]*file-pick[^"]*"[^>]*for="([^"]+)"/)?.[1] || out.match(/<label[^>]*for="([^"]+)"[^>]*class="[^"]*file-pick/)?.[1];
    expect(id).toBeTruthy();
    expect(out).toMatch(new RegExp(`<input[^>]*id="${id.replace(/[:]/g, '\\:')}"[^>]*type="file"|<input[^>]*type="file"[^>]*id="${id.replace(/[:]/g, '\\:')}"`));
  });

  // (a server render reads the status store's first state: the browser's other answers are in e2e/install.spec.js)
  it('"שמירה קבועה בדפדפן": before the browser answers it says "לא ידוע", with the info button and no ask button', () => {
    const out = html(<SaveSection />);
    expect(out).toContain('שמירה קבועה בדפדפן');
    expect(out).toContain('aria-label="מתי דפדפן מוחק נתונים"');
    expect(out).toContain('data-persisted="null">לא ידוע</dd>');
    expect(out).not.toContain('לבקש מהדפדפן לשמור');
  });

  it('no Home Screen row away from an iPhone', () => {
    expect(html(<SaveSection />)).not.toContain('להוסיף למסך הבית');
  });

  it('"גיבוי" with a server: off, the button that makes a code, and what the code keeps', () => {
    const out = html(<SaveSection />);
    expect(out).toMatch(/<dt>גיבוי<\/dt><dd class="save-not" data-backup="off">כבוי<\/dd>/);
    expect(out).toContain('ליצור קוד גיבוי');
    expect(out).toContain(BACKUP_NOTE);
    expect(BACKUP_NOTE).toBe('קוד גיבוי שומר עותק מוצפן. בלי הקוד אף אחד לא יכול לקרוא אותו, גם לא אנחנו.');
    expect(out).not.toContain('להציג את קוד הגיבוי');
    expect(out).not.toContain('להפסיק את הגיבוי');
  });
});

describe('BackupCodeSheet', () => {
  it('the message for a parent has the code in groups of four and how to use it', () => {
    expect(shareText('ABCDEFGHJKMNPQRS')).toBe('קוד הגיבוי שלי במדרגות: ABCD-EFGH-JKMN-PQRS\nאם הטלפון יתחלף: פותחים את מדרגות, בוחרים "יש לי קוד גיבוי" ומקלידים את הקוד.');
    expect(CODE_SHEET.title).toBe('קוד הגיבוי שלכם');
    expect(CODE_SHEET.who).toBe('מי שיש לו את הקוד יכול לראות את ההתקדמות שלכם, אז תנו אותו רק למי שאתם סומכים עליו.');
  });
});
