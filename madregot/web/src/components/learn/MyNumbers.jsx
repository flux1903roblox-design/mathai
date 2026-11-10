// "הלמידה שלי במספרים": what the evidence says, worked out on this device. Time in the app is not counted as learning.
// A number with too little behind it is shown as "not enough yet", never as a percentage. Where the data goes is said by
// the one sentence the app uses for it (lib/durable/copy.js): a class student's answers also go to the teacher.
import { useApp } from '@/lib/store.js';
import { metrics, MIN_N } from '@/learn/analytics.ts';
import { whereSavedText } from '@/lib/durable/copy.js';

const pct = (r) => (r.value == null ? null : `${Math.round(r.value * 100)}%`);

export default function MyNumbers() {
  const learn = useApp((s) => s.learn);
  const profile = useApp((s) => s.profile);
  const backup = useApp((s) => s.backup);
  const m = metrics(learn, new Date().toISOString());
  const rows = [
    { label: 'מדרגות שאתם שולטים בהן לבד', value: String(m.masteredNow) },
    { label: 'תשובות לבד (בלי רמז, בניסיון ראשון) שיצאו נכונות', value: pct(m.independent), n: m.independent.n },
    { label: 'טעויות חוזרות שתוקנו', value: pct(m.misconResolution), n: m.misconResolution.n },
    { label: 'בדיקות זיכרון שעברו', value: pct(m.reviews), n: m.reviews.n },
    { label: 'ימים שבהם למדתם', value: String(m.activeDays) },
  ];
  const gain = m.masteryGain.value == null ? null : `${m.masteryGain.value >= 0 ? '+' : ''}${Math.round(m.masteryGain.value * 100)}`;
  return (
    <section className="section my-numbers" aria-labelledby="nums-title">
      <h2 id="nums-title" className="h-section">הלמידה שלי במספרים</h2>
      <dl className="nums">
        {rows.map((r) => (
          <div key={r.label} className="num-row">
            <dt>{r.label}</dt>
            <dd>{r.value ?? <span className="muted">עוד אין מספיק נתונים</span>}{r.value != null && r.n != null && <span className="num-n"> ({r.n})</span>}</dd>
          </div>
        ))}
      </dl>
      <details className="nums-more">
        <summary>מדדי למידה מפורטים</summary>
        <dl className="nums">
          <div className="num-row"><dt>שיפור בשליטה עצמאית (מהבדיקה הראשונה לבדיקה מאוחרת, בנקודות אחוז)</dt><dd>{gain ?? <span className="muted">עוד אין מספיק נתונים</span>}</dd></div>
          <div className="num-row"><dt>שליטה שנשמרה אחרי שבוע או יותר</dt><dd>{pct(m.retained7) ?? <span className="muted">עוד אין מספיק נתונים</span>}</dd></div>
          <div className="num-row"><dt>חזרתם אחרי יום / שבוע / חודש</dt><dd>{[m.returned.d1, m.returned.d7, m.returned.d30].map((x) => (x ? 'כן' : 'עוד לא')).join(' / ')}</dd></div>
          <div className="num-row"><dt>שיעורים שהתחלתם / סיימתם</dt><dd>{m.lessonsStarted} / {m.lessonsDone}</dd></div>
        </dl>
        <p className="field-hint">מספר מוצג רק כשיש מאחוריו לפחות {MIN_N} מקרים.</p>
      </details>
      <p className="field-hint nums-where">{whereSavedText({ profile, backup }, { about: 'numbers' })} הזמן באפליקציה לא נספר כאן: רק מה שפתרתם לבד.</p>
    </section>
  );
}
