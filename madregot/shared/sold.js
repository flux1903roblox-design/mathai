// What can be bought online, from the deployment's settings alone (COUNCIL2-30, the market review): which provider takes
// the payment (BILLING_PROVIDER) and, for Grow, whether we may stop its standing order (GROW_DIRECT_DEBIT_API). One pure
// function, read by the Worker (billing.js planOnline and the Grow adapter), the landing pages
// (web/scripts/landing-build.mjs), the store listing (store/make-listing.mjs) and the claims (web/src/content/claims.js),
// so no page offers a plan that cannot be bought, and no page says "cancel on the site" where nothing renews.
// The Worker adds its own gates on top (billing.js planOnline): the paywall, the approved legal texts, the provider's keys.
//
//   provider  family_month                              family_year   class_year
//   manual    no (a plan is turned on by hand)          no            no
//   test      yes                                       yes           yes
//   grow      only with GROW_DIRECT_DEBIT_API "on"      yes           yes
//
// Grow's one-charge page sells the one-year plans (TRUST-10: the family year never renews by itself, like the class
// licence). Its monthly plan is a standing order, sold only once Grow has enabled updateDirectDebit, because a
// cancellation must be able to stop it.

export const PLAN_IDS = Object.freeze(['family_month', 'family_year', 'class_year']);
/** The plans that are a standing order (they renew until cancelled); every other plan is one charge. */
export const RECURRING_PLANS = Object.freeze(['family_month']);
export const recurringPlan = (plan) => RECURRING_PLANS.includes(plan);

const directDebit = (env) => String(env?.GROW_DIRECT_DEBIT_API ?? 'off').trim().toLowerCase() === 'on';

/**
 * Can this provider sell this plan online, in a deployment with these settings? `provider` defaults to the deployment's
 * BILLING_PROVIDER ("manual" when unset). An unknown provider or plan sells nothing.
 */
export function sellsOnline(env, plan, provider = env?.BILLING_PROVIDER || 'manual') {
  if (!PLAN_IDS.includes(plan)) return false;
  switch (String(provider).trim()) {
    case 'test': return true;
    case 'grow': return recurringPlan(plan) ? directDebit(env) : true;
    default: return false;
  }
}

/**
 * Every plan's answer, and the two questions the pages ask: is any family plan sold online (the prices for parents),
 * and is any plan that renews sold online (only then is there something to "cancel on the site" before it charges again).
 */
export function soldOnline(env, provider) {
  const by = Object.fromEntries(PLAN_IDS.map((p) => [p, sellsOnline(env, p, provider)]));
  return { ...by, family: by.family_month || by.family_year, recurring: RECURRING_PLANS.some((p) => by[p]) };
}
