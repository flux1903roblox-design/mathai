// Madregot 2.0: the learning model. Pure types, shared by the engines (src/learn/*.ts), the content
// registry (src/learn/content/*.ts) and the screens. Nothing here depends on React or on the store.
//
// Text is Hebrew with inline TeX between $...$ (rendered by components/MathText). A `display` is TeX only.

export type TopicId = 'frac' | 'signed' | 'coord' | 'angles' | 'expr' | 'eq' | 'ratio' | 'pct' | 'line' | 'pyth' | 'stats' | 'sys';
/** One skill per stair: `${topic}:${level}`, e.g. 'signed:1'. Every stair is one skill. */
export type SkillId = string;
export type Text = string;
export type Mood = 'idle' | 'happy' | 'thinking' | 'encouraging' | 'excited' | 'achievement';

/** A seeded random source, so every generated item can be reproduced in a test. */
export type Rng = () => number;

// ------------------------------------------------------------------ interactive objects

/**
 * The kinds of components/manip. The fields of each kind are those its generators use (see content/manip.js).
 * Algebra: 'balance' (a scale of boxes x and unit weights; the answer is the value of x), 'tiles' (algebra tiles,
 * zero pairs removed; the answer is { k, c } for kx + c), 'area' (a rectangle a by x + b; the answer is { a, b }),
 * 'ray' (an inequality on the number line; the answer is { at, dir, closed }). 'plot' also takes `lines`.
 * Fractions and ratio: 'fbar' (the fraction bar { start: { den, shaded }, lockDen?, maxDen?, marks?, whole? }; the answer
 * is { mode: 'value', value } | { mode: 'common', of } | { mode: 'exact', den, shaded }) and 'dline' (the double number
 * line { top, bottom, move: 't' | 'max', start: { t, max? }, fixT? }; the answer is the marker's top value or the bottom
 * line's end). 'numberline' and 'pins' take `den` (ticks every 1/den, values k/den) and `fmt: 'dec'`.
 */
export type ManipKind = 'numberline' | 'plot' | 'line' | 'angle' | 'squares' | 'bars' | 'pins' | 'triangle' | 'balance' | 'tiles' | 'area' | 'ray' | 'fbar' | 'dline';
export interface ManipSpec { kind: ManipKind; [field: string]: unknown }

// ------------------------------------------------------------------ Stage A: discover and understand

/** מדי says one short thing (one or two sentences). */
/** One line of a double number line: its end, its step, its unit (outside the maths) and name; labels every n-th tick. */
export type DlineLine = { max: number; step: number; unit?: string; label?: string; every?: number };
/** A number line: points (A at k/den is { x: k/den, label: 'A' }), jumps as arcs; with den, every unit cut into parts. */
export type NumlineFig = { type: 'numline'; from: number; to: number; marks?: { x: number; label?: string; tone?: 'brand' | 'good' | 'bad' }[]; jumps?: { from: number; to: number; label?: string }[]; step?: number; anim?: boolean; den?: number };
/** The fraction bar: rows of bars of one length; hatch the first shaded parts, cross out the last; whole names the bar. */
export type FbarFig = { type: 'fbar'; den?: number; shaded?: number; marks?: number[]; whole?: number; labels?: boolean; hatch?: number; cross?: number; rows?: { den: number; shaded: number; label?: string }[] };
/** A rectangle cut both ways, the overlap of the shaded columns and rows darkest. */
export type FgridFig = { type: 'fgrid'; rows: number; cols: number; shadeRows: number; shadeCols: number; label?: string };
/**
 * The double number line, still: the marker at `at` on the top line, which values it shows, or one value under it;
 * `blank` writes no number on the bottom line but 0 (a picture that asks for the whole).
 */
export type DlineFig = { type: 'dline'; top: DlineLine; bottom: DlineLine; at?: number; show?: 'both' | 'top' | 'bottom'; label?: string; blank?: boolean };
/** Things counted in rows of dots, with a Hebrew label at the start of each row. */
export type GroupsFig = { type: 'groups'; rows: { n: number; label: string }[] };
/** The figures of fractions, percent and ratio: content writes them `satisfies FractionFig` so their fields are checked. */
export type FractionFig = NumlineFig | FbarFig | FgridFig | DlineFig | GroupsFig;
/** A drawing, in the shape components/Figure draws (e.g. { type: 'parallel', a, kind }). */
export type FigSpec = { type: string; [field: string]: unknown };

export interface SayStep { kind: 'say'; text: Text; display?: string; mood?: Mood; fig?: FigSpec }
/** A prediction before the explanation: the student commits, then sees why. Any choice moves on. */
export interface PredictStep {
  kind: 'predict'; text: Text; display?: string; fig?: FigSpec;
  choices: Text[]; answer: number;
  /** Shown after the student chose: why the right choice is right. */
  why: Text;
  /** Optional: what a particular wrong choice usually means. */
  wrongWhy?: Record<number, Text>;
}
/** The student moves a maths object until it is in the right state (checked by manipCorrect). */
export interface ExploreStep {
  kind: 'explore'; text: Text; display?: string;
  manip: ManipSpec; answer: unknown;
  /** Shown while the object is not there yet, after a wrong check. */
  hint: Text;
  /** Shown when it is there: what the student just saw. */
  success: Text;
}
/** The rule, stated only after the intuition, with the reason it works. */
export interface RuleStep { kind: 'rule'; text: Text; display?: string; why: Text; fig?: FigSpec }
export type DiscoverStep = SayStep | PredictStep | ExploreStep | RuleStep;

// ------------------------------------------------------------------ Stage B: a worked example

/**
 * One step of a worked example: the action, the reason for it, and what it gives.
 * `value` is an expression (src/learn/expr.ts) that must equal the example's answer when the step only
 * rewrites the problem; `calc` is a side computation whose value is checked. Tests check both.
 * Algebra adds two more checks (learn/content.test.ts):
 * `ident` is this step's expression in x (written for evaluate: 3*x + 12), and it must be identical to the example's
 * `expr`: rewriting an expression never changes its value. `eq` is the equation this step states
 * ('7*x - 3 = 4*x + 9'): it must hold at the example's answer (or at `vars` with two unknowns), and with one unknown
 * hold there only, so a step that loses or adds a solution fails.
 */
export interface ExampleStep {
  action: Text; why: Text; result: string; value?: string; calc?: { expr: string; value: number };
  ident?: string;
  eq?: string;
  /** An inequality this step states ('2*x - 3 > 5'): it must have exactly the example's solutions (`ray`), and so must `result`. */
  ineq?: string;
}
export interface WorkedExample {
  problem: Text; display?: string;
  /** A drawing the problem is about (the number line whose point A is asked). */
  fig?: FigSpec;
  /** A numeric answer, checked against `check` (an expression for the same quantity). */
  answer: number; check: string;
  steps: ExampleStep[];
  /** For an expression: the expression in x as given, for evaluate ('3*(x-2) - (x+4)'); every step's `ident` equals it. */
  expr?: string;
  /** Shown as the answer instead of `answer` ('2x - 10'). `answer` is then the value at the substitution check. */
  answerTex?: string;
  /** With two unknowns, the solution ({ x: 3, y: 6 }): every step's `eq` must hold there. */
  vars?: Record<string, number>;
  /** An inequality's solutions as a ray ({ at: 4, dir: 1, closed: false } is x > 4): every step's `ineq` has exactly these. */
  ray?: { at: number; dir: 1 | -1; closed: boolean };
}

// ------------------------------------------------------------------ Stage C: solve together

export interface GuidedChoice { text: Text; ok: boolean; feedback: Text }
/** The student chooses the next step; a wrong choice gets its own feedback and the hints grow stronger. */
export interface GuidedStep { prompt: Text; display?: string; choices: GuidedChoice[]; hints: [Text, Text]; done: Text }
export interface GuidedProblem {
  problem: Text; display?: string;
  /** A drawing the problem is about. */
  fig?: FigSpec;
  steps: GuidedStep[];
  /**
   * The last move is the student's alone: a typed number, checked against `check`. `precise` compares it exactly (as an
   * item's `precise`, content/util.js numRight); `fmt: 'dec'` shows the answer as a decimal.
   */
  final: { prompt: Text; answer: number; check: string; hints: [Text, Text]; precise?: boolean; fmt?: 'dec' };
}

// ------------------------------------------------------------------ misconceptions

/**
 * A misconception of a stair. `id` is the category the generators' diag() already returns for it
 * (content/grade7.js and friends), so the evidence of every existing exercise counts.
 */
export interface Misconception {
  id: string;
  /** What the student does, in their words' terms (shown on the board and in the tutor). */
  title: Text;
  /** The likely reason behind it. */
  cause: Text;
  /** A targeted explanation: not the stair's general one. */
  explain: Text[];
  /** An interactive activity that repairs it (shown after the explanation). */
  remedy: DiscoverStep[];
  /** The smaller skill it may come from, when there is one. */
  prereq?: SkillId;
}

/**
 * The stair's diagnostic model ("bug library"): random parameters, the right answer, and the answer each
 * misconception predicts for the same parameters. Diagnosis matches a wrong answer against every prediction;
 * a discriminating question is one whose predictions all differ.
 */
export interface DiagModel<P = Record<string, number>> {
  params: (rnd: Rng) => P;
  text: (p: P) => Text;
  display?: (p: P) => string;
  /** A drawing for the question, when the question needs one. */
  fig?: (p: P) => FigSpec;
  answer: (p: P) => number;
  /** The exact value when the answer is rounded (a root that is not whole): an answer within half a tenth of it is right. */
  exact?: (p: P) => number;
  bugs: Record<string, (p: P) => number | null>;
  solution: (p: P) => Text[];
  hint: (p: P) => Text;
  unit?: string;
  /** Compare the typed answer exactly (content/util.js numRight), as an exercise marked `precise`. */
  precise?: boolean;
  /** Show the answer as a decimal (-1.3, not -13/10); a function chooses per question (decimals, or quarters as fractions). */
  fmt?: 'dec' | ((p: P) => 'dec' | undefined);
}

// ------------------------------------------------------------------ the stair

export interface StairContent {
  skill: SkillId; topic: TopicId; level: number; title: Text;
  objectives: Text[];
  /** One sentence: the key idea (the tutor's "לא הבנתי"). */
  idea: Text;
  /** Why the rule works (the tutor's "למה זה עובד?"). */
  why: Text[];
  /** Another way to see it (the tutor's "תסביר לי בדרך אחרת"). */
  alt: Text[];
  discover: DiscoverStep[];
  examples: WorkedExample[];
  together: GuidedProblem[];
  /** Diagnostic questions (also the transfer questions of practice and the mastery check). */
  diag: DiagModel<any>;
  /** Transfer questions with an unfamiliar surface (a story, a table, a context), same skill. */
  transfer?: DiagModel<any>;
  misconceptions: Misconception[];
  /** The stair's new words (shown on its journey page under "מה נלמד"). */
  words?: Text[];
}

// ------------------------------------------------------------------ the learner

export type MasteryState = 'not-started' | 'learning' | 'needs-support' | 'practicing' | 'mastered' | 'needs-review';

/** Why an answer counts: practice with help is evidence of learning, not of independent mastery. */
export type Purpose = 'practice' | 'mastery' | 'review' | 'verify' | 'diagnostic' | 'guided';

export interface Attempt { at: string; ok: boolean; independent: boolean; purpose: Purpose }

export interface SkillRecord {
  /** Teaching stages finished: A discover, B example, C together. */
  taught?: { A?: string; B?: string; C?: string };
  attempts: Attempt[];
  /** The last passed mastery check, and the review schedule after it. */
  mastered?: { at: string; box: number; due: string; lastReview?: { at: string; ok: boolean } };
  /** Failed mastery checks since the last pass (for honest feedback, not punishment). */
  failedChecks?: number;
  /** Where the student is inside each teaching stage, so leaving keeps the place. */
  pos?: { A?: number; B?: number; C?: number };
}

export type MisconState = 'suspected' | 'confirmed' | 'repairing' | 'resolved';
export interface MisconRecord {
  skill: SkillId; id: string;
  /** Weighted evidence: a match counts 1 (or less when another misconception explains it too). */
  score: number;
  /** Items that showed it (keys), so one question answered twice is one piece of evidence. */
  seen: string[];
  state: MisconState;
  at: string;
  /** Remediation offered today, and verifications failed: to avoid an endless loop. */
  offered?: { day: string; n: number };
  failedVerify?: number;
  resolvedAt?: string;
}

export interface ExamPlanInput { grade: '7' | '8'; date: string; skills: SkillId[]; confidence: 1 | 2 | 3 | 4; minutes: number }
export interface ExamPlanState extends ExamPlanInput { createdAt: string; diagnostic?: Record<SkillId, { asked: number; right: number; at: string }> }

/** One analytics event. n: a check's share right (0..1); d: days since mastery (for reviews). No names, no free text. */
export interface LearnEvent { t: string; e: string; s?: SkillId; m?: string; ok?: boolean; ind?: boolean; p?: Purpose | string; n?: number; d?: number }

/**
 * The floor check of the bridge unit (בדיקת יסודות): when it ran, whether the unit is on the map, what each fractions
 * stair showed, and the multiplication facts. Written by the floor check (storeGlue.ts learnAfterCheck, purpose 'floor');
 * read by recommend.ts. `on` puts the bridge unit on the map: a missed fractions question switches it on, and only the
 * student switches it off again (Topics, "להסתיר את היסודות מהמפה"), which keeps the evidence.
 */
export interface FloorState {
  at: string;
  on: boolean;
  results: Record<SkillId, { asked: number; right: number }>;
  facts: { asked: number; right: number };
}

// ------------------------------------------------------------------ the challenge track (CURRICULUM-6)

/** What a challenge asks for: judging a claim, finding someone's error, ordering a proof, or a real-world task. */
export type ChallengeKind = 'claim' | 'error' | 'proof' | 'literacy';
/**
 * A challenge task for a strong student: optional, graded by code (offline, no AI), shown once its `after` stair is
 * mastered. Its parts are solved in order, each with two tries; an `explain` part is the student's own words, a
 * self-check with no score. Content lives in learn/challenges/<topic>.ts.
 */
export interface ChallengeTask {
  id: string; // 'pct:c1'
  topic: TopicId;
  after: SkillId; // shown once this stair is mastered
  kind: ChallengeKind;
  title: Text;
  story?: Text; // the context, at most 400 characters
  fig?: FigSpec;
  parts: ChallengePart[]; // 2..5, solved in order
  minutes: number; // 4..10
  /** The mistake (a misconception id of the content, e.g. 'partial-dist') the task is built on, when it is one. */
  misc?: string;
}
/**
 * One part of a challenge.
 *   num      a typed number, checked against `answer` (`check` is an expression for the same quantity, tested)
 *   mc       one right choice among several, each with its own feedback
 *   claim    always / sometimes / never true; with `example`, a counterexample typed into the slots: `expr` evaluated
 *            at the slots' values (learn/expr.ts) must satisfy `rel value`, the values in `domain`
 *   order    a proof's steps, shown shuffled, put in order; a step with `reason` then asks why, as a choice. `free`
 *            lists groups of steps that may come in any order among themselves (two equal angles found one after the
 *            other): the proof is right either way, so the check accepts both
 *   error    someone's solution as lines: the wrong line (`wrong`), then the right value typed (`fix`)
 *   explain  the student's own words (kept on the screen only), then the sample answer and the rubric to tick
 */
export type ChallengePart =
  | { type: 'num'; prompt: Text; answer: number; check: string; unit?: string; solution: Text[] }
  | { type: 'mc'; prompt: Text; choices: { text: Text; ok: boolean; feedback: Text }[] }
  | { type: 'claim'; prompt: Text; claim: Text; verdict: 'always' | 'sometimes' | 'never'; why: Text;
      example?: { ask: Text; slots: { name: string; label: Text }[]; domain: 'positive-int' | 'int' | 'number';
                  expr: string; rel: '<' | '<=' | '>' | '>=' | '!='; value: number; hint: Text } }
  | { type: 'order'; prompt: Text; steps: { text: Text; reason?: { choices: Text[]; answer: number } }[]; free?: number[][] }
  | { type: 'error'; prompt: Text; lines: Text[]; wrong: number; why: Text; fix: { prompt: Text; answer: number; check: string } }
  | { type: 'explain'; prompt: Text; rubric: Text[]; sample: Text };
/** A challenge task (curriculum stage 1, CURRICULUM-6): when it started, when it was finished, parts right first time. */
export interface ChallengeRecord { startedAt: string; doneAt?: string; firstTry: number; parts: number }

export interface LearnState {
  skills: Record<SkillId, SkillRecord>;
  miscon: Record<string, MisconRecord>; // key `${skill}|${id}`
  exam: ExamPlanState | null;
  missions: Record<string, { items: MissionItem[] }>; // by day 'YYYY-MM-DD'
  events: LearnEvent[];
  /**
   * The floor check's record; null until it runs. A save from before it existed has none: the store's persist merge
   * fills null in (lib/store.js), and every reader still reads it as `learn.floor ?? null`.
   */
  floor?: FloorState | null;
  /** Challenge tasks by id ({} until one starts; read as `learn.challenges ?? {}`, as floor is). */
  challenges?: Record<string, ChallengeRecord>;
}

// ------------------------------------------------------------------ what to do next

/**
 * What a suggestion is (learn/next.ts planNext ranks them): an Exam Rescue step, a misconception to repair, a due
 * review, points lost in a checked exam ('exam-loss'), the floor check of the fractions unit ('floor'), a missing
 * prerequisite, a mastery check, the stair in progress, a new stair, or a challenge task of a mastered stair.
 */
export type ActionKind = 'exam' | 'repair' | 'review' | 'exam-loss' | 'floor' | 'prereq' | 'continue' | 'new' | 'mastery' | 'challenge';
export type Stage = 'A' | 'B' | 'C' | 'D' | 'E';
/** The kind of an Exam Rescue step, as its plan names it (examRescue.ts PlanTask), plus the diagnostic before a plan. */
export type RescueTask = 'learn' | 'practice' | 'mastery' | 'review' | 'exam' | 'diagnostic';
export interface Action {
  /** The stair it is about; '' for an Exam Rescue step on no single stair (the diagnostic, the practice exam). */
  kind: ActionKind; skill: SkillId; misc?: string;
  /** For learning a stair: the one stage this action is (a mission item is done when this stage is, not the stair). */
  stage?: Stage;
  /** An Exam Rescue step: which step of the plan it is, so the mission item is done only by that step. */
  task?: RescueTask;
  /** A challenge: which task (its skill is the stair it follows), so the mission item is done only by that task. */
  challengeId?: string;
  title: Text; reason: Text; minutes: number;
  /** The route that starts it. */
  to: string;
}
export interface MissionItem extends Action { done?: string }
