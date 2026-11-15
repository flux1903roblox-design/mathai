// The AI tab for a child practising alone (PRODUCT2-40/41, the council's "one of the five tabs is a wall"): with no
// server it is a calm page about what מדי already explains in every lesson; with a server and no parent's OK yet
// (TRUST-9) it leads with what the helper does and one clear "לבקש מהורה". Neither is a locked input, and the quiet
// "צריכים לדבר עם מישהו?" link (the 1201 card) stays on both. The parent-OK rule itself is not tested here (trust.spec).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Assistant from './Assistant.jsx';
import { useApp } from '@/lib/store.js';
import { useAIStatus } from '@/lib/account.js';

vi.mock('react', async (load) => {
  const react = await load();
  return { ...react, default: react, useSyncExternalStore: (sub, get, server) => react.useSyncExternalStore(sub, get, server || get) };
});

const html = () => {
  Object.assign(useApp.getInitialState(), useApp.getState());
  Object.assign(useAIStatus.getInitialState(), useAIStatus.getState());
  return renderToStaticMarkup(<MemoryRouter initialEntries={['/assistant']}><Assistant /></MemoryRouter>);
};
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const LOCKED = /העוזר עוד לא מחובר|מחכים לאישור של הורה|disabled=""[^>]*placeholder|placeholder="[^"]*לא מחובר/;

describe('the AI tab for a child practising alone', () => {
  beforeEach(() => {
    useApp.getState().resetProgress();
    useApp.setState((s) => ({ profile: { role: 'student', name: 'נועה', grade: '7', know: 1 }, ai: { ...s.ai, apiUrl: '', introSeen: true } }));
    useAIStatus.setState({ status: null });
  });

  it('with no server: a calm page about what מדי explains in every lesson, and ways on; no locked input', () => {
    useApp.setState((s) => ({ ai: { ...s.ai, apiUrl: 'none' } }));
    const out = html();
    expect(out).not.toMatch(LOCKED);
    expect(out).not.toContain('<textarea');
    expect(out).not.toContain('<input');
    expect(out).toMatch(/<h2[^>]*>מדי מסביר בכל שיעור<\/h2>/);
    for (const w of ['הסבר עם ציור', 'דוגמה פתורה', 'למה זה לא נכון', 'רמז ותזכורת']) expect(text(out)).toContain(w);
    expect(out).toMatch(/<a[^>]*href="\/"[^>]*>להמשיך ללמוד<\/a>/);
    expect(out).toMatch(/<a[^>]*href="\/topics"[^>]*>דפי התזכורת<\/a>/);
    expect(text(out)).toContain('צריכים לדבר עם מישהו?');
    expect(out).not.toContain('איך מחברים את העוזר');
  });

  it('with a server and no parent\'s OK yet: what the helper does, one clear "לבקש מהורה", and an open input', () => {
    useApp.setState((s) => ({ ai: { ...s.ai, apiUrl: 'https://api.madregot.test' } }));
    useAIStatus.setState({ status: { state: 'parent_ok_needed' } });
    const out = html();
    expect(out).not.toMatch(LOCKED);
    // it leads with what the helper does
    expect(out).toMatch(/<h2[^>]*>מה העוזר החכם עושה<\/h2>/);
    for (const w of ['הסבר לכל שאלה, צעד אחר צעד', 'בדיקה של פתרון מצולם', 'תרגילים חדשים באותה מדרגה']) expect(text(out)).toContain(w);
    expect(text(out)).toContain('אחד ההורים מאשר את זה פעם אחת. זה בחינם ולוקח דקה.');
    // one clear action, the existing TRUST-9 way to the screen for the parents
    expect(out.match(/>לבקש מהורה</g)).toHaveLength(1);
    expect(out).not.toContain('להראות להורים');
    expect(out).not.toContain('קודם, אישור של הורה');
    // the input stays usable (a message that reads as distress still gets the card), and does not read as locked
    expect(out).toMatch(/<textarea[^>]*placeholder="כתבו שאלה…"/);
    expect(out).not.toMatch(/<textarea[^>]*disabled/);
    expect(text(out)).toContain('צריכים לדבר עם מישהו?');
  });
});
