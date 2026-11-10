// The teacher's student view (spec TEACHER-2 §2): the student screens of a stair (its page, the teaching stages,
// practice, the mastery check, a repair), exactly as a student sees them, under a thin bar that says so and leads back
// to the board. The screens work on this device's own learning state; nothing is sent to the class (lib/teacher.js).
// While it is open, <html data-preview="1"> gives the full-height screens the bar's 40px back (canon.css), so the
// keypad stays on a 320×568 screen.
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { previewBack } from '@/lib/teacher.js';

export default function PreviewFrame() {
  const { state } = useLocation();
  const navigate = useNavigate();
  // where the teacher came from (the library, later the board's other tools); kept for the tab while the preview is
  // open, so a student screen that ends on "/" or "/quests" comes back there too (PreviewHome, App.jsx)
  const [back] = useState(() => {
    const b = state?.back || previewBack.get() || '/teacher/lessons';
    previewBack.set(b);
    return previewBack.get() || '/teacher/lessons';
  });
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.preview = '1';
    return () => { delete root.dataset.preview; };
  }, []);
  return (
    <>
      <div className="preview-bar" role="region" aria-label="תצוגת תלמיד">
        <Eye className="preview-eye" size={18} aria-hidden="true" />
        <p className="preview-text">
          <b>תצוגת תלמיד</b>
          <span className="preview-hint"><span className="preview-hint-a">כך התלמידים רואים את זה. </span>מה שעושים כאן לא נשלח לכיתה.</span>
        </p>
        <button type="button" className="preview-back" onClick={() => navigate(back)}><span>חזרה ללוח</span></button>
      </div>
      <Outlet />
    </>
  );
}
