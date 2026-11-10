import { lazy, Suspense, useEffect } from 'react';
import { createHashRouter, Navigate, Route, RouterProvider, Routes, ScrollRestoration, useLocation } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { LazyMotion, domAnimation, MotionConfig } from 'motion/react';
import { useApp } from '@/lib/store.js';
import { syncNow, hasServer } from '@/lib/api.js';
import { useMoments, onMoment, MOMENT_ORDER } from '@/lib/durable/moments.js';
import { refreshStatus, refreshIfNewDay } from '@/lib/account.js';
import { qaActive } from '@/lib/qaFixtures.js';
import { useDurable } from '@/lib/durable/useDurable.js';
import { watchPersisted } from '@/lib/durable/persist.js';
import LimitSheet from '@/components/LimitSheet.jsx';
import Shell from '@/components/Shell.jsx';
import { ErrorBoundary, LoadingState } from '@/components/Screen.jsx';
import Welcome from '@/screens/Welcome.jsx';
import Learn from '@/screens/Learn.jsx';
import Topics from '@/screens/Topics.jsx';
import Topic from '@/screens/Topic.jsx';
import Lesson from '@/screens/Lesson.jsx';
import Quests from '@/screens/Quests.jsx';
// Screens that are not on the daily path load on demand.
const Assistant = lazy(() => import('@/screens/Assistant.jsx'));
const Me = lazy(() => import('@/screens/Me.jsx'));
const Settings = lazy(() => import('@/screens/Settings.jsx'));
const AdvancedSettings = lazy(() => import('@/screens/Settings.jsx').then((m) => ({ default: m.AdvancedSettings })));
const Teacher = lazy(() => import('@/screens/Teacher.jsx'));
// The parents' area (its own header, no tab bar) works with or without a profile: one chunk, loaded on demand.
const Parents = lazy(() => import('@/screens/parents/parents.js').then((m) => ({ default: m.Parents })));
const ParentHandoff = lazy(() => import('@/screens/parents/parents.js').then((m) => ({ default: m.ParentHandoff })));
const Legal = lazy(() => import('@/screens/parents/parents.js').then((m) => ({ default: m.Legal })));
const Exams = lazy(() => import('@/screens/Exams.jsx'));
const ExamCheck = lazy(() => import('@/screens/ExamCheck.jsx'));
const ExamResult = lazy(() => import('@/screens/ExamResult.jsx'));
const Plan = lazy(() => import('@/screens/Plan.jsx'));
const Journey = lazy(() => import('@/screens/Journey.jsx'));
const Teach = lazy(() => import('@/screens/Teach.jsx'));
const Repair = lazy(() => import('@/screens/Repair.jsx'));
const Rescue = lazy(() => import('@/screens/Rescue.jsx'));
const NewPracticeExam = lazy(() => import('@/screens/PracticeExam.jsx').then((m) => ({ default: m.NewPracticeExam })));
const PracticeSheet = lazy(() => import('@/screens/PracticeExam.jsx').then((m) => ({ default: m.PracticeSheet })));

/**
 * A class student's answers go to the class server at the app's sync moments (lib/durable/moments.js): when the app
 * opens, after a lesson, every 10 minutes, back online, and when it goes out of view or closes (with keepalive where it
 * can). Opening the app as a class student, or joining a class, sends at once, the levels too.
 */
function useSync() {
  const token = useApp((s) => s.profile?.token);
  useEffect(() => {
    if (!token) return undefined;
    syncNow({ levels: true });
    return onMoment(['boot', 'lesson', 'tick', 'online', 'hidden'], (m) => syncNow({ hidden: m === 'hidden' }), { priority: MOMENT_ORDER.classOutbox });
  }, [token]);
}

/**
 * What the tutor allows on this device today (free taste, family plan, class licence), asked on opening; again when
 * the class, the family link or the server changes.
 */
function useAIStatusBoot() {
  const role = useApp((s) => s.profile?.role);
  const token = useApp((s) => s.profile?.token);
  const active = useApp((s) => s.profile?.active);
  const linked = useApp((s) => s.ai.familyDevice?.token);
  const apiUrl = useApp((s) => s.ai.apiUrl);
  useEffect(() => { if (role && (hasServer() || qaActive())) refreshStatus(); }, [role, token, active, linked, apiUrl]);
}

/**
 * ...and again when the app comes back into view, and on the first screen opened after the day changed (the server's
 * resetsAt, the next midnight in Jerusalem). No timers and no time-zone formatting on the way: a screen change stays cheap.
 */
function StatusWatch() {
  const { pathname } = useLocation();
  useEffect(() => { refreshIfNewDay(); }, [pathname]);
  useEffect(() => {
    const onShow = () => { if (document.visibilityState === 'visible' && hasServer()) refreshStatus(); };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, []);
  return null;
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

/**
 * When the progress came back from the copy on the device (a lost or broken save, lib/durable/storage.js), the app says
 * so once, calmly. It can happen at the start or a moment later, when the copy answers late.
 */
let restoreToastShown = false;
function RestoreToast() {
  const restored = useDurable((s) => s.restoredFrom === 'mirror' && s.restoreNote);
  useEffect(() => {
    if (!restored || restoreToastShown) return;
    restoreToastShown = true;
    toast('החזרנו את ההתקדמות מהעותק שנשמר במכשיר.', { duration: 6000 });
  }, [restored]);
  return null;
}

// Each lesson route starts a fresh lesson, so the screen remounts per route.
function LessonRoute() {
  const { pathname, search } = useLocation();
  return <Lesson key={`${pathname}${search}`} />;
}
// Each teaching stage is its own screen: a new stage starts at its own beginning.
function TeachRoute() {
  const { pathname } = useLocation();
  return <Teach key={pathname} />;
}

/** The app's screens. Rendered under a data router so a lesson can ask before the back button leaves it. */
function Root() {
  const role = useApp((s) => s.profile?.role);
  useAIStatusBoot();
  return (
    <>
      <Toasts />
      <RestoreToast />
      {role && <LimitSheet />}
      {role && <StatusWatch />}
      {/* a new screen opens at the top; back restores where the student was */}
      <ScrollRestoration />
      <ErrorBoundary>
      <Suspense fallback={<LoadingState />}>
      <Routes>
        {/* the parents' area and the legal pages come first: they open from a QR code, a payment page or an email
            link on a device with no profile at all */}
        <Route path="/parents" element={<Parents mode="home" />} />
        <Route path="/parents/link" element={<Parents mode="link" />} />
        <Route path="/parents/info" element={<ParentHandoff />} />
        <Route path="/cancel" element={<Parents mode="cancel" />} />
        <Route path="/terms" element={<Legal doc="terms" />} />
        <Route path="/privacy" element={<Legal doc="privacy" />} />
        <Route path="/accessibility" element={<Legal doc="accessibility" />} />
        {!role && <Route path="*" element={<Welcome />} />}
        {role === 'teacher' && (
          <>
            <Route path="/teacher/*" element={<Teacher />} />
            <Route path="/subscription" element={<Navigate to="/teacher" replace />} />
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
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/advanced" element={<AdvancedSettings />} />
              <Route path="/subscription" element={<Navigate to="/parents/info" replace />} />
              <Route path="/exams" element={<Exams />} />
              <Route path="/exams/check" element={<ExamCheck />} />
              <Route path="/exams/new" element={<NewPracticeExam />} />
              <Route path="/exams/practice/:id" element={<PracticeSheet />} />
              <Route path="/exams/:id" element={<ExamResult />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/learn/:topic/:level" element={<Journey />} />
              <Route path="/mission" element={<Navigate to="/quests" replace />} />
              <Route path="/rescue" element={<Rescue />} />
            </Route>
            <Route path="/lesson/:topic/:level" element={<LessonRoute />} />
            <Route path="/practice/:id" element={<LessonRoute />} />
            <Route path="/placement" element={<LessonRoute />} />
            <Route path="/learn/:topic/:level/:stage" element={<TeachRoute />} />
            <Route path="/repair/:topic/:level/:misc" element={<Repair />} />
            <Route path="/rescue/check" element={<LessonRoute />} />
            <Route path="/rescue/exam" element={<LessonRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
      </Suspense>
      </ErrorBoundary>
    </>
  );
}

const router = createHashRouter([{ path: '*', element: <Root /> }]);

export default function App() {
  useMoments();
  useSync();
  // whether the browser promised to keep the data: read on every open and whenever the app comes back into view
  useEffect(() => watchPersisted(), []);
  return (
    <LazyMotion features={domAnimation} strict>
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
    </LazyMotion>
  );
}
