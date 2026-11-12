// The content registry: every stair's teaching journey, keyed by skill id ('signed:1' ... 'stats:5').
// A stair that has no entry yet is not taught (the journey screen says so honestly) and keeps its practice.
//
// One file per topic, loaded on demand (DURABLE-11), so the first screen does not wait for all the teaching:
// - meta.gen.ts (generated from the content files, small, always there): each stair's title, its misconceptions'
//   names and whether it has transfer questions, and the topics' new misconception names. hasContent and metaOf
//   read it, and so does every screen that only needs those.
// - loadTopic(topic) brings a topic's journeys and diagnostic models (one dynamic import per topic, so the build makes
//   one file per topic); contentOf(skill) reads what has loaded, and is null until then. Screens that show the
//   teaching wait for it with useStairContent (learn/useStairContent.js); a lesson, a check, the placement test and
//   Exam Rescue wait for ensureTopics before they make a question. ensureTopics also loads the topics' exercise
//   generators (content/topics.js loadGens), which are not part of the first download either.
import type { StairContent, StairMeta, SkillId, TopicId } from '../types';
import { META, NEW_CATS } from './meta.gen';
// the topics' exercise generators load per topic too (content/topics.js): ensureTopics waits for both
// @ts-ignore: plain JS
import { loadGens, gensReady } from '@/content/topics.js';

export { META, NEW_CATS };

/** What every screen knows about a stair without loading its topic. */
export const metaOf = (skill: SkillId): StairMeta | null => META[skill] || null;
export const hasContent = (skill: SkillId) => !!META[skill];
/** The topics that have teaching content, in the order of META. */
export const CONTENT_TOPICS: TopicId[] = [...new Set(Object.keys(META).map((s) => s.split(':')[0] as TopicId))];

/** A new topic adds its case here (learn/content-split.test.ts fails for a topic in TOPICS whose stairs do not load). */
function importTopic(topic: string): Promise<StairContent[]> {
  switch (topic) {
    // the curriculum lane's bridge unit (fractions)
    case 'frac': return import('./frac').then((m) => m.FRAC);
    // signed:6 (signed fractions and decimals) is the curriculum lane's sixth stair of signed numbers, in its own file
    case 'signed': return Promise.all([import('./signed'), import('./signed6')]).then(([a, b]) => [...a.SIGNED, ...b.SIGNED6]);
    case 'coord': return import('./coord').then((m) => m.COORD);
    case 'angles': return import('./angles').then((m) => m.ANGLES);
    case 'expr': return import('./expr').then((m) => m.EXPR);
    case 'eq': return import('./eq').then((m) => m.EQ);
    // the curriculum lane's grade 8 units in school order: ratio and scale, then percent
    case 'ratio': return import('./ratio').then((m) => m.RATIO);
    case 'pct': return import('./pct').then((m) => m.PCT);
    // the stage-5 lane's introduction to functions (ח׳ November), before linear functions
    case 'func': return import('./func').then((m) => m.FUNC);
    case 'line': return import('./line').then((m) => [...m.LINE1, ...m.LINE2]);
    case 'pyth': return import('./pyth').then((m) => m.PYTH);
    case 'stats': return import('./stats').then((m) => m.STATS);
    case 'sys': return import('./sys').then((m) => m.SYS);
    // a topic with no teaching content has nothing to load
    default: return Promise.resolve([]);
  }
}

const cache: Record<SkillId, StairContent> = {};
const requested = new Map<string, Promise<StairContent[]>>();
const loaded = new Set<string>();

/** A topic's stairs, loaded once. A file that failed to load (offline before it was ever kept) can be asked for again. */
export function loadTopic(topic: TopicId | string): Promise<StairContent[]> {
  let p = requested.get(topic);
  if (!p) {
    const q: Promise<StairContent[]> = importTopic(topic).then((list) => {
      for (const c of list) cache[c.skill] = c;
      loaded.add(topic);
      return list;
    });
    q.catch(() => { if (requested.get(topic) === q) requested.delete(topic); });
    requested.set(topic, q);
    p = q;
  }
  return p;
}

/** The topics of skill ids ('signed:1') or topic ids ('signed'). */
export const topicsOf = (ids: (SkillId | TopicId)[]): string[] => [...new Set(ids.filter(Boolean).map((id) => id.split(':')[0]))].sort();
/** Have the topics of these skills (or these topics) loaded? */
export const topicsReady = (ids: (SkillId | TopicId)[]) => topicsOf(ids).every((t) => loaded.has(t));

// React's use() reads a promise's `status`: a promise marked 'fulfilled' gives its value at once, without suspending.
type Marked = Promise<void> & { status?: 'pending' | 'fulfilled' | 'rejected'; value?: undefined; reason?: unknown };
const READY: Marked = Object.assign(Promise.resolve(), { status: 'fulfilled' as const, value: undefined });
const waiting = new Map<string, Marked>();
/**
 * Resolves once the topics of these skills (or these topics) have loaded. The same set gives the same promise while
 * it waits, and a set already loaded gives a promise marked as settled, so a screen can always pass it to React's use()
 * (learn/useStairContent.js): it suspends only while something is really loading.
 */
export function ensureTopics(ids: (SkillId | TopicId)[]): Promise<void> {
  const topics = topicsOf(ids);
  if (topics.every((t) => loaded.has(t) && gensReady(t))) return READY;
  const key = topics.join(',');
  let p = waiting.get(key);
  if (!p) {
    // a topic's teaching and its exercise generators (a lesson's first question needs both)
    const q: Marked = Promise.all(topics.flatMap((t) => [loadTopic(t), loadGens(t)])).then(() => undefined);
    q.status = 'pending';
    q.then(
      () => { q.status = 'fulfilled'; q.value = undefined; waiting.delete(key); },
      (e) => { q.status = 'rejected'; q.reason = e; if (waiting.get(key) === q) waiting.delete(key); },
    );
    waiting.set(key, q);
    p = q;
  }
  return p;
}

/**
 * A stair's full teaching content, once its topic has loaded; null before that, and for a stair with no content.
 * In development it throws for a stair whose topic was never asked for: code that reads the content has to wait for
 * it (ensureTopics, useStairContent), or it would quietly fall back to plain exercises.
 */
export function contentOf(skill: SkillId): StairContent | null {
  const c = cache[skill];
  if (c) return c;
  if (import.meta.env.DEV && META[skill] && !requested.has(skill.split(':')[0])) {
    throw new Error(`contentOf('${skill}'): its topic was never loaded. Wait for ensureTopics(['${skill}']) or useStairContent first.`);
  }
  return null;
}

/** Every stair's content, every topic loaded (tests, and tools that need it all). */
export async function loadAllContent(): Promise<Record<SkillId, StairContent>> {
  await ensureTopics(CONTENT_TOPICS);
  return Object.fromEntries(Object.keys(META).map((s) => [s, cache[s]]));
}
