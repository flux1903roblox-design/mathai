// "מבחנים": every exam of the class, one row each, with the score, a strip of results by question and the topics to
// strengthen. Two sources (PRODUCT2-31), each row says which: a class exam the teacher sent from the app and the student
// solved in it (the topics from its own questions), and an exam a student checked from a photo with the smart helper.
// A school class whose students have the helper off still gets the first kind, and the empty tab says so. A name opens
// the student's page (TEACHER-8).
import { Link } from 'react-router-dom';
import { TOPIC } from '@/content/topics.js';
import { fmtDay, Rate, StudentName } from './common.jsx';

const Q_TONE = { correct: 'ok', partial: 'mid', wrong: 'bad', missing: 'bad' };
const Q_LABEL = { correct: 'נכון', partial: 'נכון בחלקו', wrong: 'טעות', missing: 'לא נענה' };

/** Where a row came from (an older answer without `source`: a row of an assignment is from the app). */
export const EXAM_SOURCE = { app: 'מבחן כיתה, נפתר באפליקציה', photo: 'נבדק מצילום' };
const sourceOf = (e) => e.source || (e.assignmentId ? 'app' : 'photo');

/** The empty tab: where exams will come from, for this class. */
export const EXAMS_EMPTY = {
  title: 'עוד אין כאן מבחנים.',
  app: 'מבחן כיתה ששולחים מהאפליקציה יופיע כאן כשהתלמידים יפתרו אותו, עם ציון, תוצאה לכל שאלה ונושאים לחיזוק.',
  photoOn: 'גם מבחן שתלמיד בודק מצילום עם העוזר החכם יופיע כאן.',
  photoOff: 'בדיקת מבחן מצילום נעשית עם העוזר החכם, והוא כבוי לתלמידים בכיתה הזאת. לכן יופיעו כאן המבחנים שנשלחו מהאפליקציה ונפתרו בה.',
  make: 'להכנת מבחן כיתה',
};

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
  if ((data.exams || []).length === 0) {
    const photo = data.aiPolicy?.students === 'on';
    return (
      <section className="ex-empty" aria-labelledby="ex-empty-t">
        <p id="ex-empty-t" className="ex-empty-title">{EXAMS_EMPTY.title}</p>
        <p className="muted">{EXAMS_EMPTY.app}</p>
        <p className="muted">{photo ? EXAMS_EMPTY.photoOn : EXAMS_EMPTY.photoOff}</p>
        <Link to="/teacher/exam/new" className="btn btn-secondary ex-empty-make">{EXAMS_EMPTY.make}</Link>
      </section>
    );
  }
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="טבלת המבחנים">
      <table className="t-table">
        <thead><tr><th scope="col">תלמיד</th><th scope="col">מבחן</th><th scope="col">תאריך</th><th scope="col">ציון</th><th scope="col">לפי שאלה</th><th scope="col">נושאים לחיזוק</th></tr></thead>
        <tbody>
          {data.exams.map((e) => (
            <tr key={e.id}>
              <th scope="row"><StudentName id={e.studentId} name={e.name} onOpen={onStudent} /></th>
              <td>{e.title}<span className={`ex-src ex-src-${sourceOf(e)}`}>{EXAM_SOURCE[sourceOf(e)]}</span></td>
              <td>{fmtDay(e.at)}</td>
              <td><Rate value={e.total ? Math.round((100 * e.correct) / e.total) : null} /> <span className="muted">{e.correct}/{e.total}</span></td>
              <td><QuestionStrip questions={e.questions} /></td>
              <td className="wrap">{(e.weak || []).map((w) => TOPIC[w]?.title || 'אחר').join(', ') || '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
