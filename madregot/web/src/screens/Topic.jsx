import { ScreenBar, ScreenFoot, EmptyState } from '@/components/Screen.jsx';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ArrowRight, Sparkles, Check, Lock } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { aiAccess, useAIStatus } from '@/lib/account.js';
import { TOPIC, TOPICS } from '@/content/index.js';
import { Box, Button } from '@/components/ui.jsx';
import { MathText } from '@/components/MathText.jsx';

const LineExplorer = lazy(() => import('@/components/LineExplorer.jsx'));

export default function Topic() {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = TOPIC[id];
  const p = useApp((s) => s.progress[id]) || { level: 1, max: 1 };
  const mistakes = useApp((s) => s.mistakes);
  // new exercises from the tutor: only where this device has that tool today
  const genOpen = aiAccess('generate', useAIStatus((x) => x.status)).state === 'open';
  if (!t) return <div className="page pushed"><ScreenBar title="מדריך" back="/topics" /><EmptyState mood="encouraging" title="הנושא לא נמצא"><p>אולי הקישור ישן. כל הנושאים מחכים ברשימה.</p></EmptyState><ScreenFoot><Link to="/topics" className="btn btn-primary btn-block btn-lg">לרשימת הנושאים</Link></ScreenFoot></div>;
  const n = TOPICS.filter((x) => x.grade === t.grade).indexOf(t) + 1;
  const mine = Object.entries(mistakes).filter(([k]) => k.startsWith(`${id}:`)).map(([k, v]) => ({ cat: k.split(':')[1], v })).filter((m) => t.cats[m.cat]).sort((a, b) => b.v - a.v);

  return (
    <div className="page pushed">
      {/* laid out like Duolingo's guidebook: a bar with the way back, the unit's banner, then the key ideas, one card each */}
      <header className="screen-bar" data-region="header">
        <Link to="/topics" className="icon-btn" aria-label="כל הנושאים"><ArrowRight size={24} aria-hidden="true" /></Link>
        <h1 className="screen-bar-title">מדריך</h1>
        <span className="icon-btn-spacer" aria-hidden="true" />
      </header>
      <div className={`unit-head guide-banner ch-${t.color}`}>
        <div className="unit-head-text">
          <h2 className="unit-title">{t.title}</h2>
          <p className="unit-label">יחידה {n}</p>
          <p className="unit-label">{t.desc}</p>
        </div>
      </div>

      {t.lesson && (
        <section className="guide" aria-labelledby="guide-key" data-region="content">
          <h2 id="guide-key" className="h-section">רעיונות מרכזיים</h2>
          <ul className="guide-cards">{t.lesson.points.map((pt) => <li key={pt} className="guide-card"><MathText text={pt} /></li>)}</ul>
          {t.lesson.examples && (
            <>
              <h2 className="h-section">דוגמאות מהשיעור</h2>
              <ul className="guide-cards">{t.lesson.examples.map((ex) => <li key={ex} className="guide-card"><MathText text={ex} /></li>)}</ul>
            </>
          )}
          {t.lesson.explore === 'line' && (
            <details className="sol explorer-details">
              <summary>גרף שמשנים: מזיזים את m ואת b</summary>
              <Suspense fallback={<p className="muted">טוענים…</p>}><LineExplorer /></Suspense>
            </details>
          )}
        </section>
      )}

      <h2 className="h-section">המדרגות של היחידה</h2>
      <ol className="level-list">
        {t.levels.map((L, i) => {
          const lv = i + 1; const state = lv === p.level ? 'cur' : lv <= p.max ? 'done' : 'todo';
          const open = lv <= Math.max(p.max, p.level);
          return (
            <li key={L.title} className={`level-row ${state} ch-${t.color}`}>
              <span className="level-num" aria-hidden="true">{state === 'done' ? <Check size={16} /> : lv}</span>
              <span className="level-title">{L.title}{state === 'cur' && <span className="level-badge">כאן אתם</span>}</span>
              {open ? (
                <Button variant="ghost" className="btn-sm" onClick={() => navigate(`/practice/${id}?level=${lv}`)} aria-label={`תרגול מדרגה ${lv}: ${L.title}`}>תרגול</Button>
              ) : <Lock size={16} className="lock" aria-label="נפתח בהמשך" />}
            </li>
          );
        })}
      </ol>

      <div className="form-actions">
        <Button className="btn-block btn-lg" onClick={() => navigate(`/practice/${id}`)}>תרגול ממדרגה {p.level}</Button>
        {genOpen && (
          <Button variant="secondary" className="btn-block" onClick={() => navigate(`/assistant?generate=${id}&level=${p.level}`)}>
            <Sparkles size={18} aria-hidden="true" />תרגילים נוספים מהעוזר
          </Button>
        )}
      </div>

      {mine.length > 0 && (
        <Box tone="attention" title="הטעויות שלכם בנושא">
          <ul className="plain-list">
            {mine.slice(0, 4).map((m) => <li key={m.cat}><MathText text={t.cats[m.cat]} /> <span className="muted">({m.v} פעמים)</span></li>)}
          </ul>
        </Box>
      )}
    </div>
  );
}
