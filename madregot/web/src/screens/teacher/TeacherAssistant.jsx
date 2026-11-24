// The teacher's own assistant (spec TEACHER-2 §6), at /teacher/assistant: the tutor's screen, for preparing exercises,
// explanations and lesson ideas. It is not a student view (no PreviewFrame): its bar leads back to the board, and the
// note above it says what may go into it. In a school class (the dashboard's aiPolicy.setting, TRUST-11; a school class
// until the board says otherwise) the note adds that it is not shown to the class. Chat, new exercises and the photo
// check carry the class's credentials (lib/ai.js through teacherHeaders), so they count on the teacher's own allowance
// and nothing reaches the class.
import { useApp } from '@/lib/store.js';
import { useBoard } from '@/lib/teacherBoard.js';
import { ScreenBar } from '@/components/Screen.jsx';
import TeacherAINote from '@/components/teacher/TeacherAINote.jsx';
import Assistant from '../Assistant.jsx';

export default function TeacherAssistant() {
  const cls = useApp((s) => s.profile.classes?.find((c) => c.code === s.profile.active) || s.profile.classes?.[0]);
  const { board } = useBoard(cls);
  return (
    <Assistant className="t-assistant"
      head={<ScreenBar title="העוזר החכם" back="/teacher" backLabel="חזרה ללוח" />}
      lead={<TeacherAINote setting={board?.aiPolicy?.setting} />} />
  );
}
