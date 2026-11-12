// The skill catalogue: one skill per stair, and the prerequisite graph between them.
// A prerequisite is a skill the stair really leans on (it is used inside the new skill), not merely an
// earlier stair. The graph is acyclic (tested), so "the smallest missing prerequisite" is well defined.
import type { SkillId, TopicId } from './types';

// 'frac' (fractions and decimals) is a bridge unit: the floor under grade 7, first so ALL_SKILLS stays in prerequisite
// order. A bridge stair is in no grade's own list (gradeSkillsOf), is missing only on evidence and is new only when the
// floor is switched on (recommend.ts); content/index.js keeps it out of topicsFor.
// ח׳ in school order: ratio and scale is the first unit of the year (September), percent the second (October), the
// introduction to functions the third (November), all before linear functions (rate and slope, December). ז׳'s data and
// frequency (January–February) comes before equations (March). ח׳'s probability ("הסתברות ב", March, unit 8.16) is the
// last unit of the year.
export const TOPIC_ORDER: TopicId[] = ['frac', 'signed', 'coord', 'angles', 'expr', 'data', 'eq', 'ratio', 'pct', 'func', 'line', 'pyth', 'stats', 'sys', 'prob'];
export const GRADE_OF: Record<TopicId, '7' | '8'> = { frac: '7', signed: '7', coord: '7', angles: '7', expr: '7', data: '7', eq: '7', ratio: '8', pct: '8', func: '8', line: '8', pyth: '8', stats: '8', sys: '8', prob: '8' };
export const STAIRS: Record<TopicId, number> = { frac: 4, signed: 6, coord: 5, angles: 5, expr: 5, data: 4, eq: 7, ratio: 4, pct: 5, func: 4, line: 8, pyth: 5, stats: 8, sys: 5, prob: 3 };
/** Bridge units: a repair below the grade's programme, never a stair every student must climb. */
export const BRIDGE = new Set<TopicId>(['frac']);

export const skillId = (topic: TopicId | string, level: number): SkillId => `${topic}:${level}`;
export const parseSkill = (id: SkillId) => { const [topic, l] = id.split(':'); return { topic: topic as TopicId, level: Number(l) }; };

/** Every skill in curriculum order (grade 7 topics, then grade 8). */
export const ALL_SKILLS: SkillId[] = TOPIC_ORDER.flatMap((t) => Array.from({ length: STAIRS[t] ?? 0 }, (_, i) => skillId(t, i + 1)));

/** A unit filed under one grade that a school year also teaches in another: drawn on that grade's path after `after`. */
export type AlsoOnPath = Partial<Record<TopicId, { grade: '7' | '8'; after: TopicId }>>;
/**
 * Units on two grades' paths. The Ministry's תשפ״ז transition year has ח׳ learn the ז׳ data unit too (8.6 in October and
 * November; its last stair, probability from relative frequency, is ח׳'s "הסתברות א – בסיס" in March): `data` is filed
 * under ז׳ and drawn on the ח׳ path after percent. programme.test.ts fails when no unit of that grade lists one of the
 * topic's stairs, so the entry is removed when the programme moves on (shared/stairs.js TOPIC_ALSO with it).
 * A table, not a special case in each screen: topicsFor (content/index.js), gradeSkillsOf, isMissing (recommend.ts)
 * and the screens that name a unit's grade read it through onGradePath. The helpers take another table for tests.
 */
export const ALSO_ON_PATH: AlsoOnPath = { data: { grade: '8', after: 'pct' } };
/** Is a topic on a grade's path: filed in it, or also climbed in it (never a bridge unit)? */
export const onGradePath = (t: TopicId, g: '7' | '8', also: AlsoOnPath = ALSO_ON_PATH): boolean => !BRIDGE.has(t) && (GRADE_OF[t] === g || also[t]?.grade === g);
/**
 * A grade's topics in the order of its path (the map's, content/index.js topicsFor): its own in TOPIC_ORDER, and a unit
 * also climbed in it right after the unit named in `after`, never a bridge unit. For ח׳ this year: ratio, pct, data, line…
 */
export const gradePathOf = (g: '7' | '8', also: AlsoOnPath = ALSO_ON_PATH): TopicId[] => {
  const out = TOPIC_ORDER.filter((t) => !BRIDGE.has(t) && GRADE_OF[t] === g);
  TOPIC_ORDER.filter((t) => !BRIDGE.has(t) && GRADE_OF[t] !== g && also[t]?.grade === g).forEach((t) => {
    const i = out.indexOf(also[t]!.after); out.splice(i < 0 ? out.length : i + 1, 0, t);
  });
  return out;
};
/**
 * A grade's own stairs, in the order of its path, without the bridge units. The order matters: the next new stair is the
 * first one here (learn/next.ts), so a ח׳ student meets ratio (September) and percent (October) before this year's data
 * unit, as the map draws them, though data is filed earlier, under ז׳, in ALL_SKILLS.
 */
export const gradeSkillsOf = (g: '7' | '8', also: AlsoOnPath = ALSO_ON_PATH): SkillId[] => gradePathOf(g, also).flatMap((t) => ALL_SKILLS.filter((id) => id.split(':')[0] === t));
/** Is this stair in a bridge unit (the floor under both grades)? */
export const isBridgeSkill = (id: SkillId) => BRIDGE.has(id.split(':')[0] as TopicId);
/** The bridge stairs, in order: the floor under every grade. */
export const BRIDGE_SKILLS: SkillId[] = ALL_SKILLS.filter(isBridgeSkill);

/**
 * Guest stairs (stage5.md FUNC-6): a guest stair belongs to another grade's topic and is listed in this grade's
 * programme (ח׳ 8.9 lists motion problems and equations with denominators; ז׳ 7.9 a graph that describes a situation).
 * It is offered as new, in the month the grade's school teaches it, from the banner above the path: its unit stays on
 * its own grade's map. It is never counted in the grade's own "X מתוך N", and never part of strongToday's "every stair
 * of the grade". A stair is never both a guest and one of the grade's own (gradeSkillsOf); a grade's guest stairs are
 * listed in the order they are offered (eq:7 after eq:6).
 */
export const GUEST: Record<'7' | '8', SkillId[]> = { '7': ['func:1'], '8': ['eq:6', 'eq:7'] };
export const guestSkillsOf = (g: '7' | '8' | string): SkillId[] => GUEST[g as '7' | '8'] || [];

/** What each stair uses. Comments say why, so the graph can be reviewed by a teacher. */
export const PREREQS: Record<SkillId, SkillId[]> = {
  'frac:1': [], // a fraction is a place on the number line: equal parts of one unit
  'frac:2': ['frac:1'], // comparing uses equal fractions and the number line
  'frac:3': ['frac:1'], // a common denominator is expanding both fractions
  'frac:4': ['frac:1'], // a product is simplified; "of" is a part of a part
  'signed:1': [], // adding and subtracting signed numbers starts from the number line itself
  'signed:2': [], // comparing: where numbers sit on the line
  'signed:3': ['signed:1'], // multiplying is repeated adding; the sign rules build on it
  'signed:4': ['signed:1', 'signed:3'], // order of operations mixes all four operations
  'signed:5': ['signed:4'], // brackets change that order
  'signed:6': ['signed:1', 'signed:3', 'frac:3'], // the sign rules of signed:1 and signed:3, with fraction and decimal sums (bridge edge)
  'coord:1': ['signed:2'], // a point's coordinates are signed numbers on two lines
  'coord:2': ['coord:1'], // quadrants are the signs of the two coordinates
  'coord:3': ['coord:1', 'signed:1'], // a length is a difference of coordinates
  'coord:4': ['coord:3'], // area = width × height, each a length
  'coord:5': ['coord:1', 'coord:3'], // a missing vertex shares one coordinate with each neighbour
  'angles:1': [], // angles on a straight line
  'angles:2': ['angles:1'], // vertical angles: two linear pairs
  'angles:3': ['angles:1'], // the triangle sum comes from a straight angle
  'angles:4': ['angles:1', 'angles:2'], // parallel lines: corresponding, alternate, co-interior
  'angles:5': ['angles:3'], // isosceles and exterior angles use the triangle sum
  'expr:1': ['signed:4'], // substituting turns an expression into order of operations with signed numbers
  'expr:2': ['expr:1'], // an expression is checked by substituting a case we know
  'expr:3': ['expr:1', 'signed:1'], // equality is checked by substituting; coefficients are added as signed numbers
  'expr:4': ['expr:1', 'signed:3'], // what ax means; each term is multiplied with the sign rules
  'expr:5': ['expr:3', 'expr:4'], // open the brackets, then collect like terms
  'data:1': [], // reading a chart and a frequency table starts from counting
  'data:2': ['data:1', 'frac:2'], // a relative frequency is a frequency over the total, a fraction or a decimal (bridge edge)
  'data:3': ['data:2'], // a percent is a relative frequency in hundredths; a pie shows the parts of one whole
  'data:4': ['data:2'], // picking at random from a group, the probability of a kind is its relative frequency
  'eq:1': ['expr:1', 'signed:1', 'signed:3', 'frac:4'], // a solution is checked by substituting; the inverse operations work with signed numbers; answers such as 1/4 are fractions (bridge edge)
  'eq:2': ['eq:1'], // two one-step moves, undone in reverse order
  'eq:3': ['eq:2', 'expr:3'], // the x-terms of both sides are collected first, then it is a two-step equation
  'eq:4': ['eq:3', 'expr:5'], // open the brackets and collect (simplifying), then solve
  'eq:5': ['eq:4', 'expr:2'], // the story becomes expressions (writing an expression), then an equation
  'eq:6': ['eq:5'], // a motion story becomes an equation like any story; distance = speed × time, a row per mover
  'eq:7': ['eq:4', 'frac:3'], // clearing denominators gives brackets (eq:4); a common denominator (frac:3, bridge edge)
  'ratio:1': ['frac:1'], // simplifying a ratio is simplifying a fraction (bridge edge)
  'ratio:2': ['ratio:1'], // m : n is m + n equal parts
  'ratio:3': ['ratio:1', 'frac:4'], // the unit rate is a quotient; the missing value is a product (bridge edge)
  'ratio:4': ['ratio:3'], // a scale is a proportion with units
  'pct:1': ['frac:2'], // a percent is a fraction or a decimal in hundredths (bridge edge: evidence only)
  'pct:2': ['pct:1', 'frac:4'], // "p% of" is multiplying by p/100 (bridge edge)
  'pct:3': ['pct:1'], // part ÷ whole, written in hundredths
  'pct:4': ['pct:2', 'eq:1'], // the whole: undo "p% of" through 1% or a benchmark; the same question as 0.35x = 1400 (a ז׳ stair: evidence only)
  'pct:5': ['pct:2', 'pct:3'], // the new amount is a percent of the old; the change is a percent of the old
  'func:1': ['coord:1'], // a point of a graph is a pair, read on two axes (ז׳ September)
  'func:2': ['func:1', 'expr:1'], // a rule gives each x one y; its value is a substitution (expr:1, ז׳: evidence only for ח׳)
  'func:3': ['func:1'], // increasing and decreasing are read on the graph, left to right
  'func:4': ['func:3', 'ratio:3'], // a rate is the change per one unit (a unit rate, ratio:3); uniform is straight
  'line:1': ['signed:4', 'coord:1', 'expr:1'], // a table of values: substitute x in mx + b (expr:1, signed:4), plot the points
  'line:2': ['line:1'], // what m and b mean in y = mx + b
  // slope from the graph: steps on the grid, "up 2 for every 3 to the right" is a ratio; and a slope is a uniform rate
  // of change (func:4, an own-grade edge: not new before func:4 is done, as in school order, rate before slope; a
  // student already in line:3 keeps going, as the edge is read only when choosing a new stair or the stairs under a
  // hard one)
  'line:3': ['line:2', 'coord:1', 'ratio:1', 'func:4'],
  'line:4': ['line:3', 'signed:3', 'frac:1'], // slope between two points: a quotient of signed differences, simplified like a fraction (bridge edge)
  'line:5': ['line:4', 'eq:1'], // the equation of a line from two points or a point and a slope; b solves y₁ = m·x₁ + b, one step
  'line:6': ['line:2', 'signed:3', 'eq:2'], // intercepts: x = 0 gives b; y = 0 is the two-step equation 0 = mx + b
  'line:7': ['line:6', 'coord:4'], // the triangle with the axes: its legs are the intercepts
  'line:8': ['line:5', 'line:1', 'eq:3'], // where two lines meet: equal y for the same x, mx + b = m'x + b' (the unknown on both sides)
  'pyth:1': [], // squares and square roots
  'pyth:2': ['pyth:1'], // a leg: subtract squares instead of adding
  'pyth:3': ['pyth:1'], // is it right-angled: the theorem used as a test
  'pyth:4': ['pyth:1', 'pyth:2'], // a word problem: find the right triangle first
  'pyth:5': ['pyth:1', 'coord:3'], // distance between points: legs are the coordinate differences
  'stats:1': [], // mode: counting
  'stats:2': ['signed:2'], // median: ordering numbers first
  'stats:3': ['frac:2'], // mean: sum and share; a mean is often a decimal, read and compared by place value (bridge edge)
  'stats:4': ['stats:3', 'data:1'], // mean from a frequency table (reading the table first, data:1)
  'stats:5': ['stats:3', 'eq:2'], // a missing value from the mean: the mean equation backwards, (sum + x) : n = mean, two steps
  // curriculum stage 3 (DATA-5): the rest of ח׳ units 8.10 and 8.11
  'stats:6': ['stats:2', 'stats:3'], // the range sits beside the median and the mean; adding to every value moves them
  'stats:7': ['data:1', 'stats:3'], // two sources are a table and a chart read together; the question is often a mean
  'stats:8': ['line:3', 'ratio:3'], // a uniform change is a constant rate (slope); between two values it splits in proportion
  // a percent change in a story becomes an equation (eq:5); x + 0.2x = 1.2x is collecting like terms (expr:3); the
  // change is a multiplier of the old price (pct:5, an own-grade edge: not new before pct:5 is done, as in school order)
  'sys:1': ['eq:5', 'expr:3', 'pct:5'],
  'sys:2': ['eq:4', 'line:8'], // substituting y = mx + b gives an equation with brackets (eq:4); the solution is where the two lines meet (line:8)
  'sys:3': ['sys:2', 'expr:5'], // the second unknown is found by substituting (sys:2); subtracting an equation is a minus before brackets (expr:5)
  'sys:4': ['sys:3', 'eq:5'], // a story with two unknowns: each sentence that says "equal" is an equation (eq:5), then the system is solved (sys:3)
  'sys:5': ['eq:3', 'signed:2', 'signed:3'], // solved like an equation (eq:3); the answer is a range on the number line (signed:2); dividing by a negative reverses the order (signed:3)
  // curriculum stage 3 (DATA-6): ח׳'s "הסתברות ב" in unit 8.16
  'prob:1': ['data:4'], // equally likely outcomes build on probability as a relative frequency ("הסתברות א – בסיס")
  'prob:2': ['prob:1'], // the complement is 1 minus a probability found by counting outcomes
  'prob:3': ['prob:1', 'prob:2'], // a table of pairs is equally likely outcomes counted; "at least" is often its complement
};

export const prereqsOf = (id: SkillId): SkillId[] => PREREQS[id] || [];

/** Every skill a stair leans on, directly or through others, nearest first. */
export function ancestorsOf(id: SkillId): SkillId[] {
  const out: SkillId[] = []; const seen = new Set<SkillId>([id]);
  let frontier = prereqsOf(id);
  while (frontier.length) {
    const next: SkillId[] = [];
    frontier.forEach((p) => { if (!seen.has(p)) { seen.add(p); out.push(p); next.push(...prereqsOf(p)); } });
    frontier = next;
  }
  return out;
}

/** The stairs that use a skill (the other direction of the graph). */
export const dependentsOf = (id: SkillId): SkillId[] => ALL_SKILLS.filter((s) => prereqsOf(s).includes(id));
