// Opening the app straight on a lesson, a stair's teaching, a repair, the placement test or Exam Rescue's check (a
// reload, a link, a phone that put the app away): the teaching content of that screen's topics, and KaTeX for its
// maths, are fetched before the first screen is drawn, in the same moment as the rest of the start, so the screen
// appears whole instead of after a loading screen (DURABLE-11). Inside the app, a screen waits for its topic with
// useStairContent / useTopics, and maths shows as words for the moment before KaTeX arrives.
import { TOPIC, placementTopicsFor } from '@/content/topics.js';
import { ensureTopics } from '@/learn/content/index.ts';
import { loadKatex } from '@/components/MathText.jsx';
import { LessonScreen } from './lazyScreen.js';

/** The topics (or skills) the screen at this hash route asks its questions from, for this saved state. */
export function routeTopics(hash, state) {
  if (state?.profile?.role !== 'student') return [];
  const [path, query = ''] = String(hash || '').replace(/^#/, '').split('?');
  const [head, a] = path.split('/').filter(Boolean);
  if (['lesson', 'practice', 'learn', 'repair'].includes(head)) return TOPIC[a] ? [a] : [];
  if (head === 'placement') {
    const g = new URLSearchParams(query).get('grade');
    return placementTopicsFor(['7', '8'].includes(g) ? g : state.profile.grade || '7').map((t) => t.id);
  }
  if (head === 'rescue' && ['check', 'exam'].includes(a)) return state.learn?.exam?.skills || [];
  return [];
}

/** Does this route show the lesson screen (an exercise, a check, the placement test)? */
export const lessonRoute = (hash) => /^#?\/(lesson|practice|placement|rescue\/(check|exam))(\/|\?|$)/.test(String(hash || ''));

/**
 * Wait for them, for KaTeX and, on a lesson's route, for the lesson screen's file: at most `ms` (a slow network shows
 * the loading screen after that, as inside the app).
 */
export async function bootTopics(hash, state, ms = 2000) {
  const topics = routeTopics(hash, state);
  if (!topics.length) return;
  let timer;
  await Promise.race([
    // a file that cannot load is the screen's to report (ErrorBoundary)
    Promise.all([ensureTopics(topics), loadKatex(), lessonRoute(hash) ? LessonScreen.preload() : null]).catch(() => {}),
    new Promise((done) => { timer = setTimeout(done, ms); }),
  ]);
  clearTimeout(timer);
}
