// A teacher's way to the tutor when the class has no adult behind it yet (trust spec TRUST-9, the trust review): opening
// a class needs no account, so a teacher key alone proves no adult, and the server answers parent_ok_needed. The teacher
// signs in with an email (a code, no password) and the class is bound to it, once: POST /api/teacher/class/owner with the
// class's key and the session. Then the tutor opens for the class's teacher. The binding is the school lane's (spec
// TEACHER-1, lib/teacher.js bindClass): the class is marked owned on this device, so the board opens with the email too.
import { useState } from 'react';
import { bindClass } from '@/lib/teacher.js';
import { useParent } from '@/lib/parent.js';
import { teacherClass, refreshStatus } from '@/lib/account.js';
import EmailCodeForm from '@/components/account/EmailCodeForm.jsx';
import { Button } from '@/components/ui.jsx';

export const BIND_COPY = Object.freeze({
  intro: 'נכנסים עם המייל שלכם ומקשרים אליו את הכיתה. זה פעם אחת, ואחר כך העוזר החכם פתוח לכם.',
  bind: 'לקשר את הכיתה למייל',
  busy: 'מקשרים…',
  done: (email) => `הכיתה מקושרת עכשיו ל־${email}. העוזר החכם פתוח לכם.`,
  other: 'הכיתה כבר מקושרת למייל אחר. אפשר להיכנס עם המייל הזה.',
  failed: 'לא הצלחנו לקשר עכשיו. אפשר לנסות שוב בעוד רגע.',
});

/** onDone: called after the class is bound (the sheet that holds this closes itself). */
export default function TeacherBind({ onDone }) {
  const session = useParent((s) => s.session);
  const cls = teacherClass();
  const [state, setState] = useState({ phase: 'idle' });
  if (!cls) return null;
  const bind = async () => {
    setState({ phase: 'busy' });
    try {
      const r = await bindClass(cls);
      setState({ phase: 'done', email: r.email });
      await refreshStatus();
      onDone?.();
    } catch (e) {
      setState({ phase: 'error', message: e.code === 'owned_by_other' ? BIND_COPY.other : BIND_COPY.failed });
    }
  };
  if (state.phase === 'done') return <p className="lead" role="status">{BIND_COPY.done(state.email)}</p>;
  return (
    <div className="stack teacher-bind">
      <p className="muted">{BIND_COPY.intro}</p>
      {!session ? (
        <EmailCodeForm idPrefix="tb" purpose="bind" />
      ) : (
        <Button className="btn-block btn-lg" onClick={bind} disabled={state.phase === 'busy'} aria-busy={state.phase === 'busy'}>
          {state.phase === 'busy' ? BIND_COPY.busy : BIND_COPY.bind}
        </Button>
      )}
      {state.phase === 'error' && <p className="form-error" role="alert">{state.message}</p>}
    </div>
  );
}
