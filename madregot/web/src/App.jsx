import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useApp } from '@/lib/store.js';
import { syncNow } from '@/lib/api.js';
import Shell from '@/components/Shell.jsx';
import Welcome from '@/screens/Welcome.jsx';
import Today from '@/screens/Today.jsx';
import Topics from '@/screens/Topics.jsx';
import Topic from '@/screens/Topic.jsx';
import Practice from '@/screens/Practice.jsx';
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

// A new topic or level starts a new session, so the screen remounts per route.
function PracticeRoute() {
  const { id } = useParams(); const { search } = useLocation();
  return <Practice key={`${id}${search}`} />;
}

export default function App() {
  const role = useApp((s) => s.profile?.role);
  useSync();
  return (
    <HashRouter>
      <Toaster position="top-center" dir="rtl" toastOptions={{ className: 'toast' }} />
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
              <Route path="/" element={<Today />} />
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
            <Route path="/practice/:id" element={<PracticeRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
      </Suspense>
    </HashRouter>
  );
}
