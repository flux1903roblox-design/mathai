# Game-based math apps, photo/AI solvers, and Israeli middle-school math platforms (2024-2026), with lessons for a Hebrew RTL, phone-first, Duolingo-style grade 7-8 app with an AI tutor that checks photographed work

Research date: 2026-11-06. Flags: [OLD] = information from before 2024; [SELF] = company or vendor claim; [WEAK] = blog, aggregator, or advertorial source.

## (A) Game-based learning apps: does the game wrapper help learning or distract, and which UI and motivation patterns are worth copying for ages 12-14?

### Takeaway
The evidence is mixed. Games that make the math itself the mechanic (DragonBox, From Here to There) improve conceptual understanding of equations. Their transfer to standard paper-and-pencil equation solving is weak or no better than a good tutor or textbook practice. Games that wrap rote questions in an RPG economy (Prodigy) are documented to spend much of play time on non-math activity and membership upsell. A grade 7-8 app should copy mechanics where acting on the math is the game, and Duolingo's streak, XP, and short-lesson loop. It should avoid cosmetic paywalls and visible "member vs non-member" status.

### Cited Findings

#### Prodigy Math (Prodigy Education, Canada)
- Prodigy Math is an RPG where players answer math questions to win battles and cast spells. Prodigy English was added in April 2022 (grades 1-6). One account covers both — [Wikipedia: Prodigy Education](https://en.wikipedia.org/wiki/Prodigy_Education)
- On 19 Feb 2021, Fairplay (then the Campaign for a Commercial-Free Childhood) and 21 other groups filed an FTC complaint. It said the game was assigned in about 90,000 schools, is marketed as free, and pushes a paid membership. The complaint counted 16 membership ads and only 4 math problems in 19 minutes of play [OLD] — [Fairplay press release](https://fairplayforkids.org/feb-19-2021-advocates-to-ftc-prodigy-math-game-preys-on-kids-and-families/); [complaint PDF](https://fairplayforkids.org/wp-content/uploads/2021/02/Prodigy_Complaint_Feb21.pdf); [Axios](https://www.axios.com/2021/02/19/prodigy-math-game-ftc-complaint)
- Press put membership at $59.88-$107.40 per child per year in 2021 [OLD] — [EdWeek](https://www.edweek.org/technology/popular-interactive-math-game-prodigy-is-target-of-complaint-to-federal-trade-commission/2021/02). A later Fairplay page cites up to $120 a year plus an "Ultimate" tier over $180 a year (post-Sept 2021; undated) — [Fairplay "7 reasons"](https://fairplayforkids.org/?p=26304)
- Fairplay's other design critiques [OLD, advocacy source]:
  - Members get hats, pets, and cloud rides. Non-members are shown an ad when they try to open the treasure chest.
  - Much play happens in "Lamplight Town," described as a shopping mall.
  - Membership status is visible to classmates: members ride clouds, non-members walk in dirt.
  - The math is rote and not part of the plot.
  - A Prodigy-funded study is cited as finding about 888 questions per +1 point on a standardized test.
  - Source: [Fairplay "7 reasons"](https://fairplayforkids.org/?p=26304)
- Prodigy's response: the game mentions memberships "from time to time" and does not pressure users — [Wikipedia](https://en.wikipedia.org/wiki/Prodigy_Education). Fairplay's 2021 annual report said the FTC was investigating — [Fairplay 2021 report](https://fairplayforkids.org/wp-content/uploads/2021/10/2021-Annual-report.pdf). I found no later FTC enforcement action.
- Senator Markey and Rep. Castor asked for an investigation [OLD] — [Markey press release](https://www.markey.senate.gov/news/press-releases/with-more-children-online-during-the-pandemic-senator-markey-rep-castor-call-for-investigation-of-prodigy-educations-online-math-game-for-kids). The UK Guardian covered criticism of the premium model in UK schools in 2021 — [inkl/Guardian](https://www.inkl.com/news/maths-app-targeting-uk-schools-is-criticised-over-premium-model)
- Teacher reviews are mixed to positive. One recommends it for independent practice; another says it should "focus more on the math side … and less on profit" — [Common Sense Education teacher review](https://www.commonsense.org/education/reviews/prodigy-math/teacher-reviews/5105172); [Common Sense review list](https://www.commonsense.org/education/reviews/3927006/teacher-reviews?page=26)
- Prodigy says 96% of parents and teachers were satisfied with its educational impact, from surveys it commissioned [SELF] — [prodigygame.com](https://www.prodigygame.com/main-en)
- A January 2026 Trustpilot review complained that a membership was needed to change grade level [WEAK, single user] — [Trustpilot](https://ch.trustpilot.com/review/prodigygame.com)

#### DragonBox (now "Kahoot! Algebra by DragonBox" / "Kahoot! Algebra 2")
- The DragonBox apps are now sold under Kahoot!. Access needs a Kahoot!+ Family or Kahoot! Kids subscription, with a 7-day free trial. Teachers get access through Kahoot! Premium+/EDU — [Kahoot DragonBox page](https://kahoot.com/home/learning-apps/dragonbox/); [App Store: Kahoot! Algebra](https://apps.apple.com/us/app/-/id1550574178)
- Example regional price: Kahoot! Kids at QAR 19.99 a month or QAR 129.99 a year (Qatar App Store, 2025). Kahoot! Algebra 2 is listed for ages 9+ — [App Store QA: Algebra 2](https://apps.apple.com/qa/app/kahoot-algebra-2-by-dragonbox/id1550574547)
- Carnegie Mellon classroom study, 190 grade 7-8 students, comparing DragonBox with the Lynnette intelligent tutor on a paper equation-solving test. The authors concluded that in-game learning did not carry over to standard equation solving [OLD, 2017] — [ACM TOCHI paper via Unpaywall](https://unpaywall.org/10.1145%2F3057889)
- As summarized in secondary literature, Dolonen & Kluge (2015) found grade 8 DragonBox users more engaged but with lower learning gains than students doing textbook-style practice [OLD; I did not read the primary] — [eJMT review article](https://ejmt.mathandtech.org/Contents\eJMT_v10n1p1.pdf)
- 2023 randomized trial (Decker-Woodrow et al., *AERA Open*; Chan et al., 2023, *J. Computer Assisted Learning*):
  - 4,092 US grade 7 students; conditions were From Here to There (FH2T), DragonBox 12+, ASSISTments, and an active control.
  - FH2T and DragonBox both raised conceptual understanding of equivalence, and posttest scores beat the active control.
  - Procedural knowledge and flexibility rose at midtest but fell back by posttest.
  - FH2T had a larger effect than DragonBox for higher-pretest students.
  - Sources: [FH2T project summary of findings](https://sites.google.com/view/from-here-to-there/research-findings_1/summary-of-findings); [DOAJ record](https://doaj.org/article/28d05a10d8ea487f80d0c3b6811e3e9d)
- In FH2T, "slow-steady progressors," students who reattempted problems more often, showed the largest learning gains (Lee et al., 2022) — [FH2T summary](https://sites.google.com/view/from-here-to-there/research-findings_1/summary-of-findings)
- DragonBox's "83% learn algebra basics in an hour" and 93% mastery figures come from promotional challenges whose problems resembled the game [OLD, SELF] — [EdSurge 2016](https://edsurge.com/news/2016-03-13-enter-the-dragonbox-can-a-game-really-teach-third-graders-algebra)

#### Mathigon / Polypad (Amplify)
- Polypad is completely free for students, teachers, and parents. Amplify acquired both Mathigon and Desmos Classroom and is merging them. Polypad moved to polypad.amplify.com in February 2024 and uses Desmos sign-in, which is only needed to save work — [Polypad FAQ](https://polypad.amplify.com/faqs); [Amplify acquisition release](https://amplify.com/news/amplify-acquires-k-12-mathematics-education-innovator-mathigon/)

#### Duolingo Math (the stated design reference)
- Math lessons count toward the same streak as language lessons, and XP from any subject adds to one total — [Duolingo blog: new subjects](https://blog.duolingo.com/new-subjects/); [Duolingo blog: math launch](https://blog.duolingo.com/duolingo-launches-math-app/)
- A May 2026 tracker lists the Duolingo math course by grade, 2 through 12, with unit counts per grade [WEAK] — [Duolingo Data](https://duolingodata.com/dat/mathfen255.html)
- I found no substantive independent review of how well Duolingo Math teaches — (search found only Product Hunt and app-store copy).

### Inferences
- The best-supported pattern is "the math is the mechanic." In DragonBox and FH2T, students drag and transform the expression itself. That builds equivalence sense, but it needs an explicit bridge to written notation, because the transfer studies show the skill does not carry over automatically. For grades 7-8, alternate manipulative-style steps with "now write it as you would in your notebook."
- Prodigy shows what to avoid for 12-14 year olds: cosmetic economies, visible status gaps between paying and free users, and upsell interrupting practice. These are the specific features child advocates and senators targeted.
- Rewarding reattempts and persistence fits the FH2T finding better than rewarding speed. Streaks and XP should credit effort and corrected mistakes, not only correct first tries.
- Middle schoolers are older than Prodigy's and DragonBox 5+'s core audience. Duolingo's adult-neutral, short-lesson, streak-based loop is probably a better tonal fit than a fantasy RPG.

### Gaps
- No 2024-2026 independent audit of Prodigy's current ad-to-math ratio. All the critical counts date from 2021.
- I did not verify Prodigy's current membership prices, its grade range (grades 1-8 is commonly cited but I did not source it), or its current Israeli or Hebrew availability.
- DragonBox Elements (geometry) evidence was not found.
- No source on whether Polypad or Mathigon has a Hebrew localization (Arabic, Croatian, and Ukrainian versions exist per URLs seen in search, unverified).
- No effectiveness research on Duolingo Math was found.

## (B) Photo/AI solver and homework-help apps: phone capture flow, step display, "why," handwriting, accuracy, cheating, the shift toward learning, and what students and teachers say

### Takeaway
The category moved in 2024-2026 from "snap, get answer" toward hints, guided questions, and live AI tutors. Examples are Photomath's contextual hints and animated "why" steps, ChatGPT Study Mode (July 2025), Gemini Guided Learning (August 2025), and Gauth's voice AI Live Tutor. The market also consolidated: Microsoft Math Solver was retired in July 2025, Socratic was folded into Google Lens, and Google briefly pulled a Chrome "homework help" button after professors complained about cheating. I found no rigorous public data on handwriting-recognition accuracy. Teacher concern centers on direct answers.

### Cited Findings

#### Photomath (Google)
- App Store listing features: scan handwritten, textbook, or on-screen problems; step-by-step "Animated Steps"; explanations of the "what" and "why" of each step; word-problem instructions; interactive graphs; multiple solution methods; a scientific calculator. It supports 32 languages including Hebrew, is rated 4+, and has 4.7 stars from about 56K ratings (Canada store) — [App Store (CA)](https://apps.apple.com/ca/app/id919087726?l=en-ca)
- Photomath Plus adds AI-powered animated tutorials, deeper explanations, contextual hints, and custom solutions for problems in many textbooks — [Google Photomath Help](https://support.google.com/photomath/answer/14330572?hl=bg)
- US price is about $9.99 a month or $69.99 a year — [Android Central](https://www.androidcentral.com/apps-software/google-unveils-photomath-app). The Canada store lists $12.49-$13.49 entries (currency not shown) — [App Store (CA)](https://apps.apple.com/ca/app/id919087726?l=en-ca)
- Google moved Photomath to its own developer account on Google Play and keeps it as a separate app. Commentators expect the technology to feed into Lens and Search — [Android Central](https://www.androidcentral.com/apps-software/google-unveils-photomath-app); [APKMirror](https://www.apkmirror.com/apk/google-inc/photomath)
- Recent releases (e.g., 8.46.0, September 2025) are described as bug fixes and performance work. No major 2025 feature announcement was found — [APKMirror](https://www.apkmirror.com/apk/google-inc/photomath)
- The App Store privacy label lists data "not linked to you" (purchases, location, user content, identifiers, usage data) — [App Store (CA)](https://apps.apple.com/ca/app/id919087726?l=en-ca)

#### Mathway (Chegg)
- Answers are free. Step-by-step solutions cost $9.99 a month or $39.99 a year under terms effective December 2023 [OLD terms]. Mathway, LLC is a Chegg subsidiary — [Mathway Premium Terms](https://mathway.com:443/Premium-Terms); [App Store](https://apps.apple.com/app/mathway/id467329677)

#### Gauth / Gauthmath (ByteDance-linked)
- Developer is GAUTHTECH PTE. LTD. Features listed: step-by-step explanations, an AI Live Tutor by voice with a virtual whiteboard, a "study converter" that turns notes, audio, or lecture links into quizzes and flashcards, DeepThinking mode, and 24/7 human experts. It is rated 4+, with 4.8 stars from about 1.5M ratings — [App Store (US)](https://apps.apple.com/us/app/id1542571008)
- Gauth PLUS costs $11.99 a month, $31.99 a quarter, or $99.99 a year — [App Store (US)](https://apps.apple.com/us/app/id1542571008)
- Privacy label: "Identifiers" are used to track users. Contact info, user content, identifiers, usage, and diagnostics are linked to the user — [App Store (US)](https://apps.apple.com/us/app/id1542571008)
- It reportedly held the #1 US education-app download spot for six days in Q3 2025 [WEAK] — [UC Strategies review](https://ucstrategies.com/news/gauth-ai-review-can-this-tool-really-help-you-study-like-a-real-teacher/). ByteDance ownership raises TikTok-style privacy concerns in commentary [opinion] — [Implicator](https://www.implicator.ai/bytedances-homework-app-gauthmath-quietly-conquers-american-classrooms/)

#### Brainly
- Combines community Q&A with an AI Tutor that generates step-by-step answers when no community answer exists. Claimed "350M+ users"; Plus reportedly $24 a year [WEAK, comparison sites; unverified] — [AI Tools Atlas](https://aitoolsatlas.ai/compare/socratic-google-vs-brainly-ai); [Toolkitly](https://www.toolkitly.com/compare-ai-tools/551-289/41/gauth-vs-brainly-ai)

#### Microsoft Math Solver (discontinued)
- Retired 7 July 2025 after an announcement on X in June 2025. Removed from Microsoft's site and app stores — [Wikipedia](https://en.wikipedia.org/wiki/Microsoft_Math_Solver); [Microsoft Q&A](https://learn.microsoft.com/zh-cn/answers/questions/5769057/why-stop-math-solver). The Edge math-solver feature was also discontinued — [LavX News](https://news.lavx.hu/article/microsoft-is-scrapping-a-useful-edge-feature-for-seemingly-no-reason)

#### Socratic (Google) and Google Lens
- Socratic's functionality was merged into Google Lens in 2025 per Wikipedia. Reddit reports put the move around October 2024. No official Google announcement was found — [Wikipedia: Socratic](https://en.wikipedia.org/wiki/Socratic_(Google)); [Nibble blog](https://nibble-app.com/blog/socratic-app)
- September 2025: Google temporarily disabled a Chrome/Lens "homework help" button after professors objected that it made cheating easy. Google said students "appreciate tools that help them learn and understand concepts visually" — [inkl](https://www.inkl.com/news/google-eliminates-its-cheat-button-that-gave-ai-answers-to-questions-and-irked-teachers)
- Lens has had a math "Homework" filter since 2020 [OLD] — [Engadget](https://www.engadget.com/google-lens-socratic-math-problems-102931355.html)

#### General AI assistants' learning modes (2025)
- OpenAI launched ChatGPT Study Mode ("Study and learn") on 29 July 2025, free on all plans. It uses questions, calibrated hints, and knowledge checks instead of full solutions, and accepts photo, PDF, and notes uploads — [TechCrunch](https://techcrunch.com/2025/08/06/google-takes-on-chatgpts-study-mode-with-new-guided-learning-tool-in-gemini/); [Educative](https://www.educative.io/newsletter/artificial-intelligence/openai-study-learn-tool); [Pearson explainer (Feb 2026)](https://pearson.com/international-schools/international-schools-blog/2026/02/what-is-gemini_s-guided-learning-and-chatgpts-study-mode-.html)
- Google launched Gemini Guided Learning on 6 August 2025, free, built on LearnLM, with images, diagrams, videos, and interactive quizzes — [TechCrunch](https://techcrunch.com/2025/08/06/google-takes-on-chatgpts-study-mode-with-new-guided-learning-tool-in-gemini/)
- A hands-on comparison noted students may need to explicitly ask ChatGPT to "help me learn this" for the mode to engage — [Pearson explainer](https://pearson.com/international-schools/international-schools-blog/2026/02/what-is-gemini_s-guided-learning-and-chatgpts-study-mode-.html)
- A Hebrew report says OpenAI launched a teen-oriented ChatGPT that guides with questions and breaks problems into steps instead of giving ready answers [partially covered, not independently verified] — [Channel 14](https://www.c14.co.il/article/1667695)

#### Accuracy and handwriting
- No peer-reviewed study of Photomath's handwriting-recognition accuracy was found. Blog figures (about 90-95%) lack methodology [WEAK] — [ThinkAssist blog](https://thinkassist-nextapp.pages.dev/blog/best-app-to-solve-math-problems)
- A review notes camera recognition is sensitive to handwriting quality, lighting, and formatting [WEAK] — [Tool Directory](https://tooldirectory.ai/tools/photomath)
- Small local studies (a Philippines undergraduate thesis and an Ecuador survey of 83 students and 5 teachers) report positive associations between Photomath use and learning, with weak designs — [CAPSU repository](https://repository.capsu.edu.ph/handle/123456789/839); [UTB repository](https://dspace.utb.edu.ec/handle/49000/11149?show=full)

#### What teachers say
- Teachers report spending substantial time detecting AI cheating (2025) — [KALW](https://www.kalw.org/2025-08-13/the-homework-machine-ai-arrives-in-schools)
- A 2025 survey reportedly found more than a quarter of 200+ K-12 teachers had caught a student cheating with ChatGPT [secondary report] — [Yahoo Tech](https://tech.yahoo.com/general/articles/surveys-suggest-chatgpt-cheating-students-104550858.html)
- The line educators draw is between step-by-step "tutoring" and copying direct answers — [UC Strategies](https://ucstrategies.com/news/gauth-ai-review-can-this-tool-really-help-you-study-like-a-real-teacher/)

### Inferences
- The phone flow has converged on: camera, a crop box around one problem, a recognized-expression preview the user can edit, the answer, then expandable steps with "why." The learning-oriented variant inserts hints or guiding questions before the full solution. For an app that checks photographed work, the useful change is to compare the student's own written steps to a correct path and point at the first wrong line, not to solve from scratch.
- Recognition is a known weak point (lighting, messy handwriting) with no public accuracy benchmarks. Always show the parsed expression or lines back to the student for confirmation before grading, and let them fix misreads by typing.
- The free, general learning modes in ChatGPT and Gemini are now the baseline competitor. A specialized app must win on curriculum alignment (Israeli grade 7-8 sequence), Hebrew-native explanations, and grading the student's own work.
- To answer teachers' cheating concern, lead with "check my work" and hints, and don't give finished solutions to unsolved problems without an attempt. This matches what Google, OpenAI, and Gauth now market.

### Gaps
- No primary Photomath or Google statement on 2025-2026 feature changes or on Lens/Photomath integration in Hebrew.
- No independent accuracy benchmarks for any solver on handwritten middle-school work, and none for Hebrew word problems.
- Brainly's current features, prices, and the "350M users" claim are unverified, as are any formal district or school bans on Gauth.
- Mathway's 2025-2026 price was not confirmed from an official current page (terms dated 2023).
- No Common Sense Media privacy ratings were retrieved for these apps.

## (C) Israel: what middle-school students and teachers use, Hebrew/RTL math conventions, the grade 7-8 curriculum, and gaps a new app could fill

### Takeaway
Official Israeli middle-school math runs on:
- Ministry digital spaces: the "Pedagogical Space" (מרחב פדגוגי), Moodle learning spaces, question banks, and Mafmar exams (מבחני מפמ"ר).
- Approved textbooks and digital content, much of it from CET/מט"ח and its Ofek (אופק) LMS.
- GeoGebra and Desmos as the only apps the Ministry lists.

Schools buy external programs through the Gefen (גפ"ן) budget catalog. I found no Hebrew, phone-first, gamified practice app for grades 7-8 with clear traction. Matific is K-6, Go Math is a small Israeli entrant, and AI efforts (eSelf+CET avatars, Vimi) are early. Hebrew math is written LTR inside RTL text, and generic renderers often break it. The 2025-26 (תשפ"ו) grade 7-8 sequences are published month by month, which makes curriculum-aligned unit design straightforward.

### Cited Findings

#### Ministry of Education resources
- The Ministry's middle-school math "Sites, tools and digital books" page lists:
  - Approved textbooks for grades 7, 8, and 9 (the latter two via the digital catalog ecat.education.gov.il).
  - Content environments by grade.
  - Sites: thought-provoking puzzles, a teachers' newsletter, the Weizmann Institute "Adasha" recorded lessons, and "Learning from Mistakes," an online bank of typical student errors.
  - Apps: GeoGebra, Graph, and Desmos only.
  - Source: [pop.education.gov.il: atarim-kelim](https://pop.education.gov.il/tchumey_daat/matmatika/chativat-beynayim/teaching-mathematics/atarim-kelim)
- The Ministry's national Moodle math learning spaces are mainly for trying out. Teachers must open a private space for their class to manage learning — [pop.education.gov.il: Moodle learning spaces](https://pop.education.gov.il/tchumey_daat/matmatika/chativat-beynayim/teaching-mathematics/learning-spaces-moodle-environment/)
- The Ministry publishes topic question files with higher- and lower-level sets — [pop.education.gov.il: question files](https://pop.education.gov.il/tchumey_daat/matmatika/chativat-beynayim/teaching-mathematics/question-files/). There is also summer-preparation material for grade 8 graduates — [pop: summer preparatory math 8](https://pop.education.gov.il/maagal_hashana/summer-preparatory/mathematics-8/)
- The grade 7 and 8 teaching schedules point teachers to the Pedagogical Space (teaching plans, learning materials, question collections, Mafmar exams), the Moodle site, and the "Maor" literacy tasks for grades 7-9 (a Ministry and Trump Foundation program). Grade 7 also lists STEM tasks from "Israel Realit" (ישראל ריאלית) for תשפ"ו — [Grade 8 schedule PDF](https://meyda.education.gov.il/files/Pop/0files/matmatika/Chativat-Beynayim/tashpav/prisa8tashpav.pdf); [Grade 7 schedule PDF](https://meyda.education.gov.il/files/Pop/0files/matmatika/Chativat-Beynayim/tashpav/prisa7tashpav.pdf); [Maor (Univ. of Haifa)](https://maor.haifa.ac.il/?p=30310)
- The Ministry runs free online tutoring for grades 7-12 that includes math — [Protocol](https://protocol.co.il/free-private-lessons-students/)
- The education minister declared 2025 the "year of AI." The teachers' organization (Irgun HaMorim) refused to take part, saying teachers don't even have laptops — [JPost](https://jpost.com/israel-news/article-837133); [Mako](https://www.mako.co.il/news-education/2025_q1/Article-7680a4e92c9f491026.htm)

#### CET (מט"ח) / Ofek (אופק)
- Ofek is CET's school LMS for assigning tasks to each student by level, with formative and summative assessment. Its middle-school site has thousands of interactive activities, units, and videos in math and other subjects — [Ofek (CET)](https://myofek.testing.cet.ac.il/he); [Ofek middle-school repository](https://ebaghigh.cet.ac.il/%D7%9E%D7%90%D7%92%D7%A8/%D7%97%D7%98%D7%99%D7%91%D7%AA-%D7%91%D7%99%D7%A0%D7%99%D7%99%D7%9D/%D7%9E%D7%93%D7%A2-%D7%95%D7%98%D7%9B%D7%A0%D7%95%D7%9C%D7%95%D7%92%D7%99%D7%94/7162/); [CET catalog: Ofek renewed](https://www.cet-catalogue.cet.ac.il/%D7%90%D7%95%D7%A4%D7%A7)
- CET's catalog lists "Now Math" (עכשיו מתמטיקה), a hybrid book plus digital environment for grades 7-8 co-developed with Benny Goren, and "FULL PROOF," a computerized geometry/triangles practice system for grades 7-11 shown with the Gefen logo. There is also an Arabic geometry version and "Masarati" (Arabic math environment) — [CET catalogue](https://www.cet-catalogue.cet.ac.il/)
- April 2025: Israeli startup eSelf and CET announced conversational AI tutor avatars for K-12, starting with Hebrew language and expanding to other subjects. Times of Israel coverage mentions math among the initial subjects. Harvard provides academic guidance. The articles give no privacy, scale, or results information — [CTech](https://www.calcalistech.com/ctechnews/article/r1tkoce1gg); [Times of Israel](https://www.timesofisrael.com/israel-rolls-out-pilot-for-students-to-learn-with-conversational-avatar-companions/)
- eSelf was later acquired by Kaltura — [VC Cafe (Aug 2026)](https://www.vccafe.com/ai-is-making-israeli-edtech-investable-again-and-experienced-founders-are-beginning-to-notice/)

#### Gefen (גפ"ן): how schools buy programs
- The Ministry's unit for external programs manages a catalog from which principals choose. About 10,000 programs from about 5,000 suppliers were approved in recent tenders. The rationale is budget flexibility for principals. The program has faced criticism and political controversy — [Makor Rishon](https://www.makorrishon.co.il/news/551165/)

#### Other Israeli products and startups
- **Matific** (Israeli, founded 2012) is available in Israel in Hebrew and Arabic. It targets kindergarten through elementary school (raised $45M), so it is outside grades 7-8 — [Matific multilingual page](https://www.matific.com/ch/de/home/why-matific/multilingual/); [Times of Israel](https://www.timesofisrael.com/israels-matific-raises-45m-to-expand-math-games/)
- **Go Math** (Hebrew site, Israeli contacts, "built by teachers," 3 founders):
  - Grade 2 through grade 9 algebra and geometry, 170+ topics.
  - Coins, reward boxes, and an apparent streak flame.
  - Real-time flags for common mistakes, explanation after an error with retry, a notebook that saves work, timed tests, and full practice tests.
  - Teacher assignment and progress tracking; "hundreds of teachers and schools" [SELF].
  - The App Store lists English as the primary language.
  - Sources: [gomathapp.com/he](https://www.gomathapp.com/he); [App Store IL](https://apps.apple.com/il/app/go-math-%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%97%D7%A9%D7%91%D7%95%D7%9F-%D7%97%D7%A9%D7%99%D7%91%D7%94/id1533830942?l=he)
- **Vimi**: an AI math tutor from Moovit co-founders Roy Bick and Nir Erez, with a $12M seed led by Viola and BRM. Its features are adaptive paths, gamification, and conversational instruction that "guides students toward answers rather than giving them outright." The app link points to the US App Store; Hebrew availability is not stated — [VC Cafe (Aug 2026)](https://www.vccafe.com/ai-is-making-israeli-edtech-investable-again-and-experienced-founders-are-beginning-to-notice/)
- **Jotit**: an Israeli handwriting and digital-paper learning environment with AI workflows; $10M seed in 2025 led by Owl Ventures — [VC Cafe](https://www.vccafe.com/ai-is-making-israeli-edtech-investable-again-and-experienced-founders-are-beginning-to-notice/)
- **"Shiurim" (שיעורים)**: an Israeli tutoring marketplace plus an AI tutor in 13 subjects including math. Students can attach a photo of an exercise and get a step-by-step explanation (about October 2026) [WEAK, likely advertorial section] — [Kipa](https://www.kipa.co.il/כדאי-לדעת/1233337-0/)
- **Yuvi Lab**: a children's AI-literacy platform in Hebrew, English, Russian, and Arabic, approved for the Ministry's Summer Preparatory 2026 catalog. Not math-specific — [JNS](https://www.jns.org/feature/israeli-startup-yuvi-lab-launches-ai-platform-and-safe-space-for-children)
- **BrainPOP** was Israeli-founded (Avraham Kedar) and acquired by KIRKBI for $875M in 2022 — [VC Cafe](https://www.vccafe.com/ai-is-making-israeli-edtech-investable-again-and-experienced-founders-are-beginning-to-notice/)
- **YSCHOOL** (curriculum-aligned short video lessons, paid, "tens of thousands of students") [OLD, 2016] — [Mako 2016](https://www.mako.co.il/study-career-study/articles/Article-ff67fb9af418851006.htm)
- **Karnafim** (free grade 7 worksheets) — [Karnafim](https://www.karnafim.co.il/%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94-%D7%91%D7%97%D7%A9%D7%91%D7%95%D7%9F-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%96%D7%B3/)

#### What students use for homework (Israeli coverage)
- An Israel Hayom guide on AI and homework names Photomath and Mathway as tools students use at home. It classifies asking for step breakdowns, examples, and practice tests as allowed, and submitting AI output as one's own as forbidden — [Israel Hayom](https://www.israelhayom.co.il/tech/tech-news/article/21274733)
- Forbes Israel reported teachers fear AI will make cheating easier [older; date not verified] — [Forbes Israel](https://forbes.co.il/teachers-fear-chatgpt-will-make-cheating-easier/)
- School summer packs for grade 8 graduates (תשפ"ה/תשפ"ו) are PDFs requiring an organized written solution (פתרון מסודר), with final answers at the end. They are differentiated by ability group, e.g. "group B" (הקבצה ב) — [example summer work PDF 2025](https://bgr.mashov.info/wp-content/uploads/sites/265/2025/06/עבודת-קיץ-לעולים-לטא-תשפו.pdf); [example group B PDF (2023)](https://gvanimrh.mashov.info/wp-content/uploads/sites/117/2023/06/עבודת-קיץ-למסימי-חב-תשפג-עולים-לכיתה-ט-הקבצה-ב.pdf)
- A grade 8 teaching plan for struggling students (reduced level, updated 25.8.25) is built on the Yitzhak Shalev & Etti Ozeri textbook — [mathstar.co.il plan PDF](https://images.mathstar.co.il/8-grade/תוכנית%20לארגון%20ההוראה%20כיתה%20ח%20רמה%20מצומצמת%20תשפו.pdf)

#### Official grade 7 sequence, תשפ"ו (2025-26)
Source: [Grade 7 schedule PDF](https://meyda.education.gov.il/files/Pop/0files/matmatika/Chativat-Beynayim/tashpav/prisa7tashpav.pdf)

| Month (total hours) | Topics (hours) | Notes |
|---|---|---|
| Sep (15h) | Variables and algebraic expressions, generalizing number patterns (9); rectangle, box, perpendicularity and parallelism (6) | Struggling students may describe patterns in words. Keep the multiplication sign between coefficient and variable at this stage ("2x = 2⋅x"). Right angle by paper folding. |
| Oct (20h) | Equal expressions and combining like terms (4); box surface area, volume, net (2); laws of arithmetic: commutative, associative, neutral elements, no division by zero, reciprocals (2) | Non-negative numbers only. |
| Nov (20h) | Simple equations ax+b=c without signed numbers (5); triangle types (2); triangle heights and polygon areas (4); distributive law, order of operations with powers and integer square roots (6) | Start from a word problem; verify solutions by substitution. |
| Dec (20h) | Simple word problems including speed-time-distance (5); polygon areas (2); negative numbers: number line, opposites, absolute value, adding and subtracting signed numbers (6) | Show negatives in parentheses. Emphasize the "−a" notation. Don't use absolute value to do arithmetic. |
| Jan (20h) | All four operations with signed numbers, and powers (9); substitution including negatives and powers (6); angles: notation, measuring (3) | |
| Feb (20h) | Equations ax+b=cx+d, (x+2)/4=6, decimals (0.3x+5=0.2x+6), ½x=⅓x+1 (8); bisector, adjacent and vertical angles (7); coordinate system (3) | Solve fraction equations by adding and subtracting fractions, not a common denominator. Check by substitution. |
| Mar (12h) | Word problems with equations (8); segment lengths parallel to axes, areas and perimeters in the coordinate plane (4) | |
| Apr (15h) | Reading graphs in everyday contexts, graph to table (5); angles between parallel lines and triangle angle sum (5); circle area and circumference with a pi-discovery activity (4) | |
| May | Integrative literacy questions (9); composite-shape areas (2) | The rest of the document was not extracted. |

#### Official grade 8 sequence, תשפ"ו (2025-26)
Source: [Grade 8 schedule PDF](https://meyda.education.gov.il/files/Pop/0files/matmatika/Chativat-Beynayim/tashpav/prisa8tashpav.pdf). The PDF metadata shows it was created 26 March 2026; its notes refer to "this study level," so other level-specific versions may exist.

Year-level emphases:
- Algebraic technique (extended distributive law, algebraic fractions) moves to grade 9.
- Triangle similarity is taught to all groups, especially weaker ones, because it is in the new high-school 3-unit curriculum.
- The right-triangle congruence theorem is not taught this year at this level.
- A paper-folding geometry file is recommended.

| Month (total hours) | Topics (hours) | Notes |
|---|---|---|
| Sep (15h) | Intro to functions (6): concept, finding x/y, four representations (verbal, table, graph, algebraic), increasing/decreasing intervals, uniform vs non-uniform rate; alternate and corresponding angles between parallel lines (5) | f(x) notation optional by group. Increasing/decreasing read from table and graph only; weak students may state it in words. For angles, only the direct theorem, no converse. |
| Oct (10h) | Linear function (7): meaning of slope, points on a line, parallel and intersecting lines, algebraic form, meaning of the parameters, moving between representations; ratio (3) | Teach slope's meaning, not just the formula. Do not teach y−y₁=m(x−x₁). |
| Nov (20h) | Linear function continued (7): line equation, axis intercepts, positive and negative intervals, areas in the coordinate plane, word problems; triangle congruence, first three theorems (8); scale (4) | |
| Dec (17h) | Linear function continued and linear inequalities (6); median of a triangle (2); isosceles triangle (5) | Inequalities solved algebraically and graphically, e.g. f(x)>0, f(x)>g(x). Isosceles: only the coincidence theorem, converses in grade 9. |
| Jan (20h) | Equations and word problems (10): numeric denominators, simple variable denominators, proportion, no-solution and infinite-solution equations, geometric/general/motion problems; integrative congruence in the coordinate plane (3); percent (5) | |
| Feb (20h) | Systems of two linear equations (8): meaning of the solution, graphical method, substitution, elimination only if time allows; triangle similarity (4); percent (5) | |
| Mar (12h) | Systems word problems (5); similarity continued, including area ratios (4); square root (2) | Square roots of non-integers and estimation, needed for Pythagoras. |
| Apr (15h) | Pythagorean theorem (5) | Proof, sides in composite shapes, perimeters and areas; combine with functions and similarity. |
| May (20h) | Statistics (10): tables, diagrams, frequency and relative frequency, range, mean, mode, median; integrative literacy questions in algebra (6) and coordinate geometry (4) | |
| May-June | Probability (10): basic concepts, simple calculations, link to relative frequency, complementary event | |
| June (14h) | Review | |

#### Hebrew/RTL math conventions
- In Hebrew, math is normally written left to right (Jony Rosenne, W3C list, 2004). A 2010 W3C bidi thread reported the Israel Standards Institute was considering the question, and the expected answer was that math would stay LTR [OLD] — [W3C list, 2004](https://lists.w3.org/Archives/Public/www-international/2004OctDec/0061.html); [W3C i18n-bidi thread, 2010](https://lists.w3.org/Archives/Public/public-i18n-bidi/2010JulSep/0002.html)
- Arabic practice differs and is disputed: some Arabic locales write math RTL. Microsoft's math zones keep digit sequences LTR even after Arabic text [OLD] — [W3C Arabic math note](https://www.w3.org/TR/arabic-math/); [Microsoft "Directionality in math zones"](https://learn.microsoft.com/en-us/archive/blogs/murrays/directionality-in-math-zones)
- Current tools still break: KaTeX formulas in Hebrew chatbot answers (ChatGPT, Gemini, Claude) can render reversed. A Chrome extension exists only to force them LTR. Obsidian users request native RTL math support — [Chat-Math RTL Fix (Chrome Web Store)](https://chromewebstore.google.com/detail/fbelngafemdmddffkcjlnkappimdajji); [Obsidian forum](https://forum.obsidian.md/t/native-rtl-math-support-to-unlock-obsidian-for-the-scientific-and-academic-communities-in-rtl-regions/109187)
- Official Israeli notation choices that an app should mirror:
  - Grade 7: explicit "⋅" between coefficient and variable at first; negative numbers in parentheses; "−a" for the opposite.
  - Grade 8: f(x) introduced gradually; Latin variables (x, y, m) within Hebrew text.
  - Sources: [Grade 7 PDF](https://meyda.education.gov.il/files/Pop/0files/matmatika/Chativat-Beynayim/tashpav/prisa7tashpav.pdf); [Grade 8 PDF](https://meyda.education.gov.il/files/Pop/0files/matmatika/Chativat-Beynayim/tashpav/prisa8tashpav.pdf)

### Inferences
- **Gap 1: no Hebrew-first, phone-first daily practice app for grades 7-8.** The Ministry stack is Moodle, PDFs, question files, and GeoGebra/Desmos, all teacher-mediated and desktop-oriented. CET's Ofek is a school LMS. Matific stops at grade 6. Go Math is small and its App Store primary language is English. A streak-driven Hebrew app aligned to the month-by-month תשפ"ו sequence has room.
- **Gap 2: checking handwritten work.** Israeli homework and summer packs demand an organized written solution (פתרון מסודר), and global solvers solve problems rather than grade a student's Hebrew-annotated notebook page. An AI checker that reads a photographed page and grades it against Ministry-style solution steps fits local practice. It could also tag errors using the Ministry-listed "Learning from Mistakes" bank of typical errors.
- **Gap 3: ability groups.** Israeli middle schools teach in ability groups (הקבצות; "group B," "reduced level," "weak groups" all appear in official and school documents). Paths should support at least two levels per unit, matching the Ministry's higher- and lower-level question files.
- **Unit order:** a grade 8 app should open with functions and linear functions (Sep-Dec), then equations, word problems, and systems (Jan-Mar), with geometry interleaved (congruence, isosceles, similarity, Pythagoras) and statistics and probability at the end. Algebraic fractions and the extended distributive law are deferred to grade 9 this year.
- **Exam-photo feature:** the Pedagogical Space hosts Mafmar exams and question banks, a natural source for "practice test, then photograph your answers" flows.
- **RTL rendering rule:** render each math expression as an isolated LTR span inside RTL Hebrew text (Unicode bidi isolation or a dedicated LTR container). Never let the bidi algorithm reorder operators. Test negatives, parentheses, fractions, inequalities (> and < must not mirror), and ranges such as "x > 3" inside Hebrew sentences. Generic KaTeX-in-chat output is known to fail here.
- **Distribution:** in Israel, school adoption likely goes through the Gefen catalog and Ministry content-catalog approval (CET products carry the Gefen mark). Direct-to-family B2C would compete with private tutoring and free global AI study modes.

### Gaps
- No survey data on which apps Israeli grade 7-8 students actually use (e.g., Photomath penetration in Hebrew, ChatGPT use for math homework).
- Not found or verified in this pass:
  - "Mymath," "Kotar" (כותר; believed to be CET's digital-book library) as it relates to math.
  - BrainPOP Hebrew's middle-school math coverage.
  - Matific's actual Israeli school usage.
  - Whether Ofek has a phone app.
- The CET catalog page did not show prices or AI or adaptive features. Gefen prices for math programs are unknown.
- Status, scale, and math coverage of the eSelf+CET avatar pilot after April 2025 are unknown. Vimi's Hebrew availability is unknown.
- No authoritative current Israeli style guide for typesetting math in Hebrew. RTL evidence is from 2004-2010 W3C discussions plus current bug reports.
- Only one version of the grade 8 schedule was read; a different version may exist for higher ability groups.

## Across all groups: phone input methods, feedback design, pricing models, and safety/privacy for minors

### Takeaway
Phone input splits into camera capture (solvers), drag-to-manipulate expressions (DragonBox, FH2T, Polypad), multiple choice or numeric keypads (Duolingo-style drills), and voice or whiteboard tutoring (Gauth Live). The most learning-oriented feedback is step-level: hints before answers, "why" for each step, flagging common mistakes, and rewarding retries. Pricing is freemium almost everywhere, roughly $40-$120 a year. For minors, the US COPPA rule was amended in 2025 (compliance by 22 April 2026), and Israel's Privacy Law Amendment 13 took effect 14 August 2025. Children's apps vary widely: Gauth's App Store label discloses tracking identifiers, while Photomath reports data "not linked" to the user.

### Cited Findings

#### Input and feedback
- Photomath: camera scan of handwritten, printed, or on-screen problems; animated steps with "what" and "why"; contextual hints (Plus) — [App Store (CA)](https://apps.apple.com/ca/app/id919087726?l=en-ca); [Google Photomath Help](https://support.google.com/photomath/answer/14330572?hl=bg)
- Gauth: voice AI Live Tutor with a virtual whiteboard, and import of notes, audio, or lecture links — [App Store (US)](https://apps.apple.com/us/app/id1542571008)
- ChatGPT Study Mode: questions, calibrated hints, knowledge checks; photo and PDF uploads — [Educative](https://www.educative.io/newsletter/artificial-intelligence/openai-study-learn-tool); [Pearson](https://pearson.com/international-schools/international-schools-blog/2026/02/what-is-gemini_s-guided-learning-and-chatgpts-study-mode-.html)
- Go Math (Israel): real-time flags for common mistakes, explanation after an error with retry, a saved notebook, timed tests — [gomathapp.com/he](https://www.gomathapp.com/he)
- FH2T: students who reattempted problems more ("slow-steady progressors") gained most — [FH2T summary](https://sites.google.com/view/from-here-to-there/research-findings_1/summary-of-findings)
- Israeli grade 7 guidance repeatedly asks for checking solutions by substitution — [Grade 7 PDF](https://meyda.education.gov.il/files/Pop/0files/matmatika/Chativat-Beynayim/tashpav/prisa7tashpav.pdf)

#### Pricing
| Product | Model and price | Source |
|---|---|---|
| Prodigy | Free school version; home membership $59.88-$107.40/yr (2021), later up to $120/yr plus an "Ultimate" tier over $180/yr [OLD] | [EdWeek](https://www.edweek.org/technology/popular-interactive-math-game-prodigy-is-target-of-complaint-to-federal-trade-commission/2021/02); [Fairplay](https://fairplayforkids.org/?p=26304) |
| DragonBox | Kahoot! Kids/Kahoot!+ subscription, e.g. QAR 19.99/mo or QAR 129.99/yr | [App Store QA](https://apps.apple.com/qa/app/kahoot-algebra-2-by-dragonbox/id1550574547) |
| Polypad | Free | [Polypad FAQ](https://polypad.amplify.com/faqs) |
| Photomath Plus | About $9.99/mo or $69.99/yr | [Android Central](https://www.androidcentral.com/apps-software/google-unveils-photomath-app) |
| Mathway | Free answers; steps $9.99/mo or $39.99/yr (2023 terms) | [Mathway terms](https://mathway.com:443/Premium-Terms) |
| Gauth PLUS | $11.99/mo, $31.99/quarter, $99.99/yr | [App Store (US)](https://apps.apple.com/us/app/id1542571008) |
| ChatGPT Study Mode, Gemini Guided Learning | Free tiers | [TechCrunch](https://techcrunch.com/2025/08/06/google-takes-on-chatgpts-study-mode-with-new-guided-learning-tool-in-gemini/) |
| Israeli schools | Buy external programs through the Gefen catalog chosen by principals | [Makor Rishon](https://www.makorrishon.co.il/news/551165/) |

#### Privacy and safety for minors
- **US COPPA amendments:** published 22 April 2025, effective 23 June 2025, compliance by 22 April 2026. The FTC did not finalize proposed edtech/school-authorization provisions, citing pending FERPA changes, and will keep enforcing under existing guidance — [Federal Register](https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule); [Davis Wright Tremaine](https://www.dwt.com/blogs/privacy--security-law-blog/2025/05/coppa-rule-ftc-amended-childrens-privacy)
- **Israel Amendment 13:** in force 14 August 2025. It expanded enforcement powers, requires a privacy protection officer in certain organizations, and adds administrative fines — [Shibolet](https://www.shibolet.com/אישור-תיקון-13-לחוק-הגנת-הפרטיות/)
- **No child-consent age in Israeli law:** one edtech-law summary says Israeli statute sets no dedicated age for child consent, and minors' consent runs through guardianship law. Bills proposing a 13-year parental-consent threshold appear as drafts only — [EdLaw summary](https://edlaw.eduverse.com/docs/jurisdiction/nat/il/protection-of-privacy-law); [law.co.il draft bill](https://www.law.co.il/media/computer-law/privacy_minors_342_bill.pdf)
- **Ministry data leak:** the Privacy Protection Authority found the Education Ministry violated section 17 of the Privacy Law and security regulations in a leak of data on Haredi students — [Kipa](https://www.kipa.co.il/חדשות/1233214-0/)
- **App Store labels:** Gauth uses identifiers to track and links contact info, user content, and usage to the user. Photomath lists its collected data as "not linked to you." Both are rated 4+ — [Gauth App Store](https://apps.apple.com/us/app/id1542571008); [Photomath App Store](https://apps.apple.com/ca/app/id919087726?l=en-ca)
- **Prodigy precedent:** Prodigy's FTC complaint centered on marketing to children inside a school-assigned product — [Fairplay](https://fairplayforkids.org/feb-19-2021-advocates-to-ftc-prodigy-math-game-preys-on-kids-and-families/)

### Inferences
- For a grade 7-8 Hebrew app, photographed homework and exam pages are user content from minors that may include names, school names, and faces. Minimize retention, avoid third-party tracking SDKs, and don't train on uploads without guardian consent. The Gauth label shows what a privacy-sensitive Israeli school buyer would object to.
- Freemium is the norm, but Prodigy's backlash shows that upselling to children inside school-assigned use is a reputational and regulatory risk. Gate depth (e.g., unlimited AI checks, exam analysis) for parents or schools, not cosmetics shown to kids.
- An Israeli Ministry or Gefen route probably needs a privacy officer and documented data handling under Amendment 13. The Ministry's own leak case means buyers are likely to scrutinize this.
- The best feedback stack combines (1) a hint first, (2) step-level "why," (3) the first wrong line in the student's own work, (4) a misconception label (from a typical-error bank), and (5) an immediate similar retry that earns streak or XP credit.

### Gaps
- No controlled evidence comparing input methods (camera, keypad, drag, handwriting on screen) for middle-school math learning was found in this pass.
- No Israeli Privacy Protection Authority guidance specific to edtech or AI tutors for minors was found.
- How Israeli schools' Gefen procurement treats AI tools that process student photos is unknown.
