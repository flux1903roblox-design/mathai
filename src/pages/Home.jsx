const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ScanLine, PencilRuler, ClipboardList, MessageCircle, Crown, Clock, Sparkles, ChevronLeft,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

import { profileLabel, gradeLabel } from '@/lib/curriculum';
import { isPro, actionsDisplay } from '@/lib/mathActions';
import ActionsMeter from '@/components/ActionsMeter';

const ACTIONS = [
  { to: '/scan', label: 'סרוק שאלה', desc: 'צלם וקבל פתרון מלא', icon: ScanLine, color: 'from-violet-500 to-fuchsia-500' },
  { to: '/practice', label: 'תרגול חכם', desc: 'תרגולים מותאמים אישית', icon: PencilRuler, color: 'from-cyan-400 to-blue-500' },
  { to: '/exam', label: 'בנה מבחן', desc: 'מבחן אמריקאי לפי נושא', icon: ClipboardList, color: 'from-amber-400 to-orange-500' },
  { to: '/chat', label: 'שאל את המורה', desc: 'צ׳אט עם AI בכל נושא', icon: MessageCircle, color: 'from-emerald-400 to-teal-500' },
];

export default function Home() {
  const { user } = useAuth();
  const [solved, setSolved] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    db.entities.SolvedQuestion
      .filter({ created_by_id: user.id }, '-created_date', 200)
      .then(setSolved)
      .catch(() => setSolved([]));
  }, [user?.id]);

  if (!user?.grade) return <Navigate to="/onboarding" replace />;

  const name = user.full_name?.trim()?.split(' ')[0] || 'תלמיד';
  const recent = solved?.slice(0, 4) ?? null;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const stats = solved ? [
    { label: 'שאלות נפתרו', value: solved.length },
    { label: 'השבוע', value: solved.filter((q) => new Date(q.created_date).getTime() > weekAgo).length },
    { label: 'מועדפים', value: solved.filter((q) => q.is_favorite).length },
  ] : null;

  return (
    <div className="space-y-6">
      {/* hero */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden card-base p-6 sm:p-7">
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -bottom-10 right-10 w-40 h-40 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative">
          <div className="text-sm text-muted-foreground">{profileLabel(user.grade, user.track)}</div>
          <h1 className="text-3xl sm:text-4xl font-display mt-1.5">שלום, <span className="gradient-text">{name}</span> 👋</h1>
          <p className="text-muted-foreground mt-2 text-sm">מוכן להצליח במתמטיקה היום?</p>
        </div>
      </motion.div>

      {/* stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05 }}
              className="card-base p-4 text-center">
              <div className="text-2xl sm:text-3xl font-extrabold tabular-nums">{s.value}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* actions grid */}
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map((a, i) => (
          <motion.div key={a.to} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05 }}>
            <Link to={a.to} className="card-base card-hover p-5 h-full flex flex-col justify-between group">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${a.color} grid place-items-center mb-3 group-hover:scale-105 transition`}>
                <a.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold">{a.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{a.desc}</div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <ActionsMeter user={user} className="lg:col-span-2" />
        {!isPro(user) && (
          <Link to="/paywall" className="card-base p-4 flex items-center gap-3 hover:bg-white/[0.07] transition group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-violet-500 grid place-items-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-sm">שדרג ל-Pro</div>
              <div className="text-[11px] text-muted-foreground">פעולות ללא הגבלה</div>
            </div>
            <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition" />
          </Link>
        )}
      </div>

      {/* recent */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold flex items-center gap-2"><Clock className="w-4 h-4 text-violet-300" /> נפתרו לאחרונה</h2>
          <Link to="/history" className="text-xs text-muted-foreground hover:text-foreground">הכל →</Link>
        </div>
        {recent === null ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="card-base p-3.5 flex items-center gap-3 animate-pulse-soft">
                <div className="w-9 h-9 rounded-lg bg-white/5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/5 rounded w-2/3" />
                  <div className="h-2 bg-white/5 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="card-base p-8 text-center">
            <Sparkles className="w-7 h-7 text-violet-300 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">עדיין לא פתרת שאלות. סרוק שאלה ראשונה!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((q) => (
              <Link to="/history" key={q.id} className="card-base card-hover p-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/5 grid place-items-center shrink-0">
                  <ScanLine className="w-4 h-4 text-violet-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{q.question_text || 'שאלה מצולמת'}</div>
                  <div className="text-[11px] text-muted-foreground">{q.topic || '—'} · כיתה {gradeLabel(user.grade)}</div>
                </div>
                {q.is_favorite && <Crown className="w-3.5 h-3.5 text-amber-300" />}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}