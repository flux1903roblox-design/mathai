# Daily reminder by web push (STUDENT-11)

The screens come from the e2e build (`VITE_API_URL=none`, with a saved server address answered by `page.route`). The
service worker is running and notifications are allowed. The clock is Thursday 5 November 2026, and the student
learned on the two days before. Chromium has no push service there, so an init script plays `PushManager.subscribe()`
and returns a made-up push address. Sizes are 390x844 and 320x568, light and dark.

| File | What it shows |
|---|---|
| `reminder-card.png` | The last screen after a lesson, from the third learning day, once ever. It shows a sample notification, "רוצים תזכורת קטנה?", one sentence on the rules, the hour (17:00 chosen by default), "להפעיל" and "לא, תודה". |
| `reminder-card-dark.png` | The same in dark mode. |
| `reminder-card-320x568.png`, `reminder-card-320x568-dark.png` | The same on the smallest phone. |
| `turned-on-toast.png` | Back on the map after "להפעיל" with 19:00 chosen: "התזכורת תגיע בכל יום ב־19:00". |
| `settings-on.png` | Settings, "תזכורת יומית": "פועלת", the hour (18:00), and the rules line. |
| `settings-on-320x568-dark.png` | The same on the smallest phone in dark mode. |
| `settings-paused.png` | After the server paused it (6 ignored reminders in a row): off, with "עצרנו את התזכורות כי הן לא עזרו בימים האחרונים…". |
| `settings-iphone.png` | iPhone Safari in a tab: only "באייפון התזכורות עובדות אחרי שמוסיפים את מדרגות למסך הבית." No install button (see below). |
| `worker-tests.txt` | The Worker's tests: the RFC 8291 vector, VAPID, and every date of the quiet-day rules (Shabbat, the eve of Yom Kippur, the eve of Pesach, memorial days and their eves, Tish'a B'Av). |

Where it is tested:

- `web/e2e/push.spec.js` (phone, on full Chromium in headless mode, because the headless shell has no
  notifications) checks:
  - 3 learning days and a lesson bring the card;
  - "להפעיל" sends an endpoint and slot 17 to `/api/push/subscribe`, and the id is kept in IndexedDB `madregot-push`;
  - a second lesson that day posts `seen { done: true }` once;
  - Settings shows "פועלת" and the hour; a new hour sends `replaces`; "כבויה" calls `/api/push/off`;
  - a push delivered through DevTools (`ServiceWorker.deliverPushMessage`) shows a notification titled "מדרגות" with `dir: rtl` and `lang: he`;
  - with the switch off, or with no server, only "בגרסה הזו אין תזכורות." shows;
  - iPhone in a tab: only the Home Screen sentence, and no card.
- `web/src/lib/push.test.js` covers every `pushState()` branch, `enable(17)`, a new hour, `disable()`, `markDone()`
  once a day, a pause, a 404, and the id the service worker replaced.
- `web/src/sw/sw.test.js` covers the `push`, `notificationclick` (with the `push_open` count) and
  `pushsubscriptionchange` handlers.

Not built here:

- **iPhone install guide.** DURABLE-3's `InstallSheet`, which carries progress across with a backup, is not on this
  branch. On iPhone Safari there is therefore no card, and Settings shows only the sentence above. The "איך מוסיפים"
  link comes with the durable merge. Installing without the backup step would lose progress.
- **A real reminder on a phone** (`real-device.jpg`). This is an owner step after the keys and the deploy (README.md,
  "התזכורת היומית").
