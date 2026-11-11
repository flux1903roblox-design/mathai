// Vitest setup (vite.config.js): the units whose practice generators load with their teaching content
// (content/lazyGen.js) are loaded here, so every test that draws questions from every topic draws theirs too, as the
// app does once a lesson, a check or an exam screen has waited for ensureTopics. content/lazyGen.test.js checks the
// waiting itself: a gen() before the topic loaded says what to wait for, and ensureTopics loads it.
import '@/content/transf.gen.js';
import '@/content/congr.gen.js';
