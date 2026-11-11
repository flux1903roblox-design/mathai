// The words a teacher reads for a student's mistake (TEACHER-16): the same words the student saw on the feedback line
// (catLabel: the stair's own misconception first, then the topic's name for it), never a raw id, and the stair they
// happened on. One id can mean different things on different stairs ('sign' is a negative length on coord:3), so every
// teacher surface names the stair: "מחר", the student's sheet, the class report, its printout and its CSV.
import { catLabel, TOPIC } from '@/content/index.js';

/** The words for a mistake on a stair, as the student saw them. */
export const mistakeText = (topic, level, cat) => catLabel(topic, level, cat) || TOPIC[topic]?.cats?.[cat] || 'טעות שחוזרת';

/** "מספרים מכוונים, מדרגה 1": the topic and the stair's number. */
export function stairShort(topic, level) {
  const t = TOPIC[topic];
  if (!t) return 'נושא אחר';
  return Number.isInteger(level) && level >= 1 ? `${t.title}, מדרגה ${level}` : t.title;
}

/** "מספרים מכוונים, מדרגה 1: חיבור וחיסור": the stair, named as the map names it. */
export function stairName(topic, level) {
  const title = TOPIC[topic]?.levels?.[level - 1]?.title;
  return title ? `${stairShort(topic, level)}: ${title}` : stairShort(topic, level);
}

/** A mistake in a student's row of the report (a cell, its printout and the CSV): the words, then the stair, short. */
export const mistakeLine = (topic, level, cat) => `${mistakeText(topic, level, cat)} (${stairShort(topic, level)})`;
