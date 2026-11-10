// Settings › מידע לתמיכה (DURABLE-9): the rows, closed until it is opened, and the plain text that is copied: the build,
// the saving, the room used, the backup and the last errors, and nothing of the student.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SupportInfo, { supportText, roomText, mb, COPIED } from './SupportInfo.jsx';

describe('SupportInfo', () => {
  it('a <details> closed by default, with its rows and the copy button', () => {
    const out = renderToStaticMarkup(<SupportInfo />);
    expect(out).toMatch(/^<details class="[^"]*support-info/);
    expect(out).not.toMatch(/<details[^>]* open/);
    for (const row of ['מידע לתמיכה', 'גרסה', 'שמירה במכשיר', 'שמירה קבועה בדפדפן', 'מקום בשימוש', 'גיבוי', 'תקלות אחרונות', 'להעתיק לתמיכה']) expect(out).toContain(row);
    expect(COPIED).toBe('הועתק. אפשר להדביק במייל לתמיכה.');
  });

  it('the room used, in MB', () => {
    expect(mb(420 * 1024)).toBe('0.4 MB');
    expect(mb(3 * 1024 ** 3)).toBe('3,072 MB');
    expect(roomText({ usage: 420 * 1024, quota: 2 * 1024 **3 })).toBe('0.4 MB מתוך 2,048 MB');
    expect(roomText(null)).toBe('לא ידוע');
    expect(roomText({ usage: 1, quota: 0 })).toBe('לא ידוע');
  });

  it('the copied text: every row, the errors newest first, and no name or code', () => {
    const text = supportText({
      release: 'abc1234', health: 'mirror', persisted: false, estimate: { usage: 2 * 1024 ** 2, quota: 1024 ** 3 },
      errors: [{ at: '2026-11-05T10:00:00Z', kind: 'render', route: '/me', message: 'boom' }, { at: '2026-11-05T09:00:00Z', kind: 'storage', route: '/', name: 'quota', message: '' }],
    });
    const lines = text.split('\n');
    expect(lines.slice(0, 7)).toEqual([
      'מדרגות · מידע לתמיכה', 'גרסה: abc1234', 'שמירה במכשיר: נשמר', 'שמירה קבועה בדפדפן: לא מובטחת', 'מקום בשימוש: 2 MB מתוך 1,024 MB', 'גיבוי: כבוי', 'תקלות אחרונות:',
    ]);
    expect(lines[7]).toMatch(/ · render · \/me · boom$/);
    expect(lines[8]).toMatch(/ · storage · \/ · quota$/);
    expect(supportText({ release: 'dev', health: 'full', persisted: null, estimate: null, errors: [] })).toContain('תקלות אחרונות: אין');
    expect(supportText({ release: 'dev', health: 'full', persisted: null, estimate: null, errors: [] })).toContain('שמירה במכשיר: לא נשמר: הדפדפן מלא');
  });
});
