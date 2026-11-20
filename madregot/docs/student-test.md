# The five-student test (STUDENT-16 §4)

**OWNER-ONLY.** Code cannot show how real 12-14-year-olds react to the app, so the owner runs this test. This file is
everything needed to run it:
- what to prepare;
- the parent's consent and the child's assent, in Hebrew;
- the five tasks;
- what to watch and how to log it;
- the questionnaire, in Hebrew;
- the success criteria, written before the test;
- the template for the results file.

The results go in `docs/student-test-results.md`, and that file holds **no personal data**.

## 1. Why at home, through parents

The test runs **outside school, through parents**. It does not go through a class, a teacher or the pilot:
- Research with students in Israeli schools needs a permit from the Ministry's Chief Scientist (Director-General's
  circulars "הנהלים לפעילות מחקרית במערכת החינוך", siduri 129, and "הנהלים לביצוע מחקר במערכת החינוך", siduri 529).
- Phones are not allowed in middle-school lessons unless the staff set aside a lesson for them (circular siduri 605).
- The app is built for home practice anyway.

A usability session at home, which a parent arranges and attends, involves neither the school nor class time. This is
the lane's reading of the circulars, not legal advice. If a school or a teacher is involved in any way, ask first.

## 2. Who, where, how long

- **Five students** in ז׳ or ח׳. Find them through parents you know, or parents who contact you after the `/mivchan/`
  page. Not your own children, and not the pilot's students.
- **No names in any record.** Each child is S1 to S5. The records keep only the code, the grade, the date and a
  minute-by-minute log. The signed consent forms are the only place a name appears. Keep them on paper, away from the
  repository and the results.
- **25 minutes each**, at home or in another place the family chooses, on **the child's own phone**, with **the parent
  in the room**.
- No screen recording, photos or audio. Notes by hand, or typed by the facilitator.

## 3. Before the session

1. The server is deployed with its address (owner step 2 in `QA_STUDENT.md`). If the reminder is to be part of the
   test, it is turned on (owner step 3). Without it, task 5 says so and is recorded as "not offered".
2. On the child's phone, open the app's address in the browser (or the Play app, if it is on internal testing). Check
   that the app opens on the first screen ("מתחילים"). If the phone used the app before, ask the parent first, then
   use "מחיקת כל הנתונים" in Settings.
3. If the child's class uses the app, the child joins with the class code during the session (task 1 or later). Only
   then is question 5 of the questionnaire asked.
4. Have ready: this file printed, the log sheet (section 7), a watch that shows seconds, and two copies of the consent
   form (section 4): one for the family, one for you.

## 4. Consent (the parent) and assent (the child)

### Consent form for the parent (Hebrew, print two copies)

> **הסכמה להשתתפות בבדיקת שימוש באפליקציה "מדרגות"**
>
> אנחנו בודקים איך תלמידי כיתות ז׳–ח׳ משתמשים באפליקציה לתרגול מתמטיקה. הבדיקה נמשכת כ־25 דקות, בבית או במקום
> שתבחרו, בטלפון של הילד או הילדה, ואתם נמצאים בחדר כל הזמן.
>
> **מה עושים:** הילד או הילדה מנסים את האפליקציה ועושים חמש משימות קצרות. אנחנו מסתכלים ורושמים מה קורה. בסוף יש
> שבע שאלות קצרות.
>
> **מה נרשם:** קוד (למשל S3), הכיתה, התאריך, ומה קרה בכל דקה. לא נרשם שם, טלפון או כתובת. אין צילום, אין הקלטה ואין
> צילום מסך. בודקים את האפליקציה, לא את הילד או הילדה, ואין ציון.
>
> **מה נשאר בטלפון:** ההתקדמות באפליקציה נשמרת בטלפון. אחרי הבדיקה אפשר להמשיך להשתמש בה, או למחוק הכול
> ב"הגדרות › מחיקת כל הנתונים".
>
> **אפשר להפסיק:** בכל רגע, בלי לתת סיבה. אם תבקשו, נמחק את הרישומים מהבדיקה.
>
> **למי לפנות:** ____________________ (כתובת מייל של בעל האפליקציה)
>
> אני ההורה או האפוטרופוס של ____________________, ומסכים או מסכימה להשתתפות בבדיקה.
>
> שם ההורה: ____________________ חתימה: ____________________ תאריך: __________

### Assent for the child (read aloud on the day, in these words)

> "אנחנו בודקים אפליקציה למתמטיקה ורוצים לראות מה עובד ומה לא. בודקים את האפליקציה, לא אותך. אין פה ציון ואין
> תשובה לא נכונה. אם משהו מבלבל, זו בעיה של האפליקציה, וזה בדיוק מה שאנחנו רוצים לגלות. אפשר להפסיק מתי שרוצים, רק
> להגיד. רוצה לנסות?"

Go on only if the child says yes. If the child wants to stop at any point, stop, thank them, and record "stopped at
minute N" without a reason.

## 5. The tasks

Read each task aloud as written, in the child's own grammatical gender. Do not show where to tap. If the child is stuck for **two minutes**, say "מה היית
מנסה עכשיו?". If they are still stuck after another minute, show the way and mark the task "helped".

| # | Task (say it in these words) | Ends when |
|---|---|---|
| 1 | "תתחיל/י מההתחלה, כמו שהיית עושה לבד." | The child is on the map or in a lesson, after the first questions |
| 2 | "תעשה/י שיעור אחד." | A lesson, or a teaching stage, ends with its result screen |
| 3 | "תמצא/י באפליקציה משהו שהיית רוצה להראות לחבר או חברה." | The child shows something, or says there is nothing |
| 4 | "תפתח/י את הארון של מדי." | The wardrobe ("המדי שלי") is open |
| 5 | "אם היית רוצה תזכורת, תפעיל/י אותה. אם לא, זה בסדר גמור." | The reminder is on, the child says no, or the app says it cannot (record which) |

## 6. What to watch

Write the minute (mm:ss from "מתחילים") next to each note.

- **Time to the first celebration.** Count from the tap on "מתחילים" to the first moment that celebrates: the end of a
  teaching stage ("שלב 1 הושלם!" with its XP), or a lesson's result screen. Record mm:ss.
- **Madi, unprompted.** Before task 4, does the child open the wardrobe, tap "עיצוב מדי", or try on a piece of their
  own accord? Yes or no, and at which minute.
- **Looking for something social.** Does the child look for friends, a league, a chat or sharing, or ask about one? Yes
  or no, and what they looked for.
- **Confusion.** Every hesitation over 10 seconds, every wrong tap that leads somewhere unexpected, every "מה זה?".
  Write the screen and the words the child used.
- **Feelings in their words.** Anything the child says about the reminder or the class goal, especially "לחץ"
  (pressure), "מעצבן" (annoying), "כיף" (fun) or "מגניב" (cool).

## 7. Log sheet (one per child)

```
Code: S_   Grade: ז׳ / ח׳   Date: ____   In a class that uses the app: yes / no
Started (מתחילים) at: __:__   Stopped early: no / at minute __

mm:ss | screen              | what the child did or said                 | note
------+---------------------+--------------------------------------------+-----------------
      |                     |                                            |

Task 1  done / helped / not done   at __:__
Task 2  done / helped / not done   at __:__
Task 3  showed: ______________________________
Task 4  done / helped / not done   at __:__
Task 5  turned on / chose not to / not offered: ______

First celebration at: __:__
Customised Madi unprompted: yes / no (at __:__)
Looked for something social: yes / no (what: ______)
```

## 8. The questionnaire (after the tasks)

Read each sentence aloud and show the scale. The child answers with a number. There are no right answers. The items are
adapted from the Intrinsic Motivation Inventory's interest and enjoyment items.

**הסולם:** 1 = בכלל לא נכון · 2 = לא כל כך נכון · 3 = קצת נכון · 4 = נכון · 5 = נכון מאוד

| # | Sentence | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| 1 | היה לי כיף לתרגל באפליקציה. | | | | | |
| 2 | הייתי רוצה לחזור לאפליקציה מחר. | | | | | |
| 3 | ההסברים עזרו לי להבין את הטעות שלי. | | | | | |
| 4 | המדי שלי מרגיש שלי. | | | | | |
| 5 | מטרת הכיתה גורמת לי לרצות לתרום. (only if the child's class uses the app) | | | | | |
| 6 | התזכורת נשמעת לי נעימה ולא לוחצת. | | | | | |

**Open question:** "מה היית משנה באפליקציה?" Write down the child's own words.

If the child made no mistake during the session, mark item 3 "no mistake seen" instead of asking it.

## 9. Success criteria (written before the test)

The test passes when all of these hold:

1. The median of items 1 and 2 (each child's two answers together, over the five children) is **4 or more**.
2. At least **3 of the 5** children customise Madi unprompted.
3. The median time to the first celebration is **3 minutes or less**.
4. **No child** calls the reminder or the class goal "לחץ" (pressure), in the questionnaire or aloud.

Item 5 is asked only of a child whose class uses the app. If no such child takes part, item 5 is left out. The class
goal is then judged from the pilot's own numbers (TEACHER-11, `npm run owner -- reach` and the pilot report) instead.

A criterion that fails is a finding, not a reason to change the criteria afterwards. Write it down as it is.

## 10. The results file

Copy this into `docs/student-test-results.md` and fill it in. No names, no school names and no contact details. Keep
each child's code, grade and the observations only.

```markdown
# Five-student test: results

Dates: ____ to ____ · Build (version.json): ____ · Reminder on the server: yes / no · Facilitator (role): owner

| Code | Grade | Class uses the app | First celebration (mm:ss) | Madi unprompted | Looked for social (what) | Tasks done / helped | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S1 | | | | | | | | | | | | |
| S2 | | | | | | | | | | | | |
| S3 | | | | | | | | | | | | |
| S4 | | | | | | | | | | | | |
| S5 | | | | | | | | | | | | |

## Against the criteria
1. Median of Q1-Q2: __ (pass if ≥ 4)
2. Customised Madi unprompted: __ of 5 (pass if ≥ 3)
3. Median time to the first celebration: __:__ (pass if ≤ 3:00)
4. "לחץ" about the reminder or the class goal: __ children (pass if 0)

## Confusions (screen, what happened, how many children)

## "מה היית משנה?" (the children's words, without codes if a sentence could identify a child)

## What we change, and which item it reopens (STUDENT-n)
```

After the test, link the results file from `QA_STUDENT.md`, section 3 ("No users"), and open an item for each failed
criterion and each confusion seen in two or more children.
