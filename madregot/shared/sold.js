// What can be bought online, from the deployment's settings alone (COUNCIL2-30, the market review): which provider takes
// the payment (BILLING_PROVIDER) and, for Grow, whether we may stop its standing order (GROW_DIRECT_DEBIT_API). One pure
// function, read by the Worker (billing.js planOnline and the Grow adapter), the landing pages
// (web/scripts/landing-build.mjs), the store listing (store/make-listing.mjs) and the claims (web/src/content/claims.js),
// so no page offers a plan that cannot be bought, and no page says "cancel on the site" where nothing renews.
// The Worker adds its own gates on top (billing.js planOnline): the paywall, the approved legal texts, the provider's keys.
//
//   provider  family_month                              family_year   exam_pass   class_year
//   manual    no (a plan is turned on by hand)          no            no          no
//   test      yes                                       yes           yes         yes
//   grow      only with GROW_DIRECT_DEBIT_API "on"      yes           yes         yes
//
// Grow's one-charge page sells the plans paid once: the one-year plans (TRUST-10: the family year never renews by
// itself, like the class licence) and the exam pass (COUNCIL2-33: 30 days of the family plan, one charge, never
// renewed). Its monthly plan is a standing order, sold only once Grow has enabled updateDirectDebit, because a
// cancellation must be able to stop it. The exam pass is sold only once its price is set (PRICE_EXAM_PASS_AGOROT, the
// owner's decision): with no price there is nothing to sell, and no page offers it.

export const PLAN_IDS = Object.freeze(['family_month', 'family_year', 'exam_pass', 'class_year']);
/** The plans of a family (one parent account, its devices, the tutor and the parents' report); class_year is a class's. */
export const FAMILY_PLANS = Object.freeze(['family_month', 'family_year', 'exam_pass']);
/** The plans that are a standing order (they renew until cancelled); every other plan is one charge. */
export const RECURRING_PLANS = Object.freeze(['family_month']);
export const recurringPlan = (plan) => RECURRING_PLANS.includes(plan);
/**
 * The plans whose term is counted in days (apply.js counts every other plan in calendar months): the exam pass lasts 30
 * days from its payment, whatever the month.
 */
export const PLAN_DAYS = Object.freeze({ exam_pass: 30 });
/**
 * The plans paid once for a fixed term: after the 14 days of the cooling-off period, cancelling gives back the unused
 * days (terms.md "ביטול והחזר"). The monthly plan has no such refund: it stops at the end of the month paid for.
 */
export const PRORATA_PLANS = Object.freeze(['family_year', 'exam_pass', 'class_year']);

/** The exam pass's price in agorot, VAT included (PRICE_EXAM_PASS_AGOROT), or null when it is not set: not sold. */
export function passPrice(env) {
  const raw = String(env?.PRICE_EXAM_PASS_AGOROT ?? '').trim();
  const v = /^\d+$/.test(raw) ? Number(raw) : NaN;
  return Number.isSafeInteger(v) && v > 0 ? v : null;
}

const directDebit = (env) => String(env?.GROW_DIRECT_DEBIT_API ?? 'off').trim().toLowerCase() === 'on';

/**
 * Can this provider sell this plan online, in a deployment with these settings? `provider` defaults to the deployment's
 * BILLING_PROVIDER ("manual" when unset). An unknown provider or plan sells nothing, nor does an exam pass with no price.
 */
export function sellsOnline(env, plan, provider = env?.BILLING_PROVIDER || 'manual') {
  if (!PLAN_IDS.includes(plan)) return false;
  if (plan === 'exam_pass' && !passPrice(env)) return false;
  switch (String(provider).trim()) {
    case 'test': return true;
    case 'grow': return recurringPlan(plan) ? directDebit(env) : true;
    default: return false;
  }
}

/**
 * Every plan's answer, and the two questions the pages ask: is any family plan sold online (the prices for parents; the
 * exam pass is one), and is any plan that renews sold online (only then is there something to "cancel on the site"
 * before it charges again).
 */
export function soldOnline(env, provider) {
  const by = Object.fromEntries(PLAN_IDS.map((p) => [p, sellsOnline(env, p, provider)]));
  return { ...by, family: FAMILY_PLANS.some((p) => by[p]), recurring: RECURRING_PLANS.some((p) => by[p]) };
}
