// A teacher's "I am over 18, a teacher or a tutor" (COUNCIL2-5), unticked until the teacher ticks it. An email alone
// proves no age: a child with their own email could sign in as a teacher. Without the tick the board works as always,
// but no adult is behind the class, so the smart tutor stays closed (the server's parent_ok_needed and adult_needed).
// Shown on the teacher's sign-in (EmailCodeForm, the teacher purposes), on TeacherStart's details step for a teacher
// signed in before it was asked, and on TeacherBind; each sends adultTeacher with what it posts.
// The words say "נותן/ת שיעורים פרטיים" for a tutor: copy.test.js keeps the private-teacher wording out of web/src, so
// the AI is never called one (TRUST-12 §2).

export const ADULT_TEACHER = Object.freeze({
  label: 'אני מעל גיל 18, ואני מורה או נותן/ת שיעורים פרטיים',
  hint: 'בלי הסימון הזה אפשר לנהל את הכיתה, אבל העוזר החכם לא ייפתח.',
});

/** Props: `id` (unique on the page), `checked`, `onChange(boolean)`. */
export default function AdultTeacherBox({ id, checked, onChange }) {
  return (
    <div className="adult-teacher">
      <label className="check-row parents-check" htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-describedby={`${id}-hint`} />
        <span>{ADULT_TEACHER.label}</span>
      </label>
      <p className="field-hint" id={`${id}-hint`}>{ADULT_TEACHER.hint}</p>
    </div>
  );
}
