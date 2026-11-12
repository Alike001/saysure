# SaySure — PayPal AI Hackathon submission kit

Prepared: November 12, 2026. Deadline: **9:00 PM West Africa Time (12:00 PM PST)**.

## Entry details

**Name:** SaySure  
**Tagline:** Your money. Your final say.  
**Website:** https://saysure-staging-cnhm.onrender.com/  
**Try it, no signup:** https://saysure-staging-cnhm.onrender.com/app  
**Guided sample walkthrough:** https://saysure-staging-cnhm.onrender.com/demo  
**Code:** https://github.com/Alike001/saysure  
**License:** MIT  
**Video:** Add the public YouTube URL after uploading a recording of the real application (required; not available yet).

## Devpost short description

SaySure gives people who need help with a digital payment the freedom to make their own decision. A Helper prepares a request; the Buyer reviews the amount, recipient and purpose, asks questions, and can decline or record consent with their own passkey. Changes invalidate prior approval. No payment is executed in the public test.

## Devpost full description

### Problem
People who need help navigating online payments should not have to give up control of the final decision. Existing assisted-purchase experiences often blur the line between preparing a request, asking for help, and actually authorizing a payment.

### Solution
SaySure separates the Helper who prepares a payment request from the Buyer who must decide independently. In a real, database-backed workspace, a Helper can create a request for a designated Buyer; the Buyer reviews the item, amount, merchant, description and expiry. The Buyer can decline without a passkey or, on a compatible device, register their own passkey and record consent. The Helper cannot approve for them. Altering the reviewed details invalidates earlier consent, and both users can inspect updated request states. A one-use Buyer invitation gives judges an isolated test account without registration. A separate no-login demo contains five clearly fictional examples.

### PayPal and AI engineering
SaySure includes a **read-only PayPal Orders v2 sandbox adapter**: it uses server-side OAuth, checks an operator-allowlisted order's payee, total and status, and binds provider-observed evidence into reviewable requests while limiting stale or changed evidence. During development, genuine sandbox OAuth, order creation and independent order GET returned successful responses for a one-dollar test order; no capture occurred. The public judge workspace **does not import PayPal orders** and never approves, captures, refunds, or transfers money.

SaySure also includes **Groq model-assisted Buyer questions**. The tested model `openai/gpt-oss-120b` classifies a best-effort redacted question into a fixed topic. The model does not generate transaction facts or authorize actions; deterministic code generates the answer from the details already on the screen. Historical development testing returned a successful model response and improved topic classification over the local baseline. **Hosted verification on November 12:** Render logs confirmed Groq enabled, and a user-observed live demo answered *“Does my passkey make a payment?”* with *“AI matched your question.”* The app falls back to local matching if the provider becomes unavailable. Do not confuse this with a live PayPal sandbox order read.

### Who it serves
People who need assistance with digital payments, including first-time online shoppers and people who benefit from larger, clearer review screens and spoken details. These are design hypotheses, not verified accessibility or comprehension outcomes.

### What we built during the hackathon
A functional WebAuthn/passkey-backed consent system with independent Helper/Buyer roles, request-state transitions and revision invalidation; a server-side PayPal sandbox read adapter and evidence checks; a constrained AI question classifier with fallback; PostgreSQL-backed hosted staging on Render; invite-only test accounts, fictional demo records, responsive UI and security/browser tests. Checkout, refunds, payer verification, real-money payout and reconciliation are outside this release.

### Constraints and safety
All sample data are fictional, and local SaySure consent **is not PayPal payment approval or completion**. A passkey verifies control of an authenticator, not comprehension. No successful payment is claimed. Groq redaction is best-effort; buyers should not enter sensitive identifiers into questions.

## Judge instructions

1. Open https://saysure-staging-cnhm.onrender.com/app and select **Start testing**. The server creates an isolated Helper session and a clearly fictional sample request.
2. Select **Copy Buyer invite link**. Use a private, separate browser profile/device; don't expose a password or invitation on camera.
3. Open the link as Buyer and click **Join as Buyer**.
4. Review the request, try **Decline**, or register a passkey and confirm the facts before recording local consent on another request.
5. In the Helper browser, select **Refresh** and observe the latest status.
6. Explore https://saysure-staging-cnhm.onrender.com/demo without signing in. This walkthrough simulates outcomes; the real workspace uses persisted account-scoped records.

Returning test accounts can use /app/login, which is separate from the primary public entry. This is a test environment: no PayPal or real-money payment is made.

## Video storyboard — target 1:45 to 2:30, strictly under 3 minutes

Record **actual web-browser footage** (not a static mockup), including real clicks and visible results:

- 0:00–0:15: SaySure website; state the problem and the Helper/Buyer distinction.
- 0:15–0:35: Open /demo; show populated examples, one mismatch, and a Buyer decline.
- 0:35–0:55: Open /app; start a test. Show that a sample request exists. Hide any access tokens or passwords.
- 0:55–1:20: Copy and open Buyer invite on another browser; join as Buyer. Show live request details.
- 1:20–1:45: If passkey is compatible, record passkey setup and Buyer approval. Otherwise show Buyer decline and refreshed Helper status; do not fake approval.
- 1:45–2:10: Explain the server-side read-only PayPal Orders adapter and Groq topic classification. Show actual verified provider evidence **only if available and labelled**; do not suggest the public synthetic trial makes real PayPal calls or uses live Groq by default.
- 2:10–2:20: Summarize product value and reiterate the consent-versus-payment distinction.

The generated speech narration for the presentation runs approximately 92 seconds. Align it with actual screen footage; do not replace working product footage with AI-generated UI.

## Narration text

Imagine needing help with an online payment, without giving someone else control over the decision. That's why we built SaySure. Your money. Your final say.

SaySure separates two people: the Helper, who prepares a request, and the Buyer, who independently reviews it.

Here's the guided demo. Anyone can explore five fictional requests without signing in. We can inspect a merchant, check the amount, spot a quantity mismatch, ask what a passkey means, and decline a request.

Now let's open the actual workspace. One tap creates a private test account and a sample request. The Helper shares a one-time invitation. In a separate browser, the Buyer joins with their own account and sees the exact request.

The Buyer can decline immediately, or set up a passkey on their own device to record consent. The Helper cannot approve for them. If details change, an earlier approval is invalidated. Both people can refresh to see the updated result, and requests are saved in PostgreSQL.

We also built a read-only PayPal sandbox Orders integration and validated real sandbox order reads during development. A Groq AI model was evaluated for classifying questions into safe help topics, while SaySure itself provides grounded explanations. Those integrations are separate from this public synthetic trial; it does not send or capture money, and AI help falls back to local matching when the model is unavailable.

SaySure is an accessible starting point for payment assistance with independent consent, and a clear boundary between a decision and an actual payment.

## Remaining readiness gates

- [x] Public hosted landing, guided demo and database-backed workspace
- [x] Public repository, MIT license and current README
- [x] Existing CI regression tests and PostgreSQL integration passed on the current release
- [x] Read-only PayPal sandbox adapter and model-routing implementation, with historical integration evidence
- [ ] Verify a **fresh** approved PayPal sandbox read on the current deployment before claiming it is live (not possible with historical expired order alone)
- [x] Install `GROQ_API_KEY` privately on Render and verify a live model response in `/demo` on November 12 (user-observed “AI matched your question”; startup logs confirmed configuration)
- [ ] Record and upload the real demonstration to public YouTube (under 3 minutes)
- [ ] Enter all Devpost fields and submit before the official deadline

Official rules: https://paypalaihackathon.devpost.com/rules

**Do not expose secrets** in this document, videos, public form, server logs or GitHub.

## HeyGen explainer preview

On November 12, a narrated screen-based HeyGen Studio preview was started as video ID `95ca3a331dec11399c62fe797910b54a`. It uses genuine SaySure screenshots, the previously approved Wade voice and narration wording, and burned-in captions. This is a **screen-based explainer**, not a continuous recording of actual click-by-click browser interactions; check duration, legibility and fidelity before submission. The user must upload a public YouTube video and paste that URL into Devpost. There is no verified upload or Devpost submission yet.
