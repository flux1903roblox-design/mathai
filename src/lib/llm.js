const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };


import { gradeLabel, profileLabel } from './curriculum';

function ctx(user) {
  if (!user?.grade) return 'התלמיד לומד מתמטיקה בישראל.';
  return `פרופיל התלמיד: ${profileLabel(user.grade, user.track)}. התאם את רמת הפתרון והמושגים לתוכנית הלימודים הישראלית לאותה רמה.`;
}

const SOLUTION_SCHEMA = {
  type: 'object',
  properties: {
    question_text: { type: 'string' },
    topic: { type: 'string' },
    final_answer: { type: 'string' },
    solution: { type: 'string' },
  },
  required: ['question_text', 'solution'],
};

const QUESTION_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' },
          explanation: { type: 'string' },
          topic: { type: 'string' },
        },
        required: ['question', 'answer', 'explanation'],
      },
    },
  },
  required: ['questions'],
};

const LEVEL_DESC = {
  hint: 'רמז קצר בלבד — כיוון כללי לדרך הפתרון, מבלי לחשוף את הפתרון המלא או את התשובה הסופית',
  partial: 'פתרון חלקי — הצג את השלבים המרכזיים והנוסחאות החשובות, ובלי לחשוף את התשובה הסופית',
  full: 'פתרון מלא ומפורט צעד-אחר-צעד עד לתשובה הסופית',
};

export async function solveFromImage({ imageUrl, helpLevel, user }) {
  const prompt = `אתה מורה פרטי למתמטיקה בישראל. ${ctx(user)}
בתמונה מצורפת שאלת מתמטיקה. קרא את השאלה בזהירות (טקסט, נוסחאות, מספרים).
רמת העזרה המבוקשת: ${LEVEL_DESC[helpLevel] || LEVEL_DESC.full}.
החזר JSON בלבד עם השדות:
- question_text: ניסוח השאלה בעברית.
- topic: נושא השאלה (למשל: אלגברה, גאומטריה, טריגונומטריה, חדו"א, סטטיסטיקה, הסתברות).
- final_answer: התשובה הסופית בקצרה (אם רמת העזרה היא רמז — השאר ריק).
- solution: הסבר בעברית ב-Markdown עם שלבים ממוספרים. כתוב כל נוסחה ב-LaTeX בין $...$ (למשל $x^2+3x=10$), ונוסחה מרכזית בשורה נפרדת בין $$...$$. היה ברור ומדויק.`;
  return db.integrations.Core.InvokeLLM({
    prompt,
    file_urls: [imageUrl],
    response_json_schema: SOLUTION_SCHEMA,
    model: 'gpt_5_4',
  });
}

export async function solveFromText({ text, helpLevel, user }) {
  const prompt = `אתה מורה פרטי למתמטיקה בישראל. ${ctx(user)}
פתור את השאלה הבאה שכתב התלמיד:
"${text}"
רמת העזרה המבוקשת: ${LEVEL_DESC[helpLevel] || LEVEL_DESC.full}.
החזר JSON בלבד באותו מבנה (question_text, topic, final_answer, solution). הסבר בעברית כ-Markdown עם שלבים ממוספרים, נוסחאות ב-LaTeX בין $...$ ונוסחה מרכזית בין $$...$$.`;
  return db.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: SOLUTION_SCHEMA,
    model: 'gpt_5_4',
  });
}

export async function chatReply(history, newMessage, user) {
  const convo = history
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'תלמיד' : 'מורה'}: ${m.content}`)
    .join('\n');
  const prompt = `אתה מורה פרטי למתמטיקה בישראל. ${ctx(user)}
ענה על שאלות התלמיד בעברית ברורה ומפורטת. כתוב נוסחאות ב-LaTeX בין $...$ (ונוסחה מרכזית בין $$...$$). הסבר שלב-אחר-שלב כשצריך. היה מעודד וקצר כשאפשר.
שיחה עד כה:
${convo || '(תחילת שיחה)'}

תלמיד: ${newMessage}
מורה:`;
  const res = await db.integrations.Core.InvokeLLM({ prompt });
  return typeof res === 'string' ? res : res?.response || JSON.stringify(res);
}

// In-lesson tutor (Brilliant "Koji"-style): a short nudge for the exact step the student is stuck on.
export async function lessonHint({ lessonTitle, stepTitle, task, feedback, user }) {
  const prompt = `אתה מורה פרטי למתמטיקה בישראל, סבלני ומעודד. ${ctx(user)}
התלמיד באמצע שיעור אינטראקטיבי בנושא "${lessonTitle}", בשלב "${stepTitle}".
המשימה שקיבל:
${task}

התלמיד ניסה וטעה. המשוב האוטומטי שקיבל: "${feedback}".
כתוב לו רמז קצר (2–4 משפטים) בעברית שיעזור לו להבין מה לא עובד ואיך לחשוב על זה — בלי לגלות את התשובה הסופית. כתוב נוסחאות ב-LaTeX בין $...$.`;
  const res = await db.integrations.Core.InvokeLLM({ prompt });
  return typeof res === 'string' ? res : res?.response || '';
}

export async function generatePractice({ topics, count, difficulty, user }) {
  const prompt = `אתה בוחן מתמטיקה בישראל. ${ctx(user)}
צור ${count} שאלות תרגול ברמת קושי "${difficulty || 'medium'}" מהנושאים: ${topics.join(', ')}.
כל שאלה כוללת: question (נוסח השאלה בעברית), answer (תשובה סופית קצרה וברורה), explanation (הסבר קצר כ-Markdown), topic.
השאלות צריכות להיות מגוונות, מדויקות וברות-פתרון. החזר JSON בלבד.`;
  const res = await db.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: QUESTION_SCHEMA,
  });
  return res?.questions || [];
}

export async function generateExam({ topics, count, user }) {
  const prompt = `אתה בוחן בגרות במתמטיקה בישראל. ${ctx(user)}
צור מבחן אמריקאי עם ${count} שאלות בנושאים: ${topics.join(', ')}.
סגנון השאלות כמו שאלון בגרות — רב-שלביות כשצריך, ברמה המתאימה לפרופיל.
כל שאלה: question (נוסח מלא בעברית), answer (תשובה מפורטת קצרה), explanation (פתרון כ-Markdown), topic.
החזר JSON בלבד.`;
  const res = await db.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: QUESTION_SCHEMA,
    model: 'gpt_5_4',
  });
  return res?.questions || [];
}