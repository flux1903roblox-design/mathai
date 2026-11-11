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

const html = () => { Object.assign(useApp.getInitialState(), useApp.getState()); return renderToStaticMarkup(<MemoryRouter initialEntries={['/settings']}><Settings /></MemoryRouter>); };
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
    expect(out).toMatch(/<h2 id="adults-title" class="set-head set-adults-head">להורים ולמבוגרים<\/h2>/);
    const adults = text(out.slice(out.indexOf('id="adults-title"'), out.indexOf('id="dz-title"')));
    expect(adults).toContain('שמירה, גיבוי ופרטים לתמיכה.');
    for (const w of ['שמירת ההתקדמות', 'שמירה קבועה בדפדפן', 'לשמור קובץ גיבוי', 'מידע לתמיכה']) expect(adults).toContain(w);
    // the saving keeps its anchor (the storage banner's "מה עושים" opens /settings#save)
    expect(out).toContain('id="save"');
    // deleting stays last
    expect(out.indexOf('id="dz-title"')).toBeGreaterThan(out.indexOf('מידע לתמיכה'));
  });
});
