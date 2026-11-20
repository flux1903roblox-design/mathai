// The lesson's top bar, rendered: the combo moment (a run of 5 or 10 right first tries) is a small pill inside the bar's
// own box, a status read aloud, and not a layer over the lesson that ate the first tap on the keypad (ux-motion 16, 17;
// e2e/motion.spec.js taps the keypad while it shows). Lesson.jsx shows it for a moment, and never in a quiet class.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProgressHeader } from './LessonParts.jsx';

const html = (props) => renderToStaticMarkup(<ProgressHeader pct={40} label="התקדמות בשיעור" onExit={() => {}} combo={5} {...props} />);
const lesson = readFileSync(new URL('../../screens/Lesson.jsx', import.meta.url), 'utf8');

describe('the combo moment', () => {
  it('a pill in the bar\'s box, beside the run\'s chip: a status with the run in words', () => {
    const out = html({ pop: 5 });
    const meter = out.match(/<div class="lesson-meter">([\s\S]*)<\/div><\/header>/)?.[1] || '';
    expect(meter).toContain('role="progressbar"');
    expect(meter).toContain('class="combo-chip"');
    expect(meter).toMatch(/<div class="combo-pop" role="status"[^>]*>/);
    expect(meter).toContain('5 ברצף!');
    // its flame is decoration: the words say it
    expect(meter).toMatch(/combo-pop[\s\S]*<svg[^>]*aria-hidden="true"/);
  });

  it('nothing over the bar between moments, and the bar keeps its name and value', () => {
    const out = html({ pop: null });
    expect(out).not.toContain('combo-pop');
    expect(out).toMatch(/role="progressbar" aria-label="התקדמות בשיעור" aria-valuemin="0" aria-valuemax="100" aria-valuenow="40"/);
  });

  it('the lesson shows it for a moment, never as a layer over the lesson, and not in a quiet class', () => {
    expect(lesson).toMatch(/pop=\{combo\} onPopClose=\{\(\) => setCombo\(null\)\}/);
    expect(lesson).toMatch(/if \(!quietClass\) \{ clearTimeout\(comboTimer\.current\); setCombo\(mark\); comboTimer\.current = setTimeout\(\(\) => setCombo\(null\), 1400\); \}/);
    // the old moment: a fixed layer with מדי over the whole lesson
    expect(lesson).not.toMatch(/className="combo-pop"/);
    expect(lesson).not.toMatch(/combo-card/);
    // the sound and the vibration follow their own switches (quiet in a class already)
    expect(lesson).toMatch(/play\('combo', mark\); haptic\('combo'\);/);
  });
});
