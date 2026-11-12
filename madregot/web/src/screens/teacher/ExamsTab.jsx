// "מבחנים": exams students checked in the app, one row each, with the score and a strip of results by question. A name
// opens the student's page (TEACHER-8).
import { TOPIC } from '@/content/topics.js';
import { fmtDay, Rate, StudentName } from './common.jsx';

const Q_TONE = { correct: 'ok', partial: 'mid', wrong: 'bad', missing: 'bad' };
const Q_LABEL = { correct: 'נכון', partial: 'נכון בחלקו', wrong: 'טעות', missing: 'לא נענה' };

/** One small square per question, coloured by result; the skill shows on hover. */
export function QuestionStrip({ questions = [] }) {
  const missed = questions.map((q, i) => (q.status === 'correct' ? null : i + 1)).filter(Boolean);
  return (
    <span className="qstrip" role="img" aria-label={missed.length ? `טעויות בשאלות ${missed.join(', ')}` : 'כל השאלות נכונות'}>
      {questions.map((q, i) => (
        <i key={i} className={Q_TONE[q.status] || 'bad'} title={`שאלה ${i + 1}: ${Q_LABEL[q.status] || ''}${q.skill ? `, ${q.skill}` : ''}`}>{i + 1}</i>
      ))}
    </span>
  );
}

export default function ExamsTab({ data, onStudent }) {
  if ((data.exams || []).length === 0) return <p className="muted">עוד אין מבחנים שנבדקו בכיתה. כשתלמידים יבדקו מבחן באפליקציה, התוצאות יופיעו כאן.</p>;
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="טבלת המבחנים">
      <table className="t-table">
        <thead><tr><th scope="col">תלמיד</th><th scope="col">מבחן</th><th scope="col">תאריך</th><th scope="col">ציון</th><th scope="col">לפי שאלה</th><th scope="col">נושאים לחיזוק</th></tr></thead>
        <tbody>
          {data.exams.map((e) => (
            <tr key={e.id}>
              <th scope="row"><StudentName id={e.studentId} name={e.name} onOpen={onStudent} /></th>
              <td>{e.title}</td>
              <td>{fmtDay(e.at)}</td>
              <td><Rate value={e.total ? Math.round((100 * e.correct) / e.total) : null} /> <span className="muted">{e.correct}/{e.total}</span></td>
              <td><QuestionStrip questions={e.questions} /></td>
              <td className="wrap">{e.weak.map((w) => TOPIC[w]?.title || 'אחר').join(', ') || '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
