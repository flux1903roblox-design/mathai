// The profile, laid out like Duolingo's profile screen: a wide header with the avatar (מדי) and the settings gear,
// the name and the class, a "סטטיסטיקה" grid of four tiles, then what to do next, the stairs that need work, the
// medals, and the learning numbers. Settings (details, class, assistant, sound, deleting data) live on /settings.
import { Link } from 'react-router-dom';
import { Settings as Gear, Flame, Zap, Footprints, Award } from 'lucide-react';
import { useApp, streakOf } from '@/lib/store.js';
import { TOPICS, topicsFor } from '@/content/index.js';
import { doneUpTo } from '@/lib/path.js';
import { skillId } from '@/learn/skills.ts';
import { masteryState } from '@/learn/mastery.ts';
import { Stat } from '@/components/ds.jsx';
import Achievements from '@/components/Achievements.jsx';
import ProgressSummary from '@/components/learn/ProgressSummary.jsx';
import MyNumbers from '@/components/learn/MyNumbers.jsx';

export default function Me() {
  const { profile, days, xp, path, progress } = useApp();
  const skills = useApp((s) => s.learn.skills);
  const streak = streakOf(days);
  const stairs = TOPICS.reduce((a, t) => a + doneUpTo(t.id, path, progress), 0);
  const now = new Date().toISOString();
  const mastered = topicsFor(profile.grade || '7').reduce((a, t) => a + t.levels.filter((_, i) => masteryState(skills[skillId(t.id, i + 1)], now) === 'mastered').length, 0);
  return (
    <div className="page profile">
      <header className="profile-top" data-region="header">
        <Link to="/settings" className="icon-btn profile-gear" aria-label="הגדרות"><Gear size={24} aria-hidden="true" /></Link>
        <div className="profile-avatar" aria-hidden="true"><span className="avatar-initial">{(profile.name || "א").trim().charAt(0)}</span></div>
      </header>
      <section className="profile-id" aria-labelledby="profile-name">
        <h1 id="profile-name" className="profile-name">{profile.name || 'אני'}</h1>
        <p className="profile-sub">{profile.className ? `כיתה ${profile.className}` : profile.grade === '8' ? 'כיתה ח׳' : 'כיתה ז׳'}</p>
      </section>
      <section className="section" aria-labelledby="stats-title" data-region="content">
        <h2 id="stats-title" className="h-section">סטטיסטיקה</h2>
        <div className="profile-stats">
          <Stat tone="gold" icon={Flame} value={streak} label="ימים ברצף" />
          <Stat tone="gold" icon={Zap} value={xp} label="סך הכול XP" />
          <Stat tone="brand" icon={Footprints} value={stairs} label="מדרגות שעליתם" />
          <Stat tone="good" icon={Award} value={mastered} label="שולטים לבד" />
        </div>
      </section>
      <ProgressSummary tiles={false} />
      <Achievements stats={false} />
      <MyNumbers />
    </div>
  );
}
