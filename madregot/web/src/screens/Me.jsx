// The profile, laid out like Duolingo's profile screen: a wide header with the student's own מדי (their colour and
// what they wear, STUDENT-3) and the settings gear, the name and the class with the way to Madi's wardrobe, a
// "סטטיסטיקה" grid of four tiles and the weekly summary's card, then what to do next, the stairs that need work, the
// medals, and the learning numbers. Settings (details, class, assistant, sound, deleting data) live on /settings. At
// the bottom, small and quiet, the legal pages and the AI safety statement (trust spec TRUST-2 §7), and the cancel link
// when the app has a server: a second way there for a returning family (the front page carries the one the law asks for).
import { Link } from 'react-router-dom';
import { Settings as Gear, Flame, Footprints, Award, CalendarCheck, ChevronLeft, Shirt } from 'lucide-react';
import { useApp, streakOf } from '@/lib/store.js';
import { learnDaysTotal } from '@/lib/streak.js';
import { hasServer } from '@/lib/api.js';
import { TOPICS, topicsFor } from '@/content/index.js';
import { doneCount } from '@/lib/path.js';
import { skillId } from '@/learn/skills.ts';
import { masteryState } from '@/learn/mastery.ts';
import { Stat } from '@/components/ds.jsx';
import Achievements from '@/components/Achievements.jsx';
import ProgressSummary from '@/components/learn/ProgressSummary.jsx';
import MyNumbers from '@/components/learn/MyNumbers.jsx';
import { qaThrow } from '@/lib/qaFixtures.js';
import { useReportWeek } from '@/components/report/useReportWeek.js';
import { he } from '@/learn/report.ts';

/** "הסיכום השבועי": one line about this week, and the way to the summary the child can send a parent (PARENTS-2). */
function ReportCard() {
  const { week } = useReportWeek();
  return (
    <ul className="hub-rows">
      <li>
        <Link to="/report" className="hub-row">
          <span className="hub-row-icon" aria-hidden="true"><CalendarCheck size={22} /></span>
          <span className="hub-row-text"><span className="hub-row-title">הסיכום השבועי</span><span className="hub-row-desc">{he.practiceWeek(week.activeDays)}</span></span>
          <ChevronLeft className="chev" size={20} aria-hidden="true" />
        </Link>
      </li>
    </ul>
  );
}

import Mascot from '@/components/Mascot.jsx';

export default function Me() {
  if (qaThrow() === 'render') throw new Error('QA: a test error while the profile renders');
  const { profile, days, path } = useApp();
  const skills = useApp((s) => s.learn.skills);
  const streak = streakOf(days);
  const stairs = TOPICS.reduce((a, t) => a + doneCount(t.id, path), 0);
  const now = new Date().toISOString();
  const mastered = topicsFor(profile.grade || '7').reduce((a, t) => a + t.levels.filter((_, i) => masteryState(skills[skillId(t.id, i + 1)], now) === 'mastered').length, 0);
  return (
    <div className="page profile">
      <header className="profile-top" data-region="header">
        <Link to="/settings" className="icon-btn profile-gear" aria-label="הגדרות"><Gear size={24} aria-hidden="true" /></Link>
        {/* a picture only: the name is the page's heading */}
        <div className="profile-avatar" aria-hidden="true"><Mascot size={96} mood="idle" /></div>
      </header>
      <section className="profile-id" aria-labelledby="profile-name">
        <h1 id="profile-name" className="profile-name">{profile.name || 'אני'}</h1>
        <p className="profile-sub">{profile.className ? `כיתה ${profile.className}` : profile.grade === '8' ? 'כיתה ח׳' : 'כיתה ז׳'}</p>
        <Link to="/me/madi" className="btn btn-secondary btn-sm profile-madi-btn"><Shirt size={18} aria-hidden="true" />עיצוב מדי</Link>
      </section>
      <section className="section" aria-labelledby="stats-title" data-region="content">
        <h2 id="stats-title" className="h-section">סטטיסטיקה</h2>
        <div className="profile-stats">
          <Stat tone="gold" icon={Flame} value={streak} label="ימים ברצף" />
          {/* a number that only grows (STUDENT-5); XP stays on Quests and in the header */}
          <Stat tone="brand" icon={CalendarCheck} value={learnDaysTotal(days)} label="ימי לימוד" />
          <Stat tone="brand" icon={Footprints} value={stairs} label="מדרגות שעליתם" />
          <Stat tone="good" icon={Award} value={mastered} label="שולטים לבד" />
        </div>
        <ReportCard />
      </section>
      <ProgressSummary tiles={false} />
      <Achievements stats={false} />
      <MyNumbers />
      <footer className="me-foot">
        <nav className="me-foot-links" aria-label="מידע משפטי">
          <Link to="/privacy">פרטיות</Link>
          <Link to="/terms">תקנון</Link>
          <Link to="/accessibility">נגישות</Link>
          <Link to="/safety">בטיחות</Link>
          {hasServer() && <Link to="/cancel">ביטול מנוי</Link>}
        </nav>
      </footer>
    </div>
  );
}
