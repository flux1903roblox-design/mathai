// A screen in its own file (DURABLE-11): React.lazy, plus a way to fetch it ahead of time. Once fetched it renders at
// once, with no loading screen; before, it waits in the app's loading screen like any lazy screen.
import { createElement, lazy, useState } from 'react';

export function lazyScreen(load) {
  let loaded = null;
  const get = () => load().then((m) => { loaded = m.default; return m; });
  const Lazy = lazy(get);
  function Screen(props) {
    // chosen once per mount: changing from the lazy wrapper to the loaded screen later would start the screen over
    const [Comp] = useState(() => loaded || Lazy);
    return createElement(Comp, props);
  }
  Screen.preload = () => get();
  return Screen;
}

/**
 * The lesson (exercises, checks, the placement test): fetched when one opens, when the app opens straight on one
 * (lib/bootTopics.js), and when the browser is idle after the first screen (App.jsx).
 */
export const LessonScreen = lazyScreen(() => import('@/screens/Lesson.jsx'));
