// All topics, laid out like Duolingo's sections overview: one large card per unit in its colour (its number, name,
// what it covers, a thick progress bar, the way back to its place on the path, plus its guidebook), then the
// level board (where each topic stands and what is not clear yet) and the stair-by-stair mastery grid. Only the unit
// being climbed has a solid button; the others jump there with a quiet text button, and the board adds no primary.
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { topicsFor } from '@/content/index.js';
import { doneUpTo } from '@/lib/path.js';
import { GradeSwitch } from './Welcome.jsx';
import { Bar } from '@/components/ds.jsx';
import { Emblem } from '@/components/map/Scenery.jsx';
import Board from '@/components/Board.jsx';
import MasteryMap from '@/components/learn/MasteryMap.jsx';

function SectionCard({ t, n, current }) {
  const navigate = useNavigate();
  const { path, progress } = useApp();
  const done = doneUpTo(t.id, path, progress);
  const total = t.levels.length;
  return (
    <li className={`section-card ch-${t.color}`}>
      <div className="section-card-text">
        <p className="section-card-label">יחידה {n}</p>
        <h2 className="section-card-title">{t.title}</h2>
        <p className="section-card-desc">{t.desc}</p>
        <Bar value={done} max={total} text={`${done} / ${total} מדרגות`} label={`${t.title}: ${done} מתוך ${total} מדרגות`} tone="light" />
        <div className="section-card-actions">
          {/* one solid button on the screen: the unit being climbed now (Duolingo's "Continue"); the others jump quietly */}
          {current
            ? <button type="button" className="btn btn-on-color" onClick={() => navigate('/', { state: { from: t.id } })}>{done === 0 ? 'התחלה' : 'המשך'}</button>
            : <button type="button" className="section-card-jump" onClick={() => navigate('/', { state: { from: t.id } })}>{done >= total ? 'חזרה ליחידה' : 'מעבר ליחידה'}</button>}
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
  const { path, progress } = useApp();
  const current = list.find((t) => doneUpTo(t.id, path, progress) < t.levels.length);
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
      <Board grade={grade} placed={!!state?.placed} onStart={(to) => navigate(to)} onJump={(id) => navigate('/', { state: { from: id } })} />
      <MasteryMap grade={grade} />
    </div>
  );
}
