# Controlled sandbox operator approval sheet

9 November 2026, Stage 1 complete. **NOT APPROVED. No PayPal network request was made, including OAuth.** This sheet supersedes the earlier preflight's open app-association question and proposed allowance of five GETs. The current authorization scope is **one create POST and one GET**, plus prerequisite OAuth. No additional consent-flow GETs are authorized yet.

## Verified scope and provenance

- Operator reports independent Developer Dashboard confirmation: **Sandbox → PayTale → NG Business merchant**, with a separate NG Personal buyer. These are operator-confirmed dashboard observations, not dashboard API evidence fetched by SaySure.
- Read-only comparison of configured client ID's **full SHA-256** against the historical SQLite app binding matches. Safe prefix: **2faa5ef4c17b**. Historical merchant `7TSZELT2DA9JJ` matches the reviewed target. This associates the current credential identifier with the historical app and operator-confirmed dashboard mapping. The secret is present and locally validated for format; it was not authenticated in this run. No secret hash, credential or token is displayed.
- Credentials remain in the existing private PayTale configuration, read only. SaySure `.env` is absent. No PayTale source, configuration or records are modified. The operator CLI reads only the explicitly selected configuration file; process environment cannot override it.
- Existing SaySure `paypal_bindings` registry has zero entries; no current order/allowlist configuration was found. No prior SaySure one-order attempt existed. A **single new private reservation**, not an order, now exists.
- The historical PayTale order is a separate preserved experiment. The [historical failure report](../../capturedesk-feasibility/docs/CHECKOUT-ERROR-DIAGNOSIS.md) records genuine create/read success and later hosted buyer-approval failure with unknown root cause. Later saved GET evidence returned 404. That order is not queried or reused here. No new order was found in local records; preflight does not claim an exhaustive remote order inventory.
- App association, OAuth scopes and earlier create success do **not** establish current receiving eligibility. No account-specific cause for the hosted approval failure has been established. No account, region, buyer setting or restriction is changed.

## Exact sanitized preview

The full resolved preview, including the reserved UUID and review digest, is private at `.local/paypal-one-order/preview.json`. The stable UUID is also persisted in `attempt.json`; rerunning preflight reuses it. The following replaces only the token and private reservation values with placeholders:

```http
POST https://api-m.sandbox.paypal.com/v1/oauth2/token
Authorization: Basic <private sandbox client credentials>
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
```

The token is held in memory only. Then, only after separate approval:

```http
POST https://api-m.sandbox.paypal.com/v2/checkout/orders
Authorization: Bearer <memory-only token>
Accept: application/json
Content-Type: application/json
PayPal-Request-Id: <the single UUID in private attempt.json>
Prefer: return=representation
```

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

Follow with exactly:

```http
GET https://api-m.sandbox.paypal.com/v2/checkout/orders/{exact returned order ID}
Authorization: Bearer <same memory-only token>
Accept: application/json
```

No link is followed. All requests refuse redirects and have a 15-second timeout. No automatic retry, capture, payment authorization, refund, settlement, buyer checkout, Live API, account creation, deployment or push is included. CAPTURE is an order intent, not a capture request.

Payload checked using Context7 against the current official [Orders specification](https://github.com/paypal/paypal-rest-api-specifications/blob/main/_autodocs/api-reference/orders.md), [standard Orders example](https://developer.paypal.com/api/rest/integration/orders-api/api-use-cases/standard), and [idempotency documentation](https://developer.paypal.com/api/rest/reference/idempotency). Intent and purchase units are required; amount uses string `value` and `currency_code`. This request supplies one unit and an explicit payee. Prefer requests the representation; GET uses the returned ID. Provider request-ID retention is finite (default six hours), so the permanent local no-retry marker provides the durable run guard. Never delete it to retry.

## Private operator command and exact gate

Safe preflight (no network):

```sh
node scripts/paypal-once.mjs preflight --config ../capturedesk-feasibility/.env
```

**STOP. The task prompt and dashboard screenshots do not authorize execution.** The operator must separately approve this precise operation and merchant. Suggested explicit decision:

> I authorize exactly one SaySure sandbox 1.00 USD order create and one GET; no payment execution. Use the reserved attempt and merchant 7TSZELT2DA9JJ, with prerequisite sandbox OAuth. No retries or buyer approval.

Only after receiving that decision, create the ignored, owner-controlled mode-0600 `.local/paypal-one-order/operator-approval.json` containing exactly:

```json
{
  "statement": "I authorize exactly one SaySure sandbox 1.00 USD order create and one GET; no payment execution.",
  "review_digest": "<copy the review_digest from the reviewed private attempt.json>"
}
```

**This approval file has not been created.** Preparing code or showing this template is not approval. The eventual private CLI is:

```sh
node scripts/paypal-once.mjs execute --config ../capturedesk-feasibility/.env --approval .local/paypal-one-order/operator-approval.json
```

The command accepts no arbitrary payload, host, merchant, order ID or request key. Configuration must match the full historical fingerprint and reviewed payload. It refuses existing application order bindings/configuration and any prior execution marker. Two concurrent invocations have only one winner. An exclusive, fsynced `execution-started.json` is created **before OAuth** and never removed, including on OAuth failure, process termination or timeout. Any failed/unknown POST stops permanently; no new key, token refresh, replay or automatic second order is authorized. Manual deletion/tampering with private state is outside this guard and prohibited by this procedure. Preserve the entire directory across restarts.

## Evidence and failure handling

Only private mode-0600 files in ignored `.local/paypal-one-order/` contain attempt/transaction evidence. `result.json` persists write-ahead operation timestamps, actual HTTP statuses, sanitized debug IDs/name/issues, returned order ID/status, safe GET financial fields, validation outcome and provenance. Headers are persisted before parsing a response body. Raw bodies, messages, links, payer/shipping data and credentials are discarded. Unreadable bodies/network failures retain observed status or null for unknown outcome; never substitute a fixture. Review private evidence and existing app API logs; do not replay requests.

- HTTP 401: authentication failure; stop. Not receiving-ineligibility proof.
- HTTP 403: refused permission/access; stop and inspect actual safe issue/debug ID.
- HTTP 404 on GET: resource unavailable/inaccessible; do not infer expiry/cancellation/payment.
- HTTP 422: inspect the actual business-validation issue; no country-causality inference.
- HTTP 5xx, timeout, invalid JSON, absent ID or unknown outcome: stop and reconcile; no new order.
- Create 200/201 plus valid matching GET: order observation only. Neither receiving eligibility, PayPal approval nor payment is established merely by creating it.

GET validation requires exact returned ID, CAPTURE, exactly one unit, string amount `1.00`, USD, expected merchant, supported reviewable status, recent provider creation and no inconsistent payment evidence. Provider fields are stored separately from derived local validation. Invalid responses remain unvalidated.

## SaySure passkey verification after a real order

No genuine order exists from this run; no consent binding or passkey ceremony has been performed. After authorized creation and valid GET, configure SaySure's own private sandbox read settings and allowlist only the returned order ID. This CLI does not automatically change app configuration or the existing consent database.

**The initial one-GET grant does not cover the additional reads needed for Stage 3.** Obtain explicit permission for the bounded consent-verification reads before importing the real order. Existing application code then fetches provider evidence on import, before challenge issuance, after signature verification and before local one-time consumption. Missing/changed/unavailable evidence invalidates consent; no mock fallback is allowed. Helper selects only the application buyer/order; verified amount, currency and payee come from authenticated provider GETs. `paypal-consent-v1` binds the observed order tuple to buyer, nonce, revision, request ID and expiry using the existing localhost RP/passkey configuration.

SaySure consent does not establish PayPal payer identity, approve PayPal checkout, authorize funds or prove payment. Provider status and local consent remain distinct. Existing fixture tests exercise these paths with a real WebAuthn verifier; genuine order-bound integration remains unverified.

## Stage 1 result

**GO for review; NO-GO execution pending the separate decision above.** Initial working tree was clean at `652ec29`. Existing suite: **59/59 passed**. New one-time guard suite: **20/20 passed**; syntax/source-size and whitespace checks passed (existing security-test line-count advisory remains). No PayPal error occurred because no PayPal request was sent.

Judge readiness: credential-free fixture demonstration remains available and explicitly simulated. A genuine sandbox create/read and real order-bound passkey demonstration are pending authorization and provider results. Buyer checkout and receiving eligibility remain unqualified. No completed payment or production readiness is claimed.
