// A screen in its own file, fetched ahead of time (DURABLE-11): before, it waits like React.lazy; once fetched, it
// renders at once, with no loading screen.
import { describe, it, expect } from 'vitest';
import { Suspense } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { lazyScreen } from './lazyScreen.js';

const fake = () => {
  let calls = 0;
  const load = () => { calls += 1; return Promise.resolve({ default: ({ who }) => <p>שלום {who}</p> }); };
  return { load, calls: () => calls };
};
const render = (Screen) => renderToStaticMarkup(<Suspense fallback={<i>טוענים…</i>}><Screen who="נועה" /></Suspense>);

describe('lazyScreen', () => {
  it('before its file is fetched: the loading screen', () => {
    const f = fake();
    expect(render(lazyScreen(f.load))).toBe('<i>טוענים…</i>');
  });
  it('fetched ahead: renders at once, with its props', async () => {
    const f = fake();
    const Screen = lazyScreen(f.load);
    await Screen.preload();
    expect(render(Screen)).toBe('<p>שלום נועה</p>');
    expect(f.calls()).toBe(1);
  });
});
