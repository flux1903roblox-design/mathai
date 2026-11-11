# App Store screenshots

Five frames for the iPhone 6.7" display (1290 × 2796, JPEG, no transparency), one benefit each, in order:

| File | Headline | Line under it |
|---|---|---|
| `iphone-6.7-1-numberline.jpg` | מזיזים את המתמטיקה בידיים | גוררים, רואים מה קורה, ובודקים. |
| `iphone-6.7-2-map.jpg` | עולם לכל נושא | מפה של מדרגות, מכפור ואש ועד פירמידות. |
| `iphone-6.7-3-hint.jpg` | רמז שמצויר על התרגיל | מדי מראה איפה לחפש, בלי לגלות את התשובה. |
| `iphone-6.7-4-climb.jpg` | מדרגה אחרי מדרגה | כל שיעור מעלה את מדי עוד צעד. |
| `iphone-6.7-5-topics.jpg` | שישה נושאים, 33 מדרגות | כיתות ז׳ וח׳, כמה דקות ביום. |

Every screen inside the phone is the real app (a no-server build), captured at 430 × 932 at 3x: nothing is mocked. The framing follows the stageshow skill's rules: one thing said per frame, the product big and running off an edge, no plate behind it, real words only where the story is.

To make them again, in an empty working folder: `node <this folder>/capture.cjs store` (it builds the app without a server, serves it on port 4238 and saves the five screens, `raw-*.png`), then `node <this folder>/frames.cjs` (the frames, `store-*.png`); convert them to JPEG for the store. `--dist <folder>` reuses a build made with `VITE_API_URL=none`.

## Landing page pictures

`node madregot/store/capture.cjs landing` makes the pictures of the landing pages (STUDENT-13) in `web/landing/img/`:
`phone-rescue.webp` and `phone-teacher.webp` (Exam Rescue and the teacher's board in a phone, 1080 wide, at most 70 KB,
WebP encoded by Chromium's canvas in the page) and `og-mivchan.png` / `og-pilot.png` (the link previews, 1200 × 630).
The teacher's board needs a server, so `page.route` answers it with a synthetic class (first names only). Run it again
after a screen it shows changes; `npm run build` copies the files into `dist/l/`.
