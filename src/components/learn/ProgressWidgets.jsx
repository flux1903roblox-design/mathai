import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, Zap, Check, Star, Play, Clock, Trophy } from 'lucide-react';
import { useProgress, streakOf, todayXP, weekActivity, isActiveToday, DAILY_GOAL } from '@/lib/progress';
import { courseOf, nextLesson } from '@/lessons';

const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const weekday = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return DAY_LETTERS[new Date(y, m - 1, d).getDay()];
};

export function GoalRing({ value, goal = DAILY_GOAL, size = 64, stroke = 7, children }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, value / goal);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={pct >= 1 ? '#34d399' : '#fbbf24'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - pct) }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

// Compact flame + streak count for headers/sidebars.
export function StreakChip({ user, className = '' }) {
  const p = useProgress(user?.id);
  const streak = streakOf(p);
  const active = isActiveToday(p);
  return (
    <Link
      to="/learn"
      title={active ? 'למדת היום — הרצף נשמר' : 'למד שיעור היום כדי לשמור על הרצף'}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold border transition hover:bg-white/10 ${active ? 'bg-orange-500/15 border-orange-400/40 text-orange-300' : 'glass text-muted-foreground'} ${className}`}
    >
      <Flame className={`w-3.5 h-3.5 ${active ? 'fill-orange-400 text-orange-400' : ''}`} />
      <span className="tabular-nums">{streak}</span>
    </Link>
  );
}

// Streak + this week + daily XP goal + total XP.
export function ProgressCard({ user }) {
  const p = useProgress(user?.id);
  const streak = streakOf(p);
  const today = todayXP(p);
  const week = weekActivity(p);
  return (
    <div className="card-base p-4 sm:p-5 flex items-center gap-4 sm:gap-6">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <motion.div
          animate={isActiveToday(p) ? { scale: [1, 1.12, 1] } : {}}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className={`w-12 h-12 rounded-2xl grid place-items-center shrink-0 ${streak ? 'bg-gradient-to-br from-orange-400 to-rose-500 btn-glow' : 'bg-white/[0.06]'}`}
        >
          <Flame className={`w-6 h-6 ${streak ? 'text-white fill-white/30' : 'text-muted-foreground'}`} />
        </motion.div>
        <div className="min-w-0">
          <div className="text-2xl font-extrabold leading-none tabular-nums">{streak} <span className="text-sm font-bold text-muted-foreground">ימי רצף</span></div>
          <div className="flex gap-1 mt-2" aria-label="פעילות השבוע">
            {week.map((d) => (
              <div key={d.key} className="flex flex-col items-center gap-0.5">
                <div className={`w-5 h-5 rounded-full grid place-items-center ${d.xp ? 'bg-orange-400 text-orange-950' : d.today ? 'border-2 border-dashed border-orange-400/60' : 'bg-white/[0.07]'}`}>
                  {d.xp > 0 && <Check className="w-3 h-3" strokeWidth={3.5} />}
                </div>
                <span className={`text-[9px] font-bold ${d.today ? 'text-orange-300' : 'text-muted-foreground'}`}>{weekday(d.key)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <GoalRing value={today}>
          <Zap className={`w-5 h-5 ${today >= DAILY_GOAL ? 'text-emerald-300' : 'text-amber-300'}`} />
        </GoalRing>
        <div className="hidden sm:block">
          <div className="text-xs text-muted-foreground">יעד יומי</div>
          <div className="font-extrabold tabular-nums">{Math.min(today, DAILY_GOAL)}/{DAILY_GOAL} XP</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">סה״כ {p.xp} XP</div>
        </div>
      </div>
    </div>
  );
}

export function stars(best) {
  return best >= 90 ? 3 : best >= 60 ? 2 : 1;
}

// Big "continue learning" call to action.
export function ContinueCard({ user }) {
  const p = useProgress(user?.id);
  const lesson = nextLesson(user, p);
  if (!lesson) return null;
  const course = courseOf(lesson.id);
  const allDone = !!p.lessons[lesson.id]?.done;
  const Icon = lesson.icon;
  return (
    <Link to={`/learn/${lesson.id}`} className="block group">
      <div className="relative overflow-hidden card-base card-hover p-5 flex items-center gap-4">
        <div className={`absolute -left-12 -top-12 w-44 h-44 rounded-full bg-gradient-to-br ${course.gradient} opacity-20 blur-3xl`} />
        <div
          className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${course.gradient} grid place-items-center shrink-0 btn-chunky`}
          style={{ '--chunk': course.chunk }}
        >
          {allDone ? <Trophy className="w-8 h-8 text-white" /> : <Icon className="w-8 h-8 text-white" strokeWidth={2.2} />}
        </div>
        <div className="relative flex-1 min-w-0">
          <div className={`text-xs font-bold ${course.text}`}>{allDone ? 'סיימת את כל השיעורים! חזרה לחיזוק' : Object.keys(p.lessons).length ? 'המשך מאיפה שעצרת' : 'השיעור הראשון שלך'}</div>
          <div className="text-lg font-extrabold mt-0.5 truncate">{lesson.title}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {lesson.minutes} דק׳</span>
            <span>· {lesson.steps.length} שלבים אינטראקטיביים</span>
          </div>
        </div>
        <div className="relative w-11 h-11 rounded-full bg-white text-background grid place-items-center shrink-0 group-hover:scale-110 transition">
          <Play className="w-5 h-5 fill-current -scale-x-100" />
        </div>
      </div>
    </Link>
  );
}

const SPACING = 160;
const OFFSETS = [0, 64, 0, -64];

// Winding, colour-coded path of lesson nodes (done / next / open).
export function LessonPath({ course, lessons, progress, nextId }) {
  const W = 300;
  const pts = lessons.map((_, j) => [W / 2 + OFFSETS[j % OFFSETS.length], 48 + j * SPACING]);
  return (
    <div className="relative mx-auto" style={{ width: W, height: pts.length * SPACING - 10 }}>
      <svg className="absolute inset-0" width={W} height={pts.length * SPACING} aria-hidden="true">
        {pts.slice(1).map((q, j) => {
          const p = pts[j];
          const done = progress.lessons[lessons[j].id]?.done;
          return (
            <path
              key={j}
              d={`M${p[0]} ${p[1]} C${p[0]} ${p[1] + 75} ${q[0]} ${q[1] - 75} ${q[0]} ${q[1]}`}
              fill="none"
              stroke={done ? course.hex : 'rgba(255,255,255,0.14)'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={done ? undefined : '2 12'}
            />
          );
        })}
      </svg>
      {lessons.map((lesson, j) => {
        const [x, y] = pts[j];
        const rec = progress.lessons[lesson.id];
        const isNext = lesson.id === nextId && !rec?.done;
        const Icon = lesson.icon;
        return (
          <motion.div
            key={lesson.id}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.08 * j, type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute flex flex-col items-center"
            style={{ left: x - 80, top: y - 38, width: 160 }}
          >
            {isNext && (
              <div className="absolute -top-11 z-10 animate-bounce">
                <div className="relative bg-white text-background text-xs font-extrabold rounded-xl px-3 py-1.5 shadow-lg">
                  התחל כאן
                  <span className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2.5 h-2.5 bg-white rotate-45" />
                </div>
              </div>
            )}
            <Link
              to={`/learn/${lesson.id}`}
              aria-label={`${lesson.title}${rec?.done ? ' — הושלם' : ''}`}
              className={`relative w-[76px] h-[76px] rounded-full grid place-items-center btn-chunky ${
                rec?.done || isNext ? `bg-gradient-to-br ${course.gradient}` : 'bg-white/[0.07] border border-white/10'
              }`}
              style={{ '--chunk': rec?.done || isNext ? course.chunk : 'hsl(240 10% 3%)' }}
            >
              {isNext && <span className={`absolute -inset-2 rounded-full ring-4 ${course.ring} animate-pulse-soft`} />}
              <Icon className={`w-8 h-8 ${rec?.done || isNext ? 'text-white' : course.text}`} strokeWidth={2.2} />
              {rec?.done && (
                <span className="absolute -top-1 -left-1 w-7 h-7 rounded-full bg-white text-emerald-600 grid place-items-center border-2 border-background">
                  <Check className="w-4 h-4" strokeWidth={3.5} />
                </span>
              )}
            </Link>
            <div className="mt-2.5 text-center rounded-xl bg-background/90 border border-white/5 px-2.5 py-1">
              <div className="text-sm font-bold leading-tight">{lesson.title}</div>
              {rec?.done ? (
                <div className="flex justify-center gap-0.5 mt-1" aria-label={`דיוק הכי טוב ${rec.best}%`}>
                  {[1, 2, 3].map((s) => (
                    <Star key={s} className={`w-3.5 h-3.5 ${s <= stars(rec.best) ? 'fill-amber-400 text-amber-400' : 'text-white/20'}`} />
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground mt-0.5">{lesson.minutes} דק׳ · {lesson.steps.length} שלבים</div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
