// A unit whose practice generators load with its teaching content (content/lazyGen.js, curriculum stage 4): the topic
// object stays on the first screen, the arithmetic does not, and a question asked for too early says what to wait for.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lazyLevels, registerGens, gensReady } from './lazyGen.js';
import { TOPIC, makeItem, isCorrect } from './index.js';
import { ensureTopics, topicsReady } from '@/learn/content/index.ts';
import { makePracticeExam, makeClassExam } from '@/lib/exam.js';

const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('lazy generators', () => {
  it('a level asked for before its unit loaded throws and names ensureTopics; once registered it draws', () => {
    const levels = lazyLevels('lazy-test', ['one', 'two']);
    expect(levels.map((l) => l.title)).toEqual(['one', 'two']);
    expect(gensReady('lazy-test')).toBe(false);
    expect(() => levels[0].gen()).toThrow(/ensureTopics\(\['lazy-test'\]\)/);
    registerGens('lazy-test', [() => ({ key: 'a' }), () => ({ key: 'b' })]);
    expect(gensReady('lazy-test')).toBe(true);
    expect(levels[1].gen()).toEqual({ key: 'b' });
    // a unit whose generators are on the first screen is always ready
    expect(gensReady('signed')).toBe(true);
  });

  it('transformations: the topic object is on the first screen, its generators load with its teaching', async () => {
    // content/transf.js (in the boot list through grade7.js) never imports the generators; the teaching file does
    expect(src('./transf.js')).not.toMatch(/import[^;]*transf\.gen/);
    expect(src('./grade7.js')).not.toMatch(/import[^;]*transf\.gen/);
    expect(src('../learn/content/transf.ts')).toMatch(/from '@\/content\/transf\.gen\.js'/);
    expect(TOPIC.transf.levels.every((l) => l.lazy)).toBe(true);
    await ensureTopics(['transf']);
    expect(topicsReady(['transf:1'])).toBe(true);
    expect(gensReady('transf')).toBe(true);
    for (let level = 1; level <= 4; level += 1) {
      const it = makeItem('transf', level);
      expect(it.topic).toBe('transf');
      if (it.form !== 'manip') expect(isCorrect(it, it.answer)).toBe(true);
    }
  });

  it('the practice exam and the class exam draw transformations once it has loaded', async () => {
    await ensureTopics(['transf']);
    const pe = makePracticeExam(['transf'], 6);
    expect(pe.length).toBe(6);
    expect(pe.every((q) => q.topic === 'transf' && q.form !== 'manip')).toBe(true);
    const ce = makeClassExam(['transf:1', 'transf:2', 'transf:3', 'transf:4'], 8);
    expect(ce.skipped).toEqual([]);
    expect(ce.items.length).toBe(8);
  });

  it('the exam screens wait for the units before they draw', () => {
    for (const f of ['../screens/PracticeExam.jsx', '../screens/teacher/ExamNew.jsx']) {
      const s = src(f);
      expect(s, f).toMatch(/await ensureTopics\(/);
      expect(s.indexOf('await ensureTopics('), f).toBeLessThan(s.search(/make(Practice|Class)Exam\(\w+, count/));
    }
  });
});
