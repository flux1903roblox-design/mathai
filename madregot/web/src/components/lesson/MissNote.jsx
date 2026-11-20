// The line under a first miss that names what probably happened, and the way to its repair (PRODUCT2-18): the same for
// a typed answer and for an object (the number line, the pins, a point on the grid). On a short phone an object's
// feedback folds to one row so the object stays in view; the line shows there too, above "רמז" (it was recorded but not
// shown: the council's number-line misses on an iPhone SE).
import { diagnosisLine } from '@/content/index.js';
import { metaOf } from '@/learn/content/index.ts';
import { skillId } from '@/learn/skills.ts';
import { MathText } from '@/components/MathText.jsx';

/**
 * What a miss shows, from the answer's result (`last`: { cat, diagnosis, more }): the line ("מה כנראה קרה: …", the
 * builder every miss uses) and the misconception whose repair it links, null for none. A check (`test`) links none.
 */
export function missNote(topic, level, last, { test = false } = {}) {
  const line = diagnosisLine(topic, level, last);
  const repair = !test && last?.cat && !last.diagnosis?.ambiguous && metaOf(skillId(topic, level))?.misconceptions.some((x) => x.id === last.cat) ? last.cat : null;
  return { line, repair };
}

export default function MissNote({ note, onRepair }) {
  return (
    <>
      {note.line && <p className="fb-diag"><MathText text={note.line} /></p>}
      {note.repair && <button type="button" className="link-btn" onClick={() => onRepair(note.repair)}>בואו נראה את זה אחרת</button>}
    </>
  );
}
