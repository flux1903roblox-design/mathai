import { Link, useNavigate, useParams } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ArrowRight, Sparkles, Check, Lock } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { aiReady } from '@/lib/ai.js';
import { TOPIC, TOPICS } from '@/content/index.js';
import { Box, Button, ChapterMark } from '@/components/ui.jsx';
import { MathText } from '@/components/MathText.jsx';
import WorldBackdrop from '@/components/map/WorldBackdrop.jsx';

const LineExplorer = lazy(() => import('@/components/LineExplorer.jsx'));

export default function Topic() {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = TOPIC[id];
  const p = useApp((s) => s.progress[id]) || { level: 1, max: 1 };
  const mistakes = useApp((s) => s.mistakes);
  if (!t) return <div className="page"><p>הנושא לא נמצא.</p><Link to="/topics">לרשימת הנושאים</Link></div>;
  const n = TOPICS.filter((x) => x.grade === t.grade).indexOf(t) + 1;
  const mine = Object.entries(mistakes).filter(([k]) => k.startsWith(`${id}:`)).map(([k, v]) => ({ cat: k.split(':')[1], v })).filter((m) => t.cats[m.cat]).sort((a, b) => b.v - a.v);

  return (
    <div className="page">
      <Link to="/topics" className="back-link"><ArrowRight size={18} aria-hidden="true" />כל הנושאים</Link>
      <div className={`chapter-card ch-${t.color} world-${t.id}`}>
        {/* the unit's world, as on the map */}
        <div className="chapter-world" aria-hidden="true"><WorldBackdrop topic={t.id} /></div>
        <header className={`chapter-opener ch-${t.color}`}>
          <ChapterMark color={t.color} n={n} size="lg" />
          <div>
            <h1 className="chapter-title">{t.title}</h1>
            <p className="chapter-desc">{t.desc}</p>
          </div>
        </header>
      </div>

      {t.lesson && (
        <Box tone="note" title="תזכורת מהשיעור">
          <ul className="lesson-list">{t.lesson.points.map((pt) => <li key={pt}><MathText text={pt} /></li>)}</ul>
          {t.lesson.examples && (
            <details className="sol">
              <summary>דוגמאות מהשיעור</summary>
              <ul className="lesson-list">{t.lesson.examples.map((ex) => <li key={ex}><MathText text={ex} /></li>)}</ul>
            </details>
          )}
          {t.lesson.explore === 'line' && (
            <details className="sol explorer-details">
              <summary>גרף שמשנים: מזיזים את m ואת b</summary>
              <Suspense fallback={<p className="muted">טוענים…</p>}><LineExplorer /></Suspense>
            </details>
          )}
        </Box>
      )}

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
        {aiReady() && (
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
