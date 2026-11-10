// "מהמורה {name}": the teacher's work at the top of today's mission (spec TEACHER-5 §5), in the mission rows' grammar:
// an icon, the title (a link), the kind and the due day in calm words, the teacher's note, and a bar. Work due within
// 3 days shows; later work folds under "עוד משימות מהמורה"; done work stays on the day it was finished, with a check.
// Never red and never "late": a date that passed says "המועד עבר, ועדיין אפשר להשלים".
import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { School, Award, Check, ChevronLeft, ChevronDown } from 'lucide-react';
import { dueLine } from '@/lib/classWork.js';
import { Bar } from '@/components/ds.jsx';

const KIND = { stair: 'מדרגה ללמוד', check: 'בדיקת שליטה' };
const ICON = { stair: School, check: Award };

/** A row's bar: a stair's stages (the one in progress, as the mission rows count it), a check's result once done. */
function barOf(r) {
  if (r.a.kind === 'stair') {
    const stage = r.w?.stage || 0;
    if (r.done) return { value: 5, max: 5, text: 'כל השלבים' };
    return { value: stage, max: 5, text: `שלב ${Math.min(5, stage + 1)} מתוך 5` };
  }
  if (r.done) return { value: 1, max: 1, text: r.w?.asked ? `${r.w.right}/${r.w.asked}` : 'בוצע' };
  return { value: 0, max: 1, text: `${r.minutes} דק׳` };
}

function Row({ r, next }) {
  const Icon = r.done ? Check : ICON[r.a.kind] || School;
  const bar = barOf(r);
  return (
    <li className={clsx('today-row', 'cw-row', r.done && 'done', next && 'next')}>
      <span className="quest-icon qk-class" aria-hidden="true"><Icon size={22} strokeWidth={r.done ? 3 : 2} /></span>
      <span className="quest-body">
        <Link to={r.to} className="today-item-title today-link">{r.a.title}</Link>
        <span className="today-kind">{KIND[r.a.kind]} · {r.done ? <span className="cw-done-mark"><Check size={14} strokeWidth={3} aria-hidden="true" />הושלם</span> : dueLine(r.a.dueOn)}</span>
        {r.a.note && <span className="today-why cw-note">“{r.a.note}”</span>}
        <Bar value={bar.value} max={bar.max} text={bar.text} label={r.a.title} tone={r.done ? 'good' : 'brand'} />
      </span>
      <ChevronLeft size={20} aria-hidden="true" className="chev" />
    </li>
  );
}

/** Props: `rows` (classRows of lib/classWork.js) and the teacher's name. */
export default function ClassWork({ rows, teacherName }) {
  const [more, setMore] = useState(false);
  const { show, later, next, allDone } = rows;
  if (!show.length && !later.length) return null;
  return (
    <section className="cw" aria-labelledby="cw-title">
      <h2 id="cw-title" className="cw-head"><School size={18} aria-hidden="true" />{teacherName ? `מהמורה ${teacherName}` : 'מהמורה'}</h2>
      {show.length > 0 && (
        <ol className="today-items quest-rows cw-rows" aria-labelledby="cw-title">
          {show.map((r) => <Row key={r.a.id} r={r} next={r === next} />)}
        </ol>
      )}
      {allDone && <p className="cw-all">סיימתם את המשימות מהמורה. כל הכבוד על ההתמדה.</p>}
      {later.length > 0 && (
        <>
          <button type="button" className="cw-fold" aria-expanded={more} aria-controls="cw-later" onClick={() => setMore(!more)}>
            עוד משימות מהמורה ({later.length})<ChevronDown size={18} aria-hidden="true" className={more ? 'cw-fold-open' : ''} />
          </button>
          {more && <ol id="cw-later" className="today-items quest-rows cw-rows" aria-label="עוד משימות מהמורה">{later.map((r) => <Row key={r.a.id} r={r} next={r === next} />)}</ol>}
        </>
      )}
    </section>
  );
}
