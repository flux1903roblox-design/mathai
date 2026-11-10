// The teacher's own assistant (spec TEACHER-2 §6), at /teacher/assistant: the tutor's screen, for preparing exercises,
// explanations and lesson ideas. It is not a student view (no PreviewFrame): its bar leads back to the board, and the
// note above it says what may go into it. Chat, new exercises and the photo check carry the class's credentials
// (lib/ai.js through teacherHeaders), so they count on the teacher's own allowance and nothing reaches the class.
import { useApp } from '@/lib/store.js';
import { ScreenBar } from '@/components/Screen.jsx';
import TeacherAINote from '@/components/teacher/TeacherAINote.jsx';
import Assistant from '../Assistant.jsx';

export default function TeacherAssistant() {
  const cls = useApp((s) => s.profile.classes?.find((c) => c.code === s.profile.active) || s.profile.classes?.[0]);
  return (
    <Assistant className="t-assistant"
      head={<ScreenBar title="העוזר החכם" back="/teacher" backLabel="חזרה ללוח" />}
      lead={<TeacherAINote setting={cls?.aiPolicy?.setting} />} />
  );
}
