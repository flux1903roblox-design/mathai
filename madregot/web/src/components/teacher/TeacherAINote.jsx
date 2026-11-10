// The note above the teacher's assistant (spec TEACHER-2 §6): what it is for, and the Ministry's rule for what goes
// into it (trust Appendix E §E.8). In a school class (the default: a class marked private by its teacher is not one,
// TRUST-11) it also says that the assistant is not shown to the class. The lesson stages may be projected; this may not.
// §E.8's school sentence also repeats "no names or grades"; right under the line that already says so, only its new
// part is kept.
import { ShieldCheck } from 'lucide-react';

export default function TeacherAINote({ setting }) {
  const school = setting !== 'private';
  return (
    <aside className="t-ai-note" aria-label="על העוזר החכם למורים">
      <p className="t-ai-note-lead">העוזר החכם למורים: להכנת תרגילים, הסברים ורעיונות לשיעור. השאלות שלכם לא מוצגות לתלמידים.</p>
      <p className="t-ai-note-rule">
        <ShieldCheck size={18} aria-hidden="true" />
        <span>
          לפי ההנחיות של משרד החינוך: בלי שמות של תלמידים, ציונים או פרטים מזהים.
          {school && <> בכיתה לא מציגים את העוזר לתלמידים.</>}
        </span>
      </p>
    </aside>
  );
}
