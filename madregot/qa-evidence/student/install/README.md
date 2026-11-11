# Install offer on Android and desktop (STUDENT-10)

Taken from the e2e build (no server) at 390x844 and 320x568, with Chrome's `beforeinstallprompt` played by a
synthetic event, the clock on Thursday 5 November 2026, and a student who learned the day before.

| File | What it shows |
|---|---|
| `install-card.png` | The last screen after a lesson, from the second learning day: a home screen with the app's icon, "מדרגות במסך הבית", one sentence, "להתקין" and "לא עכשיו". |
| `install-card-dark.png` | The same in dark mode. |
| `install-card-320x568.png` | The same on the smallest phone. |
| `settings-row.png` | Settings: "להתקין את האפליקציה" under "האפליקציה", shown only while the browser offers an install. |
| `installed-toast.png` | After the browser's `appinstalled`: "מדרגות הותקנה. אפשר לפתוח אותה ממסך הבית." |
| `manifest-check.txt` | What Chrome itself reports for the manifest (`Page.getAppManifest` and `Page.getInstallabilityErrors`, the data the DevTools Application > Manifest panel shows): no parse errors or warnings, no installability errors, and the id, launch handler and three shortcuts as Chrome parsed them. `manifest-check.cjs` makes it again. |

When it is offered (lib/install.js `installDue`): the browser offers an install, this is no store app and not the
installed app, at least 2 learning days, fewer than 2 offers, and none in the last 30 days. Never inside a lesson,
never on Welcome, never on the first day. On iPhone there is no such event, so nothing shows there.

Tested in `web/e2e/install.spec.js` and `web/src/lib/install.test.js`. The manifest screenshots come with the
store screenshots' capture script (STUDENT-12), which renders the same screens at 1080 wide.
