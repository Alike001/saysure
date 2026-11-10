# SaySure local API

Contract inspected against security-approved commit `22c116be7f0a88843a50d6ff3f5cf6464c152177` (186 security/regression tests). This is the localhost application at **http://localhost:3100**, not the isolated fixture viewer at port 3200. No endpoint executes a payment. No provider operation or passkey enrollment is authorized by this reference. Examples are synthetic documentation data, never historical records or usable credentials.

## Sessions, roles and transport

- `Host` must match the configured origin; mutation `Origin` must equal `http://localhost:3100`. Cross-site Fetch Metadata is refused. The server is loopback-only, with RP ID `localhost`.
- POST/PATCH bodies must be JSON objects, at most 24,000 bytes, with **exact** `Content-Type: application/json`. Unknown fields are refused. Use canonical ASCII paths; encoded path characters, dot segments and repeated/trailing slashes are rejected. Valid query strings are inert and cannot select an action or identity.
- Login issues an opaque `consent_session` cookie: HttpOnly, SameSite=Strict, Path=/, 30-minute lifetime. The current plain-HTTP localhost cookie has no Secure attribute. Session tokens are stored hashed. Login rotates the current browser session; logout deletes it and invalidates its challenges.
- Except login, mutations require a live session and `X-CSRF-Token` equal to the `csrf` returned by `GET /api/session`. Retrieve it in the same browser session; never log or publish it.
- The **Helper** prepares/revises its own requests and selects an existing app buyer. The **Buyer** can see only its own inbox and enroll/approve/reject/withdraw/consume for that account. Roles are server-assigned. App buyer identity is not proof of PayPal payer identity. Neither the helper nor another buyer may approve for the selected buyer.

## Endpoint inventory

`:id` is a server-generated `SYNTH-<UUID>` or `PAYPAL-<UUID>` request ID. Successful responses are JSON with `Cache-Control: no-store`.

| Method and path | Session/role | Input | Success |
| --- | --- | --- | --- |
| GET `/api/session` | Optional | None | 200: anonymous `{user:null,origin,rpID}`; signed-in `{user:{id,role},csrf,enrolled,origin,rpID}` |
| POST `/api/login` | None | `{username,password}` | 200 `{logged_in:true}` and session cookie |
| POST `/api/logout` | Either | `{}` | 200 `{logged_out:true}` and expired cookie |
| GET `/api/buyers` | Helper | None | 200 array of `{id}` buyer accounts |
| GET `/api/requests` | Either | None | 200 array of request views, newest first, at most 100, filtered by owner |
| POST `/api/requests` | Helper | Synthetic fields below | 201 request view |
| PATCH `/api/requests/:id` | Owning Helper | Complete synthetic fields plus current `revision` | 200 revised view; buyer is immutable, prior consent/challenges invalidated |
| POST `/api/paypal/requests` | Helper | `{order_id,buyer_id}` | 201 PayPal request view after configured server read |
| POST `/api/requests/:id/refresh-provider` | Owning Helper | `{digest}` | 200 revised PayPal view; requires policy permission, invalidates prior consent |
| POST `/api/register/options` | Buyer | `{}` | 200 `{options,challengeId}` for registration |
| POST `/api/register/verify` | Same Buyer/session | `{challengeId,response}` | 200 `{registered:true,user_verified:true}` |
| POST `/api/requests/:id/options` | Owning Buyer | `{digest}` | 200 `{options,challengeId,digest}` for authentication |
| POST `/api/requests/:id/approve` | Same Buyer/session | `{challengeId,response}` | 200 approved request view |
| POST `/api/requests/:id/reject` | Owning Buyer | `{digest}` | 200 rejected view; pending/invalidated only, no passkey required |
| POST `/api/requests/:id/withdraw` | Owning Buyer | `{digest}` | 200 withdrawn view; approved only |
| POST `/api/requests/:id/consume` | Owning Buyer | `{digest}` | 200 consumed view plus committed receipt below |

There is no individual GET-by-request-ID API, receipt-recovery endpoint, diagnostic query API, account recovery/replacement API, or payment/capture/refund endpoint. Read a request from the filtered list. The register endpoints support fresh independent enrollment; they do not replace an existing buyer credential.

## Synthetic creation and review

Representative `POST /api/requests` body (Helper session, same-origin and CSRF headers required):

```json
{
  "buyer_id": "buyer-a",
  "merchant_id": "SYNTH-SHOP-1",
  "merchant_name": "Synthetic shop",
  "amount": "1.00",
  "currency": "USD",
  "description": "Synthetic notebook; no goods or payment",
  "lifetime_minutes": 10
}
```

Amount is a decimal **string**, converted to exact integer minor units. Supported currencies: USD/EUR/NGN (two decimal places), JPY (zero). Amount strings allow at most nine whole-number digits, with a further cap of 100,000,000,000 minor units. Lifetime is an integer 1–30 minutes, default 10. Creation assigns ID, nonce, revision 1 and expiry; do not send `revision` on creation. Revision requires the same buyer ID and current revision along with the complete editable fields.

A representative pending synthetic request view is:

```json
{
  "snapshot": {
    "request_id": "SYNTH-00000000-0000-4000-8000-000000000001",
    "merchant_id": "SYNTH-SHOP-1",
    "merchant_name": "Synthetic shop",
    "amount_minor": "100",
    "currency": "USD",
    "description": "Synthetic notebook; no goods or payment",
    "buyer_id": "buyer-a",
    "nonce": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "expires_at": 1893456600000,
    "revision": 1
  },
  "digest": "8ebbdaba21ea0f4f92d858cc7291dc61880caaa9cd68e2777632aa506f28c00b",
  "status": "pending",
  "consent_digest": null,
  "consumed_at": null,
  "display_amount": "1.00 USD",
  "synthetic": true
}
```

The ID, nonce and times above are illustrative synthetic values. Actual creation generates them. All subsequent `{digest}` bodies use the digest returned for the exact reviewed snapshot. Listing/review does not call PayPal. Other ordinary list/read paths may persist local expiry transitions.

The Buyer reviews the list item and explicitly chooses approval. `options` is the actual WebAuthn options object generated by the server library. `response` is the browser-produced registration/authentication response, not a caller-authored proof. Challenges last at most two minutes and are tied to buyer/session; approval challenges additionally bind request ID and digest, bounded by request expiry. Taking a challenge makes it single-use even if verification fails. Origin, RP, credential ownership, user verification, signature and current request state are checked; the server revalidates PayPal evidence before issuing approval options and after signature verification. Authentication proves credential control, not comprehension or an independently displayed transaction.

## Canonical binding and PayPal evidence

`synthetic-consent-v1` binds request ID, merchant ID/name, amount/currency, description, buyer ID, nonce, expiry and revision in a fixed ordered tuple. New PayPal snapshots use `kind:"paypal"`, `evidence_provenance` and `provider`; `paypal-consent-v2` also binds source provenance and normalized sandbox/order/intent/status/payee/totals/unit values/creation-window facts. The shared serializer is [consent-shape.js](../public/consent-shape.js). SHA-256 is an integrity digest, **not an independent digital signature**. The random WebAuthn challenge is associated with that digest in server state; the authenticator signs WebAuthn data, not the purchase wording directly.

PayPal views add `paypal_evidence` with `observed_at`, boolean `current`, `provenance` and `merchant_identity_verified:false`. Sources are `authenticated-sandbox-api` for actual fixed-endpoint adapter observations or `mock-paypal-fixture` for injected fixtures. Constructing an adapter alone establishes no order evidence. Missing/unknown/contradictory provenance cannot authorize new consent or consumption. Legacy `paypal-consent-v1` snapshots retain their byte domain for reading, but cannot gain new provenance-bound consent/receipts. The normalized `provider` contains `environment`, `order_id`, `intent`, `status`, `payee_id`, `amount_minor`, `currency`, `units`, `created_at` and `provider_window_end`; each unit contains `index`, `amount_value`, `amount_minor` and `currency`. Times are Unix milliseconds. Provider free text, payer/shipping data and credentials are omitted from the view.

## Consumption and acknowledgement

`POST /api/requests/:id/consume` takes `{digest}` for approved, unconsumed consent. It checks the live buyer session, ownership, intact snapshot/digest and expiry, claims the request before provider I/O, revalidates PayPal when applicable, and checks state again. State, `consumed_at`, challenge invalidation and the mandatory consume event commit in one SQLite transaction. Event/database failure rolls them back; no success receipt is issued.

The consumed response retains the full request view above, sets `status:"consumed"`, `consent_digest` to its digest and `consumed_at` to the acceptance timestamp. It adds this representative field (using the same illustrative request/digest):

```json
{
  "consumption_receipt": {
    "version": 1,
    "request_id": "SYNTH-00000000-0000-4000-8000-000000000001",
    "buyer_id": "buyer-a",
    "status": "consumed",
    "consent_digest": "8ebbdaba21ea0f4f92d858cc7291dc61880caaa9cd68e2777632aa506f28c00b",
    "consumed_at": 1893456300000,
    "event": {
      "id": 42,
      "type": "consume",
      "request_id": "SYNTH-00000000-0000-4000-8000-000000000001",
      "at": 1893456300000
    },
    "committed": true,
    "correlation_id": "00000000-0000-4000-8000-000000000002"
  }
}
```

`committed:true` is attached only after COMMIT. `event.id` is the actual saved consume-event sequence; `event.at` equals `consumed_at`. The frontend recomputes the reviewed digest and compares the complete returned snapshot, state, event and source before announcing success. HTTP 200 without a matching receipt is unconfirmed. A valid receipt remains confirmed if a later list refresh fails. This is a trusted same-origin acknowledgement, not independent proof against a compromised server.

Canonical POST consumption requests receive `X-Consumption-Correlation-Id` after Host/Origin, body parsing, live buyer session, CSRF and buyer-role admission. It matches the receipt's `correlation_id` on success and remains on later errors. Requests rejected before admission need not have it. Correlation IDs are server-generated; clients cannot select them. Operational traces are optional, bounded and sanitized; diagnostic-storage failure cannot authorize, undo or replace consumption. Missing telemetry proves neither failure nor success and never authorizes a retry.

Sequential duplicate consumption returns 409, normally `CONSENT_NOT_AVAILABLE`, without another read. Same-process overlapping duplicates wait for the first attempt then reject; separate instances sharing SQLite reject an existing claim with `CONSUMPTION_IN_PROGRESS` before provider entry. Process death can leave a durable claim: restart does not steal it or reset read budgets. Follow the [read-only reconciliation procedure](CONSUMPTION-CORRECTIONS.md#operator-reconciliation-for-an-abandoned-claim); an unconsumed orphan remains NO-GO.

## Expiry, read policies and errors

Acceptance requires a safe integer timestamp strictly **before** snapshot expiry; equality is expired. Expiry crossing during consumption rejects without consumption-driven expiry mutation. Synthetic lifetimes are described above. PayPal review expiry is at most ten minutes and additionally bounded by the conservative three-hour window from provider creation and any operational deadline. These are local policy limits, not claims about PayPal expiry. Provider observations must be less than 60 seconds old, measured from read start.

PayPal reads are disabled by default. Configured imports require sandbox credentials, a fixed expected payee and an operator allowlist. Generic configured reads and separately budgeted operator integrations are distinct: a four-GET ceiling is not universal to every adapter. The read-plan integration durably reserves at most one OAuth and four GET slots before transport; helper refresh is disabled there. The historical attended scope shared one OAuth and allowed one create plus five total GETs, including immediate verification. Those historical grants are used and must not be rerun/reset. No retry, polling, token-refresh grant or new provider authorization follows from this API reference. Consumption has a bounded 20-second outer timeout (configurable downward); the adapter has a 15-second request timeout. Aborted/late responses cannot commit consent.

Errors are `{ "error": "SAFE_CODE" }`; raw database/provider errors and credentials are not returned. Representative mappings (not an exhaustive code list):

| HTTP status | Examples |
| --- | --- |
| 400 | `NONCANONICAL_ROUTE`, `INVALID_JSON`, `UNKNOWN_FIELD`, `INVALID_DECIMAL_AMOUNT`, invalid challenge IDs, failed passkey verification |
| 401 | `LOGIN_REQUIRED`, `LOGIN_FAILED`, `SESSION_EXPIRED` |
| 403 | `INVALID_HOST`, `INVALID_ORIGIN`, `CROSS_SITE_DENIED`, `CSRF_REQUIRED`, wrong role/buyer credential |
| 404 | `REQUEST_NOT_FOUND`, `ROUTE_NOT_FOUND` |
| 409 | `DETAILS_CHANGED_REVIEW_AGAIN`, `REQUEST_EXPIRED`, `CONSENT_NOT_AVAILABLE`, `CONSUMPTION_IN_PROGRESS`, `ORDER_PROVENANCE_CHANGED` |
| 413 / 415 | `BODY_TOO_LARGE` / `JSON_REQUIRED` |
| 429 | `TOO_MANY_LOGIN_ATTEMPTS` (more than 12 attempts per address in a one-minute window) |
| 500 | `INTERNAL_ERROR` for unexpected failures |
| 502 | Safe provider HTTP/network/response errors |
| 503 | Unconfigured PayPal import, read-budget exhaustion, missing operator approval, stopped/cutoff read experiment |
| 504 | `CONSUMPTION_TIMED_OUT` |

Never retry a failed/unconfirmed historical provider operation automatically. Reconcile saved state without replaying a grant or changing evidence.
