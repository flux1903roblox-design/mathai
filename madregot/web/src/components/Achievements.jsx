import { m } from 'motion/react';
import { Zap, Flame, Footprints, Star, Trophy, Target, ClipboardCheck, Sparkles, Mountain } from 'lucide-react';
import { useApp, streakOf, isShabbat, dayBefore, today } from '@/lib/store.js';
import { TOPICS } from '@/content/index.js';
import { doneUpTo } from '@/lib/path.js';
import RewardBadge from './RewardBadge.jsx';

const active = (d) => !!d && ((d.lessons || 0) > 0 || (d.lessons == null && (d.q || 0) > 0));

/** The longest run of practice days in the history (Shabbat and frozen days keep a run without adding to it). */
export function bestStreak(days) {
  const keys = Object.keys(days).sort();
  if (!keys.length) return 0;
  let best = 0; let run = 0; let key = today();
  const first = keys[0];
  // Walk back from today to the first recorded day.
  for (;;) {
    if (active(days[key])) { run += 1; best = Math.max(best, run); } else if (!(days[key]?.frozen || isShabbat(key))) run = 0;
    if (key <= first) break;
    key = dayBefore(key);
  }
  return best;
}

/**
 * The profile's record: totals, then medals that are earned from real history only
 * (lessons, streaks, perfect lessons, units, stairs, the placement test, a checked exam).
 * A medal not earned yet shows grey with how far along it is.
 */
export default function Achievements() {
  const { days, xp, path, progress, exams, placement } = useApp();
  const streak = streakOf(days);
  const best = bestStreak(days);
  const lessons = Object.values(days).reduce((a, d) => a + (d.lessons || 0), 0);
  const perfect = Object.values(days).reduce((a, d) => a + (d.perfect || 0), 0);
  const stairs = TOPICS.reduce((a, t) => a + doneUpTo(t.id, path, progress), 0);
  const units = Object.values(path).filter((u) => (u.reviews || 0) > 0).length;
  const medals = [
    { id: 'first', icon: Footprints, label: 'השיעור הראשון', have: lessons, need: 1, tone: 'brand' },
    { id: 'streak3', icon: Flame, label: '3 ימים ברצף', have: best, need: 3, tone: 'streak' },
    { id: 'streak7', icon: Flame, label: 'שבוע ברצף', have: best, need: 7, tone: 'streak' },
    { id: 'perfect', icon: Star, label: 'שיעור בלי טעויות', have: perfect, need: 1, tone: 'gold' },
    { id: 'stairs10', icon: Mountain, label: '10 מדרגות', have: stairs, need: 10, tone: 'good' },
    { id: 'unit', icon: Trophy, label: 'יחידה שלמה', have: units, need: 1, tone: 'gold' },
    { id: 'xp500', icon: Zap, label: '500 XP', have: xp, need: 500, tone: 'gold' },
    { id: 'placement', icon: Target, label: 'בדיקת רמה', have: placement ? 1 : 0, need: 1, tone: 'brand' },
    { id: 'exam', icon: ClipboardCheck, label: 'מבחן שנבדק', have: exams.length, need: 1, tone: 'good' },
  ];
  const earned = medals.filter((x) => x.have >= x.need).length;
  return (
    <>
      <m.dl className="me-stats" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07 } } }}>
        {[[Zap, 'xp', 'XP', xp], [Flame, 'streak', 'ימים ברצף', streak], [Footprints, 'stairs', 'מדרגות', stairs]].map(([Icon, k, label, v]) => (
          <m.div key={k} className={`me-stat me-${k}`} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
            <dt>{label}</dt>
            <dd><Icon size={20} aria-hidden="true" /><bdi dir="ltr">{v}</bdi></dd>
          </m.div>
        ))}
      </m.dl>
      <section className="section" aria-labelledby="medals-title">
        <h2 id="medals-title" className="h-section"><Sparkles size={20} aria-hidden="true" className="h-icon" />מדליות <span className="h-count">{earned} מתוך {medals.length}</span></h2>
        <div className="medals">
          {medals.map((x, k) => {
            const got = x.have >= x.need;
            return (
              <div key={x.id} className={got ? 'medal' : 'medal locked'}>
                <RewardBadge icon={x.icon} label={x.label} tone={got ? x.tone : 'locked'} delay={0.1 + k * 0.05} />
                {!got && x.need > 1 && <span className="medal-progress"><bdi dir="ltr">{Math.min(x.have, x.need)}/{x.need}</bdi></span>}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
