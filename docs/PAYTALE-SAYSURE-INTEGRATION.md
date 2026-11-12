# SaySure + PayTale product integration

**Status:** Product direction agreed; feature integration incomplete.  
**Current staging branch:** \`feat/saysure-postgres-runtime\`.

SaySure is the single user-facing product. PayTale's strongest investigation and reconciliation ideas belong in its payment-evidence layer. This does not mean the historical PayTale workspace, credentials, database or records are to be copied, migrated or modified.

## What is implemented today

### Before a payment decision
- A Helper can prepare or revise a request for a separate Buyer.
- The Buyer sees the amount, currency, merchant reference/name, description, expiry and current request status.
- Changed details invalidate the previous consent and challenges.
- The Buyer can decline or record consent with their own enrolled passkey.
- Explanations and optional speech are grounded in the recorded request details. AI question routing selects from a closed topic vocabulary; answers are generated locally.
- The public guided demo is synthetic and does not perform WebAuthn or PayPal operations.

### PayPal evidence available in this branch
- The authenticated app has an operator-enabled PayPal sandbox order import path.
- The server reads an allowlisted order and binds the normalized provider observation to a request.
- Freshness, order identity, payee, amount, currency and provenance are checked again before consent continuation.
- The adapter is not a checkout/capture service. Local consent consumption is not PayPal payment execution.

## Not yet implemented

- A customer-facing PayPal checkout hand-off or capture flow.
- A verified post-checkout order/capture timeline.
- A public webhook receiver with PayPal signature verification, durable event IDs and idempotent processing.
- Reconciliation between order state, capture state and verified webhook evidence.
- Duplicate-safe recovery guidance for pending, completed, failed, reversed or ambiguous outcomes.
- An operator-reviewed recovery workflow. No retry, capture, refund or reversal should be inferred from an incomplete or contradictory observation.

## Integration sequence

1. **Product entry and UX:** one landing page, a no-login synthetic demo and a separate protected workspace. Keep current Helper/Buyer security and passkey requirements.
2. **Evidence model:** add immutable provider observations with source, environment, event ID, observed time, signature-verification result and canonical order/capture identifiers. Keep raw payer/shipping/PII fields out of the Buyer view unless a reviewed need exists.
3. **Webhook verification:** verify PayPal's signature against the configured webhook identity before accepting an event. Persist event IDs under a unique constraint and process duplicates as no-ops. A webhook is evidence, not unquestionable truth; corroborate material state with a fresh authenticated provider read.
4. **Reconciliation:** derive a timeline from verified order/capture observations and webhook events. Represent unknown, pending, failed and conflicting evidence explicitly. Never turn missing evidence into success.
5. **Recovery recommendations:** recommend the safest next investigation step; do not automatically retry a payment or issue a refund. Require a separate, explicit operator approval for any future sandbox write operation.
6. **End-to-end sandbox validation:** only after the read model and safety controls pass, run a newly reviewed, bounded sandbox scenario. Do not reuse historical order IDs, execution markers or old approvals.

## Non-negotiable product boundaries

- SaySure consent is not PayPal approval, capture or payment completion.
- The Helper cannot approve or consume for the Buyer.
- The Buyer's own passkey remains the only consent approval mechanism in the authenticated workflow.
- A changed amount, currency, payee, order or evidence generation invalidates the previous review.
- The public demo must say **DEMO ONLY** and use synthetic fixtures.
- No production credentials, real funds, card details or historical private PayTale records are used in this staging work.
