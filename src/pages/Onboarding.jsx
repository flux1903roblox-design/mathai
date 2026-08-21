import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, GraduationCap, Layers, Check } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { GRADES, UNITS, MIDDLE_GRADES, gradeLabel, profileLabel } from '@/lib/curriculum';
import { setProfile } from '@/lib/mathActions';
import Logo from '@/components/Logo';

export default function Onboarding() {
  const { checkUserAuth } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [grade, setGrade] = useState(null);
  const [track, setTrack] = useState(null);
  const [saving, setSaving] = useState(false);

  const isHigh = grade && !MIDDLE_GRADES.includes(grade);

  const finish = async () => {
    setSaving(true);
    try {
      await setProfile({ grade, track: isHigh ? track || '3' : null });
      await checkUserAuth();
      navigate('/', { replace: true });
    } catch (e) {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-8"><Logo /></div>

        {/* progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[0, 1].map((i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i <= step ? 'w-8 bg-violet-400' : 'w-4 bg-white/15'}`} />
          ))}
        </div>

        {step === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 grid place-items-center mx-auto mb-3 btn-glow">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-display">באיזה כיתה אתה?</h1>
              <p className="text-sm text-muted-foreground mt-1">נתאים את כל הפתרונות והתרגול לרמה שלך</p>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {GRADES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGrade(g.id)}
                  className={`aspect-square rounded-2xl border flex flex-col items-center justify-center transition-all ${
                    grade === g.id ? 'border-transparent bg-gradient-to-br from-violet-500/25 to-cyan-400/15 ring-glow' : 'border-white/10 glass hover:bg-white/[0.07]'
                  }`}
                >
                  <span className="text-2xl font-extrabold">{g.label}</span>
                  <span className="text-[10px] text-muted-foreground mt-1">{g.id >= '7' && MIDDLE_GRADES.includes(g.id) ? 'חטיבה' : 'תיכון'}</span>
                </button>
              ))}
            </div>
            <button
              disabled={!grade}
              onClick={() => (isHigh ? setStep(1) : finish())}
              className="w-full mt-7 bg-gradient-to-l from-violet-500 to-cyan-400 text-white font-bold py-3.5 rounded-xl btn-glow disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
            >
              המשך <ArrowLeft className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {step === 1 && isHigh && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 grid place-items-center mx-auto mb-3 btn-glow">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-display">כמה יחידות לימוד?</h1>
              <p className="text-sm text-muted-foreground mt-1">כיתה {gradeLabel(grade)} · הנושאים יותאמו לרמת היחידות</p>
            </div>
            <div className="space-y-3">
              {UNITS.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setTrack(u.id)}
                  className={`w-full rounded-2xl border p-4 flex items-center justify-between transition-all ${
                    track === u.id ? 'border-transparent bg-gradient-to-l from-violet-500/25 to-cyan-400/15 ring-glow' : 'border-white/10 glass hover:bg-white/[0.07]'
                  }`}
                >
                  <div className="text-right">
                    <div className="text-lg font-bold">{u.label} לימוד</div>
                    <div className="text-xs text-muted-foreground">רמה {u.desc}</div>
                  </div>
                  <div className={`w-7 h-7 rounded-full grid place-items-center border ${track === u.id ? 'bg-violet-500 border-transparent' : 'border-white/20'}`}>
                    {track === u.id && <Check className="w-4 h-4 text-white" />}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-7">
              <button onClick={() => setStep(0)} className="glass rounded-xl px-5 py-3.5 font-semibold hover:bg-white/10 transition">חזרה</button>
              <button
                disabled={!track || saving}
                onClick={finish}
                className="flex-1 bg-gradient-to-l from-violet-500 to-cyan-400 text-white font-bold py-3.5 rounded-xl btn-glow disabled:opacity-40 flex items-center justify-center gap-2 transition"
              >
                {saving ? 'שומר…' : <>סיום והתחלה <Check className="w-4 h-4" /></>}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}