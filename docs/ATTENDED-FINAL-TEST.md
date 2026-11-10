# SaySure — historical attended sandbox test archive

**HISTORICAL — DO NOT EXECUTE THESE INSTRUCTIONS.** This reservation has execution/result records. Its old authorization is consumed and must not be reused. Preserve the old authorization files, request/idempotency identifiers, read-budget files and execution marker unchanged. Do not delete, reset, edit, replay or repurpose a marker/grant, and do not rerun preflight or execution as a release-preparation step. Historical PayPal-order consumption remains unconfirmed; later code fixes do not repair that outcome.

Final independent security approval covers commit **22c116be7f0a88843a50d6ff3f5cf6464c152177** (`22c116b`), with **186/186 tests passed** and no outstanding security findings. This approves the local prototype, not payment completion, comprehension, deployment or publication.

The subsequent release-readiness audit verified a temporary fresh local clone on the existing Linux host: Node 24.14.1, npm 11.13.0, installed Google Chrome/system libraries and the host npm cache. Dependency installation, 186 tests, syntax checks, default synthetic app startup, Helper/Buyer screens and the isolated demo passed without private configuration. Production-only and full dependency audits reported zero known vulnerabilities at that check. This is not cross-platform or blank-machine verification.

Any future provider experiment needs a new separately reviewed scope and explicit authorization. None is authorized here. MIT licensing and original-code ownership are owner-confirmed; the root [LICENSE](../LICENSE) is prepared with `Copyright (c) 2026 Hammed Ali Oyeleye`. Current next actions are documentation and an honest demo recording; public publication remains separately gated. See [release preparation](FINAL-SUBMISSION.md).

## Original preparation record — superseded

Statements below such as “no approval file, execution marker or new order exists” describe the earlier preparation checkpoint only. Commands and approval wording are retained for historical traceability, not as valid instructions or reusable authorization.

**Preparation only. No new external request is authorized or executed.** The prior order failed the unchanged three-hour local policy and must not be read/imported/reused. Its create marker and prior read plan are preserved. This is one new independently reviewed reservation, not an automatic retry or replacement after a failure in this attempt.

## Fresh gate and precise operation

The new private reservation is `.local/paypal-attended-final/attempt.json`; its immutable parent scope is `attended-plan.json`. Offline preparation compared the complete configured client-ID SHA-256 with the previous authenticated app binding, matching safe prefix **2faa5ef4c17b**. Sandbox host and merchant `7TSZELT2DA9JJ` are fixed. App/account association remains operator-confirmed Dashboard evidence; receiving eligibility and PayPal payer ownership are unproved. Credentials stay in PayTale's existing private file, read only. Source/environment changes cannot grant approval.

A new UUID is persistently reserved; preflight reuses it. No approval file, execution marker or new order exists for this reservation. The exact resolved UUID and scope digest are displayed privately by:

```sh
node scripts/paypal-attended.mjs preflight --config ../capturedesk-feasibility/.env
```

Proposed ceiling, only after separate explicit approval:

1. **One** sandbox `POST /v1/oauth2/token`, client credentials, form body `grant_type=client_credentials`. Keep the token in memory throughout the same attended process. No refresh or second OAuth is authorized.
2. **One** `POST https://api-m.sandbox.paypal.com/v2/checkout/orders`, the new reserved `PayPal-Request-Id`, `Prefer: return=representation`, JSON content type and Bearer token, with exactly:

```json
{
  "intent": "CAPTURE",
  "purchase_units": [{
    "reference_id": "saysure-test",
    "payee": { "merchant_id": "7TSZELT2DA9JJ" },
    "description": "SaySure synthetic notebook test; no real goods",
    "amount": { "currency_code": "USD", "value": "1.00" }
  }]
}
```

3. At most **five authenticated GETs**, all `https://api-m.sandbox.paypal.com/v2/checkout/orders/{the exact new returned ID}`: immediate verification after create; helper import; before challenge issuance; after verified signature; before one-time local consumption. GETs use `Accept: application/json` and the same memory-only Bearer token. No provider link is followed. Each consent GET requires its existing local user action/security transition; there is no polling.

The previous read-only scope needed four GETs; this grant includes the extra immediate create verification GET. A new result must match ID, expected merchant, one unit, exact `1.00` string/USD, CAPTURE intent and CREATED status. Missing/mismatched/unavailable/stale evidence stops the run. No retry or fresh key is permitted after any uncertain/failed POST. No capture, payment authorization, refund, settlement, PayPal buyer checkout/approval automation, Live API, real money, account change, public deployment or push is included.

**Exact proposed operator decision:**

> I authorize one attended SaySure sandbox attempt: one OAuth, one new 1.00 USD CAPTURE order, at most five GETs, real buyer passkey consent and one local consumption; no payment execution, retries or replacement order. Use the new reserved attempt, merchant 7TSZELT2DA9JJ and existing buyer-a passkey. Stop at the 15-minute operational cutoff or any failed/unverifiable operation.

Only after receiving that decision, save an owner-controlled mode-0600 `.local/paypal-attended-final/operator-approval.json` with:

```json
{
  "statement": "I authorize one attended SaySure sandbox attempt: one OAuth, one new 1.00 USD CAPTURE order, at most five GETs, real buyer passkey consent and one local consumption; no payment execution, retries or replacement order.",
  "plan_digest": "<digest of the newly reviewed attended-plan.json>"
}
```

**That file is absent.** Old approval files/digests cannot satisfy this gate. After approval, execute once in a private attended terminal:

```sh
node scripts/paypal-attended.mjs run --config ../capturedesk-feasibility/.env --attended
```

The command checks the existing enrolled buyer credential and availability of localhost port 3100 before any external request. A private interactive terminal is required. It validates the new plan/app binding and exact approval, writes a permanent start marker, then uses the original durable creator. The create marker cannot be reset/reused. Successful creation/read derives a child read gate from this **new parent authorization**, spends its OAuth slot against the already-obtained token, and launches the same localhost app/database. Startup cannot create a second order. A process restart cannot resume the grant or recover the memory-only token; stop and reconcile instead.

## Timing and attendance

The operational cutoff is **15 minutes from this attempt's start**, including OAuth/create latency. The final child read gate and consent request expiry enforce it server-side. The existing provider-creation **three-hour** window, ten-minute review lifetime, two-minute native challenge, 60-second evidence freshness, origin/RP, signature, role, nonce/revision/digest and one-time atomic-consumption checks remain enforced. The earliest applicable deadline wins; none is extended. The local operational cutoff is deliberately much earlier than the three-hour policy and is not a provider expiry claim.

Prepare both people/profiles and the phone **before execution**. Aim to import/review/approve/consume in a few minutes. Once import supplies fresh evidence, start the native ceremony within its 60-second freshness window; do not leave the request sitting while setting up devices. The real Buyer must operate their own enrolled phone and explicitly approve reviewed details. TTY/flags and database events cannot prove a human used a particular phone; record that as a separate operator observation, never infer it from a test fixture.

## Helper and Buyer procedure

1. Keep the existing checkout and `.local/` intact; never rerun setup/enrollment. Prepare separate Helper and Buyer browser profiles, phone/Bluetooth/provider readiness and private account access. If needed, use the ordinary `npm start` with reads disabled to sign in ahead of time, then stop it with Ctrl+C. Sessions survive a brief server restart until their normal expiry. Do not expose bootstrap secrets or authenticator QR/details in a recording.
2. Review the offline preflight and fresh scope, obtain the explicit new authorization and create its private approval file. Run the attended command once. Port 3100 must be free; do not kill unrelated processes. The command prints only the **new** ID/status/1.00 USD/cutoff. If anything fails, stop; do not rerun, reset keys or create a replacement.
3. Reload **http://localhost:3100** exactly in both profiles. Origin stays `http://localhost:3100`, RP ID `localhost`. This is desktop review with a phone-backed native ceremony; it does not make the page reachable directly on the phone.
4. Helper: **Review a PayPal sandbox order**, choose buyer-a, enter only the new ID and select **Read and prepare PayPal order review**. No helper-supplied amount, currency, payee or response is accepted. Old order IDs and other buyers are rejected. Duplicate import and helper re-read are blocked before spending additional reads.
5. Buyer: **Refresh requests**; independently inspect new order ID, exact `1.00 USD`, merchant reference, CREATED, evidence timestamp, buyer, revision/expiry and the unverified shop-identity label. A fresh real GET alone enables **PayPal order verified**. Optional speech/help reads the same exact server snapshot; it does not approve anything.
6. Buyer checks the exact-details statement and selects **Approve local consent for this PayPal order with my passkey**. The server GETs before the challenge, the existing human Buyer completes the native phone-backed ceremony, then the server GETs again before recording **Buyer consent approved**. Failure, mismatch or expired evidence records no consent. No virtual authenticator or scripted buyer approval is used for this live test.
7. Buyer immediately selects **Consume consent once (local test only)**. A final GET precedes atomic one-time consumption. Expect **Consent consumed**. A repeat consume/assertion fails locally and spends no further GET. Do not conduct extra live tampering probes; those failures are tested offline. Decline/withdraw remain valid local alternatives with no payment action.
8. Keep provider and consent states distinct: **PayPal buyer approval not established** and **Payment not captured** for the fresh CREATED observation. A local consent event never changes PayPal to APPROVED/paid. Once a label's evidence is stale, it must say stale/unavailable.
9. Stop the server normally after the run. Save sanitized local outcome evidence without another provider read:

```sh
node scripts/paypal-attended.mjs report
```

The report uses SQLite read-only and writes a private timestamped report: bound order tuple, genuine/mock provenance, canonical-digest consistency, local status, consumption time and relevant local event timestamps. It does not inspect/export passkey public keys, credential IDs, assertions, tokens, names/addresses or raw provider JSON. Add a separate private operator observation of browser/OS, actual phone-backed ceremony outcome and who operated the device. Record a failure as a failure; never replace it with a fixture.

## Proof required after the attended run

Report actual OAuth/create/GET HTTP statuses and safe debug IDs from private files; new order ID/provider state, exact amount/currency/payee comparison; real signature-verification/local approval event; revalidation timestamps; single local consumption; and no payment-execution request. Database state alone cannot prove the actual hardware used or comprehension. Retain the previous expired order as history, with no refreshed timestamps or new claims about its PayPal expiry.

For preparation, automated tests use isolated databases, **mock PayPal responses and virtual authenticators with the real verifier**. Existing real-create evidence and user-reported physical synthetic-passkey success remain distinct. No genuine new order or physical real-order consent is claimed before execution. Public submission preparation and the honest recording script are in [FINAL-SUBMISSION.md](FINAL-SUBMISSION.md).

## Preparation verification

Baseline: 95/95 tests passed. Full regression after integration: 100/100 passed; after the final old-ID wire safeguard, the focused creator/attended run passed 26/26, covering all six new attended tests. All original tests remain covered. Syntax/source-size and whitespace checks passed; the existing security-test length advisory remains. The new mocked journey proves operation ceilings, shared memory-only OAuth, exact new order binding, real verifier behavior, replay rejection and single consumption. Cutoff/uncertain-outcome/old-ID tests stop without an extra wire request. Existing suites retain changed amount/currency/merchant/status, stale/provider-failure, wrong buyer/helper and restart coverage.

Local preservation checks matched the prior passkey/account/PayTale file hashes; old markers are intact, the fresh request ID differs, new files are mode 0600, and both old read and new attended approval files remain absent. Automated test output is not a real phone ceremony or a new PayPal API observation. No external request, push, deployment, license installation or payment operation occurred during preparation.
