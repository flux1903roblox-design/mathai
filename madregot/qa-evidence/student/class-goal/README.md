# The class goal of the week (STUDENT-4): proof

Stage 11 of the student lane. Every picture is against a fake server (no Worker, no real data); the classmates in the
teacher's board (יואב, דנה, עומר) are made up, and the student's screens are checked never to show them.

From `web/e2e/class-goal.spec.js` (run with `CLASS_GOAL_SHOTS=<this folder>`), on `phone` (390x844) and
`phone-small` (320x568):

| File | What it shows |
| --- | --- |
| `*-card-mid.png` | Quests: the card above today's missions, "23 מתוך 60 צעדים", "החלק שלכם השבוע: 4 צעדים" |
| `*-card-new-week.png` | Tuesday of a new week with no steps yet: "שבוע חדש…" and last week's line |
| `*-card-reached.png` | The class reached the goal with the student's part: gold bar, Madi happy, the scarf line |
| `*-card-reached-not-mine.png` | Reached without the student's part: the calm line, no "you didn't" |
| `*-moment.png` | The moment ("עשינו את זה יחד"), shown once a week, Madi wearing the class scarf |
| `*-teacher-block.png`, `*-teacher-block-off.png` | The teacher's "מטרת כיתה שבועית" block on the "תלמידים" view, on and off |

From `goalshots.cjs` (a preview of the e2e build on port 4232, light and dark):

| File | What it shows |
| --- | --- |
| `more-quests-mid-390-dark.png`, `more-quests-reached-320-dark.png` | The card in dark mode |
| `more-quests-reached-not-mine-390-light.png` | Reached without the student's part |
| `more-moment-320-dark.png`, `more-moment-390-light.png` | The moment in dark and light |
| `more-learn-side-desktop-*.png` | The compact card in Learn's side panel on a wide screen |
| `more-teacher-head-320-light.png` | The chip "מטרת הכיתה: 23/60" in the teacher board's header |
| `more-teacher-students-390-dark.png` | The teacher's block in dark mode |
| `more-qa-mid-solo-390-light.png` | The staging fixture `?qa-goal=mid` (no server, no class) |

The worker side (stage 10) is proved by `worker/test/goal.test.js`.
