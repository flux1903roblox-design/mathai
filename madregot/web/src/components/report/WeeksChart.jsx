// "8 שבועות אחרונים" (PARENTS-5): a device's minutes on learning screens in each of the last 8 weeks, as plain CSS
// bars (ds.jsx Bar), each labelled with that week's practice days, newest week first. The same numbers are in a
// visually hidden table (שבוע · דקות · ימי תרגול) for a screen reader; the bars themselves are hidden from it. No
// accuracy line: parents see practice and mastery, never a percentage right. The bars do not animate with reduced motion.
import { Bar } from '@/components/ds.jsx';
import { weekStart, weekFrom, he } from '@/learn/report.ts';
import { dm } from '@/lib/share.js';

export const WEEKS = 8;
const shift = (day, n) => { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d) + n * 864e5).toISOString().slice(0, 10); };

/** The last `n` weeks up to the week of `today`, newest first: [{ start, end, minutes, days }]. */
export function weeksOf(rows, today, n = WEEKS) {
  const first = weekStart(today);
  return Array.from({ length: n }, (_, i) => {
    const start = shift(first, -7 * i);
    const w = weekFrom(rows, start, today);
    return { start, end: w.end, minutes: w.minutes, days: w.activeDays };
  });
}

export default function WeeksChart({ rows, today, id, level = 3 }) {
  const Title = `h${Math.min(6, Math.max(2, level))}`;
  const weeks = weeksOf(rows, today);
  const max = Math.max(60, ...weeks.map((w) => w.minutes));
  const label = (w, i) => (i === 0 ? 'השבוע' : i === 1 ? 'השבוע שעבר' : `${dm(w.start)}–${dm(w.end)}`);
  return (
    <section className="weeks-chart" aria-labelledby={id}>
      <Title id={id} className="report-sec-title">8 שבועות אחרונים</Title>
      <p className="report-sub">דקות על מסכי הלמידה בכל שבוע, וכמה ימים היה בו תרגול.</p>
      <ol className="weeks-bars" aria-hidden="true">
        {weeks.map((w, i) => (
          <li key={w.start} className="weeks-row">
            <span className="weeks-when">{label(w, i)}</span>
            <Bar value={w.minutes} max={max} tone="brand" text={he.days(w.days)} />
            <span className="weeks-min">{`${w.minutes} דק׳`}</span>
          </li>
        ))}
      </ol>
      <table className="visually-hidden">
        <caption>8 שבועות אחרונים</caption>
        <thead><tr><th scope="col">שבוע</th><th scope="col">דקות</th><th scope="col">ימי תרגול</th></tr></thead>
        <tbody>
          {weeks.map((w) => <tr key={w.start}><th scope="row">{`${dm(w.start)}–${dm(w.end)}`}</th><td>{w.minutes}</td><td>{w.days}</td></tr>)}
        </tbody>
      </table>
    </section>
  );
}
