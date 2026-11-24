import { hasContent, ensureTopics } from '@/learn/content/index.ts';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, Footprints, Target, Layers } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { useApp, STORE_KEY } from '@/lib/store.js';
import { api, hasServer } from '@/lib/api.js';
import { useAIStatus, refreshStatus } from '@/lib/account.js';
import { Button, Field } from '@/components/ui.jsx';
import Mascot from '@/components/Mascot.jsx';
import { LoadingState } from '@/components/Screen.jsx';
import Stairs from '@/components/Stairs.jsx';
import { topicsFor, placementTopicsFor } from '@/content/topics.js';
import { LessonScreen } from '@/lib/lazyScreen.js';
import { KNOW, placementMax } from '@/lib/placementRules.js';
import { Tex } from '@/components/MathText.jsx';
import { GOALS } from '@/lib/quests.js';
import FileRestore from '@/components/durable/FileRestore.jsx';
import RestorePreview from '@/components/durable/RestorePreview.jsx';
import { isStandalone } from '@/lib/durable/install.js';
import { findCode, formatCode } from '@/lib/durable/code.js';
import { afterClassJoin } from '@/lib/durable/escrow.js';
import { defaultBackup } from '@/lib/durable/vault.js';
import { deepLink, countFromLanding } from '@/lib/deepLink.js';
import { canSell } from '@/lib/price.js';
import { needsTeacherAdultStep } from '@/lib/parentGate.js';
import LangPick from '@/components/LangPick.jsx';

import { localized, t as tr, LOCALES } from '@/lib/i18n.js';
/**
 * The first open of the Home Screen app (DURABLE-3): on an iPhone it keeps its data apart from Safari, so the front page
 * says how the progress comes over, first: the backup code with a server, the backup file without one.
 */
export let HOME_BANNER = localized(() => ({
  code: tr('shell.welcome.1'),
  file: tr('shell.welcome.2'),
}), (v) => { HOME_BANNER = v; });

/** The grade's topics in one short line: up to three names, then how many more (it stays on two lines at 320px). */
const topicLine = (g) => { const ts = topicsFor(g).map((t) => t.title); return ts.length <= 3 ? ts.join(', ') : tr('shell.welcome.3', { p0: ts.slice(0, 3).join(', '), p1: ts.length - 3 }); };

// A taste of each level, so the choice is about real maths and not a feeling: grade 7 (signed numbers,
// coordinates, angles) and grade 8 (linear functions, Pythagoras, statistics), from the first stair to the last.
const KNOW_SAMPLE = {
  7: ['-3 + 5', '(-2)\\cdot(-4)', 'A(-3,\\,2)', '\\alpha + 2\\alpha = 180^\\circ'],
  8: ['y = 2x + 1', '3^2 + 4^2', '\\bar{x}:\\ 4, 6, 8', 'm = \\tfrac{8-2}{3-1}'],
};

export { GradeSwitch } from '@/components/GradeSwitch.jsx';

/**
 * Join a class (or come back to it with the personal PIN). `claim`: the one-time code the teacher gave after resetting
 * the student's PIN (COUNCIL2-25), sent only once the server asked for it (claim_code_needed). `vault`: the code the class
 * kept for a returning student (DURABLE-6), handed to durable/escrow.js afterClassJoin() and never kept in the profile.
 */
export async function joinClass({ code, name, pin, claim = '' }) {
  const c = cleanClaim(claim);
  const r = await api(`/api/classes/${code.trim().toUpperCase()}/join`, { method: 'POST', body: { name, pin, ...(c ? { claim: c } : {}) } });
  return { classCode: r.classCode, className: r.className, grade: r.grade, token: r.token, studentId: r.studentId, name: r.name, returning: r.returning, ...(r.vault?.code ? { vault: { code: r.vault.code } } : {}) };
}
/** A claim code as typed: capitals and digits only, at most 6 (spaces, dashes and other marks dropped). */
export const cleanClaim = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
/** The words around the teacher's one-time code, after a PIN reset (COUNCIL2-25): plain, calm, no hurry. */
export let CLAIM_COPY = localized(() => ({
  note: tr('shell.welcome.4'),
  // the server asked for the teacher's code because of many wrong PINs under this name today, not after a reset
  noteMany: tr('shell.welcome.claim.many'),
  label: tr('shell.welcome.5'),
  hint: tr('shell.welcome.6'),
  pinLabel: tr('shell.welcome.7'),
  missing: tr('shell.welcome.8'),
}), (v) => { CLAIM_COPY = v; });
/** Why the server asked for the teacher's code (the answer to a join): 'many' wrong PINs today, else a 'reset'. */
export const claimReason = (err) => (err?.data?.reason === 'many_wrong' ? 'many' : 'reset');
/**
 * The teacher's one-time code, shown once the server answered claim_code_needed: the student's PIN was reset, or
 * (`why` 'many') there were many wrong PINs under this name today and this device is not one the student signed in
 * from. The note is a status, so a screen reader says why a field appeared; the field takes focus.
 */
export function ClaimField({ id, value, onChange, why }) {
  return (
    <>
      <p className="ob-note" role="status">{why === 'many' ? CLAIM_COPY.noteMany : CLAIM_COPY.note}</p>
      <Field label={CLAIM_COPY.label} id={id} hint={CLAIM_COPY.hint}>
        <input id={id} className="input mono" dir="ltr" value={value} onChange={(e) => onChange(cleanClaim(e.target.value))} maxLength={12}
          autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-describedby={`${id}-hint`} autoFocus />
      </Field>
    </>
  );
}
/** What of a join goes into the profile (never the kept code). */
export const joinedProfile = ({ vault, returning, ...c }) => c; // eslint-disable-line no-unused-vars
/** The sentence under the class step: the class keeps a copy (DURABLE-6), said without "מוצפן". */
export let CLASS_COPY_NOTE = localized(() => tr('shell.welcome.9'), (v) => { CLASS_COPY_NOTE = v; });

let GRADE_NAME = localized(() => ({ 7: tr('shell.welcome.10'), 8: tr('shell.welcome.11') }), (v) => { GRADE_NAME = v; });

/**
 * Under the PIN field once a class code is typed (trust spec TRUST-12 §3). The first to join a class takes a name, so
 * the step says which name the teacher will see, and how to tell two children with the same name apart.
 */
export const nameClaimHint = (name) => tr('shell.welcome.12', { p0: String(name || '').replace(/\s+/g, ' ').trim().slice(0, 30) });

/** One answer on an onboarding screen: a big pressable row. */
function Option({ on, onPick, title, sub, glyph, aside, badge }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={clsx('ob-opt', on && 'on')} onClick={onPick}>
      {glyph && <span className="ob-opt-glyph" aria-hidden="true">{glyph}</span>}
      <span className="ob-opt-text"><b>{title}{badge && <span className="ob-badge">{badge}</span>}</b>{sub && <span>{sub}</span>}</span>
      {aside && <span className="ob-opt-aside">{aside}</span>}
    </button>
  );
}

// a link from a landing page (lib/deepLink.js) lands here after the first questions; the last button says where
let NEXT_CTA = localized(() => ({ '/rescue': tr('shell.welcome.13'), '/quests': tr('shell.welcome.14'), '/parents': tr('shell.welcome.15') }), (v) => { NEXT_CTA = v; });

/**
 * After "delete all" (lib/wipe.js) the app reloads at ?wiped=1 (the device and the server) or ?wiped=device (this
 * device only): the front page says so once, as a status line, and the parameter leaves the address at once, so a
 * reload or a shared link does not say it again (trust spec TRUST-6 §4).
 */
export let WIPED_TEXT = localized(() => ({ 1: tr('shell.welcome.16'), device: tr('shell.welcome.17') }), (v) => { WIPED_TEXT = v; });
function useWiped() {
  const [wiped] = useState(() => {
    try { const w = new URLSearchParams(window.location.search).get('wiped'); return w && WIPED_TEXT[w] ? w : null; } catch { return null; }
  });
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      if (!u.searchParams.has('wiped')) return;
      u.searchParams.delete('wiped');
      window.history.replaceState(window.history.state, '', `${u.pathname}${u.search}${u.hash}`);
    } catch { /* the address keeps it: the line shows again on a reload, nothing else */ }
  }, []);
  return wiped;
}

/** The questions of the first visit, in order: the class code only with a server, the start only without a landing link. */
export const onboardingSteps = ({ server, next }) => ['name', 'grade', 'know', 'goal', ...(server ? ['class'] : []), ...(next ? [] : ['start'])];

/** How מדי looks beside each question (PRODUCT2-41): he asks the name excited, then listens, thinks and cheers. */
const ASK_MOOD = { name: 'excited', grade: 'happy', know: 'thinking', goal: 'happy', class: 'idle', start: 'encouraging' };

/**
 * First time on the app: a few short questions, one per screen, then a choice
 * between a placement test and starting from the first stair. With `next` (a landing page's link, e.g. /rescue) there
 * is no such choice: after the questions the student goes straight there. `at`: the screen it opens on (-1, the hello
 * screen; a test opens a question).
 */
export function Onboarding({ onTeacher, onRestore, next = null, at = -1 }) {
  const navigate = useNavigate();
  const wiped = useWiped();
  const setProfile = useApp((s) => s.setProfile);
  const setGoalXp = useApp((s) => s.setGoalXp);
  const server = hasServer();
  const steps = onboardingSteps({ server, next });
  const [i, setI] = useState(at); // -1: the hello screen
  const [f, setF] = useState({ name: '', grade: null, know: null, goal: 20, code: '', pin: '', claim: '', start: null });
  // the server asked for the teacher's one-time code: this name's PIN was reset (COUNCIL2-25)
  const [needClaim, setNeedClaim] = useState(false);
  const [joined, setJoined] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const step = steps[i];
  const set = (patch) => { setError(''); setF((v) => ({ ...v, ...patch })); };
  const grade = joined?.grade || f.grade || '7';
  const recommended = (f.know ?? 1) >= 1 ? 'test' : 'scratch';
  // "everything is new to me": the basics under the grade (fractions, multiplication facts) can be checked first. It is
  // offered, never recommended: most students who say so only mean the grade's material.
  const floorOffered = f.know === 0;
  const start = f.start === 'floor' && !floorOffered ? recommended : f.start || recommended;

  // j: the class just joined (the state may not have caught up when the class question is the last one)
  const finish = (j = joined) => {
    setGoalXp(f.goal);
    setProfile({ role: 'student', name: j?.name || f.name.trim(), grade: j?.grade || grade, know: f.know ?? 1, ...(j ? joinedProfile(j) : {}) });
    if (j) useApp.getState().quietForClass(); // a classroom is quiet: sounds start off (STUDENT-7)
    // a class keeps this student's code (DURABLE-6): made in the background once the profile is here, never in the way.
    // A student on their own gets the backup on by default (COUNCIL2-24): the same, with the code kept only here; Learn
    // says once what it is, and Settings stops it.
    if (j) afterClassJoin(j).then((r) => { if (r.toast) toast(r.toast); });
    else defaultBackup().catch(() => { /* the backup stays off; the reminder on a calm screen offers it again */ });
    if (next) { navigate(next, { replace: true }); return; }
    // "to the first lesson" opens it: the first stair of the grade's first topic
    // from the first stair: it starts by understanding (the stair's first teaching stage), not with exercises
    const first = topicsFor(grade)[0].id;
    navigate(start === 'test' ? '/placement' : start === 'floor' ? '/floor' : hasContent(`${first}:1`) ? `/learn/${first}/1/A` : `/lesson/${first}/1?part=1`, { replace: true });
  };
  // each question of the first visit opens at its top
  useEffect(() => { window.scrollTo(0, 0); }, [i]);
  // Once the grade is known, the start the questions lead to (the placement test, or the grade's first lesson) is fetched
  // while the last questions are answered: the lesson screen and its topics' teaching and exercise generators, none of
  // which is in the first download (the boot split). When the browser is idle; a topic already loaded costs nothing.
  const gradeKnown = !!(joined?.grade || f.grade) && i > steps.indexOf('grade');
  useEffect(() => {
    if (!gradeKnown || next) return undefined;
    const run = () => {
      LessonScreen.preload().catch(() => {});
      ensureTopics(placementTopicsFor(grade).map((t) => t.id)).catch(() => {});
    };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(run, 1500);
    return () => clearTimeout(id);
  }, [gradeKnown, grade, next]);
  // The parents' links (and the cancel link) are for a server that sells the tutor: they show once the server says
  // the switch is on, or when a parent already signed in on this device. With AI_PAYWALL off there is nothing to
  // join or cancel.
  const status = useAIStatus((x) => x.status);
  useEffect(() => { if (server && !useAIStatus.getState().status) refreshStatus(); }, [server]);
  const parentHere = (() => { try { return !!(localStorage.getItem(`${STORE_KEY}-parent`) || sessionStorage.getItem(`${STORE_KEY}-parent`)); } catch { return false; } })();
  // a store app sells nothing, so its first screen has no way to the parents' or the cancel page (STUDENT-12)
  const billing = server && canSell() && (status?.paywall === true || parentHere);

  const go = async () => {
    if (step === 'name' && !f.name.trim()) { setError(tr('shell.welcome.18')); return; }
    let j = joined;
    if (step === 'class' && f.code.trim() && !joined) {
      if (!/^\d{4}$/.test(f.pin)) { setError(tr('shell.welcome.19')); return; }
      if (needClaim && !f.claim) { setError(CLAIM_COPY.missing); return; }
      setBusy(true);
      try {
        const c = await joinClass({ code: f.code, name: f.name.trim(), pin: f.pin, claim: needClaim ? f.claim : '' });
        if (c.vault && await rejoin(c)) return;
        j = { ...c, vault: undefined };
        setJoined(j);
        toast.success(c.returning ? tr('shell.welcome.20', { className: c.className }) : tr('shell.welcome.21', { className: c.className }));
      } catch (err) {
        // not an error to fix: the field for the teacher's code appears, with its note
        if (err.code === 'claim_code_needed') { setNeedClaim(claimReason(err)); setError(''); return; }
        setError(err.message); return;
      } finally { setBusy(false); }
    }
    if (i === steps.length - 1) { finish(j); return; }
    setError(''); setI(i + 1);
  };
  const back = () => { setError(''); setI(i - 1); };
  // A returning class student whose class kept their code (DURABLE-6): the progress comes back and the app opens on the
  // map, with no more questions. The profile is made first (this student, this class, the goal just chosen), in the same
  // moment as the merge, so the map never shows an empty start. Resolves false when the copy could not be read: then
  // the questions go on, and a new copy is kept at the end.
  const rejoin = async (c) => {
    const base = { role: 'student', name: c.name || f.name.trim(), grade: c.grade || grade, know: f.know ?? 1 };
    const r = await afterClassJoin(c, { keep: false, before: () => { setGoalXp(f.goal); setProfile({ ...base, ...joinedProfile(c) }); } });
    if (!r.restored) return false;
    toast.success(r.toast);
    return true;
  };
  const standalone = isStandalone();
  // "להדביק קוד גיבוי": the code from the clipboard when the browser lets us read it there (straight from the tap), else
  // the restore screen with an empty field. Only a code is taken from the clipboard, never other text.
  const pasteCode = async () => {
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch { /* not allowed here: it is typed instead */ }
    const code = findCode(text);
    navigate('/restore', code ? { state: { paste: formatCode(code) } } : undefined);
  };

  if (i < 0) {
    // the first screen, laid out like Duolingo's: the character large in the middle, the name and one line under
    // him, and the two ways in as full-width buttons pinned to the bottom
    return (
      <div className={clsx('ob ob-hello hello-duo', standalone && 'hello-standalone')}>
        {/* the language, before anything else (COUNCIL2-34): עברית or العربية. Only in a build that has two languages
            (VITE_ARABIC=on): the default build has no row at all, so the screen is laid out as it was before it */}
        {Object.keys(LOCALES).length > 1 && <div className="hello-top"><LangPick /></div>}
        <main className="hello-center" data-region="content">
          {wiped && <p className="hello-wiped" role="status"><Check size={20} aria-hidden="true" /><span>{WIPED_TEXT[wiped]}</span></p>}
          <Mascot mood="excited" size={168} className="hello-madi" />
          <p className="hello-brand"><span className="wordmark">{tr('shell.welcome.22')}</span></p>
          <h1 className="hello-title">{tr('shell.welcome.23')}<br />{tr('shell.welcome.24')}</h1>
          <p className="hello-fact">{tr('shell.welcome.25')}</p>
        </main>
        <footer className="hello-foot" data-region="footer">
          {/* the Home Screen app's first open: how the progress comes over from Safari, before anything else */}
          {standalone && (
            <section className="hello-home" aria-label={tr('shell.welcome.26')}>
              <p>{server ? HOME_BANNER.code : HOME_BANNER.file}</p>
              <Button className="btn-block" onClick={server ? pasteCode : onRestore}>{server ? tr('shell.welcome.27') : tr('shell.welcome.28')}</Button>
            </section>
          )}
          <Button variant={standalone ? 'secondary' : 'primary'} className="btn-block btn-lg" onClick={() => setI(0)}>{tr('shell.welcome.29')}</Button>
          <Button variant={standalone ? 'ghost' : 'secondary'} className="btn-block" onClick={onTeacher}>{tr('shell.welcome.30')}</Button>
          {/* a backup file works with no server and no account, so it is on every build; the backup code needs the
              server (in the Home Screen app the banner above is its way in) */}
          <div className="hello-restores">
            {server && !standalone && <Button variant="ghost" className="hello-restore" onClick={() => navigate('/restore')}>{tr('shell.welcome.31')}</Button>}
            <Button variant="ghost" className="hello-restore" onClick={onRestore}>{tr('shell.welcome.32')}</Button>
          </div>
          {/* the site's front page (trust spec TRUST-2 §7): the privacy notice, the accessibility statement and the AI
              safety statement always (each page renders without a server); while the tutor is sold, also the parents'
              page, the terms, and the dedicated cancel link with how to cancel beside it (Consumer Protection Law
              s.14ט(ב), (ה)(2)). Every device without a profile opens here, the parent's own phone too. */}
          <nav className="hello-legal" aria-label={billing ? tr('shell.welcome.33') : tr('shell.welcome.34')}>
            {billing && <Link to="/parents">{tr('shell.welcome.35')}</Link>}
            {billing && <Link to="/cancel" aria-describedby="hello-cancel-how">{tr('shell.welcome.36')}</Link>}
            {billing && <Link to="/terms">{tr('shell.welcome.37')}</Link>}
            <Link to="/privacy">{tr('shell.welcome.38')}</Link>
            <Link to="/accessibility">{tr('shell.welcome.39')}</Link>
            <Link to="/safety">{tr('shell.welcome.40')}</Link>
          </nav>
          {billing && <p id="hello-cancel-how" className="hello-legal-note">{tr('shell.welcome.41')}</p>}
        </footer>
      </div>
    );
  }

  const can = { name: !!f.name.trim(), grade: !!f.grade, know: f.know != null, goal: !!f.goal, class: true, start: true }[step];
  const ask = {
    name: tr('shell.welcome.42'),
    grade: tr('shell.welcome.43', { p0: f.name.trim() }), // no pronoun right after the name (STUDENT-9 §5)
    know: tr('shell.welcome.44', { p0: GRADE_NAME[grade] }),
    goal: tr('shell.welcome.45'),
    class: tr('shell.welcome.46'),
    start: tr('shell.welcome.47'),
  }[step];
  const last = i === steps.length - 1;
  const cta = step === 'class' ? (joined ? (last && next ? NEXT_CTA[next] : tr('shell.welcome.48')) : f.code.trim() ? tr('shell.welcome.49') : last && next ? NEXT_CTA[next] : tr('shell.welcome.50'))
    : step === 'start' ? ({ test: tr('shell.welcome.51'), floor: tr('shell.welcome.52') }[start] || tr('shell.welcome.53')) : last && next ? NEXT_CTA[next] : tr('shell.welcome.48');

  return (
    <form className="ob" onSubmit={(e) => { e.preventDefault(); if (can && !busy) go(); }} noValidate>
      <header className="ob-top" data-region="header">
        <button type="button" className="icon-btn" onClick={back} aria-label={tr('shell.welcome.54')}><ArrowRight size={26} aria-hidden="true" /></button>
        <div className="ob-bar" role="progressbar" aria-label={tr('shell.welcome.55')} aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={i + 1}>
          <i style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
        </div>
      </header>
      <main className="ob-main" data-region="content">
        {/* מדי asks: small, beside his question, so the screen is not a lone sentence over a blank page (PRODUCT2-41); the
            question is the screen's heading (PKG-1) */}
        <div className="ob-ask ob-ask-madi" data-region="question">
          <Mascot mood={ASK_MOOD[step] || 'happy'} size={64} className="ob-madi" />
          <h1 className="ob-bubble" id="ob-q">{ask}</h1>
        </div>

        {step === 'name' && (
          <div className="ob-field">
            <label htmlFor="w-name" className="visually-hidden">{tr('shell.welcome.56')}</label>
            <input id="w-name" className="input input-lg" value={f.name} onChange={(e) => set({ name: e.target.value })} autoComplete="given-name" maxLength={30} placeholder={tr('shell.welcome.57')} autoFocus enterKeyHint="next" aria-describedby="w-name-hint" />
            {/* where the name is kept (trust spec TRUST-1 §5) */}
            <p className="ob-note" id="w-name-hint">{tr('shell.welcome.58')}</p>
          </div>
        )}
        {step === 'grade' && (
          <div className="ob-opts" role="radiogroup" aria-labelledby="ob-q">
            {['7', '8'].map((g) => (
              <Option key={g} on={f.grade === g} onPick={() => set({ grade: g, start: null })} title={GRADE_NAME[g]} sub={topicLine(g)}
                glyph={<span className="ob-grade">{g === '7' ? tr('shell.welcome.59') : tr('shell.welcome.60')}</span>} />
            ))}
          </div>
        )}
        {step === 'know' && (
          <div className="ob-opts" role="radiogroup" aria-labelledby="ob-q">
            {KNOW.map((k) => (
              <Option key={k.id} on={f.know === k.id} onPick={() => set({ know: k.id, start: null })} title={k.title} sub={k.sub}
                glyph={<Stairs steps={4} done={k.id + 1} />}
                aside={<span className="ob-sample" title={tr('shell.welcome.61')}><Tex tex={(KNOW_SAMPLE[grade] || KNOW_SAMPLE[7])[k.id]} /></span>} />
            ))}
          </div>
        )}
        {step === 'goal' && (
          <div className="ob-opts" role="radiogroup" aria-labelledby="ob-q">
            {GOALS.map((g) => (
              <Option key={g.xp} on={f.goal === g.xp} onPick={() => set({ goal: g.xp })} title={tr('shell.welcome.62', { mins: g.mins })} sub={g.label}
                aside={<bdi dir="ltr">{g.xp} XP</bdi>} badge={g.xp === 20 ? tr('shell.welcome.63') : null} />
            ))}
            <p className="ob-note">{tr('shell.welcome.64')}</p>
          </div>
        )}
        {step === 'class' && (
          <div className="ob-field">
            {joined ? (
              <p className="ob-joined" role="status"><Check size={20} strokeWidth={3} aria-hidden="true" />{tr('shell.welcome.65')}{joined.className}{joined.teacherName ? tr('shell.welcome.66', { teacherName: joined.teacherName }) : ''}.</p>
            ) : (
              <>
                {/* what joining keeps on the server, and where it says more (trust spec TRUST-1 §5); the link opens in a new tab,
                    so nothing typed here is lost */}
                <p className="ob-note">{tr('shell.welcome.67')}{CLASS_COPY_NOTE}{' '}
                  <Link to="/privacy" target="_blank" rel="noopener noreferrer">{tr('shell.welcome.68')}<span className="visually-hidden">{tr('shell.welcome.69')}</span></Link>
                </p>
                <Field label={tr('shell.welcome.70')} id="w-code">
                  <input id="w-code" className="input mono" dir="ltr" value={f.code} onChange={(e) => { setNeedClaim(false); set({ code: e.target.value.toUpperCase() }); }} maxLength={6} autoCapitalize="characters" autoComplete="off" placeholder={tr('shell.welcome.71')} />
                </Field>
                {f.code.trim() && (
                  <>
                    {needClaim && <ClaimField id="w-claim" why={needClaim} value={f.claim} onChange={(claim) => set({ claim })} />}
                    <Field label={needClaim ? CLAIM_COPY.pinLabel : tr('shell.welcome.72')} id="w-pin" hint={needClaim ? null : tr('shell.welcome.73')}>
                      <input id="w-pin" className="input mono" dir="ltr" inputMode="numeric" pattern="\d{4}" maxLength={4} value={f.pin} onChange={(e) => set({ pin: e.target.value.replace(/\D/g, '') })} autoComplete="off" />
                    </Field>
                    {/* the first to join takes a name (trust spec TRUST-12 §3): say which name the teacher will see */}
                    {!needClaim && <p className="ob-note ob-name-claim">{nameClaimHint(f.name)}</p>}
                  </>
                )}
              </>
            )}
          </div>
        )}
        {step === 'start' && (
          <div className="ob-opts" role="radiogroup" aria-labelledby="ob-q">
            <Option on={start === 'test'} onPick={() => set({ start: 'test' })} title={tr('shell.welcome.74')} badge={recommended === 'test' ? tr('shell.welcome.75') : null}
              sub={tr('shell.welcome.76', { p0: placementMax(grade) })} glyph={<Target size={30} strokeWidth={2.4} />} />
            <Option on={start === 'scratch'} onPick={() => set({ start: 'scratch' })} title={tr('shell.welcome.77')} badge={recommended === 'scratch' ? tr('shell.welcome.75') : null}
              sub={tr('shell.welcome.78')} glyph={<Footprints size={30} strokeWidth={2.4} />} />
            {floorOffered && (
              <Option on={start === 'floor'} onPick={() => set({ start: 'floor' })} title={tr('shell.welcome.79')}
                sub={tr('shell.welcome.80')} glyph={<Layers size={30} strokeWidth={2.4} />} />
            )}
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
      </main>
      <footer className="ob-foot" data-region="footer">
        <Button type="submit" className="btn-block btn-lg" disabled={!can || busy}>{busy ? tr('shell.welcome.81') : cta}</Button>
      </footer>
    </form>
  );
}

// The teacher's way in (sign-in by email, the classes on any device, the key flow, and the public site's page) is its
// own screen: screens/teacher/TeacherStart.jsx, loaded when a teacher asks for it.
const TeacherStart = lazy(() => import('./teacher/TeacherStart.jsx'));
// the adult step (TRUST-8's AdultGate) with the teacher's words, loaded only on a device that needs it (COUNCIL2-5)
const TeacherAdultGate = lazy(() => import('@/components/account/AdultGate.jsx').then((m) => ({ default: (p) => <m.default {...p} copy={m.TEACHER_ADULT_COPY} /> })));

/**
 * "אני מורה" on a device a student used (a profile that signed out here, or a child's device a parent linked): the
 * parents' birth-year step comes first (COUNCIL2-5). A speed bump, as for the parents' area: the server's checks are
 * the email code and the teacher's 18+ declaration. Back goes to the first screen.
 */
function TeacherAdultStep({ onPass, onBack }) {
  return (
    <div className="ob ob-flow teacher-adult">
      <header className="ob-top" data-region="header">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={tr('shell.welcome.54')}><ArrowRight size={26} aria-hidden="true" /></button>
        <span className="ob-top-title">{tr('shell.welcome.82')}</span>
      </header>
      <main className="ob-main" data-region="content">
        <Suspense fallback={<LoadingState />}><TeacherAdultGate onPass={onPass} onBack={onBack} /></Suspense>
      </main>
    </div>
  );
}

/**
 * "יש לי קובץ גיבוי" on a new device (DURABLE-4): choose the file, see what it holds, continue from it. Once the
 * progress is in, the app shows the map (the profile came with it). It needs no server.
 */
function RestoreStart({ onBack }) {
  const [found, setFound] = useState(null);
  useEffect(() => { window.scrollTo(0, 0); }, [found]);
  return (
    <div className="ob ob-flow restore-start">
      <header className="ob-top" data-region="header">
        <button type="button" className="icon-btn" onClick={found ? () => setFound(null) : onBack} aria-label={tr('shell.welcome.54')}><ArrowRight size={26} aria-hidden="true" /></button>
        <span className="ob-top-title">{tr('shell.welcome.83')}</span>
      </header>
      <main className="ob-main" data-region="content">
        {found ? (
          <RestorePreview backup={found} heading="h1" onCancel={() => setFound(null)} />
        ) : (
          <>
            <div className="ob-ask" data-region="question">
              <div className="ob-bubble"><h1 className="ob-bubble-title">{tr('shell.welcome.84')}</h1></div>
            </div>
            <p className="restore-hint">{tr('shell.welcome.85')}<bdi>madregot</bdi>.</p>
            <FileRestore onLoaded={setFound} />
          </>
        )}
      </main>
    </div>
  );
}

/**
 * The first screen with no profile: the student's onboarding, the teacher's way in, or a restore from a backup file. A
 * link to the app with ?start=teacher (the public site's "ללוח המורה") or ?role=teacher (the landing pages) opens the
 * teacher's way in; ?start=demo opens the demo class (TEACHER-15); ?next=/rescue (the parents' landing page,
 * STUDENT-13) takes a new student there after the first questions.
 */
export default function Welcome() {
  const [params, setParams] = useSearchParams();
  // #/?start=demo reached inside the app (on opening, lib/demo.js bootDemo already did it): the demo class, here. The
  // demo's code is a file of its own, loaded only then (FOLLOWUP-23).
  const wantsDemo = params.get('start') === 'demo';
  useEffect(() => { if (wantsDemo) import('@/lib/demo.js').then((m) => m.openDemo()); }, [wantsDemo]);
  // a landing page's link (STUDENT-13, lib/deepLink.js): ?next=/rescue&src=mivchan, or ?start=teacher&src=pilot; the
  // place and the source are read once, on arrival (the source is counted once)
  const [link] = useState(() => deepLink(`?${params}`));
  useEffect(() => { countFromLanding(link); }, [link]);
  const asked = deepLink(`?${params}`).teacher;
  const [mode, setMode] = useState(asked ? 'teacher' : null); // null: the first visit; 'teacher'; 'restore'
  // the adult step before the teacher's way in, on a device a student used (COUNCIL2-5)
  const [adultOk, setAdultOk] = useState(false);
  const back = () => { setMode(null); setAdultOk(false); if (asked) setParams({}, { replace: true }); };
  if (mode === 'restore') return <RestoreStart onBack={() => setMode(null)} />;
  if (mode !== 'teacher' && !asked) return <Onboarding onTeacher={() => setMode('teacher')} onRestore={() => setMode('restore')} next={link.next} />;
  if (!adultOk && needsTeacherAdultStep(useApp.getState())) return <TeacherAdultStep onPass={() => setAdultOk(true)} onBack={back} />;
  return <Suspense fallback={<LoadingState />}><TeacherStart onBack={back} /></Suspense>;
}
