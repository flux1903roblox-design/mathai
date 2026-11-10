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

## Positioning

Built-in question generators with exact answers drive the practice and decide what is correct. Claude explains, converses and checks handwriting, always grounded in the exact question on screen and the answer the student actually typed. The practice works without the AI, and the AI never invents whether an answer is right for a built-in question.

## Operating Context

- Short sessions with a daily goal of about 10 minutes; a phone held in one hand; often in a classroom where sound is unwelcome.
- Hebrew, right to left, with math expressions isolated left to right.
- Teachers use a laptop browser, usually during a free period or the evening before a lesson.
- Student phones have no minus key on the numeric keyboard, so the app supplies its own keypad.

## Capabilities and Constraints

- Topics carried over from the school practice app the user pointed to (Vibewise): grade 7 signed numbers, the coordinate plane and angles; grade 8 slope and the equation of a line, the Pythagorean theorem, and statistics (frequency, mean, median, mode). Each topic is a ladder of levels.
- Ladder rules: two correct answers in a row without a mistake or hint move up a level; after a mistake or hint, four are needed. A question answered wrong comes back three questions later.
- AI features (all four were requested): explain a mistake, chat about the current question, generate new questions, and check a photo of handwritten work.
- The Anthropic key never reaches student browsers. A personal key stored on one device is allowed only in solo mode.
- A daily AI limit per student keeps cost predictable.
- Minors' privacy: a class code plus a short personal code to join, no class roster shown to students, first name and initial in anything other students can see.
- Undecided: the product name ("מדרגות" is a working name), the default model and daily AI limit per class, whether parents get a view.

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
