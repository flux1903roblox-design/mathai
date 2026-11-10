// The manual provider: no online payment. Used for class licences paid by invoice, the owner's grants (npm run owner)
// and before a payment provider is chosen. Nothing renews, so cancelling and resuming need no call anywhere; a refund
// is made by the owner by hand (the queue row becomes manual and the owner gets a notice).
import { HttpError } from '../util.js';

export default {
  id: 'manual',
  capabilities: { online: false, cancelApi: true, refundApi: false, resumeApi: true, portal: false, signedWebhooks: false },
  enabled: () => true,
  async createCheckout() { throw new HttpError(501, 'checkout_not_configured'); },
  async verify() { throw new HttpError(404, 'not_found'); },
  parse() { throw new HttpError(404, 'not_found'); },
  async fetchTruth() { return null; },
  async acknowledge() {},
  async cancel() { return { synced: true }; },
  async resume() { return { synced: true }; },
  async refund() { return { refunded: false, manual: true }; },
  async fetchSubscription() { return null; },
  portalUrl() { return null; },
};
