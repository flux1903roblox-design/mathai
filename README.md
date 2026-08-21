# MathAI — מורה פרטי למתמטיקה (100% מקומי)

אפליקציית עזרה במתמטיקה לכיתות ז'–י"ב. הכול רץ אצלך במחשב:
ה-AI הוא **Ollama** מקומי (במקום ה-API של Base44), והנתונים (משתמשים, היסטוריה) נשמרים ב-localStorage של הדפדפן.

## הרצה

1. ודא ש-Ollama רץ ושיש מודל עם תמיכה בתמונות:

```bash
ollama pull gemma3:27b
```

2. הפעל את האפליקציה:

```bash
npm install
npm run dev
```

3. פתח את http://localhost:5173 — "המשך עם Google" יוצר משתמש מקומי מיידי (אין OAuth אמיתי).

## החלפת מודל

ברירת המחדל היא `gemma3:27b`. להחלפה, הרץ בקונסולת הדפדפן:

```js
localStorage.setItem('mathai_ollama_model', 'qwen3.5:27b')
```

(לסריקת תמונות נדרש מודל עם יכולת vision — כמו gemma3.)

## מה הוחלף מ-Base44

- `src/lib/localdb.js` — המימוש המקומי: entities ב-localStorage, auth מקומי, ו-InvokeLLM מול Ollama (`/api/chat` עם JSON schema).
- אין שרת, אין Stripe אמיתי — "רכישה" ב-Paywall פשוט מעדכנת את המשתמש המקומי.
