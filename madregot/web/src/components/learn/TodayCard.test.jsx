// A child reads two short lines (PRODUCT2-41, the council's painful moment #3): a mission part's reason shows its first
// short sentence, in the student's words, and the rest waits behind "עוד", a button with aria-expanded. Rendered to
// HTML on the server, as Learn.test.jsx does.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import TodayCard from './TodayCard.jsx';
import { useApp } from '@/lib/store.js';
import { LEAD_MAX } from '@/components/MoreText.jsx';

vi.mock('react', async (load) => {
  const react = await load();
  return { ...react, default: react, useSyncExternalStore: (sub, get, server) => react.useSyncExternalStore(sub, get, server || get) };
});

const html = () => { Object.assign(useApp.getInitialState(), useApp.getState()); return renderToStaticMarkup(<MemoryRouter><TodayCard grade="7" onBoard={() => {}} /></MemoryRouter>); };
const text = (h) => h.replace(/<[^>]+>/g, '').replace(/ /g, ' ');

describe('the mission card says why in two short lines', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T16:00:00'));
    useApp.getState().resetProgress();
    useApp.setState({ profile: { role: 'student', name: 'נועה', grade: '7', know: 1 } });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('a new stair: a short line in the student\'s words, and the rest behind "עוד"', () => {
    const out = html();
    const why = out.match(/<span class="today-why[^"]*">[\s\S]*?<\/button><\/span>/)?.[0];
    expect(why, 'the reason has its "עוד"').toBeTruthy();
    // the line on screen: short, and never the programme's words
    const lead = text(why.match(/<span class="more-lead">([\s\S]*?)<\/span><span id=/)[1]);
    expect(lead.length).toBeLessThanOrEqual(LEAD_MAX.row + 1);
    expect(lead).not.toMatch(/לפי תוכנית הלימודים|נלמד בכיתה/);
    // the rest is there for whoever wants it, hidden until "עוד" opens it
    expect(why).toMatch(/<span id="[^"]+" class="more-rest" hidden="">/);
    expect(why).toMatch(/<button type="button" class="link-btn more-btn"[^>]* aria-expanded="false" aria-controls="[^"]+">עוד<\/button>/);
  });

});
