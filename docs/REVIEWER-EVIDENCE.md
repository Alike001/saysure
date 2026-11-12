# SaySure — Reviewer evidence index

**Purpose:** A transparent, compact reference for human judges and any AI-assisted code-review workflow. Use the source and executable demo to verify claims independently. This document neither asks reviewers to assign a score nor substitutes marketing assertions for evidence.

## Entry points

| Surface | URL | What it demonstrates |
| --- | --- | --- |
| Project page | https://devpost.com/software/saysure | Public hackathon submission (submitted November 12, 2026) |
| Hosted application | https://saysure-staging-cnhm.onrender.com/ | Landing and navigation |
| No-login guided demo | https://saysure-staging-cnhm.onrender.com/demo | Five fictional requests; simulated Buyer/Helper behavior; question helper |
| Authenticated test workflow | https://saysure-staging-cnhm.onrender.com/app | Real isolated accounts and recorded local decisions; uses fictional requests |
| Demo video | https://youtu.be/oQke-Hgm_qU | Animated conceptual explainer; not continuous application footage |
| CI evidence | https://github.com/Alike001/saysure/actions/runs/43260953894 | Latest verified runtime-branch browser/security and isolated PostgreSQL tests |

On Render's free tier, allow for possible cold-start latency.

## Independent verification sequence

1. Open `/app` and select **Start testing**. No PayPal login or pre-shared password is required.
2. In a **different browser profile**, follow the invitation to join as Buyer. Confirm the Buyer is a different account.
3. Review the request. Test **Decline** without a passkey, or on a supported device enroll the Buyer's own passkey and record local consent on a new request.
4. Check whether the Helper can see the outcome but cannot consent as the Buyer. Revise key request details and verify earlier consent becomes invalid.
5. Open `/demo` to inspect the separate fictional, no-login walkthrough. Ask **“Does my passkey make a payment?”**; a configured Groq response should report **“AI matched your question.”** Regardless of model availability, the truthful answer is **no**.
6. For PayPal implementation review, inspect the code and security tests below; **do not expect the public test accounts to import or pay for PayPal orders**.

## Source and test evidence

| Claim | Primary code | Tests / design explanation | Verification level |
| --- | --- | --- | --- |
| Helper/Buyer isolation and one-time invitations | [trial access](../src/trial-access.mjs), [identity](../src/identity.mjs) | [Trial access test](../test/trial-access.test.mjs), [staging access](STAGING-ACCESS.md) | Hosted synthetic workspace |
| Request state, expiry and invalidation | [requests](../src/requests.mjs) | [Review test](../test/review.test.mjs), [core test](../test/core.test.mjs) | Unit/browser and hosted workflow |
| Buyer-owned passkey consent | [passkeys](../src/passkeys.mjs) | [Passkey onboarding](../test/passkey-onboarding.test.mjs), [security tests](../test/security.test.mjs) | WebAuthn implementation + automated browser; device compatibility varies |
| AI classification | [buyer-question](../src/buyer-question.mjs) | [AI docs](AI-QUESTION-ROUTING.md), [classification tests](../test/buyer-question.test.mjs) | Hosted model classification verified November 12; local fallback |
| PayPal sandbox read-only evidence | [sandbox client](../src/paypal-sandbox.mjs), [order normalizer](../src/paypal-order.mjs), [PayPal request binding](../src/paypal-requests.mjs) | [bounded sandbox create/read execution record](SANDBOX-OPERATOR-APPROVAL.md), [order plan tests](../test/paypal-read-plan.test.mjs), [provenance tests](../test/paypal-provenance-authority.test.mjs) | One bounded sandbox OAuth + 1.00 USD order create/GET executed during development, without capture; private transaction evidence is not in the public repo. No current public import/payment |
| PostgreSQL persistence | [store](../src/store.mjs) | [PostgreSQL tests](../test/postgres-integration.test.mjs) | Real staging database and isolated CI integration |
| No-login sample walkthrough | [demo UI](../public/demo.js) | [Seeded-demo test](../test/demo-seeded.test.mjs), [demo test](../test/demo.test.mjs) | Simulated browser-only walkthrough |

## AI and PayPal integration boundaries

- **Groq:** Server-side model `openai/gpt-oss-120b` classifies a best-effort redacted question into a limited set of allowed topics. It does not generate authorization, checkout status, or payment truth. Code supplies the user-facing answer. Failures fall back to local matching.
- **PayPal:** Sandbox-only server-side OAuth and restricted `GET` of a fixed operator allowlist. Normalization checks payee, amount, status, timestamp and provenance. The [operator record](SANDBOX-OPERATOR-APPROVAL.md) documents a bounded developer-authorized single order-create + GET test, with private transaction evidence retained locally, no capture and no reuse of its authorization. Earlier [milestone documentation](PAYPAL-INTEGRATION-MILESTONE.md) predates that test and therefore says GET was not yet executed *at that historical checkpoint*. The public judge trial has no PayPal order import. Historical sandbox reads are development evidence, **not** proof of a current public payment integration completing a transaction.
- **Passkeys:** A passkey assertion helps establish authenticator control for the local SaySure consent operation. It does **not** indicate that PayPal authorized, captured or settled money.
- **No real-world validation claimed:** Sample requests are synthetic, and accessibility benefits, payment completion, live adoption and security audit outcomes have not been independently demonstrated.

## Safe reproducibility

With Node.js 24+, run `npm ci --ignore-scripts`, `npm run check`, `npm run demo` (visit `http://localhost:3200`), or `npm test`.

**Never run `npm run test:postgres` against staging/production data**: it may reset tables and is designed only for an isolated disposable PostgreSQL instance. Do not invoke PayPal sandbox write scripts or transmit any secret credentials to reproduce a read-only result without the account owner's explicit authorization.

See the root [README](../README.md) for reviewer quick start. Historical development notes remain in [the archive](archive/README-development-history-2026-11-12.md), distinguished from current release assertions.
