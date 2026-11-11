// Payment providers, chosen by BILLING_PROVIDER. Each adapter has the same shape (see manual.js and test.js):
// capabilities, createCheckout, verify, parse (hints only, never trusted to grant), fetchTruth (the state pulled with
// our credentials), acknowledge, cancel, resume, refund, fetchSubscription and portalUrl.
// A refund or chargeback truth carries the charge's providerPaymentId and, where the provider has one, its own
// providerRefundId: without it, one refund per charge is recorded (a later report about it counts as a repeat).
// grow.js is the Israeli provider (PARENTS-11). An adapter whose capabilities depend on the deployment (Grow's cancel
// needs a permission the owner asks for) has capabilitiesOf(env); read them through capsOf. One that sells only some
// plans online has planOnline(env, plan).
import manual from './manual.js';
import test from './test.js';
import grow from './grow.js';

const REGISTRY = { manual, test, grow };
/** A provider's capabilities in this deployment. */
export const capsOf = (env, p) => p?.capabilitiesOf?.(env) ?? p?.capabilities;

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
