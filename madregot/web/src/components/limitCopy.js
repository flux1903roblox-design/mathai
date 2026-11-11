// The words of the tutor's limits, in one place so a test can read every one of them. They speak to a child calmly:
// no price, no plan, no buy button, no countdown, no lock. Madi and practice are always the way on.
// In a store app (store: !canSell(), STUDENT-12) no variant has a way to the parents' pages, and the day's limit says
// only when the questions come back: nothing that points to a plan or to buying anything.

/** The free questions are over for today, in a store app. */
export const STORE_DAILY_TEXT = 'סיימתם את השאלות לעוזר החכם להיום. מחר יש עוד. השיעורים, התרגול ומדי פתוחים תמיד.';

/** What the sheet says when the tutor says "not now". actions: 'madi' | 'practice' | 'licence'; parents: a small link. */
export function limitVariant({ reason, tier = null, scope = null, role = 'student', store = false } = {}) {
  const v = variant({ reason, tier, scope, role });
  if (!store) return v;
  if (reason === 'daily_limit' && role !== 'teacher') return { title: 'העוזר החכם חוזר מחר', text: [STORE_DAILY_TEXT], actions: ['madi', 'practice'], parents: false };
  return { ...v, parents: false };
}

function variant({ reason, tier, scope, role }) {
  const free = tier === 'free';
  const teacher = role === 'teacher';
  if (reason === 'daily_limit' && free && teacher) {
    return {
      title: 'השאלות של היום לעוזר החכם נגמרו',
      text: ['עם רישיון כיתה יש לכם עד 100 שאלות ביום, ולכל תלמיד עד 20.'],
      actions: ['licence'], parents: false,
    };
  }
  if (reason === 'daily_limit' && free) {
    return {
      title: 'העוזר החכם חוזר מחר',
      text: ['את השאלות של היום כבר שאלתם, והן מתחדשות מחר. בינתיים מדי יכול להסביר את המדרגה, להראות דוגמה פתורה ולעבור איתכם על הפתרון צעד אחר צעד, כמה שרוצים.'],
      actions: ['madi', 'practice'], parents: true,
    };
  }
  if (reason === 'daily_limit') {
    return { title: 'להיום סיימנו עם העוזר החכם', text: ['מחר הוא כאן שוב. מדי והתרגול פתוחים כל הזמן.'], actions: ['practice'], parents: false };
  }
  if (reason === 'shared_limit') {
    return {
      title: 'העוזר החכם עמוס היום',
      text: [scope === 'class'
        ? 'הכיתה שלכם שאלה אותו היום הרבה, אז הוא נח עד מחר. זה לא קשור לשאלות שלכם. מדי זמין גם עכשיו.'
        : 'הוא קיבל היום הרבה שאלות מאותה רשת אינטרנט, אז הוא נח עד מחר. זה לא קשור לשאלות שלכם. מדי זמין גם עכשיו.'],
      actions: ['madi', 'practice'], parents: false,
    };
  }
  if (reason === 'free_paused') {
    return { title: 'העוזר החכם נח היום', text: ['היום הוא כבר ענה על הרבה שאלות, ומחר הוא חוזר. מדי והתרגול פתוחים כמו תמיד.'], actions: ['madi', 'practice'], parents: false };
  }
  if (reason === 'monthly_fair_use') {
    return {
      title: 'הבדיקות של החודש נגמרו',
      text: ['בדיקת דף, בדיקת מבחן ותרגילים חדשים חוזרים ב־1 בחודש. העוזר עדיין עונה בשיחה, ומדי זמין תמיד.'],
      actions: ['practice'], parents: false,
    };
  }
  // paid_only (the screen thought the tool was open): what the full tutor does, and what is open now
  return {
    title: 'את זה עושה העוזר החכם המלא',
    text: ['בינתיים מדי יכול להסביר את המדרגה, להראות דוגמה פתורה ולעבור איתכם על הפתרון צעד אחר צעד.'],
    actions: teacher ? ['licence'] : ['madi', 'practice'], parents: !teacher,
  };
}

/** The quiet line about today's questions (AIAllowance), or null for nothing to say. */
export function allowanceText({ state, left, tier, ended = false }) {
  if (ended && tier === 'free') return 'העוזר החכם עובד עכשיו עם 2 שאלות ביום.';
  if (tier === 'free') {
    if (state === 'used' || left === 0) return 'העוזר החכם חוזר מחר. מדי כאן בינתיים.';
    if (state !== 'free' || !Number.isFinite(left)) return null;
    if (left === 1) return 'היום אפשר לשאול את העוזר החכם עוד שאלה אחת.';
    return `היום אפשר לשאול את העוזר החכם עוד ${left} שאלות.`;
  }
  if (state === 'used') return 'להיום סיימנו עם העוזר החכם. מחר הוא כאן שוב.';
  if (state !== 'open' || !Number.isFinite(left) || left > 5) return null;
  if (left === 1) return 'נשארה היום שאלה אחת לעוזר החכם.';
  return `נשארו היום ${left} שאלות לעוזר החכם.`;
}

/** What a tool says instead of opening the camera (ToolLocked). In a store app (store: true) there is no parents' link. */
export function lockedText(kind, { state = 'locked', inClass = false, store = false } = {}) {
  const t = lockedLines(kind, { state, inClass });
  return store ? { ...t, parents: false } : t;
}

function lockedLines(kind, { state, inClass }) {
  if (state === 'economy') return { lines: ['הבדיקה הזו חוזרת ב־1 בחודש.'], teacher: false, parents: false };
  if (kind === 'check') {
    return inClass
      ? { lines: ['את הבדיקה הזו עושה העוזר החכם המלא.', 'רוצים שמישהו יסתכל על הפתרון? אפשר לשלוח את הדף למורה.'], teacher: true, parents: false }
      : { lines: ['את הבדיקה הזו עושה העוזר החכם המלא.', 'בכל מדרגה יש פתרון מלא צעד אחר צעד.'], teacher: false, parents: true };
  }
  if (kind === 'generate') return { lines: ['תרגילים חדשים מכין העוזר החכם המלא. בינתיים יש בכל מדרגה תרגילים מוכנים.'], teacher: false, parents: !inClass };
  return { lines: ['את בדיקת המבחן עושה העוזר החכם המלא. אפשר לבדוק את המבחן לבד מול מפתח התשובות.'], teacher: false, parents: !inClass };
}
