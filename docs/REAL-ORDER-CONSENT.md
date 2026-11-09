# SaySure — real order-bound passkey consent gate

**Superseded for execution:** The referenced order exceeded the unchanged three-hour local window. It is NO-GO; this read plan must not be executed. The [fresh attended preparation](ATTENDED-FINAL-TEST.md) uses a new independent reservation and grant. This document remains the historical reviewed read-only scope.

**Current decision: local implementation ready for review; external reads NOT AUTHORIZED.** No new PayPal request, including OAuth, was made in this milestone. The previous one-create/one-read grant is consumed. Its permanent execution marker is intact. Previous authenticated create/read evidence is historical only; it cannot establish current order availability or authorize local consent.

## Exact proposed external operations

Use only the single order and app fingerprint in ignored `.local/paypal-consent-read/plan.json`, derived from the genuine one-order result and checked against its original reservation/marker. The preflight displays the resolved order/merchant/amount privately. Never commit the plan or transaction evidence. Fixed expectations: merchant `7TSZELT2DA9JJ`, CAPTURE intent, one unit, string amount `1.00`, USD, observed status CREATED, application buyer `buyer-a`.

The existing implementation needs **four GETs**, rather than the proposed three, to preserve every existing security boundary:

| Ceiling | Operation | Trigger and purpose |
| --- | --- | --- |
| One | `POST https://api-m.sandbox.paypal.com/v1/oauth2/token` | First order read; backend client credentials, `grant_type=client_credentials`; token held only in memory |
| GET 1 | `GET https://api-m.sandbox.paypal.com/v2/checkout/orders/{the known order ID}` | Helper import; fresh initial evidence and exact financial comparison |
| GET 2 | Same exact authenticated GET | Buyer explicitly requests approval options; validate before binding the WebAuthn challenge |
| GET 3 | Same exact authenticated GET | After successful WebAuthn signature verification, before recording local consent |
| GET 4 | Same exact authenticated GET | Buyer explicitly consumes consent once locally |

GET headers: `Authorization: Bearer <memory-only token>`, `Accept: application/json`. OAuth uses Basic credentials and form content type. The existing adapter fixes the sandbox host, refuses redirects, bounds response sizes and applies a 15-second timeout. No raw headers, tokens, bodies, payer data or URLs with query strings are logged. The create command is never used. No capture, authorize, refund, payment, hosted buyer checkout, new order, account change, deployment or push is permitted.

**This is a ceiling for one uninterrupted successful journey, not four automatic reads.** Each read requires its local user action/security transition. Browser refresh/listing does not call PayPal. A helper re-read is disabled for this experiment. Duplicate imports, terminal requests, wrong buyer/helper and obvious invalid local state fail before spending a GET. Concurrent valid requests can consume the finite budget; do not run multiple tabs or ceremonies. Any failed/unknown provider request, stale/unverifiable order, changed financial tuple or unsupported state permanently stops this experiment. No retry, replacement order, expired-window extension, token refresh or reset is authorized.

## Separate operator approval

Safe offline preflight:

```sh
node scripts/paypal-consent.mjs preflight
```

Preflight creates/reuses only the private plan; it does not provision credentials or an approval file, start the server or contact PayPal. The approval file is currently **absent**. The proposed explicit operator decision is:

> I authorize one sandbox OAuth and at most four GETs for the reviewed SaySure order-bound consent plan; no payment execution or new order. Use only the existing order, merchant and buyer in the reserved read plan. Preserve the before-challenge, after-signature and before-consumption revalidations. Stop on failure; no retries or replacement order.

Only after that separate authorization, save a mode-0600 owner-controlled `.local/paypal-consent-read/operator-approval.json`:

```json
{
  "statement": "I authorize one sandbox OAuth and at most four GETs for the reviewed SaySure order-bound consent plan; no payment execution or new order.",
  "plan_digest": "<the digest of the reviewed private plan>"
}
```

Then the private operator command is:

```sh
node scripts/paypal-consent.mjs serve --config ../capturedesk-feasibility/.env
```

This reads the existing credentials without modifying PayTale or copying its other configuration into source. Configuration cannot be overridden by process environment. The same full client-ID fingerprint is required. The server refuses to start without the matching private approval. Startup itself does not authenticate; the first permitted order read does. Do not use the unbounded readiness probe or change general app configuration to bypass this gate.

Requests reserve exclusive, fsynced private operation slots **before** sending. Actual HTTP status, safe debug ID and genuine-versus-mock provenance are recorded in those files; normalized successful observations are saved separately. A partial write, crash or unknown outcome spends the reserved slot. Error metadata is never replaced with fixtures. The budget survives restart. Tokens do not: restarting after OAuth cannot acquire another token under this grant and therefore stops safely. Keep the server running throughout the ceremony; no resume/retry is preauthorized. Never delete the plan, spent slots or stop marker to reset the grant.

## Binding and security

The canonical `paypal-consent-v1` tuple binds the server-held request ID, app buyer, merchant ID, exact amount/currency, non-provider presentation text, complete normalized provider tuple, nonce, expiry and revision. Provider tuple includes sandbox environment, returned order ID, intent, observed status, payee, per-unit original decimal values/minor units/currency, total, provider creation time and conservative local validity end. The server stores the canonical digest with the random challenge, session and buyer; WebAuthn verifies the stored challenge, existing credential public key/counter, exact origin/RP, user presence and required user verification. Challenge replay is rejected; the signature does not authorize a PayPal payment. The generic authenticator prompt does not independently display transaction details.

The [SimpleWebAuthn server documentation](https://simplewebauthn.dev/docs/packages/server), checked through Context7, supports the retained stored-challenge/credential/counter verification contract. All existing synthetic canonical bytes, localhost origin `http://localhost:3100`, RP ID `localhost`, passkeys and security checks remain intact. No enrollment, credential replacement, reset or schema migration is performed. The guarded launcher uses the same application/database as the ordinary server; do not run two servers on port 3100.

A fresh GET must match the exact reviewed order/merchant/1.00 USD/one unit/CAPTURE/CREATED. Historical values are expectations, not a provider cache. Missing IDs/payees/times/amounts, 404, mismatches and unsupported responses fail closed. The existing conservative **three-hour window from provider creation**, 60-second observation freshness, ten-minute review and two-minute challenge remain enforced. They are application limits, not PayPal expiry guarantees. Do not extend them if the existing order is unavailable or too old. A legitimate later change to APPROVED also stops this fixed CREATED-snapshot experiment; it is not silently accepted. Provider evidence may still change after GET; SaySure does not lock the remote order.

## Demonstration after approval only

1. Run preflight and verify the resolved known order, expected merchant, buyer and read ceilings. Obtain the separate approval above. Start the guarded command once. Existing enrolled accounts/passkeys are preserved; **do not rerun setup**.
2. Sign in as the existing Helper and Buyer in separate browser profiles at the unchanged localhost origin. Retrieve account secrets only through the existing private account command. Do not record secrets, credential IDs, assertions or native pairing QR screens.
3. Helper: enter only the known order ID and choose `buyer-a`; select **Read and prepare PayPal order review**. This spends GET 1. A 404/expired/mismatched order ends the demonstration. Do not create or import a replacement.
4. Buyer: refresh the local request list and inspect exact order ID, merchant reference, unit amount, USD, CREATED, evidence timestamp, app buyer, revision and expiry. Only a fresh authenticated read may show **PayPal order verified**. Merchant display/shop identity remains unverified; helper free text is never promoted to provider fact. Optional speech uses the same exact snapshot.
5. Within the freshness window, review/check the exact-details statement and explicitly select **Approve local consent for this PayPal order with my passkey**. GET 2 precedes the native ceremony. The legitimate existing Buyer must complete the physical passkey ceremony themselves; no virtual authenticator or automation is used for the real demonstration. GET 3 follows signature verification. Only successful server verification/revalidation may show **Buyer consent approved**.
6. Immediately select **Consume consent once (local test only)**. GET 4 precedes atomic one-time consumption. Expect **Consent consumed**. Another consume fails locally without a fifth GET. Refreshing local lists is safe; helper re-read and additional native approval attempts are outside this budget. Decline/withdraw remain local options and require no PayPal request.
7. Retain the distinct provider label **PayPal buyer approval not established** and **Payment not captured** for the current CREATED observation. If evidence ages, display stale/unavailable rather than current verification. Local consent can be approved/consumed while PayPal remains CREATED; no payment action follows.

No real physical ceremony or current provider read has been executed in this milestone. The new browser journey uses explicitly **mocked PayPal responses and a virtual authenticator with the real WebAuthn verifier** in temporary accounts/databases. It proves implementation behavior only; it is never offered as authentication by the existing human buyer.

## Verification and remaining gates

The original baseline passed 79/79 tests. Final full suite: **95/95 passed**, zero failures/skips. Syntax/source-size and whitespace checks passed (the existing security-test line-count advisory remains). Added tests cover the bounded four-read browser journey, missing/wrong approval, wrong order/app/buyer/helper, durable ceilings and restart refusal, exact financial/status/staleness failures, provider HTTP/network failure, duplicate import, replayed assertion, duplicate consumption and no unauthorized provider methods. Existing suite retains tampering, revisions, CSRF, signatures, roles, origin/RP, races, accessibility and synthetic regression coverage.

Real readiness: implementation is prepared; **genuine order-bound consent is not yet proved**. Fresh order availability, separate read authorization, valid existing passkey and the human ceremony remain gates. If the order has exceeded the retained local validity window by authorization time, stop; do not loosen policy or create a replacement.

AI scope is unchanged: fixed-example routing results do not establish human comprehension benefit; no model receives this real order. UI gates remain physical speech, TalkBack/VoiceOver, intended-user review and direct mobile compatibility. Submission gates remain operator license choice, safe recording/final demo artifact, fresh-clone checks and separately authorized public repository/hosting/submission. No scope is added to address those gates here.
