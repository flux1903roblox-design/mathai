# Store privacy answers: DRAFT

> **DRAFT for the owner (STUDENT-12 §6).** Drafted on 11 November 2026 by hand, then checked the same day, row by row,
> against TRUST-1's data map (`worker/datamap.json`: every D1 table, every key the app keeps on a device, and what the
> AI receives) on the integrated branch (FOLLOWUP-40). Where this file and the data map ever differ, the data map is
> right. Check the store forms again on the submission day, because their questions change. Have the lawyer read this
> file together with the in-app privacy text (`web/src/content/legal/privacy.md`).

Nothing in either app is used for tracking or advertising. There are no ads, no advertising ID and no analytics or
crash SDK, and no data is sold. All traffic is HTTPS.

## What leaves the phone, by mode

| Mode | Kept on the phone | Sent to our server (Cloudflare Worker and D1) | Sent to others |
|---|---|---|---|
| **Solo, no AI** (the default; works offline) | progress, settings, the name typed on the first screen (`madregot` in localStorage), theme (`madregot-theme`), store-app flag (`madregot-src`) | nothing, except the reach counts in the last row | none |
| **Solo, AI used** (free daily taste) | as above, plus a random device id (32 hex characters) | the question, the exercise on screen, what the student typed, and a photo if one was taken (for the answer only; **not stored**). The device id and a one-way hash of the network address count the daily allowance (`ai_usage`). | **Anthropic** (Claude) receives the same text and photo to write the answer: no name, email or phone. In the iOS app the student is asked first (`AIConsentSheet`, Apple 5.1.2(i)). |
| **Class student** | as above | the first name chosen for the class, a PIN (hashed), each answer (topic, step, right or wrong, first try, hint, the mistake's type, seconds, day), step levels, help requests to the teacher and the replies in their thread (question, note, optional notebook photo; `help_requests`, `help_messages`), the work on the teacher's assignments and class exams (`assignment_work`, `exams`), and class-goal points (no topic, no answer; `class_steps`). The teacher sees them. With the backup code on, the class keeps the code by default (`vault_escrow`), so the student gets the progress back with the PIN; that copy is not end-to-end encrypted. | Anthropic, as above, when AI is used |
| **Linked family device** (Android app only; the iOS app never sends the family token) | the device's token | the token's hash and the label the parent chose ("הטאבלט") (`family_devices`). While the child's and the parent's sharing switches are both on: one summary a day for the parents' report, with counts and stair and mistake codes only (`family_daily`). The parent's account (email) is made on the website, never in the app. | Anthropic, as above |
| **Daily reminder on** | Android: the push address in IndexedDB `madregot-push`. iOS: local notifications, so nothing leaves the phone. | Android only: the browser's push address and keys, the hour chosen, and three days (last opened, last lesson, last sent) in `push_subs`. No name, class or device id. | Android only: the browser's push service (Google's) delivers the reminder, encrypted. |
| **Teacher** | the class key | class name, the teacher's name as typed, the key (hashed), the class's settings and assignments (title, note, dates; `assignments`) and the replies to help requests (`help_messages`). Signed in by email (TEACHER-1): the email (`accounts`), the sign-in sessions (`account_sessions`) and which classes it owns (`class_owners`). For a trial or quote: school name and class size (`licence_requests`). | **Resend** sends the sign-in code email. |
| **Backup code on** (optional, Settings › שמירת ההתקדמות) | the code | an encrypted copy of the progress that only the code opens (`vaults`, ciphertext; the server never has the key). | none |
| **Every mode** | | reach counts: one row per day per named step (`metrics_daily`, e.g. `install_offer`, `store_open_play`). No device, address, account or student. The app's error reports (DURABLE-9, `client_errors`): what broke, scrubbed (no device id, address or name; the screen's route pattern only). A reported AI answer (TRUST-4, `answer_reports`): the tutor's text with personal details masked, never the child's message or who sent it. | none |

Kept for (`shared/retention.js`, as in the data map and the in-app privacy text): class goal points 120 days, reach
counts 400 days, error reports 30 days, a reported AI answer 60 days, the parents' daily summaries 90 days, an encrypted
backup 400 days after its last use, a reminder until it is turned off or 45 days after the app was last opened; sign-ins
unused for 180 days are removed, and an account with no sign-in for 730 days (and no plan or money record) is deleted.
On the phone, Settings › "מחיקת כל הנתונים" deletes everything: the saved state, the backup on the server, the reminder
on the server and the family link.

## Google Play: target audience and Data safety

**Target audience:** "9–12" and "13–15" (grade 7 starts at 12). The Families Policy applies:
- no ads SDKs;
- no advertising ID;
- a privacy policy link in the listing and in the app (`/#/privacy`);
- no free-form exchange between users, so no safety reminder is needed (the AI chat is with the tutor, not with people);
- AI answers can be reported in the app (TRUST-4, merged: the report button under each tutor answer).

**Does the app collect or share user data?** Yes, collected. Nothing is "shared" in Play's sense, because Cloudflare,
Anthropic, Resend and Google's push service process data on our behalf.

**Is all data encrypted in transit?** Yes.

**Can people ask for their data to be deleted?** Yes. In the app: Settings › מחיקת כל הנתונים. A class student's record
on the server is removed by the teacher (remove the student) or by writing to `CONTACT_EMAIL`. A teacher's or parent's
account is deleted on the website (`<PUBLIC_URL>/#/parents` › delete account); give that address as the deletion URL.

**Is collection optional?** Yes for every type. The app works fully with no server and no AI.

| Play data type | Collected? | Why | Optional | Notes |
|---|---|---|---|---|
| Personal info › Name | yes | App functionality | yes | a class student's first name, the teacher's name; only for a class |
| Personal info › Email address | yes | App functionality, Account management | yes | a teacher who signs in by email (TEACHER-1) or asks for a trial or quote |
| Photos and videos › Photos | yes | App functionality | yes | a notebook photo for the AI (processed ephemerally) or for the teacher (kept with the help request) |
| App activity › Other user-generated content | yes | App functionality | yes | questions typed to the AI (processed ephemerally); a class student's answers |
| App activity › App interactions | yes | App functionality, Analytics | yes | a class student's practice record; the reach counts (not linked to anyone) |
| Device or other IDs | yes | App functionality, Fraud prevention and security | yes | the random device id for the free AI allowance; the push address for the reminder |
| App info and performance › Crash logs, Diagnostics | yes | App functionality | no | the app's error reports (DURABLE-9), scrubbed and not linked to anyone; a build with `VITE_MONITOR=off` sends none |
| Location, Contacts, Messages, Financial info, Health, Audio, Files, Calendar, Web history | no | | | payments happen only on the website, never in the app |

## Apple: App Privacy (nutrition label) and age

**Data used to track you:** none. **Tracking domains:** none (`store/ios/PrivacyInfo.xcprivacy`, which `make.sh`
copies into the Xcode project, declares `NSPrivacyTracking` false and no tracking domains; `web/scripts/check-dist.mjs`
refuses any build that names an analytics or ads host).

| Apple data type | Linked to the user? | Purpose | Notes |
|---|---|---|---|
| Contact Info › Name | yes | App Functionality | class student's first name, teacher's name |
| Contact Info › Email Address | yes | App Functionality | a teacher who signs in by email, or asks for a trial or quote |
| User Content › Photos or Videos | yes (class) / no (solo) | App Functionality | notebook photos for the AI or the teacher |
| User Content › Other User Content | yes (class) / no (solo) | App Functionality | questions to the AI, a class student's answers |
| Identifiers › Device ID | no | App Functionality | the random id that counts the free AI allowance |
| Usage Data › Product Interaction | yes (class) / no (counts) | App Functionality, Analytics | the class practice record; the anonymous reach counts |
| Diagnostics › Crash Data, Other Diagnostic Data | no | App Functionality | the app's error reports (DURABLE-9), scrubbed, with no device id |

**Third parties to name** (Apple 5.1.2(i), from 13 Nov 2025): Anthropic receives what the student types or photographs
for the AI, in the US. Cloudflare hosts the server and database. Resend sends sign-in codes to teachers.

**Category and age:** Education, **not** the Kids category (that category is for 11 and under). Answer the age-rating
questionnaire on the submission day. The app has no user-to-user communication and no web browsing outside the app's own
site, and the AI tutor is limited to maths.

**Account deletion (5.1.1(v)):** a teacher can sign in by email in the app, so the store build must also let that
teacher delete the account in the app. TEACHER-1 is merged, but its "מחיקת החשבון" is on `/parents`, which the store
apps replace with "מידע להורים": the teacher's screens still need their own row for it. Do not submit the iOS app
before that row exists (`store/README.md`).

## Before submitting (owner)

1. TRUST-1 (data map), TRUST-4 (report an AI answer), TRUST-9 (free parent OK) and TEACHER-1 (teacher account) are
   merged, and this file was checked against `worker/datamap.json` on 11 Nov 2026. Two store-only pieces still block
   the submissions (`store/README.md`): the parent's OK inside the store apps, and a teacher's account deletion in
   them. Check this file against the data map again after any change to it.
2. DURABLE-9's error reports are on (the rows above say what they send). If you build with `VITE_MONITOR=off`, remove
   those rows.
3. Have the lawyer read this file and the privacy page together.
