// All topics, laid out like Duolingo's sections overview: one large card per unit (its number, name, what it covers,
// a thick progress bar that moves from the first stage, the stair it is on now, the way back to its place on the
// path, plus its guidebook), then one board: the grade's stairs as tiles, in words, what is not clear yet, and the
// placement test. Only the unit being climbed has a solid button; the others jump there with a quiet text button,
// and the board adds no primary. Under the grade's units, the floor under them (יסודות לחיזוק): the fractions unit,
// always reachable from here, the short floor check, multiplication facts after a missed fact, and the way to take the
// unit off the map again.
// Under a unit's bar, once one of its challenge tasks is open (its stair mastered): "אתגרים: {done} מתוך {open}", a link to
// the next one not solved yet (CURRICULUM-6.3). It never shows while nothing is open: no row of zeros.
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/lib/store.js';
import { topicsFor, bridgeTopicsFor } from '@/content/index.js';
import { Button } from '@/components/ui.jsx';
import { doneCount, unitProgress, unitCountText, unitNodes } from '@/lib/path.js';
import { GradeSwitch } from './Welcome.jsx';
import { Bar } from '@/components/ds.jsx';
import { Emblem } from '@/components/map/Scenery.jsx';
import Board from '@/components/Board.jsx';
import ChallengeLine from '@/components/learn/ChallengeLine.jsx';

function SectionCard({ t, n, current }) {
  const navigate = useNavigate();
  const path = useApp((s) => s.path);
  const skills = useApp((s) => s.learn.skills);
  // the bar fills with every stage of every stair (five each), so it moves from the first stage of the first session
  const prog = unitProgress(t.id, path, skills);
  const now = prog.stages > 0 && prog.done < prog.stairs ? unitNodes(t.id, path).find((x) => x.kind === 'node' && x.state === 'current') : null;
  return (
    <li className={`section-card ch-${t.color}${current ? ' is-current' : ''}`}>
      <div className="section-card-text">
        <h2 className="section-card-title">{t.title}</h2>
        <p className="section-card-label">יחידה {n}</p>
        <p className="section-card-desc">{t.desc}</p>
        <Bar value={prog.stages} max={prog.of} text={unitCountText(prog)} label={`${t.title}: ${prog.stages} מתוך ${prog.of} שלבים, ${prog.done} מתוך ${prog.stairs} מדרגות`} tone="light" />
        {now && <p className="section-card-now">עכשיו: {now.title}</p>}
        <ChallengeLine topic={t.id} />
        <div className="section-card-actions">
          {/* one solid button on the screen: the unit being climbed now (Duolingo's "Continue"); the others jump quietly */}
          {current
            ? <button type="button" className="btn btn-on-color" onClick={() => navigate('/', { state: { from: t.id } })}>{prog.stages === 0 ? 'התחלה' : 'המשך'}</button>
            : <button type="button" className="section-card-jump" onClick={() => navigate('/', { state: { from: t.id } })}>{prog.done >= prog.stairs ? 'חזרה ליחידה' : 'מעבר ליחידה'}</button>}
          <Link to={`/topic/${t.id}`} className="section-card-guide" aria-label={`תזכורת מהשיעור: ${t.title}`}><BookOpen size={20} aria-hidden="true" />תזכורת</Link>
        </div>
      </div>
      <span className="section-card-art" aria-hidden="true"><Emblem topic={t.id} /></span>
    </li>
  );
}

/** The facts row's line: the same words as on the floor check's end screen, with "here". */
export const FACTS_ROW_LINE = 'לוח הכפל הוא בסיס לשברים. תרגול קצר כאן עוזר לכל השאר.';

/**
 * The floor unit's card: like a unit's card, under the יסודות heading and not numbered. Its button opens the stair the
 * unit is on (its page works whether or not the unit is on the map), and its bar shows only once something was done in
 * it: a student who never needed the floor sees no row of zeros.
 */
function FloorCard({ t }) {
  const navigate = useNavigate();
  const path = useApp((s) => s.path);
  const skills = useApp((s) => s.learn.skills);
  const prog = unitProgress(t.id, path, skills);
  const node = unitNodes(t.id, path).find((x) => x.kind === 'node' && x.state === 'current');
  const now = prog.stages > 0 && prog.done < prog.stairs ? node : null;
  const label = prog.stages === 0 ? 'התחלה' : prog.done >= prog.stairs ? 'חזרה ליחידה' : 'המשך';
  return (
    <li className={`section-card floor-card ch-${t.color}`}>
      <div className="section-card-text">
        <h3 className="section-card-title">{t.title}</h3>
        <p className="section-card-desc">{t.desc}</p>
        {prog.stages > 0 && <Bar value={prog.stages} max={prog.of} text={unitCountText(prog)} label={`${t.title}: ${prog.stages} מתוך ${prog.of} שלבים, ${prog.done} מתוך ${prog.stairs} מדרגות`} tone="light" />}
        {now && <p className="section-card-now">עכשיו: {now.title}</p>}
        <ChallengeLine topic={t.id} />
        <div className="section-card-actions">
          <button type="button" className="section-card-jump" onClick={() => navigate(`/learn/${t.id}/${node?.level || 1}`)} aria-label={`${label}: ${t.title}`}>{label}</button>
          <Link to={`/topic/${t.id}`} className="section-card-guide" aria-label={`תזכורת מהשיעור: ${t.title}`}><BookOpen size={20} aria-hidden="true" />תזכורת</Link>
        </div>
      </div>
      <span className="section-card-art" aria-hidden="true"><Emblem topic={t.id} /></span>
    </li>
  );
}

/** יסודות לחיזוק: the floor under the grade, offered and never forced. */
function FloorSection({ grade }) {
  const floor = useApp((s) => s.learn.floor ?? null);
  const setFloor = useApp((s) => s.setFloor);
  const units = bridgeTopicsFor(grade);
  if (!units.length) return null;
  const factsMissed = !!floor && floor.facts.right < floor.facts.asked;
  const hide = () => { setFloor({ on: false }); toast.success('היסודות הוסתרו מהמפה. הם מחכים כאן.'); };
  return (
    <section className="floor-section" aria-labelledby="floor-head">
      <h2 id="floor-head" className="h-section">יסודות לחיזוק</h2>
      <ul className="section-cards">{units.map((t) => <FloorCard key={t.id} t={t} />)}</ul>
      <ul className="floor-rows">
        <li><Link to="/floor" className="prog-entry floor-row"><span className="floor-row-text"><b>בדיקה קצרה</b><span>6 שאלות על שברים ולוח הכפל.</span></span></Link></li>
        {factsMissed && <li><Link to="/facts" className="prog-entry floor-row"><span className="floor-row-text"><b>לוח הכפל</b><span>{FACTS_ROW_LINE}</span></span></Link></li>}
      </ul>
      {floor?.on && <Button variant="ghost" className="btn-block floor-hide" onClick={hide}>להסתיר את היסודות מהמפה</Button>}
    </section>
  );
}

export default function Topics() {
  const own = useApp((s) => s.profile.grade) || '7';
  const [grade, setGrade] = useState(own);
  const navigate = useNavigate();
  const { state } = useLocation();
  const list = topicsFor(grade);
  const { path } = useApp();
  const current = list.find((t) => doneCount(t.id, path) < t.levels.length);
  return (
    <div className="page pushed topics-page">
      <header className="screen-bar" data-region="header">
        <button type="button" className="icon-btn" onClick={() => navigate('/')} aria-label="חזרה למפה"><ArrowRight size={24} aria-hidden="true" /></button>
        <h1 className="screen-bar-title">נושאים</h1>
        <span className="icon-btn-spacer" aria-hidden="true" />
      </header>
      <div className="field">
        <span className="visually-hidden" id="tp-grade">שכבה</span>
        <GradeSwitch value={grade} onChange={setGrade} id="tp-grade" />
      </div>
      <ul className="section-cards" data-region="content">
        {list.map((t, i) => <SectionCard key={t.id} t={t} n={i + 1} current={t === current} />)}
      </ul>
      <FloorSection grade={grade} />
      <Link to={`/programme?grade=${grade}`} className="prog-entry">כל תוכנית הלימודים</Link>
      <Board grade={grade} placed={!!state?.placed} onStart={(to) => navigate(to)} />
    </div>
  );
}
