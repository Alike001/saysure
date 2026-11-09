# Controlled sandbox operator approval sheet

9 November 2026. **NOT APPROVED. Creation remains DISABLED. No PayPal network request was executed for this preflight, including OAuth POST.** Review evidence: [`sandbox-preflight.json`](../evidence/sandbox-preflight.json).

## Merchant / REST app review

| Item | Read-only finding | Operator confirmation needed |
| --- | --- | --- |
| SaySure `.env` | Absent. Main app sandbox reads remain disabled | Provision privately only after merchant/order decisions |
| Existing private configuration | PayTale `.env`: sandbox client ID/secret and Groq key present; no configured merchant/current order | Do not copy into source, screenshots or chat |
| REST app credential identifier | SHA-256 prefix **2faa5ef4c17b**, matches the historical checkout's stored full app fingerprint | In Developer Dashboard **Sandbox**, confirm the intended REST app display name and its credential/account mapping. Full client ID, secret and OAuth token remain redacted |
| REST app display name / OAuth app_id | Not retained in saved evidence; “PayTale” is a prior working label, not authenticated dashboard identity | Operator must confirm; do not invent a verified app name |
| Intended merchant reference | **7TSZELT2DA9JJ**, matching prior saved GET and prior user dashboard confirmation | Confirm this is still the Business sandbox merchant associated with the intended app. This is an account reference, not proof of a shop's identity |
| Seller and buyer country | Both NG per previous user report, not freshly observed | Inspect existing account limitations/receiving notices and the legitimate supported buyer route, without changing regions/settings |
| Saved scopes | Nov 4, `2026-11-04T19:42:57.057Z`: 26 scopes; `https://uri.paypal.com/services/payments/payment/authcapture` and `https://uri.paypal.com/services/applications/webhooks` present | Complete list was not retained; current token scopes were not refreshed. Scope presence is not proof of create/receive/approve eligibility |
| Real SaySure connectivity | Prior milestone OAuth HTTP 200 on Nov 9; no current Orders GET | Authentication is not receiving eligibility or completed integration |
| Previous failure | Buyer sign-in succeeded, later hosted buyer approval failed; original precise failure code/root cause unavailable | Review existing Sandbox app Error/API Logs, account notices and, if necessary, obtain account-specific PayPal support clarification. Do not retry to bypass restrictions |

The same credential fingerprint and historical merchant are **consistent with the previous NG sandbox experiment**. They do not resolve its approval failure. Country/account capability is one hypothesis; session/browser, funding and sandbox service issues remain possible. No country-level blanket inference or restrictions bypass is justified. The historical order later returned 404 and is not a current order candidate.

## Proposed fixed operation (future authorization only)

Sandbox host: **https://api-m.sandbox.paypal.com**. Intent: **CAPTURE**, currency **USD**, amount **1.00**. No real goods or money. `CAPTURE` is the order's intended eventual flow, not an executed capture request.

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

**Use this merchant only if the operator confirms it remains correct.** If not, stop and amend this sheet to the explicitly selected sandbox account; do not silently substitute an account.

Requested future scope of authorization:

1. Backend `POST /v1/oauth2/token` to authenticate the confirmed sandbox app; keep token only in memory.
2. Exactly **one logical POST /v2/checkout/orders**, with the fixed payload, one stable `PayPal-Request-Id` and `Prefer: return=representation`.
3. Authenticated `GET /v2/checkout/orders/{new-id}` for the new result. Up to **five GETs total** if the same approved test includes import, challenge issuance, post-signature revalidation and local one-time consumption. No background polling or unbounded retries.
4. No PayPal buyer checkout, capture, authorize, refund, settlement, Live request, account/region change, deployment or remote push is included in this initial create/read authorization. A legitimate human buyer-approval observation requires an explicitly confirmed test route and separate authorization if not included in a revised sheet.

Current `createSandboxOrder` has no application route or executable creation command. Both explicit function gates default false. No environment setting alone enables it. Its caller must supply a backend-only token and stable request ID after approval. It has not been executed here.

## Duplicate prevention and ambiguous outcomes

Before any eventual POST, the operator must reserve **one UUID**, persist it with a SHA-256 hash of the fixed payload and app/merchant fingerprint in a private attempt record, and lock the run to that record. The adapter requires the request ID header but is **stateless**: it does not itself persist that record or prevent an operator from choosing a second key. Do not claim durable duplicate-creation protection is already implemented.

Do not run concurrent create commands. After timeout/unknown outcome, stop, inspect existing app API logs and reconcile the same attempt; do not generate another key or automatically create again. Any separately approved replay must use the same key, payload and merchant within PayPal's documented retention policy; expired retention is not permanent duplicate protection. [PayPal idempotency documentation](https://developer.paypal.com/api/rest/reference/idempotency) describes this behavior. No reattempt is preauthorized by this sheet.

## Interpretation / stop conditions

| Result | Interpretation and action |
| --- | --- |
| Create 201 / documented idempotent replay | Provider has an order record; confirm returned ID with authenticated GET. Not proof of receiving eligibility, buyer approval or payment |
| Valid GET | Returned ID matches; CAPTURE, 1.00 USD, expected payee, status and fresh time validate. This proves an authenticated server observation for the tested app/order/payee, not independently verified shop identity or PayPal payer ownership |
| 401 | Authentication missing/invalid/expired. Stop; inspect configuration/token lifecycle privately. Not proof of account receiving restrictions |
| 403 | Provider refused access/permission for this operation. Stop and inspect safe error issue/correlation data. Do not bypass or switch accounts silently |
| 404 | Resource unavailable, nonexistent, wrong environment or possibly inaccessible. No payable order is established; do not infer definite expiry, cancellation or payment |
| 422 | Semantically invalid request/business validation failure. Record only safe status/name/issue/debug ID; investigate that specific issue. It does not by itself prove NG country causality |
| 5xx / network timeout / uncertain create | Outcome unknown; stop and reconcile the reserved attempt; never create with a fresh key to “try again” |
| Buyer approval failure | No demonstrated approval/completion. Preserve the precise safe error if available; the old NG blocker remains unresolved. Do not capture, change region or bypass restrictions |

These HTTP meanings follow the official [Orders error table](https://developer.paypal.com/api/rest/integration/orders-api/errors). The disabled creator currently returns a generic unconfirmed error on failed creation; the future controlled caller must retain safe HTTP/correlation metadata without raw response bodies, tokens or payer data. No error status alone determines account eligibility.

**Approval is not capture.** PayPal buyer approval, local SaySure consent, an authorization of funds, capture and settlement are separate events. This task implements none of the last payment operations. An APPROVED order or local consumed consent cannot be presented as a completed payment.

## SaySure consent binding after a valid read

Add only the new order ID to the operator allowlist. The helper chooses the app buyer, not financial fields. The backend projects authenticated provider data and binds the sandbox environment, order/payee IDs, exact purchase-unit values/total/currency, recorded status/intent, application buyer, request ID/revision/nonce/expiry to `paypal-consent-v1`. Server GETs run before challenge creation, after signature verification and before local consumption. Changes/unavailability invalidate consent. The credential signature uses the preserved localhost RP and buyer public key. App buyer identity does not prove PayPal payer identity. A later change at PayPal remains possible; this is not an order lock or capture authorization.

## Required explicit operator decision

- [ ] Confirm Sandbox REST app display name and credential fingerprint mapping privately.
- [ ] Confirm current merchant ID `7TSZELT2DA9JJ`, or name the approved replacement and revise this sheet.
- [ ] Confirm account notices and legitimate buyer test limitations have been reviewed; no receiving eligibility is inferred from OAuth/scopes.
- [ ] Approve the exact fixed 1.00 USD create/read operation list and GET bound above.
- [ ] Reserve the single private attempt/key/payload record before execution; agree to stop on uncertainty.
- [ ] Keep buyer checkout, capture/authorization/refund, deployment and push outside this authorization.

**Current decision: NO-GO execution.** Technical request format and read/consent code are prepared and mock-tested. Merchant/app confirmation, a controlled single-attempt procedure and explicit creation authorization remain outstanding. Nothing on this sheet is an approval by itself.
