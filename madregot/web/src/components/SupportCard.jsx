// People a child can talk to (trust spec TRUST-3 §3.5, Appendix E.1): a trusted adult first, then free services with
// one tap each (a phone number is a tel: link, a WhatsApp entry a wa.me link). Madi waits beside it, still: no
// animation, no hurry. Shown under a message that reads as distress, under a care reply or result, in the help sheet,
// and in the sheet the quiet link "צריכים לדבר עם מישהו?" opens. Works with no network: nothing here needs the server
// except the class student's own choice to ask the teacher for a talk.
import { useState } from 'react';
import clsx from 'clsx';
import { Phone, MessageCircle, Globe } from 'lucide-react';
import { SUPPORT } from '@shared/safety.js';
import { supportLines } from '@/content/support.js';
import { useApp } from '@/lib/store.js';
import { api, hasServer } from '@/lib/api.js';
import Mascot from './Mascot.jsx';

const ICON = { phone: Phone, whatsapp: MessageCircle, web: Globe };

/** A class student (with a server) may ask the teacher for a talk. */
export function useCanAskTeacher() {
  const inClass = useApp((s) => !!(s.profile?.role === 'student' && s.profile?.classCode && s.profile?.token));
  return inClass && hasServer();
}

/**
 * The child asks the teacher to talk: POST /api/help { kind: 'talk' }, with no text. Nothing else is ever sent to
 * anyone on the child's behalf: the child decides.
 */
function TalkButton({ lines }) {
  const [state, setState] = useState('idle'); // idle | busy | sent | failed
  const ask = async () => {
    setState('busy');
    try { await api('/api/help', { method: 'POST', body: { kind: 'talk' } }); setState('sent'); } catch { setState('failed'); }
  };
  if (state === 'sent') return <p className="support-talk-sent" role="status">{lines.talkSent}</p>;
  return (
    <div className="support-talk">
      <button type="button" className="btn btn-secondary btn-block support-talk-btn" onClick={ask} disabled={state === 'busy'} aria-busy={state === 'busy'}>
        {state === 'busy' ? lines.talkBusy : lines.talk}
      </button>
      {state === 'failed' && <p className="support-note" role="status">{lines.talkFailed}</p>}
    </div>
  );
}

/**
 * variant: 'after-message' | 'opened' | 'help-note' (the opening line and the footer differ). In a sheet pass `bare`:
 * the sheet carries the title and the frame.
 */
export default function SupportCard({ variant = 'after-message', bare = false, className }) {
  const lines = supportLines(SUPPORT, variant);
  const canTalk = useCanAskTeacher();
  return (
    <section className={clsx('support-card', bare && 'bare', className)} role="region" aria-label="עזרה ממישהו שאפשר לדבר איתו" data-variant={variant}>
      <div className="support-head">
        <Mascot mood="idle" size={52} still className="support-madi" />
        <div className="support-head-text">
          {!bare && <p className="support-title">{lines.title}</p>}
          <p className="support-opening">{lines.opening}</p>
        </div>
      </div>
      <p className="support-adult">{lines.adult}</p>
      <p className="support-now">{lines.now}</p>
      <ul className="support-services">
        {lines.services.map((s) => (
          <li key={s.id} className="support-service">
            <p className="support-name">{s.name}{s.detail && <span className="support-detail"> ({s.detail})</span>}</p>
            <ul className="support-links">
              {s.links.map((l) => {
                const Icon = ICON[l.kind];
                const away = l.kind !== 'phone';
                return (
                  <li key={l.href}>
                    <a className={clsx('support-link', `is-${l.kind}`)} href={l.href} {...(away ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                      <Icon size={18} aria-hidden="true" />
                      <span><span className="visually-hidden">{s.name}, </span>{l.label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
            {s.hours && <p className="support-hours">{s.hours}</p>}
          </li>
        ))}
      </ul>
      {canTalk && <TalkButton lines={lines} />}
      <p className="support-foot">{lines.footer}</p>
    </section>
  );
}
