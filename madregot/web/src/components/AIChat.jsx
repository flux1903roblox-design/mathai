import { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send } from 'lucide-react';
import { detectDistress, maskPersonal } from '@shared/safety.js';
import { runAI, aiReady } from '@/lib/ai.js';
import { aiAccess, useAIStatus, needIntro, openLimitSheet } from '@/lib/account.js';
import { Button } from './ui.jsx';
import { Markdown } from './MathText.jsx';
import { Thinking } from './ui.jsx';
import AIAllowance from './AIAllowance.jsx';
import Mascot from './Mascot.jsx';
import SupportCard from './SupportCard.jsx';
import { SupportLink } from './SupportSheet.jsx';
import ReportAnswer from './ReportAnswer.jsx';
import { CLASS_OFF_LINE, waitingLine } from './limitCopy.js';
import { useApp } from '@/lib/store.js';
import { piiLine } from '@/content/support.js';

const STARTERS = ['איך מתחילים?', 'אפשר רמז קטן?', 'למה זה ככה?'];
/** After the student already answered an exercise of the lesson, the first question is about their own answer. */
const MISTAKE_STARTER = 'מה הטעות שלי?';
const THINK = ['קורא את התרגיל', 'חושב על הדרך', 'מנסח הסבר'];

/** Only the conversation goes to the tutor: never the support cards, never a flag. */
const toTutor = (list) => list.filter((m) => m.role === 'user' || m.role === 'assistant').map(({ role, content }) => ({ role, content }));

/**
 * Chat with the AI tutor, optionally about the exercise on screen. `context` is what the tutor is told: the version-2
 * context from lib/tutorContext.js (the exercise, the app's diagnosis, the final-answer policy), sent as `ctx`.
 * Pass `messages` and `onMessages` to keep the conversation outside (it then survives closing the sheet); onMessages
 * is a React state setter (it is given updater functions, since a reply can arrive after another message was added).
 * When the tutor is done for today the input stays usable: a message keeps its draft and a calm card says when the
 * tutor is back; `onDone` is "continue practising" there (closing the sheet in a lesson), `onMadi` the opener's way to
 * Madi. introTitle: a heading in Madi's opening bubble; restLine: the calm card's sentence instead of the usual one
 * (null: only its buttons, when the opening bubble already says it). On a device that waits for a parent's OK (TRUST-9)
 * a message opens the sheet that explains it, and the card's first button is the screen for the parents.
 * Distress first (trust spec TRUST-3 §3.5): a message that reads as distress shows the support card at once, on the
 * device, whatever the tutor's state (resting, busy, offline). It still goes to the tutor when there is one (the server
 * answers it on its care path, never counted, never refused); a failure there is silent and the card stays.
 * Help counts as help (ai spec AI-3 Design 5): `onAsk` is called when help arrives (the first words of the reply, or a
 * whole reply that is not care), never for a message that reads as distress or a request that failed, so the lesson can
 * mark the open exercise as answered with help. `footnote`: one
 * quiet line kept under the first reply about an exercise that is still open (the lesson says what help means there).
 */
export default function AIChat({ context, intro, introTitle, restLine, messages: kept, onMessages, tools, onDone, onMadi, onAsk, footnote }) {
  const navigate = useNavigate();
  const role = useApp((s) => s.profile?.role);
  const status = useAIStatus((x) => x.status);
  const access = aiAccess('chat', status);
  // the tutor does not answer here now: today's questions are used, it rests, the class has it off (TRUST-11), or a
  // parent has not approved it on this device yet (TRUST-9); the input stays usable in every case, so a message that
  // reads as distress still shows the card and still goes (the server answers it with the fixed reply)
  const resting = ['used', 'paused', 'resting', 'class_off', 'parent_ok_needed'].includes(access.state);
  const classOff = access.state === 'class_off';
  const parentOk = access.state === 'parent_ok_needed';
  const [own, setOwn] = useState([]);
  const messages = kept ?? own;
  const setMessages = onMessages ?? setOwn;
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const endRef = useRef(null);
  const dockRef = useRef(null);
  const abortRef = useRef(null);
  const sendRef = useRef(0); // the newest send: an older reply that is still arriving never touches the screen
  // Right after a message that read as distress, the calm "back tomorrow" card steps aside, so the reply and the support
  // card have the screen (on a small phone the card would cover them); it comes back when a question is tried.
  const [restBack, setRestBack] = useState(false);
  const careLast = messages.length > 0 && (messages.at(-1).role === 'support' || messages.at(-1).care === true);
  const showRest = resting && (!careLast || restBack);

  // A conversation kept outside is not cut off when the chat closes: the reply still arrives there.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (!onMessages) abortRef.current?.abort(); }, []);
  // The newest answer is scrolled into view above the docked input (and the calm card when the tutor rests), in
  // whatever scrolls: the page on the assistant screen, the sheet in a lesson. Nothing moves before the first message.
  // When the newest thing is a support card, the message above it is brought to the top instead, so what follows it
  // (the reply, then the card) is read from its start.
  useEffect(() => {
    if (!messages.length && !pending) return;
    const end = endRef.current;
    if (!end?.scrollIntoView) return;
    const start = end.dataset.align === 'start';
    const dockTop = dockRef.current?.getBoundingClientRect().top;
    const covered = Number.isFinite(dockTop) ? Math.max(0, window.innerHeight - dockTop) : 0;
    end.style.scrollMarginBottom = `${Math.round(covered) + 8}px`;
    if (start) end.style.scrollMarginTop = '72px'; // clear of the screen bar or the sheet's head
    const still = streaming || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    end.scrollIntoView({ block: start ? 'start' : 'end', behavior: still ? 'auto' : 'smooth' });
  }, [messages, streaming, pending, showRest]);

  const send = async (text) => {
    const content = (text ?? draft).trim();
    if (!content) return;
    const care = detectDistress(content).flag;
    if (!care && (pending || resting)) {
      // the tutor rests today: the draft stays where it is, and the calm card in the dock says why
      if (resting) {
        setRestBack(true);
        requestAnimationFrame(() => dockRef.current?.querySelector('.chat-rest')?.scrollIntoView?.({ block: 'nearest' }));
        // no parent's OK yet: the sheet says what it is and how to get it (the draft still waits here)
        if (parentOk && !pending) openLimitSheet({ reason: 'parent_ok_needed', onMadi });
      }
      return;
    }
    // the first AI action on this device: the introduction first, then this same message (never before a message that
    // reads as distress: that one goes at once, and the card is already on screen)
    if (!care && needIntro(() => send(content))) return;
    if (care) setRestBack(false);
    if (care && pending) abortRef.current?.abort(); // the maths answer gives way
    // a question about the exercise is help with it once help arrives: the first words of the reply, or a whole reply
    // that is neither care nor the calm sentence of a stopped one. A message that reads as distress is never help, and a
    // request that failed or was refused helped with nothing (the AI review: the right answer read "with help")
    let helped = false;
    const help = () => { if (!care && !helped) { helped = true; onAsk?.(); } };
    const mine = ++sendRef.current;
    // what the tutor will not receive (the request masks it): said quietly under the child's own words
    const pii = maskPersonal(content).found;
    const user = { role: 'user', content, ...(pii.length ? { pii } : {}) };
    const history = [...toTutor(messages), user];
    // a message that reads as distress: the card shows at once, before any network; the reply goes above it
    setMessages((ms) => [...ms, user, ...(care ? [{ role: 'support', id: mine }] : [])]);
    setDraft(''); setError(''); setPending(true); setStreaming('');
    const ctrl = new AbortController(); abortRef.current = ctrl;
    const mineNow = () => sendRef.current === mine;
    try {
      // the app's context (ai spec AI-1): a version-2 context goes as ctx; an older caller's flat fields still go as context
      const res = await runAI('chat', context?.v === 2 ? { messages: history, ctx: context } : { messages: history, context }, { onText: (t) => { if (t.trim()) help(); if (mineNow()) setStreaming(t); }, signal: ctrl.signal, onMadi, quiet: care });
      if (!res.care && !res.blocked && String(res.text || '').trim()) help();
      const reply = { role: 'assistant', content: res.text, ...(res.care ? { care: true } : {}), ...(res.blocked ? { blocked: true } : {}) };
      setMessages((ms) => {
        // the quiet line goes under the first reply about this exercise only, and stays with it
        if (footnote && !res.care && !ms.some((m) => m.role === 'assistant')) reply.note = footnote;
        const at = ms.findIndex((m) => m.role === 'support' && m.id === mine);
        if (at >= 0) return [...ms.slice(0, at), reply, ...ms.slice(at)];
        // only the tutor noticed: the card goes under its reply
        return [...ms, reply, ...(res.care ? [{ role: 'support', id: mine }] : [])];
      });
    } catch (e) {
      if (e.name === 'AbortError') return;
      // the card already stands: no red error, and the message is not handed back to be sent again
      if (care) return;
      // a limit is said calmly by the sheet and the card below, never as a red error
      if (!e.limit) setError(e.message);
      setMessages((ms) => { const at = ms.lastIndexOf(user); return at >= 0 ? [...ms.slice(0, at), ...ms.slice(at + 1)] : ms; });
      setDraft(content);
    } finally {
      if (mineNow()) { setPending(false); setStreaming(''); }
    }
  };

  if (!aiReady()) {
    return (
      <div className="chat-off">
        <p className="muted">העוזר עוד לא מחובר. אפשר לחבר אותו בהגדרות.</p>
        <SupportLink />
      </div>
    );
  }
  // the reply that is arriving goes above the card of the message it answers
  const cardLast = messages.length >= 2 && messages.at(-1).role === 'support';
  const anchor = cardLast ? messages.length - 2 : pending ? -1 : messages.length - 1;
  const thinking = (
    <div className="msg-row assistant" ref={anchor === -1 ? endRef : undefined} key="pending">
      <Mascot mood="thinking" size={34} className="msg-avatar" />
      <div className="msg assistant">
        {streaming ? <p className="streaming">{streaming}</p> : <Thinking states={THINK} />}
      </div>
    </div>
  );

  return (
    <div className="chat">
      <div className="chat-list" ref={listRef}>
        {/* the same conversation layout everywhere (LAYOUT_SPEC B3): מדי opens with a bubble, the starters wait
            above the input, and the input is docked at the bottom */}
        {intro && (
          <div className="msg-row assistant chat-intro">
            <Mascot mood="happy" size={34} className="msg-avatar" />
            <div className="msg assistant">{introTitle && <h2 className="chat-bubble-title">{introTitle}</h2>}<p>{intro}</p></div>
          </div>
        )}
        {messages.map((m, i) => {
          if (m.role === 'support') {
            return (
              <Fragment key={`support-${m.id ?? i}`}>
                {pending && i === messages.length - 1 && thinking}
                <div className="chat-support"><SupportCard variant="after-message" /></div>
              </Fragment>
            );
          }
          return (
            <Fragment key={i}>
              <div className={`msg-row ${m.role}`} ref={i === anchor ? endRef : undefined} data-align={cardLast && i === anchor ? 'start' : undefined}>
                {m.role === 'assistant' && <Mascot mood="idle" size={34} className="msg-avatar" />}
                <div className={`msg ${m.role}`}>
                  {m.role === 'assistant' ? <Markdown>{m.content}</Markdown> : <p>{m.content}</p>}
                </div>
              </div>
              {m.pii && <p className="msg-pii">{piiLine(m.pii)}</p>}
              {/* every answer of the tutor can be reported; the calm sentence that replaced a stopped one is ours, not its */}
              {m.role === 'assistant' && !m.blocked && <div className="msg-tools"><ReportAnswer kind="chat" reply={m.content} /></div>}
              {m.note && <p className="footnote msg-note">{m.note}</p>}
            </Fragment>
          );
        })}
        {pending && !cardLast && thinking}
        {error && <p className="form-error" role="alert">{error}</p>}
        {!pending && !resting && <AIAllowance className="chat-left" kind="chat" />}
      </div>
      <div className="chat-dock-live" data-region="footer" ref={dockRef}>
        {showRest && (
          <section className="chat-rest" role="status" aria-label="העוזר החכם">
            {restLine !== null && (
              <p>{restLine ?? (classOff ? `${CLASS_OFF_LINE} מדי, השיעורים והתרגול פתוחים כמו תמיד.` : parentOk ? `${waitingLine(role)} ${role === 'teacher' ? 'הלוח והשיעורים פתוחים כמו תמיד.' : 'מדי, השיעורים והתרגול פתוחים כמו תמיד.'}` : access.state === 'used' ? 'להיום סיימנו עם העוזר החכם. מחר הוא כאן שוב.' : 'העוזר החכם נח היום. מחר הוא חוזר.')}</p>
            )}
            <div className="chat-rest-actions">
              {parentOk && role === 'teacher' ? (
                <Button className="btn-sm" onClick={() => openLimitSheet({ reason: 'parent_ok_needed' })}>כניסה עם מייל</Button>
              ) : parentOk ? (
                <>
                  <Button className="btn-sm" onClick={() => navigate('/parents/info')}>להראות להורים</Button>
                  <Button variant="secondary" className="btn-sm" onClick={() => (onDone ? onDone() : navigate('/'))}>להמשיך לתרגל</Button>
                </>
              ) : (
                <>
                  <Button className="btn-sm" onClick={() => (onDone ? onDone() : navigate('/'))}>להמשיך לתרגל</Button>
                  <Button variant="secondary" className="btn-sm" onClick={() => navigate('/topics')}>מה מדי יודע להסביר</Button>
                </>
              )}
            </div>
            <SupportLink className="chat-rest-support" />
          </section>
        )}
        {messages.length === 0 && !resting && (
          <div className="starters chat-chips">
            {(context?.surface === 'lesson' && context.tries?.answers?.length > 0 ? [MISTAKE_STARTER, ...STARTERS] : STARTERS)
              .map((s) => <button key={s} type="button" className="starter" onClick={() => send(s)}>{s}</button>)}
          </div>
        )}
        {/* the other ways to help step aside while the tutor rests and under a support card, so on a small phone the
            card's numbers are not pushed under the input (the trust review) */}
        {tools?.length > 0 && !resting && !careLast && (
          <div className="chat-tools" role="group" aria-label="עוד דרכים לעזרה">
            {tools.map(({ label, icon: Icon, onClick }) => <button key={label} type="button" className="chat-tool" onClick={onClick}><Icon size={18} aria-hidden="true" />{label}</button>)}
          </div>
        )}
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label htmlFor="chat-draft" className="visually-hidden">ההודעה שלכם</label>
          {/* never disabled: a child whose questions are used up can still write, and a message that reads as
              distress always gets the card */}
          <textarea id="chat-draft" rows={1} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={classOff ? 'העוזר החכם כבוי בכיתה הזו' : parentOk ? (role === 'teacher' ? 'נפתח אחרי כניסה עם מייל' : 'מחכים לאישור של הורה') : resting ? 'העוזר החכם חוזר מחר' : 'כתבו שאלה…'} maxLength={1000}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button type="submit" className="icon-btn send" disabled={!draft.trim() || (pending && !detectDistress(draft).flag)} aria-label="שליחה"><Send size={20} aria-hidden="true" /></button>
        </form>
        {!showRest && <SupportLink className="chat-support-link" />}
      </div>
    </div>
  );
}
