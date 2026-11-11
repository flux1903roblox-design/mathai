// The Sunday recap's sheet (STUDENT-6, FOLLOWUP-38), loaded on demand from RecapCard: last week of this student, top to
// bottom: the title with its dates, the week strip with its rest days, three numbers (learning days, steps, stairs
// mastered), up to three new stairs and three mistakes fixed by name, the personal best, the class goal (in a class),
// what Madi earned that week (with Madi wearing it, still), and two buttons: "לשלוח להורים" opens the parents' share
// sheet (components/report/ShareSheet.jsx, PARENTS-2) for that week's Sunday, and "סגירה".
// Days, stairs mastered and mistakes fixed are the `week` RecapCard got from learn/report.ts weekLocal, never counted
// again here; steps and the best week are STUDENT-5's (lib/streak.js), the class goal STUDENT-4's saved classGoals,
// and Madi's pieces the ones whose look.earnedAt falls in the week. Nothing about prices, nothing sent from here.
import clsx from 'clsx';
import { CalendarCheck, Footprints, Check, Moon, Send } from 'lucide-react';
import { Sheet, Button } from '@/components/ui.jsx';
import { Stat } from '@/components/ds.jsx';
import Mascot from '@/components/Mascot.jsx';
import { ShareSheet } from '@/components/report/ShareSheet.jsx';
import { useApp } from '@/lib/store.js';
import { useMadiLook } from '@/lib/madiLook.js';
import { weekSteps, bestWeek } from '@/lib/streak.js';
import { colorOf, nameOf, wearing } from '@/lib/wardrobe.js';
import { dm, newestFirst } from '@/lib/share.js';
import { stairName, misconName } from '@/learn/report.ts';
import { isRestDay, isYomTov } from '@shared/restDays.js';

const LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const SHOWN = 3;
const steps = (n) => (n === 1 ? 'צעד אחד' : `${n} צעדים`);
/** Up to three names, then how many more. */
const names = (list) => `${list.slice(0, SHOWN).join(', ')}${list.length > SHOWN ? ` ועוד ${list.length - SHOWN}` : ''}`;

/** The personal-best line: a new best (or the first week with steps), else the week against the best. '' with no steps. */
export function bestLine(n, best) {
  if (!n) return '';
  if (!best || n > best.steps) return `שיא שבועי חדש: ${steps(n)}!`;
  return `${steps(n)}. השיא שלכם: ${best.steps === 1 ? 'צעד אחד' : best.steps}.`;
}

/** The class line (STUDENT-4), calm when the class got there without this student's steps. */
export function classLine(g) {
  if (!g || !(g.target > 0)) return '';
  const end = g.reached ? (g.mine > 0 ? '. הגעתם למטרה יחד.' : '. הכיתה הגיעה למטרה.') : '.';
  return `הכיתה: ${g.have} מתוך ${g.target}${end}${g.mine > 0 ? ` החלק שלכם: ${steps(g.mine)}.` : ''}`;
}

/** Madi's pieces that were earned in the week of `start`..`end` (look.earnedAt, set by markEarned), oldest first. */
export function earnedIn(look, start, end) {
  const owned = new Set(look?.earned || []);
  return Object.entries(look?.earnedAt || {})
    .filter(([id, d]) => owned.has(id) && d >= start && d <= end && nameOf(id))
    .sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    .map(([id]) => id);
}
const pieceName = (id) => (colorOf(id) ? `צבע ${nameOf(id)}` : nameOf(id));
/**
 * What Madi got in the recap's week. The sheet is about last week and opens on a Sunday, when "השבוע" is the week that
 * has just begun, so the line names the week it means (FOLLOWUP-38). '' with nothing earned.
 */
export const earnedLine = (ids) => (ids.length ? `בשבוע שעבר מדי קיבל: ${ids.map(pieceName).join(', ')}.` : '');

/** Last week's days: learned, a rest day (Shabbat, or a holiday), or neither. */
function Strip({ week }) {
  return (
    <ol className="week recap-week" aria-label={`ימי לימוד בשבוע שעבר: ${week.activeDays}`}>
      {week.days.map((day, i) => {
        const rest = day.rest || isRestDay(day.d);
        const state = day.on ? 'on' : rest ? 'rest' : 'off';
        const what = day.on ? 'היה לימוד' : rest ? (isYomTov(day.d) ? 'חג' : 'שבת') : 'בלי לימוד';
        return (
          <li key={day.d} className={clsx('week-day', state)}>
            <span className="week-dot" aria-hidden="true">{state === 'on' ? <Check size={16} strokeWidth={3} /> : state === 'rest' ? <Moon size={14} /> : null}</span>
            <span className="week-name" aria-hidden="true">{LETTERS[i]}</span>
            <span className="visually-hidden">{`${DAY_NAMES[i]} ${dm(day.d)}: ${what}`}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * view: 'recap' | 'share'. onClose: the recap was closed (the card marks the week seen); onShare: "לשלוח להורים" (the
 * recap closes, the share sheet opens); onShareClose: the share sheet was closed.
 */
export default function RecapSheet({ view, week, onClose, onShare, onShareClose }) {
  const days = useApp((s) => s.days);
  const look = useApp((s) => s.look);
  const inClass = useApp((s) => !!s.profile?.classCode);
  const goal = useApp((s) => s.classGoals?.[week.start]);
  const madi = useMadiLook();
  const n = weekSteps(days, week.start);
  const best = bestWeek(days, week.start);
  const mastered = newestFirst(week.mastered).map(stairName);
  const fixed = week.fixed.map(([skill, id]) => misconName(skill, id));
  const earned = earnedIn(look, week.start, week.end);
  const pb = bestLine(n, best);
  const cls = inClass ? classLine(goal) : '';
  const dressed = earned.reduce((l, id) => ({ ...l, ...wearing(id) }), madi);
  return (
    <>
      <Sheet open={view === 'recap'} onOpenChange={(o) => { if (!o) onClose(); }} className="recap-sheet"
        title={`השבוע שעבר, ${dm(week.start)}–${dm(week.end)}`}
        footer={(
          <div className="recap-actions">
            <Button className="btn-block" onClick={onShare}><Send size={20} aria-hidden="true" />לשלוח להורים</Button>
            <Button variant="ghost" className="btn-block" onClick={onClose}>סגירה</Button>
          </div>
        )}>
        <Strip week={week} />
        <div className="recap-tiles">
          <Stat icon={CalendarCheck} value={week.activeDays} label="ימי לימוד" />
          <Stat icon={Footprints} value={n} label="צעדים" />
          <Stat icon={Check} value={week.mastered.length} label="מדרגות בשליטה" />
        </div>
        <ul className="recap-lines">
          {mastered.length > 0 && <li className="recap-mastered">{`מדרגות חדשות בשליטה: ${names(mastered)}`}</li>}
          {fixed.length > 0 && <li className="recap-fixed">{`טעויות שתיקנתם: ${names(fixed)}`}</li>}
          {pb && <li className="recap-best">{pb}</li>}
          {cls && <li className="recap-class">{cls}</li>}
        </ul>
        {earned.length > 0 && (
          <div className="recap-earned">
            <Mascot mood="happy" size={72} still look={dressed} />
            <p>{earnedLine(earned)}</p>
          </div>
        )}
      </Sheet>
      <ShareSheet open={view === 'share'} onOpenChange={(o) => { if (!o) onShareClose(); }} start={week.start} />
    </>
  );
}
