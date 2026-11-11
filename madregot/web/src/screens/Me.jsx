// The profile, laid out like Duolingo's profile screen: a wide header with the avatar (מדי) and the settings gear,
// the name and the class, a "סטטיסטיקה" grid of four tiles and the weekly summary's card, then what to do next, the
// stairs that need work, the medals, and the learning numbers. Settings (details, class, assistant, sound, deleting
// data) live on /settings. On a device whose parents' summary is on, a "משותף עם ההורים" chip under the class line is
// the child's permanent sign (ICO Children's Code, standard 11) and opens what is shared (PARENTS-4).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings as Gear, Flame, Zap, Footprints, Award, CalendarCheck, ChevronLeft, Users } from 'lucide-react';
import { useApp, streakOf } from '@/lib/store.js';
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
import { useAIStatus } from '@/lib/account.js';
import SharingSheet from '@/components/SharingSheet.jsx';

/** The sign that the parents see a summary of this device's practice, and the way to see exactly what (PARENTS-4). */
function ShareChip() {
  const linked = useApp((s) => !!s.ai.familyDevice?.token);
  const on = useAIStatus((x) => x.status?.linked?.summary === 'on');
  const [open, setOpen] = useState(false);
  // the sheet stays while it is open: stopping the sharing from it takes the chip away, not the sheet
  if (!linked || (!on && !open)) return null;
  return (
    <>
      {on && <button type="button" className="chip share-chip" onClick={() => setOpen(true)}><Users size={18} aria-hidden="true" />משותף עם ההורים</button>}
      <SharingSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

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

export default function Me() {
  if (qaThrow() === 'render') throw new Error('QA: a test error while the profile renders');
  const { profile, days, xp, path } = useApp();
  const skills = useApp((s) => s.learn.skills);
  const streak = streakOf(days);
  const stairs = TOPICS.reduce((a, t) => a + doneCount(t.id, path), 0);
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
        <ShareChip />
      </section>
      <section className="section" aria-labelledby="stats-title" data-region="content">
        <h2 id="stats-title" className="h-section">סטטיסטיקה</h2>
        <div className="profile-stats">
          <Stat tone="gold" icon={Flame} value={streak} label="ימים ברצף" />
          <Stat tone="gold" icon={Zap} value={xp} label="סך הכול XP" />
          <Stat tone="brand" icon={Footprints} value={stairs} label="מדרגות שעליתם" />
          <Stat tone="good" icon={Award} value={mastered} label="שולטים לבד" />
        </div>
        <ReportCard />
      </section>
      <ProgressSummary tiles={false} />
      <Achievements stats={false} />
      <MyNumbers />
    </div>
  );
}
