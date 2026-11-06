import { useState } from 'react';
import { useApp } from '@/lib/store.js';
import { topicsFor } from '@/content/index.js';
import { GradeSwitch } from './Welcome.jsx';
import { TopicRow } from './Today.jsx';

export default function Topics() {
  const own = useApp((s) => s.profile.grade) || '7';
  const [grade, setGrade] = useState(own);
  const list = topicsFor(grade);
  return (
    <div className="page">
      <h1 className="h-page">נושאים</h1>
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
