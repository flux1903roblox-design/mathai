// A topic whose practice generators load on demand, with its teaching content (learn/content/index.ts importTopic),
// instead of on the first screen. The topic object stays in the boot list (its id, title, colour, misconception names
// and lesson summary are read everywhere); each level's gen() calls the generator that the topic's own module
// registered when it loaded. Curriculum stage 4 (GEOM-4) does this for transformations, so the unit adds its names to
// the first download but not its arithmetic.
//
// Every surface that makes a question waits for the topic first: a lesson, a check, the placement test and Exam Rescue
// through ensureTopics (lib/lesson.js lessonTopics), the practice exam and the teacher's class exam before they draw
// theirs (screens/PracticeExam.jsx, screens/teacher/ExamNew.jsx). A gen() called before that throws and says what to
// wait for, rather than handing out a question from somewhere else.
const GENS = {};
const LAZY = new Set();

/** Called once by a lazy topic's module: one generator per level, in order. */
export function registerGens(topicId, gens) { GENS[topicId] = gens; }

/** Have this topic's generators loaded? (true for a topic whose generators are in the boot list) */
export const gensReady = (topicId) => !LAZY.has(topicId) || !!GENS[topicId];

/** A lazy topic's levels: each title with a gen() that calls the registered generator. */
export function lazyLevels(topicId, titles) {
  LAZY.add(topicId);
  return titles.map((title, i) => ({
    title,
    lazy: true,
    gen: () => {
      const g = GENS[topicId];
      if (!g) throw new Error(`makeItem('${topicId}'): its generators load with the topic. Wait for ensureTopics(['${topicId}']) first.`);
      return g[i]();
    },
  }));
}
