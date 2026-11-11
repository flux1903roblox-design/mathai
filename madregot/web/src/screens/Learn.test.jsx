// The home path as a journey (PRODUCT2-35/37), rendered: the unit the student is on shows its stops, the next one its
// banner and first stop, and every other unit is a folded row that names it and opens it with one tap.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Learn from './Learn.jsx';
import { useApp } from '@/lib/store.js';
import { topicsFor } from '@/content/index.js';

// the screen's small stores (the class goal) read the device's state with no server snapshot: on the server they read it
// the same way, as the phone would
vi.mock('react', async (load) => {
  const react = await load();
  return { ...react, default: react, useSyncExternalStore: (sub, get, server) => react.useSyncExternalStore(sub, get, server || get) };
});

const done = (levels) => ({ parts: {}, reviews: 0, jumped: 0, done: Object.fromEntries(levels.map((l) => [l, 'mastered'])) });
// rendered on the server, a zustand store is read through its first state (getInitialState): the state the test set is
// copied into it before each render, so the screen draws that student
const html = (entry) => { Object.assign(useApp.getInitialState(), useApp.getState()); return renderToStaticMarkup(<MemoryRouter initialEntries={[entry]}><Learn /></MemoryRouter>); };
const render = (entry = '/') => html(entry);
// the page's words, without its tags (the no-break space that keeps "יחידה 1 ·" together read as a space)
const text = (html) => html.replace(/<[^>]+>/g, '').replace(/\u00a0/g, ' ');
const sections = (html, cls) => [...html.matchAll(new RegExp(`<section class="${cls}[ "][^>]*>`, 'g'))];
const titles = (html, cls) => [...html.matchAll(new RegExp(`<section class="${cls}[ "][\\s\\S]*?class="unit-title"[^>]*>([^<]+)<`, 'g'))].map((m) => m[1]);

describe('the home path: one unit open, the next previewed, the others folded', () => {
  const grade7 = topicsFor('7');
  beforeEach(() => {
    useApp.getState().resetProgress();
    useApp.setState({ profile: { role: 'student', name: 'נועה', grade: '7', know: 1 } });
  });

  it('a fresh student: the first unit with its stops, the second with one, the rest as rows that open it', () => {
    const out = render();
    expect(titles(out, 'unit')).toEqual([grade7[0].title, grade7[1].title]);
    expect(out).toContain('class="unit ch-');
    expect(sections(out, 'unit').length).toBe(2);
    // one stop to go on from, and one 'התחלה': not one per unit
    expect(out.match(/class="node-start"/g)).toHaveLength(1);
    expect(out.match(/node node-preview/g)).toHaveLength(1);
    expect(out).toContain('כל המדרגות של ' + grade7[1].title);
    // the folded units: a heading each with a button that names the unit, its number and its size
    const rows = titles(out, 'unit-row');
    expect(rows).toEqual(grade7.slice(2).map((t) => t.title));
    expect(out.match(/<h2 class="unit-row-h"><button type="button" class="unit-row-btn" aria-expanded="false">/g)).toHaveLength(grade7.length - 2);
    expect(text(out)).toContain(`יחידה 3 · ${grade7[2].levels.length} מדרגות`);
  });

  it('a link to a unit (the wardrobe\'s "ליחידת …", a teacher\'s) opens that unit, wherever it is on the path', () => {
    const last = grade7[grade7.length - 1];
    const out = render({ pathname: '/', state: { from: last.id } });
    expect(titles(out, 'unit')).toEqual([last.title]);
    expect(titles(out, 'unit-row')).toEqual(grade7.slice(0, -1).map((t) => t.title));
  });

  it('a student further on: the unit before folds and shows its count; the next is previewed', () => {
    useApp.setState({ path: { [grade7[0].id]: done(grade7[0].levels.map((_, i) => i + 1)), [grade7[1].id]: done([1]) }, lastTopic: grade7[1].id });
    const out = render();
    expect(titles(out, 'unit')).toEqual([grade7[1].title, grade7[2].title]);
    expect(titles(out, 'unit-row')[0]).toBe(grade7[0].title);
    expect(text(out)).toContain(`יחידה 1 · ${grade7[0].levels.length} מתוך ${grade7[0].levels.length} מדרגות`);
  });
});
