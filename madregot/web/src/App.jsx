import { lazy, Suspense, useEffect } from 'react';
import { createHashRouter, Navigate, Outlet, Route, RouterProvider, Routes, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { LazyMotion, domAnimation, MotionConfig } from 'motion/react';
import { useApp } from '@/lib/store.js';
import { syncNow, hasServer } from '@/lib/api.js';
import { useMoments, onMoment, MOMENT_ORDER } from '@/lib/durable/moments.js';
import { toAnnounce, markNoticed, focusedRoute, HELP_NOTICE } from '@/lib/help.js';
import { useVaultSync } from '@/lib/durable/vault.js';
import { refreshStatus, refreshIfNewDay } from '@/lib/account.js';
import { qaActive } from '@/lib/qaFixtures.js';
import { useDurable } from '@/lib/durable/useDurable.js';
import { watchPersisted } from '@/lib/durable/persist.js';
import { fetchClassWork, flushWork } from '@/lib/classWork.js';
import { previewBack } from '@/lib/teacher.js';
import { applyTheme } from '@/lib/theme.js';
import LimitSheet from '@/components/LimitSheet.jsx';
import SupportSheet from '@/components/SupportSheet.jsx';
import AIIntro from '@/components/AIIntro.jsx';
import DemoAsk from '@/components/DemoAsk.jsx';
import { useLearnClock } from '@/lib/learnClock.js';
import { loadTopic } from '@/learn/content/index.ts';
import { loadKatex } from '@/components/MathText.jsx';
import BackupNudge from '@/components/durable/BackupNudge.jsx';
import Shell from '@/components/Shell.jsx';
import { ErrorBoundary, LoadingState } from '@/components/Screen.jsx';
import Welcome from '@/screens/Welcome.jsx';
import Learn from '@/screens/Learn.jsx';
import { LessonScreen as Lesson } from '@/lib/lazyScreen.js';
// Screens that are not on the daily path load on demand (the topics, a topic's guide and the quests too: DURABLE-11).
// The lesson is its own file too, fetched ahead of time (lib/lazyScreen.js).
const Topics = lazy(() => import('@/screens/Topics.jsx'));
const Topic = lazy(() => import('@/screens/Topic.jsx'));
const Quests = lazy(() => import('@/screens/Quests.jsx'));
const Assistant = lazy(() => import('@/screens/Assistant.jsx'));
const Me = lazy(() => import('@/screens/Me.jsx'));
const Settings = lazy(() => import('@/screens/Settings.jsx'));
const Report = lazy(() => import('@/screens/Report.jsx'));
const AdvancedSettings = lazy(() => import('@/screens/Settings.jsx').then((m) => ({ default: m.AdvancedSettings })));
// The teacher's screens (the board, the class settings, the lessons, the assistant, the student view's frame): one chunk.
const fromTeacher = (name) => lazy(() => import('@/screens/teacher/teacher.js').then((m) => ({ default: m[name] })));
const Teacher = fromTeacher('Teacher');
const ClassSettings = fromTeacher('ClassSettings');
const TeacherLibrary = fromTeacher('TeacherLibrary');
const TeacherAssistant = fromTeacher('TeacherAssistant');
const TeacherExamNew = fromTeacher('TeacherExamNew');
const TeacherExamSheet = fromTeacher('TeacherExamSheet');
const ClassReport = fromTeacher('ClassReport');
const TeacherGuide = fromTeacher('TeacherGuide');
const PreviewFrame = fromTeacher('PreviewFrame');
const DemoBanner = fromTeacher('DemoBanner');
// The parents' area (its own header, no tab bar) works with or without a profile: one chunk, loaded on demand.
const Parents = lazy(() => import('@/screens/parents/parents.js').then((m) => ({ default: m.Parents })));
const ParentHandoff = lazy(() => import('@/screens/parents/parents.js').then((m) => ({ default: m.ParentHandoff })));
const Legal = lazy(() => import('@/screens/parents/parents.js').then((m) => ({ default: m.Legal })));
// What the app teaches against the Ministry's programme: open to anyone, profile or not.
const Programme = lazy(() => import('@/screens/Programme.jsx'));
// the week a child sent a parent (#/r/<data>): on any phone, with no profile, and with no request (PARENTS-2)
const SharedReport = lazy(() => import('@/screens/parents/parents.js').then((m) => ({ default: m.SharedReport })));
// "יש לי קוד גיבוי": with or without a profile, so it is routed with the parents' area (DURABLE-5)
const Restore = lazy(() => import('@/screens/Restore.jsx'));
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
const ClassExam = lazy(() => import('@/screens/ClassExam.jsx'));

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
 * The teacher's work for a student in a class (TEACHER-5 §2): asked on opening (and the reports left from last time
 * sent), again when the app comes back into view, and at most every 5 minutes while it stays open.
 */
function useClassWork() {
  const token = useApp((s) => s.profile?.token);
  useEffect(() => {
    if (!token || !hasServer()) return undefined;
    flushWork().then(() => fetchClassWork({ force: true }));
    const onShow = () => { if (document.visibilityState === 'visible') fetchClassWork(); };
    document.addEventListener('visibilitychange', onShow);
    const t = setInterval(() => fetchClassWork(), 5 * 60_000);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onShow); };
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
  const lesson = /^\/(lesson|practice|placement)/.test(pathname) || /^\/class\/exam\/[^/]+\/run$/.test(pathname);
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

/**
 * "יש תשובה מהמורה על בקשת העזרה" (TEACHER-6 §4): once per new reply from the teacher (classWork.noticed), on the first
 * screen after the class's work came in, never inside a lesson (it waits for the next screen). "לקריאה" opens the
 * request's thread on the missions screen.
 */
function HelpNotice() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const token = useApp((s) => (s.profile?.role === 'student' ? s.profile?.token : null));
  const help = useApp((s) => s.classWork?.help);
  useEffect(() => {
    if (!token || focusedRoute(pathname)) return;
    const fresh = toAnnounce(useApp.getState().classWork);
    if (!fresh.length) return;
    markNoticed(fresh.map((x) => x.message.id));
    const id = fresh[0].help.id;
    toast('יש תשובה מהמורה על בקשת העזרה', { id: HELP_NOTICE, duration: 10_000, action: { label: 'לקריאה', onClick: () => navigate('/quests', { state: { help: id } }) } });
  }, [token, help, pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/**
 * The teaching content loads one topic at a time, and the lesson screen is its own file (DURABLE-11). After the first
 * screen, when the browser is idle, the lesson and the topic the student worked on last load in the background, so
 * the next lesson opens without a wait.
 */
function usePreloadLastTopic(role) {
  useEffect(() => {
    if (role !== 'student') return undefined;
    const topic = useApp.getState().lastTopic;
    const run = () => { Lesson.preload().catch(() => {}); if (topic) loadTopic(topic).catch(() => {}); };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(run, 2000);
    return () => clearTimeout(id);
  }, [role]);
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

/**
 * Every /teacher screen: opening one ends the student view, so the stored way back is cleared (lib/teacher.js). In the
 * demo class (TEACHER-15) the banner sits above each of them; the student view keeps its own bar, which already says
 * nothing is sent.
 */
function TeacherArea() {
  const { pathname } = useLocation();
  const demo = useApp((s) => s.profile?.demo === true);
  useEffect(() => { previewBack.clear(); }, [pathname]);
  return <>{demo && <DemoBanner />}<Outlet /></>;
}
/**
 * A teacher on a student landing path ("/", "/quests", ...): a student screen of the preview ended there (a check
 * goes to "/", a repair to "/", CheckDone to "/rescue"), so it leads back to where the preview was opened; with no
 * preview open (a bookmark, a typed address) it is the board.
 */
function PreviewHome() {
  return <Navigate to={previewBack.get() || '/teacher'} replace />;
}
const PREVIEW_HOME = ['/', '/quests', '/topics', '/topic/:id', '/rescue', '/rescue/*', '/exams/*', '/me', '/plan', '/assistant', '/settings/*', '/mission', '/placement', '/practice/:id'];

/** Minutes on learning screens for the weekly summary (lib/learnClock.js), counted for a student only. */
function LearnClock() {
  useLearnClock();
  return null;
}

/** The app's screens. Rendered under a data router so a lesson can ask before the back button leaves it. */
function Root() {
  const role = useApp((s) => s.profile?.role);
  useAIStatusBoot();
  usePreloadLastTopic(role);
  return (
    <>
      <Toasts />
      <RestoreToast />
      {role === 'student' && <HelpNotice />}
      {role && <LimitSheet />}
      {role && <SupportSheet />}
      {role && <AIIntro />}
      {role && <StatusWatch />}
      {/* the demo class asked for on a device someone uses: it opens in a new tab (lib/demo.js) */}
      <DemoAsk />
      {/* once in a while, on a calm screen and never in a lesson: keep a backup? (lib/durable/nudge.js says when) */}
      {role === 'student' && <BackupNudge />}
      {role === 'student' && <LearnClock />}
      {/* a new screen opens at the top; back restores where the student was */}
      <ScrollRestoration />
      <ErrorBoundary>
      <Suspense fallback={<LoadingState />}>
      <Routes>
        {/* the parents' area, the legal pages, the programme page, the restore screen and a child's weekly summary come
            first: they open from a QR code, a payment page, an email link, a new phone or a WhatsApp message, on a device
            with no profile at all */}
        <Route path="/parents" element={<Parents mode="home" />} />
        <Route path="/parents/link" element={<Parents mode="link" />} />
        <Route path="/parents/info" element={<ParentHandoff />} />
        <Route path="/cancel" element={<Parents mode="cancel" />} />
        <Route path="/terms" element={<Legal doc="terms" />} />
        <Route path="/privacy" element={<Legal doc="privacy" />} />
        <Route path="/accessibility" element={<Legal doc="accessibility" />} />
        <Route path="/safety" element={<Legal doc="safety" />} />
        <Route path="/programme" element={<Programme />} />
        <Route path="/restore" element={<Restore />} />
        <Route path="/r/:data" element={<SharedReport />} />
        <Route path="/r" element={<SharedReport />} />
        {!role && <Route path="*" element={<Welcome />} />}
        {role === 'teacher' && (
          <>
            {/* the teacher's own screens (TEACHER-2 §1); later items add theirs here */}
            <Route element={<TeacherArea />}>
              <Route path="/teacher" element={<Teacher />} />
              <Route path="/teacher/lessons" element={<TeacherLibrary />} />
              <Route path="/teacher/assistant" element={<TeacherAssistant />} />
              <Route path="/teacher/settings" element={<ClassSettings />} />
              <Route path="/teacher/exam/new" element={<TeacherExamNew />} />
              <Route path="/teacher/exam/:id" element={<TeacherExamSheet />} />
              <Route path="/teacher/report" element={<ClassReport />} />
              <Route path="/teacher/guide/:doc?" element={<TeacherGuide />} />
            </Route>
            {/* the student view: the student screens of a stair, under the "תצוגת תלמיד" bar */}
            <Route element={<PreviewFrame />}>
              <Route path="/learn/:topic/:level" element={<Journey />} />
              <Route path="/learn/:topic/:level/:stage" element={<TeachRoute />} />
              <Route path="/lesson/:topic/:level" element={<LessonRoute />} />
              <Route path="/repair/:topic/:level/:misc" element={<Repair />} />
            </Route>
            <Route path="/teacher/*" element={<Navigate to="/teacher" replace />} />
            <Route path="/subscription" element={<Navigate to="/teacher" replace />} />
            {PREVIEW_HOME.map((p) => <Route key={p} path={p} element={<PreviewHome />} />)}
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
              <Route path="/report" element={<Report />} />
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
              <Route path="/class/exam/:id" element={<ClassExam />} />
            </Route>
            <Route path="/lesson/:topic/:level" element={<LessonRoute />} />
            <Route path="/practice/:id" element={<LessonRoute />} />
            <Route path="/placement" element={<LessonRoute />} />
            <Route path="/learn/:topic/:level/:stage" element={<TeachRoute />} />
            <Route path="/repair/:topic/:level/:misc" element={<Repair />} />
            <Route path="/rescue/check" element={<LessonRoute />} />
            <Route path="/rescue/exam" element={<LessonRoute />} />
            <Route path="/class/exam/:id/run" element={<LessonRoute />} />
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
  // KaTeX is not part of the first download (DURABLE-11): fetched once the first screen is up, never waited for
  useEffect(() => { loadKatex().catch(() => {}); }, []);
  useMoments();
  useSync();
  useClassWork();
  // the backup code's copy keeps in step at the same moments, after the class outbox (lib/durable/vault.js)
  useVaultSync();
  // whether the browser promised to keep the data: read on every open and whenever the app comes back into view
  useEffect(() => watchPersisted(), []);
  // the saved look (Settings, מראה); public/theme-boot.js already applied an explicit choice before the first paint
  useEffect(() => { applyTheme(useApp.getState().prefs?.theme); }, []);
  return (
    <LazyMotion features={domAnimation} strict>
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
    </LazyMotion>
  );
}
