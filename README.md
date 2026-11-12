# SaySure

**Your money. Your final say.**

SaySure is a buyer-controlled payment-request review application. A **Helper** prepares a request; a separate **Buyer** checks the amount, recipient, purpose and expiration, then declines or records **local passkey-backed consent**. The Helper cannot approve for the Buyer. Revising important details invalidates earlier consent.

**SaySure consent is NOT a PayPal checkout, authorization, capture, refund, or completed payment.** The public demonstration never transfers money.

### Submitted to the PayPal AI Hackathon — November 12, 2026

[**Devpost submission**](https://devpost.com/software/saysure) · [**1:32 demo video**](https://youtu.be/oQke-Hgm_qU) · [**Live product**](https://saysure-staging-cnhm.onrender.com/) · [**Judge test workspace**](https://saysure-staging-cnhm.onrender.com/app) · [**No-login demo**](https://saysure-staging-cnhm.onrender.com/demo) · [**Latest verified CI run**](https://github.com/Alike001/saysure/actions/runs/43260953894)

The video is a conceptual animated explainer rather than continuous recorded application interactions. **The separate live workspace above is functional** and available for judges to operate themselves.

## Try SaySure in under two minutes

**Quick walkthrough — no account needed:** Open [the guided demo](https://saysure-staging-cnhm.onrender.com/demo). Explore five **fictional** requests, compare request details, switch Helper/Buyer views, try a simulated decision, and ask a question. These outcomes stay in the browser; they are not real consent or PayPal transactions.

**Real authenticated test — no signup:** Open [the workspace](https://saysure-staging-cnhm.onrender.com/app) and select **Start testing**. This creates an isolated Helper account and a preloaded synthetic request. Share the **one-use Buyer invitation link** with a second browser profile or device; join as Buyer, inspect the request and decline, or enroll the Buyer's own passkey on a compatible device and record local consent. Refresh the Helper view to see the state change. Do **not** share account passwords or passkey credentials.

New users do not need a PayPal account. Returning test users can access [their existing workspace](https://saysure-staging-cnhm.onrender.com/app/login) with previously saved credentials. See the full [judge test instructions](docs/STAGING-ACCESS.md).

## What works, and what the evidence proves

| Capability | Implemented and verified | Boundary / proof |
| --- | --- | --- |
| Independent Helper / Buyer | Private test accounts; one-use invitations; role-scoped requests; refreshable states | [Workspace](https://saysure-staging-cnhm.onrender.com/app) · [trial access](src/trial-access.mjs) · [tests](test/trial-access.test.mjs) |
| Buyer passkeys and consent | WebAuthn enrollment, Buyer-only consent, decline and invalidation on changed details | [Passkeys](src/passkeys.mjs) · [request state](src/requests.mjs) · [passkey test](test/passkey-onboarding.test.mjs). **Consent does not send money.** |
| Groq AI | Hosted Groq classification was verified November 12 using the question “Does my passkey make a payment?” | [AI router](src/buyer-question.mjs) · [AI design](docs/AI-QUESTION-ROUTING.md) · [tests](test/buyer-question.test.mjs). AI selects a fixed topic; app code supplies the explanation; local fallback if unavailable. |
| PayPal Developer Platform | Server-side OAuth and **read-only PayPal Orders v2 sandbox** order retrieval validated during development; defensive order/payee/amount checks | [Sandbox client](src/paypal-sandbox.mjs) · [order checks](src/paypal-order.mjs) · [request binding](src/paypal-requests.mjs) · [completed bounded sandbox create/read record](docs/SANDBOX-OPERATOR-APPROVAL.md). **Public trial accounts cannot import live sandbox orders; no public checkout/capture/refund.** |
| Persistent, isolated data | PostgreSQL-backed workspace, session and request state; the demo is separate and fictional | [Storage](src/store.mjs) · [integration tests](test/postgres-integration.test.mjs) |
| Accessibility-oriented interface | Clear Buyer review, optional speech, mobile layouts, synthetic guided walkthrough | [Public UI](public/) · [UX/browser tests](test/product-ux.test.mjs). **No claim of independent accessibility certification or proven user comprehension.** |

PayPal and Groq have **different levels of verification**: hosted model routing has been observed working, while PayPal sandbox OAuth and Orders GET were verified in development. The publicly accessible trial is intentionally restricted to synthetic requests. Do not interpret a green automated test as proof of a completed payment.

## Architecture in one view

```text
Helper -> create / revise request -> PostgreSQL -> Buyer review
                                                   |
                            decline or Buyer-owned WebAuthn consent
                                                   |
                             request status and revision invalidation

Buyer question -> redacted question -> Groq topic classifier
                                        (or local fallback)
               -> local, deterministic explanation from reviewed facts

Operator-approved sandbox order -> read-only PayPal Orders API
                                 -> bounded order evidence checks
                                 -> reviewable request (not checkout)
```

- **HTTP application and routes:** [`src/app.mjs`](src/app.mjs)
- **Trial accounts and invitations:** [`src/trial-access.mjs`](src/trial-access.mjs)
- **Core request state:** [`src/requests.mjs`](src/requests.mjs), [`src/passkeys.mjs`](src/passkeys.mjs)
- **PayPal read-only adapter and validation:** [`src/paypal-sandbox.mjs`](src/paypal-sandbox.mjs), [`src/paypal-order.mjs`](src/paypal-order.mjs), [`src/paypal-requests.mjs`](src/paypal-requests.mjs)
- **AI topic routing and local fallback:** [`src/buyer-question.mjs`](src/buyer-question.mjs)
- **Data persistence:** [`src/store.mjs`](src/store.mjs)
- **Public synthetic demo:** [`public/demo.html`](public/demo.html), [`public/demo.js`](public/demo.js)

A [reviewer evidence guide](docs/REVIEWER-EVIDENCE.md) indexes each claim to its code, test and limitations. The [architecture and development history](docs/archive/README-development-history-2026-11-12.md) preserves earlier milestones without confusing them with the hosted release.

## Run and verify locally

**Requirements:** Node.js 24+ and npm.

```bash
git clone https://github.com/Alike001/saysure.git
cd saysure
npm ci --ignore-scripts
npm run check
npm run demo
```

Open **http://localhost:3200** for a browser-based, entirely synthetic walkthrough; no PayPal or Groq key is required. For the offline test suite:

```bash
npm test
```

**PostgreSQL test warning:** `npm run test:postgres` is for an **isolated disposable test database only**. Its setup may delete test data; never point it at the Render/Neon staging database or any live database. The CI workflow creates its own temporary PostgreSQL service.

The last verified hosted-runtime CI run on [November 12](https://github.com/Alike001/saysure/actions/runs/43260953894) passed the automated browser/security suite and isolated PostgreSQL integration. The live Render deployment uses runtime commit [`4187814`](https://github.com/Alike001/saysure/commit/41878140b24740bbee43a5e3a44f1c43defe2860) with startup diagnostics. The main repository includes the submitted product; documentation-only changes after the submission are not evidence of new payment functionality.

## Security and deployment boundaries

- **No real funds:** Buyer passkey consent records a decision about a request only.
- **No PayPal checkout:** Order reads are sandbox-only, operator-allowlisted and read-only. No production payments, checkout/capture/refund, verified webhook lifecycle or reconciliation is claimed.
- **Constrained AI:** Groq receives only a best-effort redacted question (redaction is not guaranteed); the model can select from a fixed topic list but cannot approve or execute actions. Never type sensitive payment details into questions.
- **Isolated roles:** A Helper cannot impersonate the Buyer's authenticator; consent is invalidated when reviewed details change.
- **Scope and maturity:** Sample data are fictional. No independent penetration audit, end-user comprehension study, production payment launch, or user-traction claim is made.

Additional documentation: [PayPal implementation status](docs/PAYPAL-INTEGRATION-MILESTONE.md) · [AI boundary](docs/AI-QUESTION-ROUTING.md) · [judge access](docs/STAGING-ACCESS.md) · [submission notes](docs/HACKATHON-SUBMISSION-2026-11-12.md).

## License

[MIT License](LICENSE). Built for the **PayPal AI Hackathon 2026**.
