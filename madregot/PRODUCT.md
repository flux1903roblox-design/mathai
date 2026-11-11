# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite front end (the user's choice). Cloudflare Worker with a D1 database as the shared server (the user's choice). Claude through the Anthropic API for every AI feature (the user's choice). The front end is a static build that can live on GitHub Pages; the Worker holds the Anthropic key as a secret.

## Users

- **Students in grades 7 and 8 (ז׳–ח׳) in Israeli schools.** They practise math for a few minutes a day, mostly on their own phones, at home or in a lesson. They want to get unstuck fast and see that they are moving up.
- **Teachers who run a class.** They open a class, hand the students a class code, and check on a laptop who practised, who is stuck, which mistakes repeat, and who asked for help.
- **Students practising alone**, with no class and no teacher. Their progress stays on their device.

## Product Purpose

Daily adaptive practice for the middle-school curriculum, with an AI tutor beside every question. Success means a student practises most days, climbs the levels of each topic, and understands a mistake right after making it, while the teacher knows what to reteach tomorrow.

Parents: a free weekly summary the child sends by WhatsApp or link (no server); in the family plan, a daily synced summary per device (90-day retention, the child notified and able to stop it, the parent able to stop or delete it) and an optional Sunday email.

## Positioning

Built-in question generators with exact answers drive the practice and decide what is correct. Claude explains, converses and checks handwriting, always grounded in the exact question on screen and the answer the student actually typed. The practice works without the AI, and the AI never invents whether an answer is right for a built-in question.

## Operating Context

- Short sessions with a daily goal of about 10 minutes; a phone held in one hand; often in a classroom where sound is unwelcome.
- Hebrew, right to left, with math expressions isolated left to right.
- Teachers use a laptop browser, usually during a free period or the evening before a lesson.
- Student phones have no minus key on the numeric keyboard, so the app supplies its own keypad.

## Capabilities and Constraints

- Topics: units of the Ministry's grade 7 and grade 8 programme, each a ladder of stairs (the first six came from the school practice app the user pointed to, Vibewise). Which units are taught, partly taught or not yet, with the Ministry's hours and months, is in `PROGRAMME.md`, generated from the code by `npm run programme:md`; the app shows the same at `/programme`. Public text never types a coverage figure or a count of topics or stairs: where it states coverage, it quotes the generated sentence ("במדרגות יש כבר את החומר של … מתוך … שעות ההוראה של כיתה …"), and `learn/claims.test.ts` fails when a quoted sentence or a count differs from the code.
- Grade 7 signed numbers include signed fractions and decimals (the last stair of the unit), as the Ministry's programme asks; grade 8 opens with ratio, proportion and scale, then percent, then the introduction to functions (so far its first two stairs, reading a graph of a situation and the function and its representations), in the school year's order.
- The floor (יסודות): a bridge unit of fractions and decimals below grade 7. It belongs to no grade, is counted in no grade's stairs, and joins the map only when the floor check (one question from each of its stairs and two multiplication facts) finds a gap in fractions; a missed fact offers a short multiplication-facts practice that counts for no stair. It is offered, never forced: in onboarding to a student who says everything is new, in Topics, and in the plan when a hard stair leans on fractions and nothing is known yet. The student can always open it from Topics and can hide it from the map without losing the evidence.
- One "what next": a single ranked plan (`learn/next.ts`) feeds the home map's focus and its banner, today's mission and Exam Rescue's "today", so two buttons never point to two different next things; every item says why in one sentence. New stairs follow the Ministry's school calendar. The older improvement plan is retired; points lost in a checked exam are a band of the one plan.
- The challenge track: for a strong student, three optional tasks per topic (the floor included): a claim to judge as always, sometimes or never true, a proof to put in order with a reason for each step or someone's solution to fix, and a real-world task. Code grades every part (counterexamples are evaluated, proofs checked step by step), so it needs no AI and no network. A task opens after its stair's mastery check, gives two tries per part and then the solution, and counts for XP, the daily goal and the streak like a lesson, never for mastery. A written explanation stays on the screen only and is self-checked against a sample answer and a rubric.
- Path rules: a stair is done (and counted, and the path moves on) only after its mastery check, five questions without hints with at least four right; practice fills the stair's ring and leads to that check. Checks and the placement test are built so that guessing passes them less than 2% of the time. A question answered wrong comes back at the end of the lesson. A repaired misconception is verified with two probe questions and one control question, and passes only with all three right.
- The first session pays off: a finished teaching stage (understand, worked examples, solve together) earns XP the first time (10, 5 and 10), counts for the daily goal, keeps the streak like a lesson, and ends in a short completion moment that says what comes next. It is recorded as learning, never as mastery.
- Counters move from the first stage: a stair has five stages (the three teaching stages, practice, the mastery check). A unit shows its size, then its stages done, then its stairs done once one is mastered, with a bar of all its stages. No screen shows a row of zeros.
- Every teaching step that names a shape or a part of one (a ray, a vertex, a leg, the hypotenuse, a transversal, an exterior angle) shows it in a drawing whose letters and numbers match the text; a test checks the letters and the geometry.
- A student's Settings has nothing about servers or keys. The class server's address and a personal Claude key are on an adult-facing "מתקדם" screen.
- AI features (all four were requested): explain a mistake, chat about the current question, generate new questions, and check a photo of handwritten work.
- The Anthropic key never reaches student browsers. A personal key stored on one device is allowed only in solo mode.
- A daily AI limit per student keeps cost predictable.
- Minors' privacy: a class code plus a short personal code to join, no class roster shown to students, first name and initial in anything other students can see.
- Undecided: the product name ("מדרגות" is a working name), the default model and daily AI limit per class.

## Brand Commitments

- The app must not use the Vibewise name, its logos, or the school's logo.
- Standing preference (10 November 2026): the category standard, executed at the level of Brilliant, Duolingo, Apple and Photomath. Light and calm, one brand colour, large readable type, consistent across every screen; nothing that looks childish or cheap.

## Evidence on Hand

No users, testimonials, metrics or school partners yet. Nothing of the kind may be invented.

## Product Principles

1. The question owns the screen: everything else gets out of its way.
2. A mistake is the lesson: feedback appears where the student is looking, next to their own answer.
3. Code grades, the AI explains.
4. The teacher dashboard answers one question: what do I do tomorrow?
5. Private by default, because the users are children.

## Accessibility & Inclusion

WCAG 2.2 AA contrast, touch targets of at least 44px, feedback announced to screen readers, reduced motion respected, and correct bidirectional rendering of math inside Hebrew text.
