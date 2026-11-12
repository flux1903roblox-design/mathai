// #/a/<id>: the link a teacher shares for one assignment (COUNCIL2-35: Google Classroom, a Moodle URL activity, the
// class's own channel). Routed before the role gate, so it opens on any phone:
//   a student of the class      the stair, the check or the exam opens at once, with ?assignment=<id> (classWork.js
//                               workRoute), as from the missions tab
//   not in the class yet        the class's name and the work, and the join (a name, a 4-digit PIN), then the work
//   another class's student     says so; nothing changes on this phone
//   a teacher                   says the link is the students'
// What the link resolves to comes from GET /api/work/<id>, which knows nothing about any student (worker/src/
// assignments.js publicAssignment): the kind, the stair, the title, the dates, and the class's code, name and grade.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { api, hasServer } from '@/lib/api.js';
import { fetchClassWork, workRoute, dueLine } from '@/lib/classWork.js';
import { afterClassJoin } from '@/lib/durable/escrow.js';
import { joinClass, joinedProfile, ClaimField, CLAIM_COPY } from '@/screens/Welcome.jsx';
import { Button, Field } from '@/components/ui.jsx';
import Mascot from '@/components/Mascot.jsx';
import '@/styles/lazy/links.css';

/** The words of this screen, one place (the e2e test reads them). */
export const OPEN_TEXT = {
  title: 'משימה מהמורה',
  loading: 'פותחים את המשימה…',
  kind: { stair: 'מדרגה', check: 'בדיקת שליטה', exam: 'מבחן תרגול' },
  joinHead: (name) => `מצטרפים לכיתה ${name}`,
  joinLead: 'כדי לפתוח את המשימה, מצטרפים לכיתה עם השם וקוד אישי של 4 ספרות. המורה יראה את ההתקדמות שלכם.',
  joinAs: (name) => `תצטרפו בשם ${name}.`,
  locked: 'הכיתה סגורה כרגע לתלמידים חדשים. מי שכבר בכיתה מתחבר עם השם והקוד האישי.',
  join: 'הצטרפות ופתיחת המשימה',
  joining: 'מצטרפים…',
  otherClass: (name) => `המשימה הזו של כיתה ${name}, והיא נפתחת בטלפונים של התלמידים שם. אתם בכיתה אחרת, ושום דבר כאן לא השתנה.`,
  teacher: 'זה קישור למשימה בשביל התלמידים. בטלפון של תלמיד או תלמידה בכיתה הוא פותח את המשימה.',
  notMine: 'המשימה הזו לא נשלחה אליכם, או שהיא עוד לא התחילה. המשימות שלכם מחכות במסך המשימות.',
  notFound: 'לא מצאנו את המשימה. ייתכן שהמורה מחק אותה.',
  noServer: 'המשימות של הכיתה נפתחות באפליקציה של הכיתה, בכתובת שהמורה נתן.',
  slow: 'היום נפתחו הרבה קישורים מהרשת הזו. אפשר לנסות שוב מחר.',
  offline: 'אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.',
};
const isId = (id) => /^[a-f0-9]{16}$/.test(String(id ?? ''));

/** The assignment, as the link's card shows it: what it is, its title, until when, and whose class. */
function WorkCard({ a, cls }) {
  return (
    <section className="al-card" aria-label="המשימה">
      <p className="al-kind">{OPEN_TEXT.kind[a.kind] || ''}</p>
      <h2 className="al-name">{a.title}</h2>
      <p className="al-meta"><span>{dueLine(a.dueOn)}</span>{cls?.name && <><span aria-hidden="true">·</span><span>כיתה {cls.name}</span></>}</p>
    </section>
  );
}

export default function AssignmentOpen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);
  const server = hasServer();
  const [state, setState] = useState(server && isId(id) ? 'loading' : server ? 'notFound' : 'noServer');
  const [info, setInfo] = useState(null); // { assignment, class }
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [claim, setClaim] = useState(''); const [needClaim, setNeedClaim] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const head = useRef(null);

  const role = profile?.demo === true ? 'teacher' : profile?.role || null;
  const member = (code) => role === 'student' && !!profile?.token && profile?.classCode === code;

  /**
   * A member of the class: the class's work, then the assignment's own route (or why it is not there: not given to this
   * student or not started yet, or no answer from the server and nothing kept on the phone).
   */
  const openAsMember = useCallback(async () => {
    setState('opening');
    const fresh = await fetchClassWork({ force: true });
    const a = (useApp.getState().classWork?.assignments || []).find((x) => x.id === id);
    if (a) { navigate(workRoute(a), { replace: true }); return; }
    setState(fresh ? 'notMine' : 'offline');
  }, [id, navigate]);

  const load = useCallback(async () => {
    if (!server || !isId(id)) return;
    // the demo class's board asks no server (TEACHER-15): the link is the students' all the same
    if (useApp.getState().profile?.demo === true) { setState('teacher'); return; }
    setState('loading');
    try {
      const r = await api(`/api/work/${id}`, { auth: false });
      setInfo(r);
      const p = useApp.getState().profile;
      const who = p?.demo === true ? 'teacher' : p?.role || null;
      if (who === 'teacher') setState('teacher');
      else if (who === 'student' && p?.token && p.classCode === r.class.code) await openAsMember();
      else if (who === 'student' && p?.token) setState('otherClass');
      else setState('join');
    } catch (e) {
      // offline, a class student whose phone has the work already: it opens from what the phone keeps
      const kept = (useApp.getState().classWork?.assignments || []).find((x) => x.id === id);
      if (e?.code === 'network' && kept && useApp.getState().profile?.token) { navigate(workRoute(kept), { replace: true }); return; }
      setState(e?.status === 404 ? 'notFound' : e?.status === 429 ? 'slow' : 'offline');
    }
  }, [server, id, openAsMember, navigate]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (state !== 'loading' && state !== 'opening') head.current?.focus({ preventScroll: true }); }, [state]);

  const join = async (e) => {
    e.preventDefault();
    if (busy || !info) return;
    const who = profile?.role === 'student' ? profile.name : name.trim();
    if (!who) { setError('כתבו את השם שלכם.'); return; }
    if (!/^\d{4}$/.test(pin)) { setError('בחרו קוד אישי של 4 ספרות.'); return; }
    if (needClaim && !claim) { setError(CLAIM_COPY.missing); return; }
    setError(''); setBusy(true);
    try {
      const c = await joinClass({ code: info.class.code, name: who, pin, claim: needClaim ? claim : '' });
      // as Settings joins a class: this device's student, now in the class; a phone with no profile gets one here, with
      // the class's grade (the first questions can wait: the work is what the student came for)
      const base = profile?.role === 'student' ? profile : { role: 'student', name: c.name || who, grade: c.grade || info.class.grade || '7', know: 1 };
      setProfile({ ...base, ...joinedProfile(c), role: 'student' });
      useApp.getState().quietForClass();
      toast.success(c.returning ? `ברוכים השבים לכיתה ${c.className}` : `הצטרפתם לכיתה ${c.className}`);
      // the class's copy comes back (merged with what is here), or this device's code is kept by the class (DURABLE-6)
      afterClassJoin(c).then((r) => { if (r.toast) toast(r.toast); }).catch(() => {});
      await openAsMember();
    } catch (err) {
      if (err?.code === 'claim_code_needed') { setNeedClaim(true); setError(''); }
      else setError(err?.message || OPEN_TEXT.offline);
    } finally { setBusy(false); }
  };

  const home = role === 'teacher' ? '/teacher' : role === 'student' ? '/quests' : '/';
  const homeText = role === 'teacher' ? 'ללוח המורה' : role === 'student' ? 'למשימות שלי' : 'לדף הבית';
  const a = info?.assignment; const cls = info?.class;
  const say = { notFound: OPEN_TEXT.notFound, noServer: OPEN_TEXT.noServer, slow: OPEN_TEXT.slow, notMine: OPEN_TEXT.notMine, teacher: OPEN_TEXT.teacher, otherClass: cls ? OPEN_TEXT.otherClass(cls.name) : '' }[state];

  return (
    <div className="ob ob-flow al-screen">
      <header className="ob-top" data-region="header">
        <button type="button" className="icon-btn" onClick={() => navigate(home, { replace: true })} aria-label="חזרה"><ArrowRight size={26} aria-hidden="true" /></button>
        <h1 className="ob-top-title">{OPEN_TEXT.title}</h1>
      </header>
      <main className="ob-main al-main" data-region="content">
        {(state === 'loading' || state === 'opening') && (
          <p className="al-wait" role="status"><Mascot mood="idle" size={72} />{OPEN_TEXT.loading}</p>
        )}
        {a && state !== 'loading' && state !== 'opening' && <WorkCard a={a} cls={cls} />}

        {state === 'join' && cls && (
          <form className="al-join" onSubmit={join} noValidate aria-labelledby="al-join-h">
            <h2 id="al-join-h" className="al-head" tabIndex={-1} ref={head}>{OPEN_TEXT.joinHead(cls.name)}</h2>
            <p className="al-lead">{OPEN_TEXT.joinLead}</p>
            {!cls.open && <p className="al-note" role="note">{OPEN_TEXT.locked}</p>}
            {profile?.role === 'student'
              ? <p className="al-lead">{OPEN_TEXT.joinAs(profile.name)}</p>
              : (
                <Field label="השם שלכם" id="al-name" hint="השם שהמורה יראה. אם יש בכיתה עוד מישהו עם אותו שם, הוסיפו אות משם המשפחה.">
                  <input id="al-name" className="input input-lg" value={name} maxLength={30} autoComplete="given-name" aria-describedby="al-name-hint"
                    onChange={(e) => { setError(''); setName(e.target.value); }} />
                </Field>
              )}
            {needClaim && <ClaimField id="al-claim" value={claim} onChange={(v) => { setError(''); setClaim(v); }} />}
            <Field label={needClaim ? CLAIM_COPY.pinLabel : 'קוד אישי של 4 ספרות'} id="al-pin" hint={needClaim ? null : 'אם זו הפעם הראשונה, בחרו קוד ותזכרו אותו.'}>
              <input id="al-pin" className="input input-lg mono" dir="ltr" inputMode="numeric" maxLength={4} value={pin} autoComplete="off"
                aria-describedby={needClaim ? undefined : 'al-pin-hint'} onChange={(e) => { setError(''); setPin(e.target.value.replace(/\D/g, '')); }} />
            </Field>
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" className="btn-block btn-lg" disabled={busy} aria-busy={busy || undefined}>{busy ? OPEN_TEXT.joining : OPEN_TEXT.join}</Button>
          </form>
        )}

        {say && (
          <div className="al-say">
            {!a && <Mascot mood="idle" size={96} />}
            <p className="al-lead" tabIndex={-1} ref={head}>{say}</p>
            <Link className="btn btn-primary btn-block btn-lg" to={home} replace>{homeText}</Link>
          </div>
        )}
        {state === 'offline' && (
          <div className="al-say">
            <p className="al-lead" role="alert" tabIndex={-1} ref={head}>{OPEN_TEXT.offline}</p>
            <Button className="btn-block btn-lg" onClick={load}>לנסות שוב</Button>
          </div>
        )}
      </main>
    </div>
  );
}
