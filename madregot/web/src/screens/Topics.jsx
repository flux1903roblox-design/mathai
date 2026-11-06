import { ChevronLeft } from 'lucide-react';
import { ChapterMark, LevelPips } from '@/components/ui.jsx';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useApp } from '@/lib/store.js';
import { topicsFor } from '@/content/index.js';
import { GradeSwitch } from './Welcome.jsx';
import PageHero from '@/components/PageHero.jsx';

export function TopicRow({ t, n, to }) {
  const p = useApp((s) => s.progress[t.id]);
  const level = p?.level || 1;
  return (
    <li>
      <Link to={to || `/topic/${t.id}`} className="topic-row">
        <ChapterMark color={t.color} n={n} />
        <span className="topic-row-text">
          <span className="topic-row-title">{t.title}</span>
          <span className="topic-row-desc">{t.desc}</span>
        </span>
        <span className="topic-row-level">
          <LevelPips total={t.levels.length} level={level} max={p?.max} color={t.color} />
          <span className="topic-row-level-text">מדרגה {level}</span>
        </span>
        <ChevronLeft className="chev" size={20} aria-hidden="true" />
      </Link>
    </li>
  );
}

export default function Topics() {
  const own = useApp((s) => s.profile.grade) || '7';
  const [grade, setGrade] = useState(own);
  const list = topicsFor(grade);
  return (
    <div className="page">
      <PageHero tone="brand" art="study" title="נושאים" sub="כל הנושאים של השנה, וכמה מדרגות כבר עליתם בכל אחד." />
      <div className="field">
        <span className="visually-hidden" id="tp-grade">שכבה</span>
        <GradeSwitch value={grade} onChange={setGrade} id="tp-grade" />
      </div>
      <ul className="topic-list">
        {list.map((t, i) => <TopicRow key={t.id} t={t} n={i + 1} />)}
      </ul>
    </div>
  );
}
