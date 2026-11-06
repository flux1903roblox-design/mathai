import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { useApp } from '@/lib/store.js';
import { syncNow } from '@/lib/api.js';
import Shell from '@/components/Shell.jsx';
import Welcome from '@/screens/Welcome.jsx';
import Learn from '@/screens/Learn.jsx';
import Topics from '@/screens/Topics.jsx';
import Topic from '@/screens/Topic.jsx';
import Lesson from '@/screens/Lesson.jsx';
import Quests from '@/screens/Quests.jsx';
// Screens that are not on the daily path load on demand.
const Assistant = lazy(() => import('@/screens/Assistant.jsx'));
const Me = lazy(() => import('@/screens/Me.jsx'));
const Teacher = lazy(() => import('@/screens/Teacher.jsx'));
const Exams = lazy(() => import('@/screens/Exams.jsx'));
const ExamCheck = lazy(() => import('@/screens/ExamCheck.jsx'));
const ExamResult = lazy(() => import('@/screens/ExamResult.jsx'));
const Plan = lazy(() => import('@/screens/Plan.jsx'));
const NewPracticeExam = lazy(() => import('@/screens/PracticeExam.jsx').then((m) => ({ default: m.NewPracticeExam })));
const PracticeSheet = lazy(() => import('@/screens/PracticeExam.jsx').then((m) => ({ default: m.PracticeSheet })));

function useSync() {
  const token = useApp((s) => s.profile?.token);
  useEffect(() => {
    if (!token) return undefined;
    syncNow();
    const t = setInterval(syncNow, 60_000);
    const onHide = () => { if (document.visibilityState === 'hidden') syncNow(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onHide); };
  }, [token]);
}

/** A toast belongs to the screen that raised it: clear it when the route changes. */
function ToastReset() {
  const { pathname } = useLocation();
  useEffect(() => { toast.dismiss(); }, [pathname]);
  return null;
}

// Each lesson route starts a fresh lesson, so the screen remounts per route.
function LessonRoute() {
  const { pathname, search } = useLocation();
  return <Lesson key={`${pathname}${search}`} />;
}

export default function App() {
  const role = useApp((s) => s.profile?.role);
  useSync();
  return (
    <HashRouter>
      <Toaster position="bottom-center" dir="rtl" offset={96} mobileOffset={{ bottom: 96 }} toastOptions={{ className: 'toast' }} />
      <ToastReset />
      <Suspense fallback={<p className="page muted" role="status">טוענים…</p>}>
      <Routes>
        {!role && <Route path="*" element={<Welcome />} />}
        {role === 'teacher' && (
          <>
            <Route path="/teacher/*" element={<Teacher />} />
            <Route path="*" element={<Navigate to="/teacher" replace />} />
          </>
        )}
        {role === 'student' && (
          <>
            <Route element={<Shell />}>
              <Route path="/" element={<Learn />} />
              <Route path="/quests" element={<Quests />} />
              <Route path="/topics" element={<Topics />} />
              <Route path="/topic/:id" element={<Topic />} />
              <Route path="/assistant" element={<Assistant />} />
              <Route path="/me" element={<Me />} />
              <Route path="/exams" element={<Exams />} />
              <Route path="/exams/check" element={<ExamCheck />} />
              <Route path="/exams/new" element={<NewPracticeExam />} />
              <Route path="/exams/practice/:id" element={<PracticeSheet />} />
              <Route path="/exams/:id" element={<ExamResult />} />
              <Route path="/plan" element={<Plan />} />
            </Route>
            <Route path="/lesson/:topic/:level" element={<LessonRoute />} />
            <Route path="/practice/:id" element={<LessonRoute />} />
            <Route path="/placement" element={<LessonRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
      </Suspense>
    </HashRouter>
  );
}
