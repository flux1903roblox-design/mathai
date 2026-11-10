// Settings › שמירת ההתקדמות, drawn on the server (no browser needed): the file buttons and the note on who can read
// the file (a teacher's says the class keys are in it). The undo is in e2e/backup-file.spec.js (a server render reads
// the store's first state).
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SaveSection from './SaveSection.jsx';

const html = (el) => renderToStaticMarkup(el);

describe('SaveSection', () => {
  it('a student: the two file buttons and the note that anyone with the file can read it', () => {
    const out = html(<SaveSection />);
    expect(out).toContain('לשמור קובץ גיבוי');
    expect(out).toContain('לשחזר מקובץ');
    expect(out).toContain('בקובץ יש את כל ההתקדמות, כולל השם. מי שמקבל אותו יכול לקרוא אותו.');
    expect(out).not.toContain('לבטל את השחזור האחרון');
  });

  it('a teacher: the note says the class keys are in the file, so keep it to yourself', () => {
    const out = html(<SaveSection role="teacher" />);
    expect(out).toContain('בקובץ יש גם את מפתח המורה של הכיתות. מי שמקבל אותו יכול להיכנס ללוח הכיתה, אז שמרו אותו רק אצלכם.');
    expect(out).not.toContain('כולל השם');
  });

  it('the file input has the button\'s words as its name', () => {
    const out = html(<SaveSection />);
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
});
