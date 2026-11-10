// All topics, laid out like Duolingo's sections overview: one large card per unit (its number, name, what it covers,
// a thick progress bar that moves from the first stage, the stair it is on now, the way back to its place on the
// path, plus its guidebook), then one board: the grade's stairs as tiles, in words, what is not clear yet, and the
// placement test. Only the unit being climbed has a solid button; the others jump there with a quiet text button,
// and the board adds no primary.
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { topicsFor } from '@/content/index.js';
import { doneCount, unitProgress, unitCountText, unitNodes } from '@/lib/path.js';
import { GradeSwitch } from './Welcome.jsx';
import { Bar } from '@/components/ds.jsx';
import { Emblem } from '@/components/map/Scenery.jsx';
import Board from '@/components/Board.jsx';

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
      <Board grade={grade} placed={!!state?.placed} onStart={(to) => navigate(to)} />
    </div>
  );
}
