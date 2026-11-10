// "הלמידה שלי במספרים": what the evidence says, from this device only. Time in the app is not counted as learning.
// A number with too little behind it is shown as "not enough yet", never as a percentage.
import { useApp } from '@/lib/store.js';
import { metrics, MIN_N } from '@/learn/analytics.ts';

const pct = (r) => (r.value == null ? null : `${Math.round(r.value * 100)}%`);

export default function MyNumbers() {
  const learn = useApp((s) => s.learn);
  const m = metrics(learn, new Date().toISOString());
  // the three that say the most, in the student's words; the rest under "עוד מספרים" (STUDENT-9 §6)
  const rows = [
    { label: 'מדרגות שאתם שולטים בהן לבד', value: String(m.masteredNow) },
    { label: 'נכון בניסיון הראשון, בלי רמז', value: pct(m.independent), n: m.independent.n },
    { label: 'טעויות שתיקנתם', value: pct(m.misconResolution), n: m.misconResolution.n },
  ];
  const gain = m.masteryGain.value == null ? null : `${m.masteryGain.value >= 0 ? '+' : '\u2212'}${Math.abs(Math.round(m.masteryGain.value * 100))} נקודות אחוז`;
  const more = [
    { label: 'חזרות שהצלחתם', value: pct(m.reviews), n: m.reviews.n },
    { label: 'ימים שלמדתם', value: String(m.activeDays) },
    { label: 'כמה השליטה שלכם השתפרה', value: gain },
    { label: 'שליטה שנשארה גם אחרי שבוע', value: pct(m.retained7) },
    { label: 'שיעורים שהתחלתם / סיימתם', value: `${m.lessonsStarted} / ${m.lessonsDone}` },
  ];
  const list = (items) => (
    <dl className="nums">
      {items.map((r) => (
        <div key={r.label} className="num-row">
          <dt>{r.label}</dt>
          <dd>{r.value ?? <span className="muted">עוד אין מספיק נתונים</span>}{r.value != null && r.n != null && <span className="num-n"> ({r.n})</span>}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <section className="section my-numbers" aria-labelledby="nums-title">
      <h2 id="nums-title" className="h-section">הלמידה שלי במספרים</h2>
      {list(rows)}
      <details className="nums-more">
        <summary>עוד מספרים</summary>
        {list(more)}
        <p className="field-hint">מספר מוצג רק כשיש מאחוריו לפחות {MIN_N} מקרים.</p>
      </details>
      <p className="field-hint">המספרים נשמרים רק במכשיר הזה ולא נשלחים לשום מקום. הזמן באפליקציה לא נספר כאן: רק מה שפתרתם לבד.</p>
    </section>
  );
}
