// The teacher's way into the board (spec TEACHER-1 §5).
// - With a server that sends email codes: a new class is opened with the teacher's email (it is bound to it at once,
//   and no key has to be kept), and "כבר יש לי כיתה" brings the classes of that email back on any device. The key flow
//   (class code and teacher key) stays as a small link, and "להמשיך בלי מייל" leads to it after a clear warning.
// - With a server that has no email set up: new classes use the key flow, with the warning.
// - With no server at all (the public practice site): the page says where the real teacher app is (VITE_TEACHER_URL)
//   or how to ask for it (VITE_CONTACT_EMAIL). It never tells a teacher to set up a server.
// Both offer the demo class (TEACHER-15): "לראות לוח לדוגמה, בלי הרשמה" opens a full board of invented students with
// no server and no sign-in.
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { ArrowRight, Users, Repeat, Hand, ClipboardList, CalendarCheck, Printer } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { api, hasServer } from '@/lib/api.js';
import { useParent, accountCall } from '@/lib/parent.js';
import { myClasses, restore, useEmailSignIn, teacherSiteLink } from '@/lib/teacher.js';
import { openDemo, DEMO_COPY } from '@/lib/demo.js';
import { Button, Field } from '@/components/ui.jsx';
import { Flow, ConfirmSheet } from '@/components/Screen.jsx';
import { GradeSwitch } from '@/components/GradeSwitch.jsx';
import EmailCodeForm from '@/components/account/EmailCodeForm.jsx';
import ClassSettingQuestion, { settingBody, settingReady } from '@/components/teacher/ClassSettingQuestion.jsx';

const TEACHER_URL = import.meta.env.VITE_TEACHER_URL || '';
const CONTACT = String(import.meta.env.VITE_CONTACT_EMAIL || '').trim();
const GRADE = { 7: 'ז׳', 8: 'ח׳' };
const studentsLine = (n) => (!n ? 'עוד בלי תלמידים' : n === 1 ? 'תלמיד אחד' : `${n} תלמידים`);

/** What the teacher's board gives, on the public site's page. */
function WhatTeachersSee() {
  return (
    <section className="set-group" aria-labelledby="t-gives">
      <h2 id="t-gives" className="set-head">מה המורה רואה</h2>
      <ul className="teacher-off-list">
        <li><Users size={20} aria-hidden="true" /><span><b>מי תרגל היום ובשבוע</b>וכמה תשובות נכונות בניסיון ראשון.</span></li>
        <li><Repeat size={20} aria-hidden="true" /><span><b>טעויות שחוזרות בכיתה</b>לפי נושא, עם שמות התלמידים.</span></li>
        <li><Hand size={20} aria-hidden="true" /><span><b>בקשות עזרה</b>עם התרגיל ודף המחברת של התלמיד.</span></li>
        <li><ClipboardList size={20} aria-hidden="true" /><span><b>מבחנים שנבדקו</b>ריבוע לכל שאלה, ונושאים לחיזוק.</span></li>
        <li><CalendarCheck size={20} aria-hidden="true" /><span><b>משימות עם תאריך</b>מדרגה, בדיקת שליטה או מבחן, לכל הכיתה או לקבוצה.</span></li>
        <li><Printer size={20} aria-hidden="true" /><span><b>מבחן תרגול להדפסה</b>עם מפתח תשובות ושתי גרסאות.</span></li>
      </ul>
    </section>
  );
}

/**
 * The public site (built with no server): it is for students' practice. A teacher is sent to the full app, or told the
 * board is not open to everyone yet and how to write to us. Laid out like the onboarding (LAYOUT_SPEC A3/E3).
 */
function PublicTeacherPage({ onBack }) {
  const href = teacherSiteLink(TEACHER_URL);
  return (
    <div className="ob ob-flow teacher-off">
      <header className="ob-top" data-region="header">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="חזרה"><ArrowRight size={26} aria-hidden="true" /></button>
        <span className="ob-top-title">לוח המורה</span>
      </header>
      <main className="ob-main" data-region="content">
        <div className="ob-ask" data-region="question">
          <div className="ob-bubble"><h1 className="ob-bubble-title">{href ? 'לוח המורה נמצא באתר המלא' : 'לוח המורה עוד לא פתוח לכולם'}</h1></div>
        </div>
        {href ? (
          <p className="teacher-off-lead">הכתובת הזו היא גרסת תרגול לתלמידים, בלי שרת. לוח המורה, הכיתות, המשימות וההדפסות נמצאים באתר המלא של מדרגות.</p>
        ) : CONTACT && (
          <p className="teacher-off-lead">רוצים לנסות אותו בכיתה שלכם? כתבו לנו: <a href={`mailto:${CONTACT}`}><bdi dir="ltr">{CONTACT}</bdi></a></p>
        )}
        {/* something real to try even here: the board with a class of invented students, nothing sent (TEACHER-15) */}
        <Button variant="secondary" className="btn-block teacher-off-demo" onClick={openDemo}>{DEMO_COPY.link}</Button>
        <WhatTeachersSee />
      </main>
      <footer className="ob-foot" data-region="footer">
        {href ? (
          <>
            <a className="btn btn-primary btn-block btn-lg" href={href}>ללוח המורה</a>
            <Button variant="ghost" className="btn-block" onClick={onBack}>לנסות את התרגול כתלמידים</Button>
          </>
        ) : <Button className="btn-block btn-lg" onClick={onBack}>לנסות את התרגול כתלמידים</Button>}
      </footer>
    </div>
  );
}

/** One way in, as a big pressable row (the onboarding's answers). */
function Way({ on, onPick, title, sub }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={clsx('ob-opt', on && 'on')} onClick={onPick}>
      <span className="ob-opt-text"><b>{title}</b><span>{sub}</span></span>
    </button>
  );
}

const NO_EMAIL = 'בלי מייל, אפשר להיכנס לכיתה רק עם מפתח המורה. אם המכשיר ילך לאיבוד והמפתח לא נשמר, לא תהיה דרך לחזור לכיתה.';

/**
 * The teacher's way in on a server. One question per screen, as the students' onboarding. The screens:
 *   choose   new class / already have a class / the key link
 *   email    the email code (new class or getting the classes back)
 *   details  the teacher's name, the class name and the grade (a new class)
 *   list     the classes of this email, all ticked, then "כניסה ללוח"
 *   key      the class code and the teacher key (the old way, unchanged)
 * Back goes to the screen before. A sign-in already on this device skips the email screen.
 */
function ServerTeacherStart({ onBack }) {
  const setProfile = useApp((s) => s.setProfile);
  const session = useParent((s) => s.session);
  const emailOn = useEmailSignIn(); // null while the server is asked
  const [stack, setStack] = useState(['choose']);
  const view = stack[stack.length - 1];
  const [way, setWay] = useState('new'); // new | restore
  const [noEmail, setNoEmail] = useState(false); // a new class with the key only
  const [askNoEmail, setAskNoEmail] = useState(false);
  const [f, setF] = useState({ teacherName: '', className: '', grade: '7', setting: 'school', attest: false, code: '', key: '' });
  const [list, setList] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const go = (v, { replace = false } = {}) => { setError(''); setStack((s) => [...(replace ? s.slice(0, -1) : s), v]); };
  const back = () => { setError(''); if (stack.length > 1) setStack((s) => s.slice(0, -1)); else onBack(); };
  const pickedWay = emailOn === false ? 'new' : way;
  // each screen opens at its top
  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  /** The classes of the signed-in email. */
  const loadList = async ({ replace = false } = {}) => {
    setBusy(true); setError('');
    try {
      const cls = await myClasses();
      setList(cls); setPicked(new Set(cls.map((c) => c.code)));
      go('list', { replace });
    } catch (e) {
      if (e.code === 'not_account') { setStack(['choose', 'email']); }
      setError(e.message);
    } finally { setBusy(false); }
  };

  const chooseNext = () => {
    if (pickedWay === 'restore') { if (session) loadList(); else go('email'); return; }
    if (emailOn === false) { setNoEmail(true); go('details'); return; }
    setNoEmail(false);
    go(session ? 'details' : 'email');
  };
  const signedIn = () => { if (pickedWay === 'restore') loadList({ replace: true }); else go('details', { replace: true }); };
  const withoutEmail = () => { setAskNoEmail(false); setNoEmail(true); go('details', { replace: true }); };

  const openClass = async () => {
    setError(''); setBusy(true);
    try {
      // where the class learns (TRUST-11): a school class unless a private group is picked and attested
      const body = { teacherName: f.teacherName.trim(), className: f.className.trim(), grade: f.grade, ...settingBody(f.setting, f.attest) };
      const s = noEmail ? null : useParent.getState().session;
      // signed in: the server binds the class to the email in the same step (owned), and a stale sign-in is refused
      const r = s ? await accountCall('/api/classes', { method: 'POST', body }) : await api('/api/classes', { method: 'POST', body });
      const owned = !!r.owned;
      // a shared computer keeps no key: the class opens there only while the sign-in lasts
      const cls = { code: r.code, key: owned && s?.shared ? null : r.teacherKey, className: r.className, grade: r.grade, fresh: true, createdHere: true, ...(owned ? { owned: true } : {}) };
      setProfile({ role: 'teacher', name: r.teacherName, grade: r.grade, classes: [cls], active: cls.code });
    } catch (e) {
      if (e.code === 'not_account') setStack(['choose', 'email']);
      setError(e.message);
    } finally { setBusy(false); }
  };
  const openByKey = async () => {
    setError(''); setBusy(true);
    try {
      const code = f.code.trim().toUpperCase();
      const d = await api('/api/teacher/dashboard', { headers: { 'X-Class-Code': code, 'X-Teacher-Key': f.key.trim() } });
      // entered with the key: maybe a co-teacher's device, so the board does not offer to bind it (lib/teacher.js openedHere)
      const cls = { code, key: f.key.trim(), className: d.class.name, grade: d.class.grade, createdHere: false };
      setProfile({ role: 'teacher', name: d.class.teacherName, grade: d.class.grade, classes: [cls], active: code });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const openPicked = () => { restore((list || []).filter((c) => picked.has(c.code))); };

  const flow = { label: 'כניסת מורה', onBack: back, step: stack.length - 1 };
  const last = ['details', 'list', 'key'].includes(view);
  const steps = view === 'choose' ? (session || emailOn === false ? 2 : 3) : last ? stack.length : stack.length + 1;
  const err = error && <p className="form-error" role="alert">{error}</p>;

  if (view === 'choose') {
    return (
      <Flow {...flow} steps={steps} className="teacher-flow" ask="שלום! איך נכנסים ללוח המורה?" mood="excited" onSubmit={() => !busy && chooseNext()}
        foot={<Button type="submit" className="btn-block btn-lg" disabled={busy}>{busy ? 'רגע…' : 'המשך'}</Button>}>
        <div className="ob-opts" role="radiogroup" aria-labelledby="flow-q" data-region="answers">
          <Way on={pickedWay === 'new'} onPick={() => setWay('new')} title="פתיחת כיתה חדשה" sub="מקבלים קוד שהתלמידים מצטרפים איתו" />
          {emailOn !== false && <Way on={pickedWay === 'restore'} onPick={() => setWay('restore')} title="כבר יש לי כיתה" sub="נכנסים עם המייל, מכל מכשיר" />}
        </div>
        <p className="ob-links"><button type="button" className="link-btn" onClick={() => go('key')}>יש לי קוד כיתה ומפתח מורה</button></p>
        <p className="ob-links"><button type="button" className="link-btn" onClick={openDemo}>{DEMO_COPY.link}</button></p>
        {err}
      </Flow>
    );
  }

  if (view === 'email') {
    return (
      <Flow {...flow} steps={steps} form={false} className="teacher-flow" ask="מה המייל שלכם?">
        {/* the form's own button is the way on; the other way is a quiet link under it, so the 320px screen keeps both */}
        <div className="ob-field" data-region="answers">
          <EmailCodeForm idPrefix="ts" purpose="teacherAccount" askShared onSignedIn={signedIn} />
          {err}
          <p className="ob-links">{pickedWay === 'new'
            ? <button type="button" className="link-btn" onClick={() => setAskNoEmail(true)}>להמשיך בלי מייל</button>
            : <button type="button" className="link-btn" onClick={() => go('key', { replace: true })}>יש לי קוד כיתה ומפתח מורה</button>}</p>
        </div>
        <ConfirmSheet open={askNoEmail} onOpenChange={setAskNoEmail} title="להמשיך בלי מייל?" keep="חזרה" confirm="להמשיך בלי מייל" mood="idle" onConfirm={withoutEmail}>
          <p>{NO_EMAIL}</p>
        </ConfirmSheet>
      </Flow>
    );
  }

  if (view === 'details') {
    const can = !!(f.teacherName.trim() && f.className.trim()) && settingReady(f.setting, f.attest);
    return (
      <Flow {...flow} steps={steps} className="teacher-flow" ask="איך קוראים לכם ולכיתה?" onSubmit={() => can && !busy && openClass()}
        foot={<Button type="submit" className="btn-block btn-lg" disabled={!can || busy}>{busy ? 'רגע…' : 'פתיחת הכיתה'}</Button>}>
        <div className="ob-field" data-region="answers">
          {/* the name students see: a family name is enough (trust spec TRUST-1 §5) */}
          <Field label="השם שלכם (כך התלמידים יראו אותו)" id="t-name" hint="השם יופיע לתלמידים שמצטרפים עם קוד הכיתה. אפשר לכתוב רק שם משפחה, למשל 'המורה כהן'.">
            <input id="t-name" className="input input-lg" value={f.teacherName} onChange={set('teacherName')} maxLength={30} placeholder="למשל: המורה כהן" aria-describedby="t-name-hint" />
          </Field>
          <Field label="שם הכיתה" id="t-class"><input id="t-class" className="input input-lg" value={f.className} onChange={set('className')} maxLength={30} placeholder="למשל: ז׳3" /></Field>
          <div className="field"><span className="field-label" id="t-grade">שכבה</span><GradeSwitch value={f.grade} onChange={(g) => setF({ ...f, grade: g })} id="t-grade" /></div>
          <ClassSettingQuestion idPrefix="t" setting={f.setting} attest={f.attest} onChange={({ setting, attest }) => setF({ ...f, setting, attest })} />
          {!noEmail && session && <p className="ob-note">הכיתה תישמר בחשבון של <bdi dir="ltr">{session.email}</bdi>.</p>}
          {noEmail && emailOn === false && <p className="ob-note">{NO_EMAIL}</p>}
        </div>
        {err}
      </Flow>
    );
  }

  if (view === 'list') {
    const none = !list?.length;
    return (
      <Flow {...flow} steps={steps} className="teacher-flow" ask={none ? 'עוד אין כיתות במייל הזה' : 'הכיתות שלכם'} mood={none ? 'idle' : 'happy'}
        onSubmit={() => (none ? go('key') : picked.size && openPicked())}
        foot={none ? <Button type="submit" className="btn-block btn-lg">כניסה עם קוד ומפתח</Button>
          : <Button type="submit" className="btn-block btn-lg" disabled={!picked.size}>כניסה ללוח</Button>}>
        {none ? (
          <p className="ob-note" data-region="answers">לא מצאנו כיתות שמקושרות ל־<bdi dir="ltr">{session?.email}</bdi>. אם פתחתם כיתה בלי מייל, נכנסים עם קוד הכיתה ומפתח המורה, ואז מקשרים אותה למייל בהגדרות הכיתה.</p>
        ) : (
          <fieldset className="t-pick" data-region="answers">
            <legend className="visually-hidden">הכיתות שייפתחו בלוח</legend>
            {list.map((c) => (
              <label key={c.code} className="check-row t-pick-row">
                <input type="checkbox" checked={picked.has(c.code)}
                  onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(c.code); else n.delete(c.code); return n; })} />
                <span><b>{c.name}</b> · כיתה {GRADE[c.grade] || c.grade} · {studentsLine(c.students)}</span>
              </label>
            ))}
          </fieldset>
        )}
        {err}
      </Flow>
    );
  }

  // the key flow, as it always was
  const can = f.code.trim().length >= 4 && !!f.key.trim();
  return (
    <Flow {...flow} steps={steps} className="teacher-flow" ask="מה הקוד של הכיתה והמפתח שלכם?" onSubmit={() => can && !busy && openByKey()}
      foot={<Button type="submit" className="btn-block btn-lg" disabled={!can || busy}>{busy ? 'רגע…' : 'כניסה ללוח'}</Button>}>
      <div className="ob-field" data-region="answers">
        <Field label="קוד כיתה" id="t-code"><input id="t-code" className="input input-lg mono" dir="ltr" value={f.code} onChange={set('code')} maxLength={6} /></Field>
        <Field label="מפתח מורה" id="t-key" hint="קיבלתם אותו כשפתחתם את הכיתה."><input id="t-key" className="input input-lg mono" dir="ltr" value={f.key} onChange={set('key')} autoComplete="off" /></Field>
      </div>
      {err}
    </Flow>
  );
}

export default function TeacherStart({ onBack }) {
  return hasServer() ? <ServerTeacherStart onBack={onBack} /> : <PublicTeacherPage onBack={onBack} />;
}
