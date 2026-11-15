// A child's Settings speaks to the child (PRODUCT2-41, the council's painful moment #3): the browser-storage rows
// ("שמירה קבועה בדפדפן · לא מובטחת"), the backup and the support details are for the adult who looks after the device,
// so they live in a clearly labelled section for adults ("להורים ולמבוגרים"), not among the student's own settings.
// Backup and restore stay where they were reachable (durable.spec, backup-file.spec, restore.spec run them).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Settings from './Settings.jsx';
import { useApp } from '@/lib/store.js';

vi.mock('react', async (load) => {
  const react = await load();
  return { ...react, default: react, useSyncExternalStore: (sub, get, server) => react.useSyncExternalStore(sub, get, server || get) };
});

const html = (at = '/settings') => { Object.assign(useApp.getInitialState(), useApp.getState()); return renderToStaticMarkup(<MemoryRouter initialEntries={[at]}><Settings /></MemoryRouter>); };
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('Settings for a student', () => {
  beforeEach(() => {
    useApp.getState().resetProgress();
    useApp.setState((s) => ({ profile: { role: 'student', name: 'נועה', grade: '7', know: 1 }, ai: { ...s.ai, apiUrl: 'none' } }));
  });

  it('the student\'s own settings come first, with no browser storage and no support details among them', () => {
    const out = html();
    const at = out.indexOf('id="adults-title"');
    expect(at, 'a section for adults').toBeGreaterThan(0);
    const mine = text(out.slice(0, at));
    for (const w of ['שמירה קבועה בדפדפן', 'מידע לתמיכה', 'לשמור קובץ גיבוי', 'שמירת ההתקדמות']) expect(mine).not.toContain(w);
    for (const w of ['הפרטים שלי', 'מראה', 'צלילים', 'פרטיות ובטיחות', 'צריכים לדבר עם מישהו?']) expect(mine).toContain(w);
  });

  it('the adults\' section says who it is for, and holds the saving, the backup and the support details', () => {
    const out = html();
    expect(text(/<h2 id="adults-title" class="set-head set-adults-head">(.*?)<\/h2>/.exec(out)?.[1] || '').trim()).toBe('להורים ולמבוגרים');
    const adults = text(out.slice(out.indexOf('id="adults-title"'), out.indexOf('id="dz-title"')));
    expect(adults).toContain('שמירה, גיבוי ופרטים לתמיכה.');
    for (const w of ['שמירת ההתקדמות', 'שמירה קבועה בדפדפן', 'לשמור קובץ גיבוי', 'מידע לתמיכה']) expect(adults).toContain(w);
    // the saving keeps its anchor (the storage banner's "מה עושים" opens /settings#save)
    expect(out).toContain('id="save"');
    // deleting stays last
    expect(out.indexOf('id="dz-title"')).toBeGreaterThan(out.indexOf('מידע לתמיכה'));
  });

  it('the adults\' section is folded: a button with aria-expanded opens it; the storage rows are hidden until then', () => {
    // the review's case: "שמירה קבועה בדפדפן · לא מובטחת" was in plain view on the child's screen
    const out = html();
    expect(out).toMatch(/<h2 id="adults-title"[^>]*><button type="button" class="set-adults-toggle" aria-expanded="false" aria-controls="adults-body">להורים ולמבוגרים/);
    const body = out.slice(out.indexOf('id="adults-body"') - 40, out.indexOf('id="dz-title"'));
    expect(body).toMatch(/^.*<div id="adults-body" class="set-adults-body" hidden="">/);
    expect(text(body)).toContain('שמירה קבועה בדפדפן');
    // what shows folded: the heading and who it is for, nothing about the browser
    const shown = text(out.slice(out.indexOf('id="adults-title"'), out.indexOf('id="adults-body"')));
    expect(shown).toContain('שמירה, גיבוי ופרטים לתמיכה.');
    for (const w of ['שמירה קבועה בדפדפן', 'לא מובטחת', 'לשמור קובץ גיבוי', 'מידע לתמיכה']) expect(shown).not.toContain(w);
  });

  it('on an iPhone in the browser, "להוסיף למסך הבית" is among the student\'s own settings, once, not in the folded section', () => {
    expect(html()).not.toContain('להוסיף למסך הבית'); // not an iPhone: no such row
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', maxTouchPoints: 5 });
    try {
      const out = html();
      expect(out.split('להוסיף למסך הבית')).toHaveLength(2);
      expect(out.indexOf('להוסיף למסך הבית')).toBeLessThan(out.indexOf('id="adults-title"'));
      expect(out.indexOf('להוסיף למסך הבית')).toBeGreaterThan(out.indexOf('id="app-title"'));
      // opened from the Home Screen: nothing to add
      vi.stubGlobal('navigator', { ...navigator, standalone: true });
      expect(html()).not.toContain('להוסיף למסך הבית');
    } finally { vi.unstubAllGlobals(); }
  });

  it('/settings#save (the storage banner\'s "מה עושים") opens it at the saving', () => {
    const out = html('/settings#save');
    expect(out).toContain('aria-expanded="true" aria-controls="adults-body"');
    expect(out).toMatch(/<div id="adults-body" class="set-adults-body">/);
    expect(out).toContain('id="save-title"');
  });
});
