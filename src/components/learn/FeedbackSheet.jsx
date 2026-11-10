import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, X, Zap, Bot, Loader2, Eye } from 'lucide-react';
import MathMarkdown from '@/components/MathMarkdown';
import { useAuth } from '@/lib/AuthContext';
import { lessonHint } from '@/lib/llm';
import { consumeAction, getActions, isPro } from '@/lib/mathActions';

const PRAISE = ['מעולה!', 'בדיוק!', 'יפה מאוד!', 'נכון!', 'מושלם!', 'כל הכבוד!', 'אלוף!'];

// Brilliant-style bottom sheet: green "correct" with the why, or a warm "not yet" with retry.
export default function FeedbackSheet({ status, message, explain, xp, canReveal, onContinue, onRetry, onReveal, tutor }) {
  const [praise] = useState(() => PRAISE[Math.floor(Math.random() * PRAISE.length)]);
  const good = status === 'correct' || status === 'revealed';
  const title = status === 'correct' ? praise : status === 'revealed' ? 'הנה הפתרון' : 'עוד לא…';

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 360 }}
      role="status"
      aria-live="polite"
      className={`fixed bottom-0 inset-x-0 z-40 border-t-2 backdrop-blur-2xl ${good ? 'bg-emerald-950/90 border-emerald-400/50' : 'bg-rose-950/90 border-rose-400/50'}`}
    >
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3">
        <div className="flex items-start gap-3">
          <motion.div
            initial={{ scale: 0.3, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            className={`w-11 h-11 rounded-full grid place-items-center shrink-0 ${good ? 'bg-emerald-400 text-emerald-950' : 'bg-rose-400 text-rose-950'}`}
          >
            {status === 'revealed' ? <Eye className="w-5 h-5" /> : good ? <Check className="w-6 h-6" strokeWidth={3} /> : <X className="w-6 h-6" strokeWidth={3} />}
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className={`font-extrabold text-xl ${good ? 'text-emerald-300' : 'text-rose-200'}`}>{title}</div>
            {!good && message && (
              <div className="math-prose text-[15px] text-rose-50/90 mt-0.5 [&_p]:mb-0"><MathMarkdown>{message}</MathMarkdown></div>
            )}
            {good && explain && (
              <div className="math-prose text-[15px] text-emerald-50/90 mt-0.5 max-h-40 overflow-y-auto scrollbar-thin [&_p]:mb-1"><MathMarkdown>{explain}</MathMarkdown></div>
            )}
          </div>
          {xp > 0 && (
            <div className="shrink-0 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-sm font-extrabold px-2.5 py-1 flex items-center gap-1 animate-slide-up">
              <Zap className="w-3.5 h-3.5" /> <bdi dir="ltr">+{xp}</bdi>
            </div>
          )}
        </div>

        {!good && tutor}

        <div className="flex gap-2.5">
          {good ? (
            <button type="button" onClick={onContinue} className="btn-chunky chunky-success flex-1 py-3.5 text-lg">המשך</button>
          ) : (
            <>
              {canReveal && (
                <button type="button" onClick={onReveal} className="btn-chunky chunky-ghost px-4 py-3.5 text-[15px]">הראה לי</button>
              )}
              <button type="button" onClick={onRetry} className="btn-chunky chunky-warn flex-1 py-3.5 text-lg">נסה שוב</button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// "Still stuck?" — asks the AI tutor for a targeted nudge about this exact step (costs one action).
export function AskTutor({ lessonTitle, step, message }) {
  const { user, checkUserAuth } = useAuth();
  const [state, setState] = useState('idle');
  const [text, setText] = useState('');
  const blocked = !isPro(user) && getActions(user) <= 0;

  const ask = async () => {
    setState('loading');
    try {
      await consumeAction(user);
      await checkUserAuth();
      const reply = await lessonHint({ lessonTitle, stepTitle: step.title, task: step.text, feedback: message, user });
      setText(reply || 'נסה לחשוב על השלב צעד אחד אחורה.');
      setState('done');
    } catch {
      setState('error');
    }
  };

  if (state === 'done') {
    return (
      <div className="rounded-xl bg-black/30 border border-white/10 p-3 math-prose text-sm max-h-44 overflow-y-auto scrollbar-thin animate-slide-up [&_p]:mb-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-violet-200 mb-1"><Bot className="w-3.5 h-3.5" /> המורה AI</div>
        <MathMarkdown>{text}</MathMarkdown>
      </div>
    );
  }
  if (blocked) {
    return (
      <Link to="/paywall" className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-200 hover:text-white">
        <Bot className="w-4 h-4" /> רוצה הסבר מהמורה AI? שדרג ל-Pro
      </Link>
    );
  }
  return (
    <button type="button" onClick={ask} disabled={state === 'loading'} className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-200 hover:text-white transition disabled:opacity-70">
      {state === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
      {state === 'loading' ? 'המורה חושב…' : state === 'error' ? 'לא הצלחתי לקבל הסבר — נסה שוב' : 'לא מבין למה? שאל את המורה AI'}
    </button>
  );
}
