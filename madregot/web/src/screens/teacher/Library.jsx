// The lessons, as the class sees them (spec TEACHER-2 §5), at /teacher/lessons: every stair of grade ז׳ or ח׳, grouped
// by topic, with the way into its lesson and its mastery check. Both open in the student view (PreviewFrame), on this
// device's own learning state; nothing is sent to the class. The dots show the stages done here, in this view.
// "לתת לכיתה" opens the assign sheet with that stair (TEACHER-4 §6).
import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { RotateCcw } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { previewBack } from '@/lib/teacher.js';
import { topicsFor, guestTopicsFor, rowStairs } from '@/content/index.js';
import { hasContent } from '@/learn/content/index.ts';
import { skillId } from '@/learn/skills.ts';
import { routeOf } from '@/learn/recommend.ts';
import { ScreenBar } from '@/components/Screen.jsx';
import { ChapterMark } from '@/components/ui.jsx';
import { GradeSwitch } from '@/components/GradeSwitch.jsx';
import AssignSheet from '@/components/teacher/AssignSheet.jsx';

const GRADE = { 7: 'ז׳', 8: 'ח׳' };
const STAGES = [['A', 'מבינים את הרעיון'], ['B', 'דוגמה פתורה'], ['C', 'פותרים יחד'], ['D', 'מתרגלים לבד'], ['E', 'בדיקת שליטה']];
/** The stages of a stair done on this device (as Journey counts them: practice is done at 6 right answers). */
function stagesDone(rec) {
  const practised = (rec?.attempts || []).filter((a) => a.purpose === 'practice' && a.ok).length;
  return { A: !!rec?.taught?.A, B: !!rec?.taught?.B, C: !!rec?.taught?.C, D: practised >= 6, E: !!rec?.mastered };
}

function StairRow({ topic, level, title, back, onAssign }) {
  const skill = skillId(topic.id, level);
  const rec = useApp((s) => s.learn.skills[skill]);
  // (META: known before the topic's teaching file has loaded, DURABLE-11)
  const taught = hasContent(skill);
  const done = stagesDone(rec);
  // a stair with no teaching content yet starts at its practice, as Journey does for a student
  const lesson = taught ? routeOf.journey(skill) : routeOf.stage(skill, 'D');
  // the way back is kept from the tap itself (PreviewFrame keeps it too, once the student screen has loaded)
  const keep = () => previewBack.set(back);
  return (
    <li className="t-lib-row">
      <div className="t-lib-text">
        <p className="t-lib-title"><span className="t-lib-n">{level}.</span> {title}</p>
        {taught ? (
          <>
            <span className="t-lib-dots" aria-hidden="true">{STAGES.map(([id]) => <i key={id} className={done[id] ? 'on' : ''} />)}</span>
            <ul className="visually-hidden" aria-label={`השלבים של ${title}`}>
              {STAGES.map(([id, name]) => <li key={id}>{name}{done[id] ? ', נעשה בתצוגה הזו' : ''}</li>)}
            </ul>
          </>
        ) : <p className="t-lib-sub">תרגול ובדיקה</p>}
      </div>
      <div className="t-lib-actions">
        <Link to={lesson} state={{ back }} onClick={keep} className="btn btn-secondary btn-sm" aria-label={`לשיעור: ${title}`}>לשיעור</Link>
        <Link to={routeOf.check(skill, 'mastery')} state={{ back }} onClick={keep} className="btn btn-ghost btn-sm" aria-label={`בדיקת שליטה: ${title}`}>בדיקת שליטה</Link>
        {onAssign && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAssign(skill)} aria-label={`לתת לכיתה: ${title}`}>לתת לכיתה</button>}
      </div>
    </li>
  );
}

export default function Library() {
  const own = useApp((s) => s.profile.grade) || '7';
  const cls = useApp((s) => s.profile.classes?.find((c) => c.code === s.profile.active) || s.profile.classes?.[0]);
  const [assign, setAssign] = useState(null); // { skill, n } while the assign sheet is open
  const opened = useRef(0);
  const onAssign = cls ? (skill) => { opened.current += 1; setAssign({ skill, n: opened.current }); } : null;
  const resetProgress = useApp((s) => s.resetProgress);
  const [params, setParams] = useSearchParams();
  const grade = ['7', '8'].includes(params.get('grade')) ? params.get('grade') : own;
  const setGrade = (g) => setParams(g === own ? {} : { grade: g }, { replace: true });
  // the student view comes back here, to the same grade
  const back = grade === own ? '/teacher/lessons' : `/teacher/lessons?grade=${grade}`;
  const reset = () => { resetProgress(); toast('תצוגת התלמיד אופסה. כל שיעור ייפתח מההתחלה.'); };
  return (
    <div className="page pushed t-library">
      <ScreenBar title={`השיעורים של כיתה ${GRADE[grade]}`} back="/teacher" backLabel="חזרה ללוח" />
      <p className="lead t-lib-intro">כל מדרגה בנויה מחמישה שלבים: מבינים את הרעיון, דוגמה פתורה, פותרים יחד, מתרגלים לבד ובדיקת שליטה. כל שלב נפתח כמו שהתלמידים רואים אותו, ואפשר להקרין אותו בכיתה.</p>
      <div className="field t-lib-grade">
        <span className="visually-hidden" id="tl-grade">שכבה</span>
        <GradeSwitch value={grade} onChange={setGrade} id="tl-grade" />
      </div>
      {topicsFor(grade).map((t, i) => (
        <section key={t.id} className="section set-group t-lib-topic" aria-labelledby={`tl-${t.id}`}>
          <h2 className="set-head t-lib-head" id={`tl-${t.id}`}><ChapterMark color={t.color} n={i + 1} size="sm" />{t.title}</h2>
          <ol className="t-lib-list">
            {t.levels.map((l, j) => <StairRow key={l.title} topic={t} level={j + 1} title={l.title} back={back} onAssign={onAssign} />)}
          </ol>
        </section>
      ))}
      {/* the grade's guest stairs (FUNC-6): another grade's stairs this grade's programme lists, after its units */}
      {guestTopicsFor(grade).length > 0 && (
        <section className="section set-group t-lib-topic t-lib-guest" aria-labelledby="tl-guest">
          <h2 className="set-head t-lib-head" id="tl-guest">גם בתוכנית של כיתה {GRADE[grade]}</h2>
          {guestTopicsFor(grade).map((t) => (
            <div key={t.id} className="t-lib-guest-unit">
              <p className="t-lib-guest-from" id={`tl-guest-${t.id}`}>מתוך היחידה "{t.title}"</p>
              <ol className="t-lib-list" aria-labelledby={`tl-guest-${t.id}`}>
                {rowStairs(t).map((s) => <StairRow key={s.id} topic={t} level={s.level} title={s.title} back={back} onAssign={onAssign} />)}
              </ol>
            </div>
          ))}
        </section>
      )}
      <section className="section set-group t-lib-foot" aria-label="תצוגת התלמיד במכשיר הזה">
        <p className="muted t-lib-foot-note">מה שעשיתם בשיעורים נשמר רק במכשיר הזה.</p>
        <div className="set-rows-wrap"><div className="set-rows">
          <button type="button" className="set-row" onClick={reset}><RotateCcw size={18} aria-hidden="true" />איפוס תצוגת התלמיד</button>
        </div></div>
      </section>
      {assign && cls && (
        <AssignSheet key={assign.n} cls={cls} preset={{ kind: 'stair', skill: assign.skill }} open onOpenChange={(o) => { if (!o) setAssign(null); }} />
      )}
    </div>
  );
}
