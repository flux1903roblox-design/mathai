# Store mode inside the app (STUDENT-12 §1, the web side of §3)

From `web/e2e/store-mode.spec.js` (the Play Store app: `?src=play`, running standalone) and `web/e2e/store-ios.spec.js`
(the iPhone build, `VITE_STORE=ios`, its own Playwright project), against a fake server (`page.route`) on the free
taste. Thursday 5 November 2026. 390x844 unless named 320x568.

| File | What it shows |
|---|---|
| `ios-consent.png`, `ios-consent-dark.png` | The iPhone build, the first question to the tutor: "לפני שמדברים עם העוזר החכם", who the helper is (Claude by Anthropic, a program and not a person), what is sent and to the US, what is never sent or kept, "מה עוד כדאי לדעת", "כן, להמשיך" and "לא עכשיו". Nothing was sent yet. |
| `ios-settings.png` | The iPhone build's Settings, "העוזר החכם": the free taste line and "מידע להורים" only. No family plan row, no unlinking (the saved family token is never sent), no cancel row. |
| `ios-reminder-on.png`, `ios-reminder-on-dark.png` | The iPhone app's Settings with the native shell's bridge stood in: "תזכורת יומית" on at 19:00 and the toast "התזכורת תגיע בכל יום ב־19:00". The reminder is a local notification on each of the next 60 days without Shabbat, its eve and the holidays (`lib/localReminder.js`); there is no "add to the Home Screen" sentence in the App Store app. |
| `ios-reminder-denied.png` | The same when the student refused notifications on the phone: "ההתראות של מדרגות כבויות בהגדרות של האייפון. אפשר להפעיל אותן שם, ואז לחזור לכאן." Nothing is scheduled. |
| `ios-parents-info.png` | `/parents/info` in the iPhone build: "מידע להורים" and the sentence about the parent's free one-time OK. The footer has the legal links and no cancel link. |
| `play-limit-sheet.png`, `play-limit-sheet-dark.png`, `320x568-limit-sheet.png` | The Play Store app when today's free questions are used: "סיימתם את השאלות לעוזר החכם להיום. מחר יש עוד. השיעורים, התרגול ומדי פתוחים תמיד." No parents link, no price, no plan. |
| `play-settings.png`, `320x568-settings-dark.png` | Settings in the Play Store app: "מידע להורים" only. |
| `play-parents-info.png`, `play-parents-info-dark.png`, `320x568-parents-info.png` | `/parents/info` (and `/parents`, `/parents/link`, `/cancel`) in the Play Store app. |

Checked by tests:

- `store-mode.spec.js` (phone): the limit sheet has no "₪", "מנוי", "באתר" or link to `/parents` or `/cancel`;
  Settings has no "חיבור למנוי משפחתי" or "ביטול מנוי"; the four parents' routes show the store page with none of
  those words; the first screen has no "להורים" or "ביטול מנוי" (the website's has both); without `?src=play`, and with
  `?src=play` in an ordinary tab (not standalone), the website's rows are back.
- `store-ios.spec.js` (`ios` project, service workers allowed): the permission sheet comes before the first AI
  request; "לא עכשיו" sends nothing and keeps nothing, and the question waits in the input; "כן, להמשיך" keeps
  `ai.consentAt` and the request goes; the next question is not asked again; no request carries `X-Family-Device`
  although one is saved; no family or purchase rows; `navigator.serviceWorker.getRegistrations()` is empty.
- `src/lib/aiConsent.test.js`, `src/components/limitCopy.test.js` (the store variants), `worker/test/cors.test.js`
  (a preflight from `capacitor://localhost` is allowed; `https://evil.example` and look-alikes are not),
  `scripts/vite-plugin-brand.test.mjs` (the name lives in `shared/brand.js` only).

Not here yet: TRUST-9's QR code and link under the parents' sentence, and TRUST-4's "report this answer" button with
its store check (both on the trust lane).
