// /programme: what Madregot teaches against the Ministry's programme, unit by unit, in the order the school year
// teaches it (CURRICULUM-1). Every number on it is computed from the stairs that exist (learn/programme.ts and
// shared/coverage.js); nothing is typed by hand, so the page moves by itself when a stage lands.
// The route sits before the role switch (App.jsx): a parent's phone with no profile opens it from the parents' area
// or a link. Its own bar with the way back, no tab bar.
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { TOPIC } from '@/content/index.js';
import { PROGRAMME, ROADMAP_NEXT, coverageOf, coverageSentence, monthsText, hoursText, inSchoolOrder, GRADE_NAME } from '@/learn/programme';
import { GradeSwitch } from './Welcome.jsx';

const STATE_WORD = { yes: 'יש', part: 'חלקי', no: 'עוד לא' };

/** The unit's stairs that exist, grouped by topic in the order the unit lists them: [{ topic, title, stairs: [title] }]. */
function stairGroups(ids) {
  const groups = [];
  ids.forEach((id) => {
    const [topic, level] = id.split(':');
    const t = TOPIC[topic];
    if (!t) return;
    let g = groups.find((x) => x.topic === topic);
    if (!g) { g = { topic, title: t.title, stairs: [] }; groups.push(g); }
    g.stairs.push(t.levels[Number(level) - 1]?.title || id);
  });
  return groups;
}

function UnitRow({ u, linkable }) {
  const groups = stairGroups(u.stairs);
  // each part not taught yet, in its own words; a unit with no words of its own for it (one part, the whole unit)
  // does not repeat its title: the chip already says it is not here, and only a promise adds anything
  const gaps = u.parts.filter((p) => !p.taught)
    .map((p) => ({ what: p.note || (u.parts.length > 1 ? u.title : ''), next: p.later === ROADMAP_NEXT }))
    .filter((g) => g.what || g.next);
  return (
    <li className={`prog-unit is-${u.state}`}>
      <div className="prog-unit-head">
        <h2 className="prog-unit-title">{u.title}</h2>
        <span className={`prog-chip is-${u.state}`}><span className="visually-hidden">במדרגות: </span>{STATE_WORD[u.state]}</span>
      </div>
      <p className="prog-unit-when">{monthsText(u.months)} · {hoursText(u.hours)}</p>
      {groups.length > 0 && (
        <ul className="prog-stairs" role="list">
          {/* the topic's guide is one place per topic: one link for its stairs, and only where it opens (a student's
              device); elsewhere the same words as plain text */}
          {groups.map((g) => (
            <li key={g.topic} className="prog-topic">
              {linkable ? <Link to={`/topic/${g.topic}`} className="prog-topic-name">{g.title}</Link> : <b className="prog-topic-name">{g.title}</b>}
              <span className="prog-topic-stairs">{g.stairs.join(', ')}</span>
            </li>
          ))}
        </ul>
      )}
      {gaps.length > 0 && (
        <ul className="prog-gaps" role="list">
          {gaps.map((g, i) => (
            <li key={i} className="prog-gap">
              {g.what && <span className="prog-gap-what">{g.what}</span>}
              {/* a promise only for the stage the next build delivers; any other gap just says it is not here yet */}
              <span className={`prog-gap-when${g.next ? ' is-next' : ''}`}>{g.next ? 'מגיע בשלב הבא' : 'עוד לא'}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function Programme() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const role = useApp((s) => s.profile?.role);
  const own = String(useApp((s) => s.profile?.grade) || '');
  const asked = params.get('grade');
  const grade = asked === '7' || asked === '8' ? asked : own === '8' ? '8' : '7';
  const cov = coverageOf(grade);
  const units = inSchoolOrder(cov.units);
  const pick = (g) => setParams((p) => { const next = new URLSearchParams(p); next.set('grade', g); return next; }, { replace: true });
  // back to the page before, or to the start when the page was opened directly (a link, a QR code)
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'));
  return (
    <div className="page pushed prog">
      <header className="screen-bar" data-region="header">
        <button type="button" className="icon-btn" onClick={back} aria-label="חזרה"><ArrowRight size={24} aria-hidden="true" /></button>
        <h1 className="screen-bar-title">מה לומדים במדרגות</h1>
        <span className="icon-btn-spacer" aria-hidden="true" />
      </header>
      <main className="prog-main" data-region="content">
        <p className="prog-sub">לפי תוכנית הלימודים של משרד החינוך לשנת {PROGRAMME.year}</p>
        <div className="field">
          <span className="visually-hidden" id="prog-grade">כיתה</span>
          <GradeSwitch value={grade} onChange={pick} id="prog-grade" />
        </div>
        <p className="prog-cover" aria-live="polite">{coverageSentence(grade, cov)}</p>
        <ol className="prog-units" role="list" aria-label={`היחידות של כיתה ${GRADE_NAME[grade]}, לפי סדר הלימוד בשנה`}>
          {units.map((u) => <UnitRow key={u.id} u={u} linkable={role === 'student'} />)}
        </ol>
      </main>
      <footer className="prog-foot">
        <p>המקור: <a href={PROGRAMME.sources[grade]} target="_blank" rel="noopener noreferrer">פריסת ההוראה של משרד החינוך<span className="visually-hidden"> (נפתח בחלון חדש)</span></a></p>
        <p>השעות הן ההמלצה של המשרד; בכיתה זה יכול להשתנות.</p>
      </footer>
    </div>
  );
}
