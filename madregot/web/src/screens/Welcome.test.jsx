// מדי asks the first questions himself (PRODUCT2-41, the council's painful moment #3): on every question of the first
// visit he stands beside the question, small, instead of talking from off screen over a mostly blank page.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Onboarding, onboardingSteps } from './Welcome.jsx';
import { useApp } from '@/lib/store.js';

vi.mock('react', async (load) => {
  const react = await load();
  return { ...react, default: react, useSyncExternalStore: (sub, get, server) => react.useSyncExternalStore(sub, get, server || get) };
});

const html = (at) => { Object.assign(useApp.getInitialState(), useApp.getState()); return renderToStaticMarkup(<MemoryRouter><Onboarding at={at} onTeacher={() => {}} onRestore={() => {}} /></MemoryRouter>); };

describe('the first questions', () => {
  beforeEach(() => { useApp.getState().resetProgress(); });

  for (const server of [true, false]) {
    it(`מדי stands beside every question (${server ? 'with' : 'without'} a server)`, () => {
      useApp.setState((s) => ({ ai: { ...s.ai, apiUrl: server ? 'https://api.madregot.test' : 'none' } }));
      const steps = onboardingSteps({ server, next: null });
      expect(steps).toEqual(['name', 'grade', 'know', 'goal', ...(server ? ['class'] : []), 'start']);
      steps.forEach((step, i) => {
        const out = html(i);
        const ask = out.match(/<div class="ob-ask ob-ask-madi"[^>]*>([\s\S]*?)<\/div>/)?.[1];
        expect(ask, step).toBeTruthy();
        expect(ask, step).toMatch(/<svg[^>]*class="mascot [^"]*ob-madi"/);
        // the speech line is next to him, and he is decoration (aria-hidden): the question is still read once, as the
        // screen's heading (COUNCIL2-8: every screen has an h1)
        expect(ask, step).toMatch(/<h1 class="ob-bubble" id="ob-q">[^<]+<\/h1>/);
        expect(ask.match(/<svg[^>]*class="mascot[^"]*"[^>]*>/)[0], step).toContain('aria-hidden="true"');
      });
    });
  }

  it('the first screen keeps its large מדי, and is not a question', () => {
    const out = html(-1);
    expect(out).toContain('hello-madi');
    expect(out).not.toContain('ob-ask-madi');
  });
});
