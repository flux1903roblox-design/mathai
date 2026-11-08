import { lazy, Suspense, useEffect } from 'react';
import { createHashRouter, Navigate, Route, RouterProvider, Routes, ScrollRestoration, useLocation } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { LazyMotion, domAnimation, MotionConfig } from 'motion/react';
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

/**
 * A toast belongs to the screen that raised it: cleared when the route changes. Above the tab bar on
 * most screens; in a lesson (no tab bar, the keypad at the bottom) it appears at the top instead.
 */
function Toasts() {
  const { pathname } = useLocation();
  useEffect(() => { toast.dismiss(); }, [pathname]);
  const lesson = /^\/(lesson|practice|placement)/.test(pathname);
  return lesson
    ? <Toaster key="top" position="top-center" dir="rtl" offset={72} mobileOffset={{ top: 72 }} toastOptions={{ className: 'toast' }} />
    : <Toaster key="bottom" position="bottom-center" dir="rtl" offset={96} mobileOffset={{ bottom: 96 }} toastOptions={{ className: 'toast' }} />;
}

// Each lesson route starts a fresh lesson, so the screen remounts per route.
function LessonRoute() {
  const { pathname, search } = useLocation();
  return <Lesson key={`${pathname}${search}`} />;
}

/** The app's screens. Rendered under a data router so a lesson can ask before the back button leaves it. */
function Root() {
  const role = useApp((s) => s.profile?.role);
  return (
    <>
      <Toasts />
      {/* a new screen opens at the top; back restores where the student was */}
      <ScrollRestoration />
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
    </>
  );
}

const router = createHashRouter([{ path: '*', element: <Root /> }]);

export default function App() {
  useSync();
  return (
    <LazyMotion features={domAnimation} strict>
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
    </LazyMotion>
  );
}
