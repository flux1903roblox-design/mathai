// The day's chest wherever the third quest is done (the student council's round 3: at the end of a teaching stage it
// had been a chip, "קיבלתם הקפאת רצף", and the piece for מדי waited unannounced on the missions tab). The end of a
// teaching stage now says a chest waits, and opens it after its own moment, as the end of a lesson does (QuestsStage):
// the chest, the freeze, the choice of a piece, and a way on that says where the choice waits. The missions tab carries
// a dot while it waits. In a quiet class nothing falls across the screen, and under reduced motion nothing moves.
// Rendered to HTML on the server, as CheckDone.test.jsx does.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import QuestsStage, { CHEST_LATER } from './QuestsStage.jsx';
import StageDone, { STAGE_CHEST } from './StageDone.jsx';
import Shell from '@/components/Shell.jsx';
import { useApp, today } from '@/lib/store.js';
import { chestWaits } from '@/lib/wardrobe.js';
import { loadMotionFeatures } from '@/lib/motion.js';

vi.mock('react', async (load) => {
  const react = await load();
  return { ...react, default: react, useSyncExternalStore: (sub, get, server) => react.useSyncExternalStore(sub, get, server || get) };
});

const render = (node, at = '/') => { Object.assign(useApp.getInitialState(), useApp.getState()); return renderToStaticMarkup(<MemoryRouter initialEntries={[at]}>{node}</MemoryRouter>); };
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const award = (more = {}) => ({ xp: 10, streak: 2, streakExtended: false, goalReached: false, questsDone: true, freezeEarned: true, ...more });

describe('the day\'s chest after a teaching stage', () => {
  beforeAll(async () => { await loadMotionFeatures(); });
  beforeEach(() => {
    useApp.getState().resetProgress();
    useApp.setState({ profile: { role: 'student', name: 'נועה', grade: '7', know: 1 }, days: { [today()]: { stages: 3, questsRewarded: true } }, freezes: 1 });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('the stage\'s moment says a chest waits, instead of a chip for the freeze', () => {
    const out = render(<StageDone stage="A" stair="חיבור וחיסור" topic="signed" award={award()} steps={1} onNext={() => {}} onMap={() => {}} />);
    expect(text(out)).toContain(STAGE_CHEST);
    expect(text(out)).not.toContain('קיבלתם הקפאת רצף'); // the chest itself says it, next
  });

  it('the chest: it opens, holds the freeze and a piece to choose, and the way on says where the choice waits', () => {
    const out = render(<QuestsStage award={award()} onNext={() => {}} />);
    expect(out).toMatch(/class="done-screen quests-done-screen"/);
    expect(out).toMatch(/aria-label="תיבת אוצר נפתחת"/);
    expect(text(out)).toContain('קיבלתם הקפאת רצף');
    expect(out).toMatch(/class="chest-choice"/);
    expect(text(out)).toContain(CHEST_LATER);
    expect(CHEST_LATER).toMatch(/במשימות/);
    expect(out).toMatch(/class="lottie done-confetti"/);
  });

  it('in a quiet class the chest opens on the student\'s own screen only: no confetti', () => {
    useApp.setState({ profile: { role: 'student', name: 'נועה', grade: '7', know: 1, classCode: 'ABC123' }, prefs: { soundSet: false } });
    const out = render(<QuestsStage award={award()} onNext={() => {}} />);
    expect(out).not.toMatch(/done-confetti/);
    expect(out).toMatch(/aria-label="תיבת אוצר נפתחת"/);
  });

  it('the missions tab carries a dot while a piece waits in the chest, and none once it is chosen', () => {
    const shell = () => render(<Routes><Route element={<Shell />}><Route path="/" element={<p>home</p>} /></Route></Routes>);
    expect(chestWaits(useApp.getState().days, useApp.getState().look, today())).toBe(true);
    expect(shell()).toMatch(/<i class="tab-dot"/);
    expect(text(shell())).toContain('בתיבה מחכה חלק למדי');
    expect(useApp.getState().pickChest(today(), 'beanie')).toBe(true);
    expect(shell()).not.toMatch(/tab-dot/);
  });
});
