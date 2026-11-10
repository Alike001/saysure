# SaySure Milestone 3 — PayPal Orders integration


**Historical milestone.** Provider observations, counts and next-action proposals below belong to this dated checkpoint. They grant no current operations. Do not reuse the old attended authorization or execution marker; historical PayPal-order consumption remains unconfirmed.

Final independent security approval covers commit **22c116be7f0a88843a50d6ff3f5cf6464c152177** (`22c116b`), with **186/186 tests passed** and no outstanding security findings. This approves the local prototype, not payment completion, comprehension, deployment or publication.

Current contract: [API reference](API.md), [consumption corrections](CONSUMPTION-CORRECTIONS.md) and [architecture map](../PASSKEY-EXPERIMENT.md#architecture-and-implementation).

9 November 2026. Starting commit `e3910e9`, clean working tree; baseline **39/39 tests passed** before changes. Localhost origin, RP ID, enrollment, account secrets and credential storage are preserved. No setup/re-enrollment, database reset, deployment or remote push was performed. The existing physical phone-backed result remains user-reported manual evidence, not a fresh agent-run test.

## Decision

**GO for the bounded local implementation and mocked consent-flow demonstration. NO-GO for executing a new sandbox order test in this run.** OAuth connectivity is genuine; current-order GET and real order-bound consent remain unverified. A separate operator approval must name the sandbox merchant, authorize one fixed 1.00 USD order creation, and confirm the known buyer-approval restriction can be handled legitimately. No completed PayPal checkout or production readiness is claimed.

## Real API evidence versus mocked evidence

| Execution | Result | What it establishes |
| --- | --- | --- |
| Real `POST https://api-m.sandbox.paypal.com/v1/oauth2/token` | HTTP 200, once | Existing sandbox client credentials authenticate. Tokens were held in memory and not printed or saved |
| Real Orders GET | **Not executed** | No current order is configured. No current GET success or merchant ownership is established |
| Historical order | Not queried | Prior 404 remains historical unavailability; not an active/payable order, nor proof of its expiry/cancellation |
| Order creation/capture/refund/authorization | **Zero** | Disabled creation implementation only; no financial operations |
| Groq purchase-question evaluation | Two requests: initial HTTP 400, corrected request HTTP 200 | Only fixed synthetic items and separately labelled mock PayPal fixtures were sent; no real buyer/order/credential data |
| Automated HTTP and browser tests | Mocked provider transport; real WebAuthn verifier | Application/protocol behavior under controlled fixtures, not a genuine provider GET result |

Sanitized evidence: [`paypal-readiness.json`](../evidence/paypal-readiness.json), [`purchase-assistant-evaluation.json`](../evidence/purchase-assistant-evaluation.json), and retained [`purchase-assistant-initial.json`](../evidence/purchase-assistant-initial.json). The read-only probe read the existing private PayTale configuration without changing it; the application itself uses SaySure's private `.env`/process environment, never PayTale at startup. PayTale HEAD remains `674aba330e2abbba3c4d8b8a054a919352db0cbe` with its pre-existing untracked research directory untouched.

## Implemented backend contract

The real client follows official [OAuth](https://developer.paypal.com/api/rest/authentication) and [Orders GET](https://developer.paypal.com/api/rest/integration/orders-api/api-use-cases/advanced) documentation fetched through Context7. Host is fixed to `https://api-m.sandbox.paypal.com`; non-sandbox configuration is refused. It has only token authentication and GET-by-ID operations. No caller-supplied URL, redirect, capture or authorization operation is available. In-memory tokens expire, concurrent token requests coalesce, 401 clears the cache, reads time out and response sizes are bounded. Errors expose safe codes/status only; raw provider JSON, bearer tokens, payer names, emails and addresses are not logged or persisted.

Operator configuration fixes the expected payee ID and an allowlist of current order IDs. The helper can select an application buyer and enter an allowlisted order ID; it cannot supply a verified amount, currency, payee, snapshot or API response. An authenticated GET plus matching payee establishes API-account access/correlation, **not independent shop identity**, beneficial ownership, trustworthiness, or that the application buyer owns the PayPal payer account. The selected app buyer is explicitly labelled as such.

Normalization validates returned ID, CAPTURE intent, known status, creation time, exact decimal strings, currency and payee. One to ten purchase units are supported only when all have the configured payee and same supported currency. Totals use BigInt minor units; per-unit original decimal strings are retained. Mixed currencies, missing payee/amount, unsupported currencies/statuses, conflicting payment data, old/future timestamps and provider failures fail closed. COMPLETED/VOIDED orders cannot receive new consent. No successful payment-completion badge is inferred.

Supported currencies remain USD, EUR, NGN and JPY. A conservative local three-hour window from provider creation and ten-minute request deadline are enforced; these are **application limits, not a provider expiry guarantee**. Each network observation must be less than 60 seconds old, measured from read start. Orders with extensions or unsupported structures can be rejected safely. Real order item names, descriptions, shipping, payer and free text are deliberately omitted from the persisted/UI projection to avoid leaking personal information embedded in them. The real UI currently shows purchase-unit totals, not provider item-name explanations. Numerical unit totals are not a full itemization or fee guarantee.

## Current implementation addendum — approved `22c116b`

New PayPal snapshots use `paypal-consent-v2`, adding immutable evidence provenance to the ordered consent tuple. Legacy v1 bytes remain readable but cannot obtain new authenticated evidence or consumption receipts. The fixed sandbox constructor alone registers genuine adapter identities; every explicit transport override is mock.

`src/consumption.mjs` coordinates durable SQLite claims before provider reads and rechecks session/ownership/expiry after I/O. `src/consumption-diagnostics.mjs` maintains separate bounded authenticated traces and rejection aggregates. `src/requests.mjs` atomically commits the state, timestamp, challenge invalidation and mandatory consume event; the receipt is marked committed only after COMMIT. `public/consumption.js` validates it against the reviewed snapshot before announcing success. New tables are `consumption_claims`, `consumption_diagnostics` and `consumption_rejections`, alongside `paypal_bindings`.

## Consent binding and state transitions

Synthetic requests retain the original `synthetic-consent-v1` canonical bytes. At this historical milestone, PayPal requests used a distinct `paypal-consent-v1` tuple binding order ID, sandbox environment, intent, recorded provider status, exact purchase-unit values and total, currency, expected payee, provider creation/window, application buyer, request ID, revision, nonce, description and local expiry. These cannot be edited through the synthetic helper API. One durable binding per sandbox order prevents rebinding an already consumed order to another app buyer.

At that checkpoint only an additive `paypal_bindings` table was introduced; no credential column, RP ID, origin or existing snapshot is migrated. It records observation freshness, availability and genuine-versus-mock provenance. Injected mock transports remain explicitly labelled **MOCK PayPal fixture** in UI and speech.

The server re-reads evidence before issuing a challenge, after verifying the buyer's passkey signature, and before local consent consumption. It compares the full normalized payment tuple, then checks the current digest, status, challenge, session, freshness and evidence availability in the atomic state transition. Network I/O stays outside SQLite transactions. Any detected material change or failed read invalidates consent/challenges and requires a helper re-read plus a fresh buyer review. A helper re-read always increments revision, rotates nonce and clears prior consent, even if financial values are unchanged.

Decline is available when evidence has been invalidated and does not depend on PayPal availability. Refusal/withdrawal/consumption cannot be reopened by an in-flight refresh. Buyer/helper and buyer-account isolation, CSRF, exact Host/Origin, UV, signature checks, expiry and one-time atomic consumption remain enforced.

A remote order can still change after a GET. SaySure records local consent for an observed snapshot; it does not lock the PayPal order or prevent a merchant acting outside SaySure. No capture integration is present. The interface distinguishes:

- Synthetic local consent with helper-supplied/unverified details.
- Recent authenticated PayPal sandbox API evidence, separately from shop identity.
- Local buyer consent (pending/approved/consumed/rejected/etc.).
- Recorded PayPal buyer approval, only when genuine fresh API evidence reports APPROVED; fixture states never establish genuine approval. This is not an authorization of funds.
- Payment authorization/completion: not established by this prototype. It never captures or calls authorize.

Stale UI evidence is marked and approval/consumption controls are disabled. Server revalidation remains mandatory even if a stale/tampered client directly calls an endpoint. Refresh is needed to see changes from another session; a failed operation may require manual refresh to display the invalidated state.

## Exact local browser procedure

**Keep the already enrolled buyer. Do not rerun setup or delete `.local/`.** Existing synthetic tests remain available without PayPal configuration.

1. For a *fresh checkout only*, run `npm ci --ignore-scripts`, `npm run setup`, and `npm start` with Node 24+ and installed Google Chrome. Retrieve the separately provisioned helper/buyer secrets privately with the interactive `npm run account -- helper` / `npm run account -- buyer-a` commands. Existing local users skip setup.
2. To enable real reads later, privately copy `config/sandbox.example` to ignored `.env` and restrict it with `chmod 600 .env`. Supply sandbox client ID/secret, confirmed `PAYPAL_MERCHANT_ID`, and operator-approved **current** `PAYPAL_ALLOWED_ORDER_IDS`. Set `PAYPAL_READ_ENABLED=true`. Do not use the historical 404 order. Do not put credentials in chat, screenshots or source. Startup refuses invalid configuration.
3. Stop an older server with Ctrl+C in its own terminal and run `npm start`. The origin remains **http://localhost:3100**, RP ID **localhost**, listener **127.0.0.1**. Do not substitute another host, port or public tunnel. Existing passkeys/sessions are not reset.
4. Open independent Helper and Buyer browser profiles. As helper, use **Review a PayPal sandbox order**, choose buyer-a and enter only the operator-allowlisted current order ID. Select **Read and prepare PayPal order review**. If no current order/configuration exists, expect a refusal; **that is the current real-testing limitation**.
5. As buyer select **Refresh requests**. Read the order ID, total/currency, payee reference, purchase-unit totals, evidence timestamp, revision/expiry, local consent status and independent PayPal approval/completion states. Do not interpret the payee reference as proof of the shop's identity. Try speech and keyboard navigation. No AI or PayPal checkout starts.
6. Decline a throwaway review explicitly. For a separate intended review, check the exact-details statement and choose **Approve local consent for this PayPal order with my passkey**. Complete the existing phone-assisted native ceremony. Expect local consent only. A current real provider order is still needed to execute this genuine flow; it was not executed here.
7. Optional **Consume consent once (local test only)** triggers another GET and consumes local consent once. It does not capture a payment. As helper, **Re-read PayPal order (invalidates consent)** creates a new review revision; old assertions/consent fail. Closed/refused/consumed requests cannot be reopened.
8. If evidence becomes unavailable, changed or stale, expect refusal/invalidation. Helper re-read then Buyer refresh/re-review is required. Decline remains available for invalidated requests. Do not repair this by editing the database.

Reproduce the mock integration now without credentials or external network: `node --test test/paypal-client.test.mjs test/paypal-flow.test.mjs`. The browser test uses temporary provisioned identities, a labelled mock provider transport and a virtual authenticator with the real verifier. For interactive inspection of that test, it is test automation rather than persistent judge login; a separate persistent fixture demo has not been published. A synthetic 390px screenshot was visually inspected locally outside the repository; it is not real API evidence. Direct phone-browser testing still requires a separate reviewed HTTPS origin and separate enrollment; desktop hybrid authentication is preserved.

## Disabled order-creation gate

Official [Orders create specification](https://github.com/paypal/paypal-rest-api-specifications/blob/main/_autodocs/api-reference/orders.md) informed `src/paypal-create.mjs`. It has **no application route or executable CLI creation command**. Default invocation fails before using configuration, credentials or transport. Both `enabled:true` and `operatorApproved:true` must be supplied in a separately reviewed backend/operator invocation with a private sandbox bearer token and stable idempotency key. No environment toggle alone enables it. It only permits the fixed sandbox create endpoint/body; no capture, refund or authorize path exists. Enabled creation has deliberately not been executed or qualified in this run.

Proposed next operation, requiring separate approval:

```text
POST https://api-m.sandbox.paypal.com/v2/checkout/orders
PayPal-Request-Id: <one stable operator-generated UUID>
Prefer: return=representation
intent: CAPTURE (order intent only; NOT a capture call)
purchase_units[0].reference_id: saysure-test
purchase_units[0].amount: { currency_code: USD, value: 1.00 }
purchase_units[0].payee.merchant_id: <operator-confirmed sandbox merchant ID>
description: SaySure synthetic notebook test; no real goods
```

The only historical intended merchant reference is **7TSZELT2DA9JJ**, from the earlier sandbox report. There is **no currently configured/verified merchant ID**. The operator must confirm that this remains the intended sandbox merchant associated with the client credentials, or explicitly select a different sandbox account; we do not invent a current account or reverify its identity by assumption. Do not enable creation until that is settled. Expected create result: 201 CREATED (or a documented idempotent replay), an order ID, then a fresh GET validating ID/payee/exact 1.00 USD. Creation alone is not checkout approval or payment success.

After that separate approval, record the new order ID privately in the allowlist, GET it, exercise SaySure review/consent, and use legitimate human sandbox buyer approval only if permitted. A later GET may establish APPROVED. The prior Nigerian sandbox buyer-approval blocker remains unresolved; do not bypass it. Capture/refund/authorization remain excluded and would require a different authorization and implementation. Stop on any provider error or restriction, retaining only sanitized evidence.

## Limited purchase-question assistant comparison

The evaluated role is question-focused selection of **already computed item differences and curated term definitions**, not restating the amount. Six fixed cases cover unfamiliar “A5 ruled” wording, quantity mismatch, unexpected item, missing item, financial injection/refusal override, and stale/unverified payability. Inputs are synthetic or explicitly labelled MOCK PayPal fixtures. Actual API free text or buyer expectations are not sent to Groq.

Deterministic code validates quantity × unit amount totals with BigInt, compares explicit expected/actual item IDs, and creates grounded issue IDs. The model may select those IDs or present glossary definitions; it cannot create facts, financial values, products, taxes, seller identities or approval actions. Strict output validation rejects unsupported IDs, extra fields and completion/approval claims. Refusal/freshness boundaries and financial facts are inserted independently of model selection. Unknown meanings require independent evidence, not guessed product definitions. An incorrect/omitted selection can still be unhelpful; all structured records remain available.

| Automatic comparison | Ordinary structured help/speech content | Groq-selected answer |
| --- | --- | --- |
| Required grounded target references present | 6/6 | 6/6 |
| Exact question focus, penalizing irrelevant selections | Full structured comparator intentionally includes all facts/definitions; no claim of question-specific precision | 3/6; three answers added irrelevant A5/ruled definitions |
| Added supported information | Full baseline | None beyond baseline |
| Financial authority | Deterministic only | None; model does not emit financial facts |
| Participant comprehension, task time, actual audio benefit | Not measured | Not measured |

Initial probe HTTP 400 was retained. Adding an explicit JSON instruction, as required by [Groq JSON mode documentation](https://console.groq.com/docs/structured-outputs), produced HTTP 200 in the next deliberate run (1,732 ms). The cause of the initial 400 is not independently proven because raw provider error bodies were not retained. No automatic retry loop was used. **AI usefulness remains UNPROVEN.** The app therefore retains ordinary speech/help rather than a live chat dependency. The purchase assistant is an offline synthetic evaluation prototype, not a verified explanation feature for real orders.

## Release readiness for November 12, 12 PM Pacific / 9 PM WAT

The date/time is the operator-provided target; no submission has been made. Readiness is **conditional, not submission-ready**:

| Deliverable | Repository evidence / remaining action |
| --- | --- |
| Public repository | No remote configured; no public repository verified. Operator must choose remote and authorize any push after secret review |
| Open-source license | No LICENSE file exists. Operator must choose license/copyright ownership before publication |
| README How to Test | Present; updated local synthetic and current-order instructions. Chrome/Node requirements and current-order blocker are explicit |
| Reproducible judge access | Synthetic workflow and isolated browser/provider-fixture tests are reproducible locally. Genuine order access, private credential provisioning and hosted judge access are unresolved |
| Short demo video | No demo artifact in this repository. Record a clearly labelled synthetic/mock demo; replace provider evidence claims only after genuine GET/approval verification |
| Deployment readiness | Localhost only. Internet-facing auth, account distribution, HTTPS, Secure cookies, secret handling, rate limits and hosting need review. Hosted RP enrollment must use a separate store/domain, preserving localhost credentials. Deployment requires separate explicit authorization |
| PayPal integration | Backend code plus genuine OAuth; GET/current merchant/order and human buyer approval still need verification |
| AI claim | Grounded comparison prototype; no measured incremental comprehension benefit. Do not market it as proven accessibility improvement |
| Accessibility | Chrome keyboard/reflow/axe checks; intended-user screen-reader, actual voice pronunciation and mobile browser testing remain manual gates |

Recommended bounded next action: confirm the intended sandbox merchant and legitimate buyer test route, then request approval for **one 1.00 USD sandbox create + authenticated GET + human approval observation, with no capture**. In parallel, choose the publication license and prepare an honest short local demo. If buyer approval remains blocked, demonstrate the observed boundary explicitly; do not claim a successful checkout.

## Changed files

- Backend: `src/paypal-sandbox.mjs`, `src/paypal-config.mjs`, `src/paypal-order.mjs`, `src/order-shape.mjs`, `src/paypal-requests.mjs`, `src/paypal-create.mjs`, `src/core.mjs`, `src/requests.mjs`, `src/passkeys.mjs`, `src/store.mjs`, `src/app.mjs`, `src/server.mjs`.
- Buyer/helper UI: `public/index.html`, `public/app.js`, `public/review.js`, `public/presentation.js`, `public/comprehension.js`.
- AI prototype: `src/purchase-assistant.mjs`, `scripts/purchase-cases.mjs`, `scripts/evaluate-purchase-assistant.mjs`.
- Readiness/config: `scripts/paypal-readiness.mjs`, `config/sandbox.example`.
- Tests: `test/paypal-client.test.mjs`, `test/paypal-flow.test.mjs`, `test/paypal-fixtures.mjs`, `test/purchase-assistant.test.mjs`, and an optional injected server configuration in `test/harness.mjs`. All prior tests retained.
- Evidence: refreshed `evidence/security-results.json`, new `evidence/paypal-readiness.json`, `evidence/purchase-assistant-initial.json`, `evidence/purchase-assistant-evaluation.json`, `evidence/paypal-integration-verification.json`.
- Docs: this report and `README.md`. Earlier milestone reports remain historical evidence.

Final verification results are recorded below and in the sanitized verification artifact.


## Final verification

- Baseline: 39/39 passed. Complete milestone suite: **55/55 passed**, zero failures/skips, including all prior tests. Provider HTTP/parsing fixtures, UI approval, consumption revalidation, concurrency, refusal race and grounded AI contracts are covered. No verifier was mocked; provider HTTP was mocked except the separately recorded OAuth probe.
- `npm run check`: passed. Existing advisory remains: `test/security.test.mjs` is 208 lines (target 200, below the 300-line limit).
- `npm audit --omit=dev`: zero vulnerabilities reported. This is dependency evidence, not an independent security audit.
- `git diff --check`: passed. New provider-flow axe scan: zero violations; mobile 320px reflow and keyboard/focus assertions passed.
- Actual speech audio, intended-user comprehension, screen readers, direct mobile browser review, current PayPal GET and genuine order-bound approval remain untested. No payment success is inferred from any mock result.
- A deterministic timestamp was added to the multi-unit unit-test fixture to avoid a millisecond-boundary flake; focused provider tests passed afterward. No production code changed after the passing complete suite.
