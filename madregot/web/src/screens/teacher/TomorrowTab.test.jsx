// "מחר" (TomorrowTab.jsx): each repeated mistake has its own "לתת תרגול על זה" button. A screen reader's list of buttons
// (and voice control: "click …") meets them by name, so each name says what the practice is on, the stair and the
// mistake, after the words on the button (WCAG 2.5.3, label in name). The external review (Nov 2026, finding 5) found
// every one of them named only "לתת תרגול על זה". The student's sheet has the same button, "לתת תרגול", named the same way.
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import TomorrowTab from './TomorrowTab.jsx';
import { practiseName } from './common.jsx';

// the screen's small stores read the device's state with no server snapshot: on the server they read it the same way
vi.mock('react', async (load) => {
  const react = await load();
  return { ...react, default: react, useSyncExternalStore: (sub, get, server) => react.useSyncExternalStore(sub, get, server || get) };
});

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
/** Each button: its class and its accessible name (its aria-label, else its words), as a browser computes it here. */
const buttons = (html) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([, attrs, inner]) => {
  const label = /aria-label="([^"]*)"/.exec(attrs);
  return { cls: /class="([^"]*)"/.exec(attrs)?.[1] || '', describedBy: /aria-describedby="([^"]*)"/.exec(attrs)?.[1] || null, name: decode(label ? label[1] : inner.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() };
});

const mistakes = [
  { topic: 'signed', level: 1, cat: 'sign', students: 2, names: ['נועה', 'יואב'], ids: ['s1', 's2'] },
  { topic: 'signed', level: 1, cat: 'abs-add', students: 1, names: ['נועה'], ids: ['s1'] },
  { topic: 'coord', level: 1, cat: 'swap', students: 1, names: ['יואב'], ids: ['s2'] },
];
const students = [{ id: 's1', name: 'נועה' }, { id: 's2', name: 'יואב' }];
const render = () => renderToStaticMarkup(
  <MemoryRouter>
    <TomorrowTab cls={{ code: 'ABC123', grade: '7' }} data={{ mistakes, help: [], exams: [], today: '2026-11-20' }} students={students} openHelp={[]}
      onAssign={() => {}} onStudent={() => {}} onOpenHelp={() => {}} onAll={() => {}} />
  </MemoryRouter>,
);

describe('"לתת תרגול על זה": every button says which stair and which mistake it gives practice on', () => {
  it('three repeated mistakes, two on the same stair: three buttons, three different names', () => {
    const acts = buttons(render()).filter((b) => b.cls.includes('t-row-act'));
    expect(acts).toHaveLength(3);
    const names = acts.map((b) => b.name);
    expect(new Set(names).size).toBe(3);
    // each name starts with the button's own words, then the stair (its topic and number), then the mistake
    for (const n of names) expect(n).toMatch(/^לתת תרגול על זה: /);
    expect(names[0]).toContain('מספרים מכוונים, מדרגה 1');
    expect(names[1]).toContain('מספרים מכוונים, מדרגה 1');
    expect(names[2]).toContain('מערכת צירים, מדרגה 1');
    // the mistake in plain words: maths written for the eye ($x$) is said as text, never as dollar signs
    expect(names[2]).toMatch(/x.*y/);
    for (const n of names) expect(n).not.toContain('$');
    // the name says it all: no description repeats the row after it
    for (const b of acts) expect(b.describedBy).toBeNull();
  });

  it('the student sheet\'s "לתת תרגול" is named the same way, after its own words', () => {
    expect(practiseName('לתת תרגול', 'coord', 1, 'swap')).toBe(practiseName('לתת תרגול על זה', 'coord', 1, 'swap').replace('לתת תרגול על זה', 'לתת תרגול'));
    expect(practiseName('לתת תרגול', 'signed', 1, 'sign')).toMatch(/^לתת תרגול: מספרים מכוונים, מדרגה 1, \S/);
    expect(practiseName('לתת תרגול', 'signed', 1, 'sign')).not.toBe(practiseName('לתת תרגול', 'signed', 1, 'abs-add'));
  });
});
