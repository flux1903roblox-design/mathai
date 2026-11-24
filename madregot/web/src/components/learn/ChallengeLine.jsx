// A unit's challenges on the topics screen (CURRICULUM-6.3): "אתגרים: {done} מתוך {open}", where open counts the unit's
// tasks whose stair is mastered (and any already solved). While a task is left to try, the line is a link to the next
// one. It shows nothing while nothing is open: no screen shows a row of zeros.
import { Link } from 'react-router-dom';
import { Puzzle, ChevronLeft } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { topicChallenges } from '@/learn/challenges/index.ts';

export const challengeLineText = (done, open) => `אתגרים: ${done} מתוך ${open}`;

export default function ChallengeLine({ topic }) {
  const skills = useApp((s) => s.learn.skills);
  const recs = useApp((s) => s.learn.challenges);
  const { open, done, next } = topicChallenges(topic, skills, recs);
  if (!open) return null;
  const text = challengeLineText(done, open);
  if (!next) return <p className="section-card-ch"><Puzzle size={18} aria-hidden="true" />{text}</p>;
  return <Link to={`/challenge/${next.id}`} className="section-card-ch" aria-label={`${text}. לאתגר הבא`}><Puzzle size={18} aria-hidden="true" />{text}<ChevronLeft size={18} aria-hidden="true" /></Link>;
}
