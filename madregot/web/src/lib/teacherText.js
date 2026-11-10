// The words a teacher reads for a student's mistake: the same words the student saw on the feedback line (catLabel:
// the stair's own misconception first, then the topic's name for it), never a raw id. Used by the class report, its
// CSV and its printout (TEACHER-7); TEACHER-16 brings the board's other mistake rows to the same helper.
import { catLabel, TOPIC } from '@/content/index.js';

export const mistakeText = (topic, level, cat) => catLabel(topic, level, cat) || TOPIC[topic]?.cats?.[cat] || 'טעות שחוזרת';
