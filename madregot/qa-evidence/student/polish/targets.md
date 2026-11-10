# Touch targets before and after (STUDENT-9 §1)

Every button, link, summary, radio and tab on six student screens, measured in Chromium at 390×844 and 320×568 with
the e2e test data (a student with a week of practice). "Before" is the build at commit ffe07e5, "after" is this
commit. Links inside running text are exempt (WCAG 2.5.8): they sit in a `<p>` or a list item's text, or carry
`data-inline`. The raw sizes are in `targets-before.json` and `targets-after.json`, and `e2e/targets.spec.js` fails
if any other target on these screens is under 44×44 again.

On Quests, the two exempt links are the titles of today's mission items. Each title is a stretched link
(`.today-link::after` covers the whole row), so a tap anywhere on the row opens it, and the row is taller than 44px.

The council's "כל הנושאים והמצב בכל אחד" link (183×19, inside the sentence at the end of the path) was exempt as an
inline link before. It is now a button on its own line: 44px tall, counted in "after".

| Screen | Width | Targets before | Under 44×44 before | Targets after | Under 44×44 after | Inline links (exempt) after |
|---|---|---|---|---|---|---|
| Learn | 390 | 49 | 5 | 50 | 0 | 0 |
| Topics | 390 | 40 | 25 | 40 | 0 | 0 |
| Quests | 390 | 13 | 2 | 13 | 0 | 2 |
| Me | 390 | 8 | 0 | 8 | 0 | 0 |
| A lesson (with tools) | 390 | 7 | 3 | 7 | 0 | 0 |
| A teaching step | 390 | 4 | 0 | 3 | 0 | 0 |
| Learn | 320 | 49 | 5 | 50 | 0 | 0 |
| Topics | 320 | 40 | 25 | 40 | 0 | 0 |
| Quests | 320 | 13 | 2 | 13 | 0 | 2 |
| Me | 320 | 8 | 0 | 8 | 0 | 0 |
| A lesson (with tools) | 320 | 7 | 3 | 7 | 0 | 0 |
| A teaching step | 320 | 4 | 0 | 3 | 0 | 0 |

| Screen | Width | Target | Class | Count | Before | After |
|---|---|---|---|---|---|---|
| Learn | 390 | תזכורת מהשיעור: מספרים מכוונים | `unit-guide` | 1 | 32×48 | 44×48 |
| Learn | 390 | תזכורת מהשיעור: מערכת צירים | `unit-guide` | 1 | 32×48 | 44×48 |
| Learn | 390 | תזכורת מהשיעור: זוויות | `unit-guide` | 1 | 32×48 | 44×48 |
| Learn | 390 | תזכורת מהשיעור: ביטויים אלגבריים | `unit-guide` | 1 | 32×48 | 44×48 |
| Learn | 390 | תזכורת מהשיעור: משוואות | `unit-guide` | 1 | 32×48 | 44×48 |
| Topics | 390 | חיבור וחיסור: מתרגלים | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | השוואת מספרים: מתרגלים | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | כפל וחילוק: מתרגלים | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | סדר פעולות: מתרגלים | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | סוגריים: מתרגלים | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | קריאת נקודה: מתרגלים | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | רביעים: מתרגלים | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | אורך קטע: עוד לא התחלנו | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | שטח מלבן: עוד לא התחלנו | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | קודקוד חסר: עוד לא התחלנו | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | זוויות צמודות: עוד לא התחלנו | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | זוויות קודקודיות: עוד לא התחלנו | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | סכום זוויות במשולש: עוד לא התחלנו | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | ישרים מקבילים: עוד לא התחלנו | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | שווה־שוקיים וזווית חיצונית: עוד לא התחלנו | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | הצבה בביטוי: עוד לא התחלנו | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | כותבים ביטוי: עוד לא התחלנו | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | כינוס איברים דומים: עוד לא התחלנו | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | חוק הפילוג: עוד לא התחלנו | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | פישוט ביטויים: עוד לא התחלנו | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | משוואה ופתרון: עוד לא התחלנו | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | משוואה בשני צעדים: עוד לא התחלנו | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | נעלם בשני האגפים: עוד לא התחלנו | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | משוואות עם סוגריים: עוד לא התחלנו | `mm-tile` | 1 | 34×34 | 44×44 |
| Topics | 390 | בעיות מילוליות: עוד לא התחלנו | `mm-tile` | 1 | 34×34 | 44×44 |
| Quests | 390 | עליתם 7 מתוך 25 | `continue-chip` | 1 | 163×38 | 163×44 |
| Quests | 390 | דבר אחד לחזק | `continue-chip` | 1 | 142×38 | 142×44 |
| A lesson (with tools) | 390 | רמז | `tool` | 1 | 40×40 | 44×44 |
| A lesson (with tools) | 390 | שאלה למדי | `tool` | 1 | 40×40 | 44×44 |
| A lesson (with tools) | 390 | מחברת | `tool` | 1 | 40×40 | 44×44 |
| Learn | 320 | תזכורת מהשיעור: מספרים מכוונים | `unit-guide` | 1 | 32×48 | 44×48 |
| Learn | 320 | תזכורת מהשיעור: מערכת צירים | `unit-guide` | 1 | 32×48 | 44×48 |
| Learn | 320 | תזכורת מהשיעור: זוויות | `unit-guide` | 1 | 32×48 | 44×48 |
| Learn | 320 | תזכורת מהשיעור: ביטויים אלגבריים | `unit-guide` | 1 | 32×48 | 44×48 |
| Learn | 320 | תזכורת מהשיעור: משוואות | `unit-guide` | 1 | 32×48 | 44×48 |
| Topics | 320 | חיבור וחיסור: מתרגלים | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | השוואת מספרים: מתרגלים | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | כפל וחילוק: מתרגלים | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | סדר פעולות: מתרגלים | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | סוגריים: מתרגלים | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | קריאת נקודה: מתרגלים | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | רביעים: מתרגלים | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | אורך קטע: עוד לא התחלנו | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | שטח מלבן: עוד לא התחלנו | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | קודקוד חסר: עוד לא התחלנו | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | זוויות צמודות: עוד לא התחלנו | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | זוויות קודקודיות: עוד לא התחלנו | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | סכום זוויות במשולש: עוד לא התחלנו | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | ישרים מקבילים: עוד לא התחלנו | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | שווה־שוקיים וזווית חיצונית: עוד לא התחלנו | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | הצבה בביטוי: עוד לא התחלנו | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | כותבים ביטוי: עוד לא התחלנו | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | כינוס איברים דומים: עוד לא התחלנו | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | חוק הפילוג: עוד לא התחלנו | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | פישוט ביטויים: עוד לא התחלנו | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | משוואה ופתרון: עוד לא התחלנו | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | משוואה בשני צעדים: עוד לא התחלנו | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | נעלם בשני האגפים: עוד לא התחלנו | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | משוואות עם סוגריים: עוד לא התחלנו | `mm-tile` | 1 | 30×30 | 44×44 |
| Topics | 320 | בעיות מילוליות: עוד לא התחלנו | `mm-tile` | 1 | 30×30 | 44×44 |
| Quests | 320 | עליתם 7 מתוך 25 | `continue-chip` | 1 | 163×38 | 163×44 |
| Quests | 320 | דבר אחד לחזק | `continue-chip` | 1 | 142×38 | 142×44 |
| A lesson (with tools) | 320 | רמז | `tool` | 1 | 40×40 | 44×44 |
| A lesson (with tools) | 320 | שאלה למדי | `tool` | 1 | 40×40 | 44×44 |
| A lesson (with tools) | 320 | מחברת | `tool` | 1 | 40×40 | 44×44 |

On a teaching step the count drops from 4 to 3 because the disabled "הקודם" on step 1 is gone (§4).

## Screenshots in this folder

- `numberline-not-yet-390x664.png` replaces the council's `t3-02-wrong1.png` (kept here as `before-t3-02-wrong1.png`).
  The marker went the wrong way (+6 to 10) and the student checked. The number line and both of its buttons now sit
  above the "not yet" sheet. The sheet shows its first sentence, and the rest is behind "עוד". There is also a
  `320x568` version. `e2e/manip.spec.js` checks this at both sizes.
- `predict-wrong-390x664.png` replaces `t6-01-predict-wrong.png` (kept as `before-t6-01-predict-wrong.png`). The
  "−1" and "5" on the cards, and "−3" in the sentences, are plain Rubik text with a real minus sign. In "2 + (−3)"
  the digits are Rubik and the operators are KaTeX's. Display maths (the panel) is not changed.
- `teach-step-1-390.png`: no "הקודם" on the first step.
- `welcome-greeting-390.png`: "נעים להכיר, נועה! באיזו כיתה?"
- `me-numbers-390.png`: the profile numbers in the student's words, with "עוד מספרים" open.
- `topics-tiles-320x568.png`, `lesson-tools-320x568.png`, `learn-all-topics-button-320x568.png`: 44px tiles, tools
  and the topics button on the smallest phone.
