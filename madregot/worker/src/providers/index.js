// Payment providers, chosen by BILLING_PROVIDER. Each adapter has the same shape (see manual.js and test.js):
// capabilities, createCheckout, verify, parse (hints only, never trusted to grant), fetchTruth (the state pulled with
// our credentials), acknowledge, cancel, resume, refund, fetchSubscription and portalUrl.
// A provider for real payments (Grow, Cardcom, PayPlus or Paddle) is added here once the owner chooses one.
import manual from './manual.js';
import test from './test.js';

const REGISTRY = { manual, test };

/** A provider by id, or null when it does not exist or may not run here (the test provider is gated). */
export function providerById(env, id) {
  const p = REGISTRY[String(id || '')];
  if (!p || !p.enabled(env)) return null;
  return p;
}
/** The provider new checkouts go to. */
export const currentProvider = (env) => providerById(env, env.BILLING_PROVIDER || 'manual');
/** Webhooks are accepted only for the provider in use. */
export const webhookProvider = (env, id) => (String(id) === String(env.BILLING_PROVIDER || 'manual') ? providerById(env, id) : null);
