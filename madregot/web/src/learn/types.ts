// Madregot 2.0: the learning model. Pure types, shared by the engines (src/learn/*.ts), the content
// registry (src/learn/content/*.ts) and the screens. Nothing here depends on React or on the store.
//
// Text is Hebrew with inline TeX between $...$ (rendered by components/MathText). A `display` is TeX only.

export type TopicId = 'signed' | 'coord' | 'angles' | 'expr' | 'eq' | 'line' | 'pyth' | 'stats' | 'sys';
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
 */
export type ManipKind = 'numberline' | 'plot' | 'line' | 'angle' | 'squares' | 'bars' | 'pins' | 'triangle' | 'balance' | 'tiles' | 'area' | 'ray';
export interface ManipSpec { kind: ManipKind; [field: string]: unknown }

// ------------------------------------------------------------------ Stage A: discover and understand

/** מדי says one short thing (one or two sentences). */
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
  steps: GuidedStep[];
  /** The last move is the student's alone: a typed number, checked against `check`. */
  final: { prompt: Text; answer: number; check: string; hints: [Text, Text] };
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
}

/**
 * What every screen knows about a stair before its topic's teaching content has loaded (learn/content/meta.gen.ts,
 * generated from the content files): its title, its misconceptions' names, and whether it has transfer questions.
 */
export interface StairMeta {
  title: Text;
  misconceptions: { id: string; title: Text }[];
  transfer: boolean;
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

export interface LearnState {
  skills: Record<SkillId, SkillRecord>;
  miscon: Record<string, MisconRecord>; // key `${skill}|${id}`
  exam: ExamPlanState | null;
  missions: Record<string, { items: MissionItem[] }>; // by day 'YYYY-MM-DD'
  events: LearnEvent[];
}

// ------------------------------------------------------------------ what to do next

export type ActionKind = 'exam' | 'repair' | 'review' | 'prereq' | 'continue' | 'new' | 'mastery';
export type Stage = 'A' | 'B' | 'C' | 'D' | 'E';
export interface Action {
  kind: ActionKind; skill: SkillId; misc?: string;
  /** For learning a stair: the one stage this action is (a mission item is done when this stage is, not the stair). */
  stage?: Stage;
  title: Text; reason: Text; minutes: number;
  /** The route that starts it. */
  to: string;
}
export interface MissionItem extends Action { done?: string }
