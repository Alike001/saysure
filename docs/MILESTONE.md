# Buyer review milestone — 9 November 2026

## Evidence and scope

Started from clean commit `51fcaf417b14e6518b4019f518f635cee33729bf`. Baseline suite: 28/28 passed in this session before changes. The user's report establishes a physical phone-assisted passkey exercise in their actual Chrome application: independent Helper and Buyer sessions, buyer enrollment, synthetic 1.00 USD Example Store request, buyer-a review, phone screen-lock PIN verification, approval, one consent consumption, final `consumed` status. This is **user-reported manual evidence**, not a newly automated test or an independent production audit. OS, phone model, browser version, independent physical ownership and screen-reader results were not reported. The phone acted as an authenticator; this does not prove the review page opened in the phone browser. No card PIN was involved.

Local `.local/` was not reprovisioned or migrated. No existing credentials, WebAuthn settings or RP display name were changed. New tests use temporary databases. PayTale was read only: `src/paypal.mjs`, prior Groq implementation/scripts, accessible-consent REPORT/AI-COMPARISON and surrounding feasibility reports. Its HEAD remains `674aba330e2abbba3c4d8b8a054a919352db0cbe` with its pre-existing untracked `docs/research/`. No PayPal request, payment operation, deployment or push was performed.

## Buyer experience

Responsive, readable semantic review shows exact amount/currency, merchant reference/name, description, buyer, revision, expiry and status. Every merchant/description is explicitly helper-supplied, synthetic and unverified; no PayPal verification badge is displayed. Integer minor units determine both visible amount and spoken amount. Speech includes provenance, status and expiry. Browser speech synthesis starts only on button activation and supports pause/resume/stop. Refresh, sign-out, approval initiation, page departure and local expiry stop ongoing audio. Ordinary question expanders use the same deterministic fields and preserve unknown fees, seller trust and payment completion.

Local expiry disables mutation controls and clears the confirmation checkbox; server expiry and unchanged snapshot checks remain authoritative. Another session can revise a request while this page is open: refresh is still needed to display remote changes, and the server denies old digests/assertions. The UI never automatically approves. Buyer/helper checks, CSRF, Host/Origin, UV, signature verification and serialized single-use transitions remain in place. The PayPal adapter is not connected to consent routes; no PayPal-backed consent is currently supported.

## Direct phone-browser feasibility

**Blocked pending a reviewed separate HTTPS environment.** Current server stays at 127.0.0.1:3100, origin http://localhost:3100 and RP ID localhost. Phone localhost points to the phone. A LAN HTTP address is not a valid substitute for a secure WebAuthn origin. Hybrid desktop-to-phone authentication remains the working path.

Two future options: isolated LAN HTTPS with stable DNS and a certificate trusted by both devices, or a separately provisioned authenticated HTTPS test deployment. Neither was configured. Public tunneling of this localhost app is unsuitable: it contains bootstrap-secret accounts and a local credential database, and lacks reviewed internet-facing protections. Do not tunnel it or expose debugging/test endpoints.

Before any operator-authorized phone environment: review access control/rate limits, secret provisioning, authenticated routes, exact Host/Origin and HTTPS RP configuration, Secure cookies, logging/redaction, network exposure and certificate trust. Use a new private store, fresh test identities and separate enrollment for the new domain; never copy localhost credential records or mutate the existing RP/store. `makeApp` now refuses a non-localhost configuration. A future HTTPS implementation needs a separately reviewed change. Test Android Chrome and iPhone Safari explicitly; no mobile OS/browser compatibility is claimed from desktop viewport checks. Existing signed wrong-origin/RP tests and new configuration-boundary tests fail closed.

## Read-only PayPal plan and next gate

Current [Orders v2 documentation](https://developer.paypal.com/api/rest/integration/orders-api/api-use-cases/advanced) supports server OAuth followed by **GET /v2/checkout/orders/{id}**. Use the authenticated server response, never a helper-entered amount/name/order JSON or return-URL flag, as provider evidence.

| Needed field | Evidence and limits |
| --- | --- |
| Order ID | Match returned `id` to the server-bound order ID; do not accept arbitrary URLs |
| Amount/currency | `purchase_units[].amount.value/currency_code`; exact decimal conversion, no floating arithmetic; initial adapter rejects multiple units and unsupported currencies |
| Payee | `payee.merchant_id` identifies the API payee; missing ID fails closed here. Email is optional and intentionally omitted from normalized output. Neither is proof of a buyer-recognizable/trusted shop name |
| Merchant label/description | Descriptions/brand labels may originate from a merchant or helper; keep provenance separate. Do not call them independently verified |
| Status | Preserve provider status. `APPROVED` is provider order approval evidence, distinct from SaySure consent and payment completion; payer identity should not be exposed merely to show status |
| Expiry | GET does not provide a universally usable expiry contract here. Maintain a conservative local request deadline plus short observation freshness and refetch. [PayPal's order guide](https://developer.paypal.com/whats-an-order/) describes creation-time windows; do not infer one from an old status. 404 is unavailable, with cause unknown |
| Invalidation | Any ID/payee/amount/currency/status mismatch, stale read, missing fields, auth/network failure, closed order or expired local deadline blocks continuation. Provider re-read required after user authentication as well as before review |

`src/paypal-evidence.mjs` is a mock-tested, disconnected read-only adapter. Its required injected transport receives only GET order paths; it contains no fetch, credentials, OAuth or write operation. Normalization strips unrelated payer/shipping data, refuses missing payee evidence, and sets `merchant_name_verified:false`. `assertCurrentOrder` checks the bound ID, amount, currency, payee, freshness and reviewable status. The 60-second maximum observation age is a local prototype policy, not a PayPal guarantee or actual expiry. Mock normalization does not establish authentic provider provenance by itself; a future server-only authenticated transport and storage boundary must provide that.

Future binding must include provider environment, order/payee/amount/currency, local validity deadline and evidence generation/version in a distinct canonical snapshot; the current `synthetic-consent-v1` cannot silently be reused. Refetch before challenge issuance and after the passkey assertion, invalidate on any mismatch, then atomically check the persisted current evidence version/digest before accepting consent. Network reads cannot occur inside SQLite transactions. A short freshness policy still leaves a provider change race: consent is an observation-bound local record, not a lock on a PayPal order or payment authorization. No provider action should follow solely from cached evidence or a browser success flag. Webhooks, if later introduced, need signature verification and idempotency, with GET as corroboration.

The historical order is **unavailable (last reported GET 404)**, not active; it was not queried again. Eventual fresh sandbox verification requires a separately authorized **POST https://api-m.sandbox.paypal.com/v2/checkout/orders**, intent CAPTURE, synthetic 1.00 USD, one purchase unit and known sandbox payee, followed by GET, human sandbox approval if permitted, and another GET to inspect APPROVED. The existing sandbox approval restriction must be resolved legitimately first. This milestone stops before order creation or buyer checkout. Captures, authorization calls, refunds and real money remain excluded. A complete payment end-to-end test would require further explicit authorization for capture; approval-only verification cannot be reported as completed payment integration.

## AI comparison

Fresh execution is in `evidence/comprehension-evaluation.json`: one Groq request, HTTP 200, model openai/gpt-oss-120b, six fixed synthetic questions only; no local transactions, personal data, merchant identity, passkeys or credentials sent in the prompt. The already-configured key was read privately from PayTale's .env without changing that repository. No raw provider errors or keys were logged. The script is an explicit evaluation command, not part of app startup or automated tests.

Six of six topic selections matched researcher-written expectations. The amount, unverified shop, passkey/payment distinction, expired request, unknown costs and adversarial invention request all produced locally written answers. Only a closed topic vocabulary is accepted; arbitrary prose, numerical claims, completion, approval instructions and extra properties are rejected. Wrong topic selection can still answer the wrong question. This reduces model authority, not all usability risk.

Compared with the ordinary spoken summary and question expanders, no additional factual content or measured comprehension benefit was demonstrated. The UI therefore uses ordinary speech/help; there is no live AI chat or automatic model call. The next AI gate is intended-user comparison of independent decisions, misunderstanding correction, latency and wrong-topic refusals. Earlier PayTale prose falsely presented historical data as payable; this implementation does not reuse that prose. The six-question routing result is not six independently audited AI explanations or an accessibility study.

## Validation and limitations

See final run counts in README and this milestone's verification record. Original protocol tests are retained. New unit/browser coverage checks exact speech strings and state qualifiers, pause/resume/stop, no automatic approval, keyboard activation and focus, 320px reflow, minimum control height, axe, speech unavailability, live expiry, unavailable/incorrect PayPal evidence, changed binding, rejected AI claims and localhost migration boundaries. Speech API stubs prove text/control behavior, not actual audible output. No physical phone browser, VoiceOver, TalkBack, screen-reader comprehension or human usability testing was performed by the agent. Only English summaries are provided; voice quality, currency pronunciation and pause behavior depend on browser/OS. Device voices can use remote services; synthetic data only, and consider audio privacy. No accessibility certification is claimed.

No deployment, account recovery, production identity verification, real PayPal integration or payment completion was delivered. Recommended submission path: observe a buyer using their screen reader and keyboard through review, read/pause/stop, decline, changed-details refusal and explicit passkey consent; record limitations and an honest synthetic demo, then seek authorization for the narrowly scoped fresh sandbox order gate.


## Final verification and file inventory

Final `npm test`: **39 tests passed, 0 failed, 0 skipped** (original 28 plus 11 additional counted tests, including the new browser parent). `npm run check`: passed, with the existing 208-line security-test advisory. `npm audit --omit=dev`: zero vulnerabilities. `git diff --check`: passed. New buyer review axe scan: zero violations for the selected WCAG A/AA tags; original buyer/helper scans also passed. Inspected a synthetic 390px-wide Chrome screenshot outside the repository; no credentials or production data were captured. A first new speech-unavailable test asserted before asynchronous refresh completed; waiting for the rendered unavailable message fixed that test synchronization failure. The final complete suite passed afterward.

| File | Change |
| --- | --- |
| `README.md` | Current scope, user-reported evidence and exact operator test steps |
| `PASSKEY-EXPERIMENT.md` | Current physical-result provenance with historical results retained |
| `docs/MILESTONE.md` | Evidence, phone blocker, provider plan/gate, AI comparison, limitations and verification |
| `public/app.js` | Stop speech on account reload/logout |
| `public/review.js` | Buyer audio/help, explicit decline, local expiry feedback and existing passkey review |
| `public/style.css` | Readable responsive layout, focus and large controls |
| `public/presentation.js` | Exact deterministic speech, pause/resume/stop and unavailable fallback |
| `public/comprehension.js` | Shared deterministic answers and strict AI topic contract |
| `src/app.mjs` | Explicit static allowlist additions and local-origin configuration guard |
| `src/origin.mjs` | Reject repurposing this experiment for a different origin/RP |
| `src/paypal-evidence.mjs` | Disconnected mocked read-only normalization and current-order binding checks |
| `scripts/evaluate-comprehension.mjs` | Explicit fixed-synthetic Groq evaluation, no payment operations |
| `test/evidence.test.mjs` | Provider, speech, AI and origin boundary tests |
| `test/review.test.mjs` | Chrome audio-control, keyboard, reflow, axe, stale review and role tests |
| `evidence/comprehension-evaluation.json` | Sanitized actual Groq routing comparison |
| `evidence/security-results.json` | Latest execution of retained virtual-authenticator security scenarios |
| `evidence/milestone-verification.json` | Final command results and manual-evidence distinction |
