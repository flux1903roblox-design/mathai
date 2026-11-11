import { m } from 'motion/react';
import { Zap, Flame, Footprints, Star, Trophy, Target, ClipboardCheck, Sparkles, Mountain, Gift, Puzzle } from 'lucide-react';
import { useApp, streakOf, dayBefore, today, isActiveDay, keptDay } from '@/lib/store.js';
import { TOPICS, TOPIC } from '@/content/index.js';
import { CHALLENGES, challengesOf, isOpen, isSolved, solvedCount } from '@/learn/challenges/index.ts';
import { TOPIC_ORDER } from '@/learn/skills.ts';
import { doneCount, chestOpen } from '@/lib/path.js';
import RewardBadge from './RewardBadge.jsx';

const active = isActiveDay; // a finished lesson, check or teaching stage

/** The longest run of practice days in the history (rest days, freezes and repairs keep a run without adding to it). */
export function bestStreak(days) {
  const keys = Object.keys(days).sort();
  if (!keys.length) return 0;
  let best = 0; let run = 0; let key = today();
  const first = keys[0];
  // Walk back from today to the first recorded day.
  for (;;) {
    if (active(days[key])) { run += 1; best = Math.max(best, run); } else if (!keptDay(days, key)) run = 0;
    if (key <= first) break;
    key = dayBefore(key);
  }
  return best;
}

/** The challenge medals' size: "פתרתם 10 אתגרים". */
export const CHALLENGES_MEDAL = 10;

/**
 * The challenge track's medals (CURRICULUM-6.3), once the student has met the track (a task is open or solved), so a
 * student who has none open sees no medal for it: "פתרתם 10 אתגרים", and for each topic with a solved task, "אתגרי
 * {topic}", earned when all its tasks are solved.
 */
export function challengeMedals(skills, recs) {
  if (!CHALLENGES.some((t) => isOpen(t, skills, recs))) return [];
  const topics = TOPIC_ORDER.map((id) => ({ id, tasks: challengesOf(id) })).filter((x) => x.tasks.some((t) => isSolved(t, recs)));
  return [
    { id: 'challenges10', icon: Puzzle, label: `פתרתם ${CHALLENGES_MEDAL} אתגרים`, have: solvedCount(recs), need: CHALLENGES_MEDAL, tone: 'brand' },
    ...topics.map(({ id, tasks }) => ({ id: `ch-${id}`, icon: Puzzle, label: `אתגרי ${TOPIC[id]?.title || id}`, have: tasks.filter((t) => isSolved(t, recs)).length, need: tasks.length, tone: 'gold' })),
  ];
}

/**
 * The profile's record: totals, then medals that are earned from real history only
 * (lessons, streaks, perfect lessons, units, stairs, the placement test, a checked exam, challenges).
 * A medal not earned yet shows grey with how far along it is.
 */
export default function Achievements({ stats = true }) {
  const { days, xp, path, exams, placement, learn } = useApp();
  const streak = streakOf(days);
  const best = bestStreak(days);
  const lessons = Object.values(days).reduce((a, d) => a + (d.lessons || 0), 0);
  const perfect = Object.values(days).reduce((a, d) => a + (d.perfect || 0), 0);
  const stairs = TOPICS.reduce((a, t) => a + doneCount(t.id, path), 0);
  const units = Object.values(path).filter((u) => (u.reviews || 0) > 0).length;
  const chests = TOPICS.filter((t) => chestOpen(t.id, path)).length; // halfway through a unit on the map
  const medals = [
    { id: 'first', icon: Footprints, label: 'השיעור הראשון', have: lessons, need: 1, tone: 'brand' },
    { id: 'streak3', icon: Flame, label: '3 ימים ברצף', have: best, need: 3, tone: 'streak' },
    { id: 'streak7', icon: Flame, label: 'שבוע ברצף', have: best, need: 7, tone: 'streak' },
    { id: 'perfect', icon: Star, label: 'שיעור בלי טעויות', have: perfect, need: 1, tone: 'gold' },
    { id: 'stairs10', icon: Mountain, label: '10 מדרגות', have: stairs, need: 10, tone: 'good' },
    { id: 'chest', icon: Gift, label: 'תיבת אוצר', have: chests, need: 1, tone: 'streak' },
    { id: 'unit', icon: Trophy, label: 'יחידה שלמה', have: units, need: 1, tone: 'gold' },
    { id: 'xp500', icon: Zap, label: '500 XP', have: xp, need: 500, tone: 'gold' },
    { id: 'placement', icon: Target, label: 'בדיקת רמה', have: placement ? 1 : 0, need: 1, tone: 'brand' },
    { id: 'exam', icon: ClipboardCheck, label: 'מבחן שנבדק', have: exams.length, need: 1, tone: 'good' },
    ...challengeMedals(learn?.skills || {}, learn?.challenges),
  ];
  const earned = medals.filter((x) => x.have >= x.need).length;
  return (
    <>
      {stats && <m.dl className="me-stats" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07 } } }}>
        {[[Zap, 'xp', 'XP', xp], [Flame, 'streak', 'ימים ברצף', streak], [Footprints, 'stairs', 'מדרגות', stairs]].map(([Icon, k, label, v]) => (
          <m.div key={k} className={`me-stat me-${k}`} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
            <dt>{label}</dt>
            <dd><Icon size={20} aria-hidden="true" /><bdi dir="ltr">{v}</bdi></dd>
          </m.div>
        ))}
      </m.dl>}
      <section className="section medals-section" aria-labelledby="medals-title">
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
