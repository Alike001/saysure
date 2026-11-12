# SaySure unified Render deployment

**One public origin, one Render web service, three clear routes.**

Public origin: **https://saysure-staging-cnhm.onrender.com**

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | SaySure product landing page | Public |
| `/demo` | Interactive synthetic walkthrough | Public; no account |
| `/app` | Helper/Buyer workspace | SaySure workspace credentials |

The landing page, demo and authenticated workspace are served by the same PostgreSQL-backed Node application. The public walkthrough no longer needs a second Render service or a second public Render URL.

## Render service

- Repository: `https://github.com/Alike001/saysure`
- Service: `saysure-staging-cnhm`
- Branch: `feat/saysure-postgres-runtime`
- Runtime: Node.js 24+
- Plan: Free
- Region: Frankfurt
- Build command: `npm ci --ignore-scripts`
- Start command: `npm start`
- Health check: `/healthz`
- Persistent state: managed PostgreSQL through the private `DATABASE_URL`
- `PG_POOL_MAX=4`

Keep database URLs, staging bootstrap credentials, PayPal sandbox credentials and any Groq key in Render's private Environment settings. Never put them in source, issues, screenshots, or chat. Remove one-time `STAGING_*_PASSWORD` bootstrap variables after the staging accounts have been provisioned successfully, as the startup log instructs.

The three original owner-provisioned accounts (`helper`, `buyer-a`, `buyer-b`) remain protected; their secrets are never published. Judges can additionally use `/app` to **Create private test workspace**, which creates a scoped Helper account, a fictional preloaded request and a one-time Buyer invitation. The Buyer claims the invitation in a separate browser and receives an independent password. Trials are synthetic, rate-limited and capacity-limited; they cannot import PayPal orders. The login is SaySure authentication and does not require a PayPal account. The public guided demo requires no account. Production user signup or verified email identity is not enabled. See [STAGING-ACCESS.md](STAGING-ACCESS.md) for the role-by-role test procedure and controlled credential rotation.

## Public demo boundary

The `/demo` page opens directly into a focused synthetic Buyer review, with a populated five-request fictional sample queue and Buyer/Helper role switch. The visitor may inspect seeded requests, ask questions, simulate decisions, revise a request, and prepare an additional fictional request entirely in their browser. The walkthrough does not require credentials and never writes to the real PostgreSQL workspace. The initial case still illustrates a quantity discrepancy and a separate Buyer decision. It uses fixed synthetic fixtures and visibly labels every decision as simulated. It does not create a session, invoke WebAuthn, read or write workspace records, import PayPal orders, or perform a payment operation.

The demo's `POST /api/demo-question` endpoint is hosted on the same origin. It accepts only a small JSON question payload, checks the exact same-origin request, applies the bounded buyer-question classifier and returns a closed topic plus local explanation. It does not attach transaction records. Local deterministic matching works without an AI key; Groq classification is optional and must be configured privately.

The public demo assets are served from an explicit allowlist. The authenticated API remains protected by the existing session, role, CSRF, exact Host/Origin, passkey and request-validation controls. Unauthenticated access to `/api/requests` remains rejected.

## PayPal and PayTale boundary

The authenticated workspace retains its optional, operator-allowlisted PayPal **sandbox read-only order inspection**. The server obtains provider facts and binds them to the reviewed request. This does not establish the app Buyer as the PayPal payer and does not establish merchant trustworthiness or payment completion.

This release does **not** enable PayPal checkout, capture, authorization, refunds, a public webhook receiver, verified webhook history, or automated reconciliation/recovery. SaySure's local passkey consent is not PayPal approval or payment execution. PayTale's investigation ideas may inform a future evidence layer, but no historical PayTale credentials, database or private records are copied or changed.

## Verification checklist

After deployment:

1. Open `/`, choose **Try the guided demo**, and confirm the browser remains on the same `saysure-staging-cnhm.onrender.com` origin at `/demo`.
2. Complete the synthetic review, explanation, question, simulated approve/decline and revision flows. Confirm all controls say simulated and no money moves.
3. Use **Open workspace** to reach `/app` on the same origin. Confirm the login and private trial onboarding appear; no PayPal login is requested.
4. Create a trial Helper account, save the credentials, copy the Buyer invitation and claim it in a different browser. Confirm the preloaded synthetic request, independent Buyer passkey enrollment and Helper request-scoping checks.
4. Confirm the public demo has no session cookie and cannot access protected request data.
5. Test desktop and mobile widths, keyboard focus, accessible labels and no horizontal overflow.
6. Confirm `/healthz` is healthy and PostgreSQL is ready.
7. Keep PayPal checkout/capture/refunds/webhooks disabled until a separately reviewed end-to-end sandbox lifecycle and recovery test can be completed.

The older isolated demo server and its unit test may remain as a local test harness. It is not the deployed public entry point. Do not advertise the legacy `saysure-public-demo.onrender.com` URL after the unified route is verified.
