import { isHighSchool, gradeLabel } from '@/lib/curriculum';

export default function GradeBadge({ user, className = '' }) {
  if (!user?.grade) return null;
  const high = isHighSchool(user.grade);
  return (
    <div className={`inline-flex items-center gap-2 glass rounded-full px-3 py-1.5 text-xs font-semibold ${className}`}>
      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 grid place-items-center text-[10px] text-white font-bold">
        {gradeLabel(user.grade)}
      </span>
      <span className="text-foreground/90">כיתה {gradeLabel(user.grade)}</span>
      {high && user.track && <span className="text-muted-foreground">· {user.track} יח'</span>}
    </div>
  );
}