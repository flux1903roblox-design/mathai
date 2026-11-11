// "הסיכום השבועי": the one renderer of a week report (PARENTS-2), for the child on their own device (source 'local'),
// the parent who opened the child's link (/r, source 'link') and the family's synced report (source 'synced'). The
// wording is the same for child and parent: what the child previews is what the parent sees. No percentage of right
// answers appears anywhere (accuracy invites grade pressure; passed mastery checks are the honest signal), and the
// maths in mistake names is plain text, so the report needs no KaTeX.
import { createContext, useContext, useId } from 'react';
import clsx from 'clsx';
import { CalendarCheck, Clock, ListChecks, Flame, Check, Moon } from 'lucide-react';
import { Stat } from '@/components/ds.jsx';
import { stairName, misconName, withPrefix, he } from '@/learn/report.ts';
import { MASTERY_N, MASTERY_NEED } from '@/learn/mastery.ts';
import { dm, newestFirst } from '@/lib/share.js';
import { RETENTION } from '@shared/retention.js';
import '@/styles/report.css';

const LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const WORKED_SHOWN = 6;

/** Where the report came from, and what it leaves out. */
export const SOURCE_NOTE = {
  local: 'לא נכלל בסיכום: התשובות עצמן, שיחות עם העוזר החכם ותמונות.',
  link: 'הסיכום נוצר במכשיר של הילד ונשלח ממנו. מדרגות לא שומרת אותו. לא נכלל: התשובות עצמן, שיחות עם העוזר החכם ותמונות.',
  synced: `הסיכום מתעדכן מהמכשיר במהלך היום ונשמר ${RETENTION.familyDailyDays} יום. לא נכלל: התשובות עצמן, שיחות עם העוזר החכם ותמונות.`,
};

/** 'א׳ 8.11 – ש׳ 14.11' */
export const weekRange = (week) => `${LETTERS[0]} ${dm(week.start)} – ${LETTERS[6]} ${dm(week.end)}`;

/** What a screen reader hears for one day of the strip. */
function dayText(day, i) {
  if (day.on) return `${DAY_NAMES[i]} ${dm(day.d)}: היה תרגול`;
  if (day.rest) return i === 6 ? 'שבת, מנוחה' : `${DAY_NAMES[i]} ${dm(day.d)}: מנוחה`;
  if (day.future) return `${DAY_NAMES[i]} ${dm(day.d)}: עוד לא הגיע`;
  return `${DAY_NAMES[i]} ${dm(day.d)}: בלי תרגול`;
}

function Strip({ week, today }) {
  return (
    <ol className="report-strip" aria-label={`ימי תרגול השבוע: ${week.activeDays}`}>
      {week.days.map((day, i) => {
        const state = day.on ? 'on' : day.rest ? 'rest' : day.future ? 'future' : 'off';
        return (
          <li key={day.d} className={clsx('report-day', `is-${state}`, day.d === today && 'is-today')}>
            <span className="report-dot" aria-hidden="true">
              {state === 'on' && <Check size={18} strokeWidth={3} />}
              {state === 'rest' && <Moon size={16} strokeWidth={2.4} />}
            </span>
            <span className="report-day-name" aria-hidden="true">{LETTERS[i]}</span>
            <span className="visually-hidden">{dayText(day, i)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** The report's own heading level (its title); its sections are one below. 2 on its own screen, deeper inside a card. */
const Level = createContext(2);
const H = ({ level, ...rest }) => { const Tag = `h${Math.min(6, Math.max(2, level))}`; return <Tag {...rest} />; };

function Section({ title, children, className }) {
  const id = useId();
  const level = useContext(Level) + 1;
  return (
    <section className={clsx('card report-sec', className)} aria-labelledby={id}>
      <H level={level} id={id} className="report-sec-title">{title}</H>
      {children}
    </section>
  );
}

function Mastered({ week }) {
  const list = newestFirst(week.mastered);
  return (
    <Section title="חדש בשליטה" className="report-mastered">
      <p className="report-sub">{`עברו בדיקת שליטה: ${MASTERY_N} שאלות בלי רמזים, ולפחות ${MASTERY_NEED} נכונות.`}</p>
      {list.length
        ? <ul className="report-list report-checks">{list.map((s) => <li key={s}><Check size={18} strokeWidth={3} aria-hidden="true" /><span>{stairName(s)}</span></li>)}</ul>
        : <p className="report-empty-line">השבוע לא הייתה בדיקת שליטה. היא מגיעה בסוף כל מדרגה, אחרי ההסבר והתרגול.</p>}
    </Section>
  );
}

function Worked({ week }) {
  const list = newestFirst(week.worked);
  const more = list.length - WORKED_SHOWN;
  return (
    <Section title="מה תורגל" className="report-worked">
      {list.length > 0 && (
        <ul className="report-list report-dots">
          {list.slice(0, WORKED_SHOWN).map((s) => <li key={s}><span>{stairName(s)}</span></li>)}
          {more > 0 && <li className="report-more"><span>{`ועוד ${he.stairs(more)}`}</span></li>}
        </ul>
      )}
      <p className="report-line">{`שלבי לימוד שהושלמו: ${week.stages} · שיעורים ובדיקות: ${week.lessons}`}</p>
      {week.reviews > 0 && <p className="report-line">{`חזרות קצרות שעברו בהצלחה: ${week.reviews}`}</p>}
    </Section>
  );
}

function Fixes({ week, today }) {
  const items = [...week.open.map((f) => [...f, 'o']), ...week.fixed.map((f) => [...f, 'd'])];
  if (!items.length) return null;
  return (
    <Section title="טעויות שחוזרות, ומה מתקנים" className="report-fixes">
      <p className="report-sub">כשאותה טעות מופיעה בשתי שאלות שונות לפחות, מדרגות מסבירה אותה מחדש ובודקת שוב. זה חלק רגיל מהלמידה.</p>
      <ul className="report-fix-list">
        {items.map(([skill, id, state]) => (
          <li key={`${state}|${skill}|${id}`} className="report-fix">
            <span className="report-fix-text">
              <span className="report-fix-stair">{stairName(skill)}</span>
              <span className="report-fix-name">{misconName(skill, id)}</span>
            </span>
            <span className={clsx('report-tag', state === 'o' ? 'is-open' : 'is-done')}>{state === 'o' ? 'בתיקון' : 'תוקן השבוע'}</span>
          </li>
        ))}
      </ul>
      {week.open.length > 0 && week.openAt && week.openAt !== today && <p className="report-asof">{`נכון ל־${dm(week.openAt)}`}</p>}
    </Section>
  );
}

function Exam({ exam }) {
  const when = withPrefix('ב', dm(exam.d));
  return (
    <Section title="מבחן קרוב" className="report-exam">
      <p className="report-line">
        {exam.n > 0
          ? `מבחן ${when}. ${exam.n} מתוך ${exam.of} המדרגות של המבחן כבר בשליטה.`
          : `מבחן ${when}. בתוכנית ההכנה ${exam.of} מדרגות, ובדיקות השליטה עליהן עוד לא נעשו.`}
      </p>
    </Section>
  );
}

function Help({ week }) {
  const newest = newestFirst(week.worked)[0];
  return (
    <Section title="איך אפשר לעזור" className="report-help">
      <ol className="report-tips">
        <li>{newest
          ? `שאלו מה היה הכי מעניין השבוע, ובקשו שיסבירו לכם דוגמה אחת מ"${stairName(newest)}".`
          : 'שאלו מה היה הכי מעניין השבוע, ובקשו שיראו לכם איך נראה שיעור במדרגות.'}</li>
        <li>שבחו את המאמץ ואת הדרך, לא את המהירות.</li>
        <li>אין צורך ללמד בעצמכם. לכל טעות שחוזרת יש במדרגות הסבר משלה.</li>
      </ol>
    </Section>
  );
}

/** A day's name and date: 'יום חמישי 5.11' ('היום' for today). */
const dayTitle = (d, today) => (d === today ? `היום, ${dm(d)}` : `יום ${DAY_NAMES[new Date(`${d}T00:00:00Z`).getUTCDay()]} ${dm(d)}`);
const names = (list) => (list.length ? list.map(stairName).join(', ') : 'אין');

/**
 * One day's summary (learn/report.ts DaySummary) in words, every field it holds and nothing else: what a linked device
 * sends its parents for that day (the sharing sheet shows today's, and the rows sent last). Maths in plain text.
 */
export function DayView({ day, today }) {
  const titleId = useId();
  const fixes = day.fx || [];
  const rows = [
    ['דקות על מסכי הלמידה', String(day.m)],
    ['שאלות שנענו', String(day.q)],
    ['שיעורים ובדיקות שהסתיימו', String(day.ls)],
    ['שלבי לימוד שהושלמו', String(day.st)],
    ['חזרות קצרות שעברו', String(day.rv)],
    ['מדרגות שתורגלו', names(day.sk || [])],
    ['עברו בדיקת שליטה', names(day.ma || [])],
    ['ימים ברצף', String(day.sr)],
    ['מבחן קרוב', day.ex ? `${withPrefix('ב', dm(day.ex.d))}, ${day.ex.n} מתוך ${day.ex.of} המדרגות שלו בשליטה` : 'אין'],
  ];
  return (
    <article className="report report-dayview" aria-labelledby={titleId} data-variant="day">
      <h4 id={titleId} className="report-dayview-title">{dayTitle(day.d, today)}</h4>
      <dl className="report-daylist">
        {rows.map(([k, v]) => <div key={k} className="report-daylist-row"><dt>{k}</dt><dd>{v}</dd></div>)}
        <div className="report-daylist-row is-wide">
          <dt>טעויות שחוזרות</dt>
          <dd>
            {fixes.length ? (
              <ul className="report-daylist-fixes">
                {fixes.map(([skill, id, state]) => (
                  <li key={`${state}|${skill}|${id}`}>{`${misconName(skill, id)} (${stairName(skill)}): ${state === 'o' ? 'בתיקון' : 'תוקנה'}`}</li>
                ))}
              </ul>
            ) : 'אין'}
          </dd>
        </div>
      </dl>
    </article>
  );
}

/**
 * One week (learn/report.ts WeekReport) in order: the dates, the 7-day strip, four tiles, mastered, practised,
 * repairs (only if any), an exam ahead (only if any), how to help, and where the report came from.
 * `today`: the day on the device that shows it (marks today on the strip; repairs from another day say their day).
 * `variant="day"` with `day` (a DaySummary) draws one day instead (DayView). `level`: the heading level of the report's
 * title (2 on its own screen; deeper inside a /parents device card), its sections one below.
 */
export default function ReportView({ week, audience = 'child', source = 'local', today, variant = 'week', day, level = 2 }) {
  if (variant === 'day') return <DayView day={day} today={today} />;
  return <Level.Provider value={level}><WeekView week={week} audience={audience} source={source} today={today} /></Level.Provider>;
}

/** On a made-up week (exampleWeek.js, `week.example`): it says so above everything else. */
export const EXAMPLE_RIBBON = 'דוגמה. אלה לא נתונים של הילד שלכם.';

function WeekView({ week, audience, source, today }) {
  const titleId = useId();
  const level = useContext(Level);
  return (
    <article className={clsx('report', week.example && 'is-example')} aria-labelledby={titleId} data-audience={audience} data-source={source}>
      {week.example && <p className="report-ribbon">{EXAMPLE_RIBBON}</p>}
      <section className="card report-week">
        <header className="report-head">
          <H level={level} id={titleId} className="report-title">השבוע במדרגות</H>
          <p className="report-dates">{weekRange(week)}</p>
        </header>
        <Strip week={week} today={today} />
      </section>
      <div className="report-tiles">
        <Stat icon={CalendarCheck} value={week.activeDays} label="ימי תרגול" />
        <Stat icon={Clock} value={week.minutes} label="דקות" />
        <Stat icon={ListChecks} value={week.questions} label="שאלות" />
        <Stat icon={Flame} value={week.streak} label="ימים ברצף" />
      </div>
      <Mastered week={week} />
      <Worked week={week} />
      <Fixes week={week} today={today} />
      {week.exam && <Exam exam={week.exam} />}
      <Help week={week} />
      {!week.example && <p className="footnote report-note">{SOURCE_NOTE[source] || SOURCE_NOTE.local}</p>}
    </article>
  );
}
