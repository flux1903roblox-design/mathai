// The skill catalogue: one skill per stair, and the prerequisite graph between them.
// A prerequisite is a skill the stair really leans on (it is used inside the new skill), not merely an
// earlier stair. The graph is acyclic (tested), so "the smallest missing prerequisite" is well defined.
import type { SkillId, TopicId } from './types';

export const TOPIC_ORDER: TopicId[] = ['signed', 'coord', 'angles', 'expr', 'eq', 'line', 'pyth', 'stats'];
export const GRADE_OF: Record<TopicId, '7' | '8'> = { signed: '7', coord: '7', angles: '7', expr: '7', eq: '7', line: '8', pyth: '8', stats: '8' };
export const STAIRS: Record<TopicId, number> = { signed: 5, coord: 5, angles: 5, expr: 5, eq: 5, line: 8, pyth: 5, stats: 5 };

export const skillId = (topic: TopicId | string, level: number): SkillId => `${topic}:${level}`;
export const parseSkill = (id: SkillId) => { const [topic, l] = id.split(':'); return { topic: topic as TopicId, level: Number(l) }; };

/** Every skill in curriculum order (grade 7 topics, then grade 8). */
export const ALL_SKILLS: SkillId[] = TOPIC_ORDER.flatMap((t) => Array.from({ length: STAIRS[t] }, (_, i) => skillId(t, i + 1)));

/** What each stair uses. Comments say why, so the graph can be reviewed by a teacher. */
export const PREREQS: Record<SkillId, SkillId[]> = {
  'signed:1': [], // adding and subtracting signed numbers starts from the number line itself
  'signed:2': [], // comparing: where numbers sit on the line
  'signed:3': ['signed:1'], // multiplying is repeated adding; the sign rules build on it
  'signed:4': ['signed:1', 'signed:3'], // order of operations mixes all four operations
  'signed:5': ['signed:4'], // brackets change that order
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
  'eq:1': ['expr:1', 'signed:1', 'signed:3'], // a solution is checked by substituting; the inverse operations work with signed numbers
  'eq:2': ['eq:1'], // two one-step moves, undone in reverse order
  'eq:3': ['eq:2', 'expr:3'], // the x-terms of both sides are collected first, then it is a two-step equation
  'eq:4': ['eq:3', 'expr:5'], // open the brackets and collect (simplifying), then solve
  'eq:5': ['eq:4', 'expr:2'], // the story becomes expressions (writing an expression), then an equation
  'line:1': ['signed:4', 'coord:1', 'expr:1'], // a table of values: substitute x in mx + b (expr:1, signed:4), plot the points
  'line:2': ['line:1'], // what m and b mean in y = mx + b
  'line:3': ['line:2', 'coord:1'], // slope from the graph: steps on the grid
  'line:4': ['line:3', 'signed:3'], // slope between two points: a quotient of signed differences
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
  'stats:3': [], // mean: sum and share
  'stats:4': ['stats:3'], // mean from a frequency table
  'stats:5': ['stats:3', 'eq:2'], // a missing value from the mean: the mean equation backwards, (sum + x) : n = mean, two steps
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
