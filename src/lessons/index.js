// Course catalogue for the interactive "learn by doing" section.
// Each course is colour-coded (like Brilliant's learning paths); lessons are bite-sized (5–7 minutes).
import { Scale, TrendingUp, Spline, Triangle, SquareStack, Orbit, Sigma, Shapes, Waves } from 'lucide-react';
import { MIDDLE_GRADES } from '@/lib/curriculum';
import balance from './balance';
import linear from './linear';
import parabola from './parabola';
import triangle from './triangle';
import pythagoras from './pythagoras';
import unitCircle from './unitCircle';

const ICONS = { balance: Scale, linear: TrendingUp, parabola: Spline, 'triangle-angles': Triangle, pythagoras: SquareStack, 'unit-circle': Orbit };

export const LESSONS = Object.fromEntries(
  [balance, linear, parabola, triangle, pythagoras, unitCircle].map((l) => [l.id, { ...l, icon: ICONS[l.id] }]),
);

export const COURSES = [
  {
    id: 'algebra',
    title: 'אלגברה ופונקציות',
    desc: 'משוואות, ישרים ופרבולות — דרך הידיים',
    icon: Sigma,
    gradient: 'from-violet-500 to-fuchsia-500',
    ring: 'ring-violet-400/60',
    text: 'text-violet-300',
    hex: '#a78bfa',
    chunk: 'hsl(270 55% 32%)',
    lessons: ['balance', 'linear', 'parabola'],
  },
  {
    id: 'geometry',
    title: 'גאומטריה',
    desc: 'זוויות, משולשים ומשפט פיתגורס',
    icon: Shapes,
    gradient: 'from-emerald-400 to-teal-500',
    ring: 'ring-emerald-400/60',
    text: 'text-emerald-300',
    hex: '#34d399',
    chunk: 'hsl(165 70% 22%)',
    lessons: ['triangle-angles', 'pythagoras'],
  },
  {
    id: 'trig',
    title: 'טריגונומטריה',
    desc: 'סינוס וקוסינוס על מעגל היחידה',
    icon: Waves,
    gradient: 'from-amber-400 to-orange-500',
    ring: 'ring-amber-400/60',
    text: 'text-amber-300',
    hex: '#fbbf24',
    chunk: 'hsl(25 80% 30%)',
    lessons: ['unit-circle'],
  },
];

// Middle-school students don't get the high-school-only lessons.
const HIGH_ONLY = new Set(['parabola', 'unit-circle']);

export function coursesFor(user) {
  const middle = MIDDLE_GRADES.includes(String(user?.grade));
  return COURSES.map((c) => ({ ...c, lessons: c.lessons.filter((id) => !(middle && HIGH_ONLY.has(id))) })).filter((c) => c.lessons.length);
}

export const getLesson = (id) => LESSONS[id] || null;
export const courseOf = (lessonId) => COURSES.find((c) => c.lessons.includes(lessonId));

// First lesson the student hasn't finished yet (in path order).
export function nextLesson(user, progress) {
  const ids = coursesFor(user).flatMap((c) => c.lessons);
  return getLesson(ids.find((id) => !progress.lessons?.[id]?.done) || ids[0]);
}

export function lessonAfter(user, lessonId) {
  const ids = coursesFor(user).flatMap((c) => c.lessons);
  const i = ids.indexOf(lessonId);
  return i >= 0 && i + 1 < ids.length ? getLesson(ids[i + 1]) : null;
}
