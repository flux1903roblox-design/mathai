const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from 'react';
import { Camera, ImagePlus, Loader2, ScanLine, Sparkles, Keyboard, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

import { solveFromImage, solveFromText } from '@/lib/llm';
import { consumeAction, getActions, isPro } from '@/lib/mathActions';
import HelpLevelSelector from '@/components/HelpLevelSelector';
import SolutionSteps from '@/components/SolutionSteps';
import PaywallGate from '@/components/PaywallGate';

export default function Scan() {
  const { user, checkUserAuth } = useAuth();
  const [mode, setMode] = useState('photo'); // photo | text
  const [imageUrl, setImageUrl] = useState(null);
  const [text, setText] = useState('');
  const [helpLevel, setHelpLevel] = useState('full');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const blocked = !isPro(user) && getActions(user) <= 0;

  const onFile = async (file) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setImageUrl(file_url);
      setResult(null);
    } catch {
      setError('העלאת התמונה נכשלה. נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  const solve = async () => {
    setError(null);
    if (mode === 'photo' && !imageUrl) return setError('צלם או העלה תמונה תחילה.');
    if (mode === 'text' && !text.trim()) return setError('כתוב את השאלה תחילה.');
    if (blocked) return;
    setLoading(true);
    try {
      await consumeAction(user);
      await checkUserAuth();
      const res = mode === 'photo'
        ? await solveFromImage({ imageUrl, helpLevel, user })
        : await solveFromText({ text, helpLevel, user });
      setResult(res);
      const payload = {
        image_url: mode === 'photo' ? imageUrl : null,
        question_text: res.question_text || (mode === 'text' ? text : ''),
        topic: res.topic || '',
        help_level: helpLevel,
        solution: res.solution || '',
        final_answer: res.final_answer || '',
        source: 'scan',
      };
      db.entities.SolvedQuestion.create(payload).catch(() => {});
    } catch {
      setError('הפתרון נכשל. נסה שוב או צלם שוב באיכות טובה יותר.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setImageUrl(null);
    setText('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 grid place-items-center btn-glow">
          <ScanLine className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-display">סריקת שאלה</h1>
          <p className="text-xs text-muted-foreground">צלם או העלה שאלה וקבל פתרון מיד</p>
        </div>
      </header>

      {blocked && <PaywallGate reason="ניצלת את כל 5 הפעולות החינמיות" />}

      {!blocked && (
        <>
          {/* mode toggle */}
          <div className="glass rounded-xl p-1 flex w-full max-w-xs">
            <button onClick={() => setMode('photo')} className={`flex-1 rounded-lg py-2 text-sm font-semibold flex items-center justify-center gap-1.5 transition ${mode === 'photo' ? 'bg-white/10' : 'text-muted-foreground'}`}>
              <Camera className="w-4 h-4" /> תמונה
            </button>
            <button onClick={() => setMode('text')} className={`flex-1 rounded-lg py-2 text-sm font-semibold flex items-center justify-center gap-1.5 transition ${mode === 'text' ? 'bg-white/10' : 'text-muted-foreground'}`}>
              <Keyboard className="w-4 h-4" /> הקלדה
            </button>
          </div>

          {mode === 'photo' ? (
            !imageUrl ? (
              <label className="block card-base border-dashed p-8 sm:p-12 text-center cursor-pointer hover:bg-white/[0.06] transition">
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 grid place-items-center mx-auto mb-3 btn-glow">
                  <Camera className="w-7 h-7 text-white" />
                </div>
                <div className="font-bold">צלם או העלה תמונה</div>
                <div className="text-xs text-muted-foreground mt-1">מצלמה, מחברת, ספר או מבחן</div>
                {loading && <div className="mt-3 text-xs text-violet-300 flex items-center justify-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> מעלה…</div>}
              </label>
            ) : (
              <div className="card-base p-3 relative">
                <img src={imageUrl} alt="שאלה" className="w-full rounded-xl max-h-72 object-contain bg-black/30 mx-auto" />
                <button onClick={reset} className="absolute top-5 left-5 w-8 h-8 rounded-full bg-black/60 grid place-items-center text-white hover:bg-black/80 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
          ) : (
            <div className="card-base p-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                dir="rtl"
                placeholder="הקלד את השאלה כאן… למשל: פתור את המשוואה 3x + 5 = 20"
                className="w-full bg-transparent outline-none resize-none text-[15px] placeholder:text-muted-foreground/60"
              />
            </div>
          )}

          <div>
            <div className="text-sm font-bold mb-2">בחר רמת עזרה</div>
            <HelpLevelSelector value={helpLevel} onChange={setHelpLevel} disabled={loading} />
          </div>

          {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{error}</div>}

          <button
            onClick={solve}
            disabled={loading || (mode === 'photo' ? !imageUrl : !text.trim())}
            className="w-full bg-gradient-to-l from-violet-500 to-cyan-400 text-white font-bold py-3.5 rounded-xl btn-glow disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> פותר…</> : <><Sparkles className="w-4 h-4" /> פתור את השאלה</>}
          </button>

          {result && <SolutionSteps result={result} helpLevel={helpLevel} />}
        </>
      )}
    </div>
  );
}