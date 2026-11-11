// The shared automated accessibility check (PKG-1, TRUST-2 §0.3 rule 7): axe-core 4.10.3 through @axe-core/playwright
// 4.10.2, on the WCAG 2.0 and 2.1 levels A and AA. a11y.spec.js runs it on every screen and state, in light and dark;
// axe-self.spec.js proves it fails on a known violation, so a screen that passes has really been checked.
//
// What axe does not judge (a human still checks these): the reading order a screen reader takes, whether a name makes
// sense, the focus order, and control edges at 3:1 (WCAG 1.4.11), which contrast.js measures on its own.
import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export const WCAG_TAGS = Object.freeze(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

/**
 * Parts of a page that axe cannot judge, left out of every scan: { selector, why }. Nothing is here to make a test
 * pass: a part goes in only when axe's verdict on it would be wrong, never when the part itself is wrong.
 */
export const NOT_JUDGED = Object.freeze([
  // (empty: KaTeX's MathML twin (.katex-mathml) is hidden from sight but read by screen readers, and axe judges it
  // correctly, so it stays in every scan)
]);

/** Rules a scan may never turn off: a contrast failure is fixed in the colours (canon.css), never skipped. */
const NEVER_OFF = new Set(['color-contrast']);

/** One violation as a block of text: the rule, how bad, what to do, where to read more, and every element it hit. */
export function describeViolation(v) {
  const nodes = v.nodes.map((n) => {
    const html = String(n.html || '').replace(/\s+/g, ' ').trim();
    const summary = String(n.failureSummary || '').replace(/\s+/g, ' ').trim();
    return `    - ${JSON.stringify(n.target)}\n      ${html.length > 220 ? `${html.slice(0, 220)}…` : html}${summary ? `\n      ${summary}` : ''}`;
  });
  return `  [${v.id}] (${v.impact || 'unknown'}) ${v.help}\n    ${v.helpUrl}\n${nodes.join('\n')}`;
}

/**
 * Run axe on the page and fail with a readable list when anything breaks WCAG 2.1 A/AA.
 * - include / exclude: a CSS selector or a list of them (exclude only for content axe cannot judge, with the reason
 *   written where it is passed);
 * - tags: the axe tags to run (default WCAG 2.0 and 2.1, A and AA);
 * - disableRules: { ruleId: 'why this rule is wrong here' }; color-contrast throws.
 * Returns the axe results, so a test can also check what was scanned.
 */
export async function expectNoAxeViolations(page, { include, exclude, tags = WCAG_TAGS, disableRules } = {}, what = '') {
  const off = disableRules || {};
  if (Array.isArray(off)) throw new Error('disableRules takes { ruleId: reason }, so every rule turned off says why');
  for (const [rule, why] of Object.entries(off)) {
    if (NEVER_OFF.has(rule)) throw new Error(`the ${rule} rule may not be turned off; fix the colours instead`);
    if (!String(why || '').trim()) throw new Error(`turning off ${rule} needs a reason`);
  }
  let builder = new AxeBuilder({ page }).withTags([...tags]);
  for (const sel of [include].flat().filter(Boolean)) builder = builder.include(sel);
  for (const sel of [...NOT_JUDGED.map((n) => n.selector), ...[exclude].flat().filter(Boolean)]) builder = builder.exclude(sel);
  if (Object.keys(off).length) builder = builder.disableRules(Object.keys(off));
  const results = await builder.analyze();
  const list = results.violations.map(describeViolation).join('\n');
  expect(results.violations.length, `axe found ${results.violations.length} WCAG 2.1 A/AA violation(s)${what ? ` on ${what}` : ''}:\n${list}\n`).toBe(0);
  return results;
}
