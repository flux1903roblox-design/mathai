import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Sparkles, Check, Lock } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { TOPIC, TOPICS } from '@/content/index.js';
import { Box, Button, ChapterMark } from '@/components/ui.jsx';
import { MathText } from '@/components/MathText.jsx';

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
      <header className={`chapter-opener ch-${t.color}`}>
        <ChapterMark color={t.color} n={n} size="lg" />
        <div>
          <h1 className="chapter-title">{t.title}</h1>
          <p className="chapter-desc">{t.desc}</p>
        </div>
      </header>

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
        <Button variant="secondary" className="btn-block" onClick={() => navigate(`/assistant?generate=${id}&level=${p.level}`)}>
          <Sparkles size={18} aria-hidden="true" />תרגילים נוספים מהעוזר
        </Button>
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
