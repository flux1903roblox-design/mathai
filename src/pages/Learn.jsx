import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useProgress } from '@/lib/progress';
import { coursesFor, getLesson, nextLesson } from '@/lessons';
import { ProgressCard, ContinueCard, LessonPath } from '@/components/learn/ProgressWidgets';

export default function Learn() {
  const { user } = useAuth();
  const progress = useProgress(user?.id);
  if (!user?.grade) return <Navigate to="/onboarding" replace />;

  const courses = coursesFor(user);
  const next = nextLesson(user, progress);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 grid place-items-center btn-glow">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-display">למידה אינטראקטיבית</h1>
          <p className="text-xs text-muted-foreground">לא קוראים על מתמטיקה — עושים אותה. גוררים, מזיזים ומגלים.</p>
        </div>
      </header>

      <ProgressCard user={user} />
      <ContinueCard user={user} />

      {courses.map((course, ci) => {
        const lessons = course.lessons.map(getLesson);
        const done = lessons.filter((l) => progress.lessons[l.id]?.done).length;
        const CourseIcon = course.icon;
        return (
          <motion.section
            key={course.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + ci * 0.08 }}
            className="card-base p-5 pb-2 overflow-hidden"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${course.gradient} grid place-items-center shrink-0`}>
                <CourseIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-extrabold">{course.title}</h2>
                <p className="text-[11px] text-muted-foreground">{course.desc}</p>
              </div>
              <div className="text-left shrink-0">
                <div className={`text-sm font-extrabold tabular-nums ${course.text}`}>{done}/{lessons.length}</div>
                <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden mt-1">
                  <div className={`h-full rounded-full bg-gradient-to-l ${course.gradient} transition-all`} style={{ width: `${(done / lessons.length) * 100}%` }} />
                </div>
              </div>
            </div>
            <LessonPath course={course} lessons={lessons} progress={progress} nextId={next?.id} />
          </motion.section>
        );
      })}

      <p className="text-center text-xs text-muted-foreground pb-4">שיעורים חדשים בדרך ✨ בינתיים — נסה <span className="text-foreground/80">תרגול חכם</span> בכל נושא.</p>
    </div>
  );
}
