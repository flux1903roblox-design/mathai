// Types for the Worker's static check (COUNCIL2-21, worker/tsconfig.json, `npm run typecheck`): the D1, binding and
// environment shapes the checked files use (util.js, entitle.js, billing.js, vault.js, each marked `// @ts-check`).
// They are written here because @cloudflare/workers-types is not a dependency. Only JSDoc: nothing in this file runs,
// and no module imports it at run time (the checked files name it in `import('./types.js')` type expressions only).

/**
 * A row as D1 returns it: column name → value. Each reader checks what it uses.
 * @typedef {Record<string, any>} Row
 */

/**
 * @template [T=Row]
 * @typedef {object} D1Result
 * @property {T[]} results
 * @property {boolean} [success]
 * @property {{ changes?: number, last_row_id?: number, [k: string]: unknown }} [meta]
 */

/**
 * A prepared statement: bound once, then read (first, all) or run.
 * @typedef {object} D1Statement
 * @property {(...values: unknown[]) => D1Statement} bind
 * @property {<T = Row>(column?: string) => Promise<T | null>} first
 * @property {<T = Row>() => Promise<D1Result<T>>} all
 * @property {<T = Row>() => Promise<D1Result<T>>} run
 */

/**
 * The database binding (DB). batch runs its statements in one transaction: all or none.
 * @typedef {object} D1Database
 * @property {(sql: string) => D1Statement} prepare
 * @property {<T = Row>(statements: D1Statement[]) => Promise<D1Result<T>[]>} batch
 */

/**
 * A Workers Rate Limiting binding (VAULT_RL and the edge limiters).
 * @typedef {{ limit(opts: { key: string }): Promise<{ success: boolean }> }} RateLimit
 */

/**
 * The request's context: work that may finish after the answer.
 * @typedef {{ waitUntil(p: Promise<unknown>): void }} Ctx
 */

/**
 * The bindings and vars the checked files read (wrangler.toml says what each var does). A var is a string, or missing;
 * AI_LIMITS may also come as parsed JSON (the tests pass an object). Vars read by name (the limits in entitle.js VARS,
 * the prices, the legal vars) go through varOf in util.js.
 * @typedef {object} Env
 * @property {D1Database} DB
 * @property {RateLimit} [VAULT_RL]
 * @property {string | Record<string, unknown>} [AI_LIMITS]
 * @property {string} [AI_PAYWALL]
 * @property {string} [AI_PARENT_OK]
 * @property {string} [ALLOW_SOLO_AI]
 * @property {string} [ANTHROPIC_API_KEY]
 * @property {string} [CLAUDE_MODEL]
 * @property {string} [FREE_MODEL]
 * @property {string} [FREE_DEVICE_MINT]
 * @property {string} [DEVICE_SECRET]
 * @property {string} [IP_HASH_SECRET]
 * @property {string} [BILLING_START]
 * @property {string} [LEGACY_CLASS_AI_UNTIL]
 * @property {string} [BILLING_MODE]
 * @property {string} [BILLING_PROVIDER]
 * @property {string} [BILLING_CHECKOUT_HOSTS]
 * @property {string} [WEBHOOK_PATH_SECRET]
 * @property {string} [TEST_WEBHOOK_SECRET]
 * @property {string} [PUBLIC_URL]
 * @property {string} [TERMS_VERSION]
 * @property {string} [VAT_MODE]
 * @property {string} [BUSINESS_NAME]
 * @property {string} [BUSINESS_ID]
 * @property {string} [BUSINESS_KIND]
 * @property {string} [BUSINESS_ADDRESS]
 * @property {string} [CONTACT_EMAIL]
 * @property {string} [CONTACT_PHONE]
 * @property {string} [PAYMENT_PROVIDER_NAME]
 * @property {string} [LEGAL_DATE]
 * @property {string} [DB_JURISDICTION]
 * @property {string} [ACCESS_COORD_NAME]
 * @property {string} [ACCESS_COORD_PHONE]
 * @property {string} [ACCESS_COORD_EMAIL]
 * @property {string} [ACCESS_STATEMENT_DATE]
 * @property {string} [ACCESS_TESTED]
 * @property {string} [VAULT]
 * @property {string} [VAULT_MAX_MB]
 * @property {string} [VAULT_SECRET]
 */

/**
 * A row of subscriptions (schema.sql): a family plan, an exam pass or a class licence.
 * @typedef {object} Subscription
 * @property {string} id
 * @property {'family' | 'class'} kind
 * @property {string | null} account_id
 * @property {string | null} class_code
 * @property {string} plan
 * @property {'active' | 'past_due' | 'canceled' | 'ended'} status
 * @property {string} provider
 * @property {string | null} provider_subscription_id
 * @property {number | null} price_agorot
 * @property {number | null} seats
 * @property {string | null} invoice_ref
 * @property {string} current_period_start
 * @property {string} current_period_end
 * @property {number} cancel_at_period_end
 * @property {string | null} cancel_requested_at
 * @property {string | null} cancel_synced_at
 * @property {string | null} first_paid_at
 * @property {string | null} refund_until
 * @property {string | null} ended_reason
 * @property {string | null} last_event_at
 * @property {string | null} note
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * A row of orders: one checkout attempt, priced on the server.
 * @typedef {object} Order
 * @property {string} id
 * @property {string | null} account_id
 * @property {string} plan
 * @property {string | null} class_code
 * @property {number | null} seats
 * @property {number} amount_agorot
 * @property {number} vat_agorot
 * @property {string} provider
 * @property {'test' | 'live'} mode
 * @property {string | null} [provider_checkout_id]
 * @property {string} idempotency_key
 * @property {string} status
 * @property {string | null} [subscription_id]
 * @property {string} created_at
 * @property {string} expires_at
 * @property {string | null} [paid_at]
 */

/**
 * A row of payments: a charge, a refund or a chargeback, as the provider reported it.
 * @typedef {object} Payment
 * @property {string} id
 * @property {string} provider
 * @property {string} provider_payment_id
 * @property {'charge' | 'refund' | 'chargeback'} kind
 * @property {string | null} subscription_id
 * @property {string | null} order_id
 * @property {number} amount_agorot
 * @property {string} status
 * @property {string | null} period_end
 * @property {string | null} invoice_url
 * @property {string} occurred_at
 */

/**
 * A row of refund_queue: money owed back, paid through the provider's API or marked manual.
 * @typedef {object} RefundRow
 * @property {number} id
 * @property {string} subscription_id
 * @property {string | null} payment_id
 * @property {number} amount_agorot
 * @property {string} reason
 * @property {string} requested_at
 * @property {number} tries
 * @property {number} manual
 * @property {string | null} done_at
 */

/**
 * A row of order_renewals: the one-year plan an order renews, and where its paid year ended.
 * @typedef {{ order_id: string, subscription_id: string, prev_start: string, prev_end: string }} Renewal
 */

/**
 * A payment provider (providers/*.js): the hosted page, the webhook's checks, the truth behind a hint, and the calls
 * a cancellation or a refund makes. A provider without an API for something says so in its capabilities.
 * @typedef {object} Provider
 * @property {string} id
 * @property {(env: Env, opts: Record<string, unknown>) => Promise<{ url: string, providerCheckoutId?: string }>} createCheckout
 * @property {(env: Env, req: Request, raw: string) => Promise<void>} verify
 * @property {(env: Env, raw: string, headers: Headers) => Array<{ eventId: string, type?: string, occurredAt?: string }>} parse
 * @property {(env: Env, hint: { eventId: string }) => Promise<Record<string, any> | null>} fetchTruth
 * @property {(env: Env, truth: Record<string, any> | null) => Promise<unknown>} acknowledge
 * @property {(env: Env, sub: Subscription, opts: { idempotencyKey: string }) => Promise<unknown>} cancel
 * @property {(env: Env, payment: Payment | null, opts: { amountAgorot: number, idempotencyKey: string }) => Promise<{ refunded?: boolean, manual?: boolean, providerRefundId?: string } | null>} refund
 * @property {(env: Env, sub: Subscription) => Promise<unknown>} resume
 * @property {(env: Env, sub: Subscription) => string | null} portalUrl
 */

/** What a provider can do here (providers/index.js capsOf). */
/** @typedef {{ online?: boolean, cancelApi?: boolean, refundApi?: boolean, resumeApi?: boolean }} Caps */

export {};
