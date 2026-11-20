// Screens that show a stair's teaching wait for its topic's file (DURABLE-11, learn/content/index.ts). They suspend:
// the app's loading screen (Screen.jsx LoadingState, App.jsx's Suspense) shows until the topic has loaded, and a file
// that cannot load reaches the ErrorBoundary like any other missing chunk.
import { use } from 'react';
import { contentOf, ensureTopics, hasContent } from './content/index.ts';

/**
 * Suspends until the topics of these skills (or topic ids) have loaded; once they have, returns at once. use() is called
 * every time there are topics, loaded or not: when React renders the screen again after the wait, it expects the same
 * call in the same place (skipping it there breaks the hooks that follow).
 */
export function useTopics(ids) {
  if (ids.length) use(ensureTopics(ids));
}

/** A stair's full teaching content: suspends until its topic has loaded; null for a stair with no teaching content. */
export function useStairContent(skill) {
  const has = !!skill && hasContent(skill);
  useTopics(has ? [skill] : []);
  return has ? contentOf(skill) : null;
}
