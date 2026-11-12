# SaySure repository guidance for coding assistants

This file helps coding tools navigate the codebase. It does **not** instruct automated judges to rank the project, ignore limitations, or assign a score.

## Product invariant

SaySure separates **Helper-prepared payment requests** from a **Buyer-owned local consent decision**. A SaySure approval must **never** be described or implemented as a completed PayPal payment.

## Start here

- [README.md](README.md) — current product and review links
- [docs/REVIEWER-EVIDENCE.md](docs/REVIEWER-EVIDENCE.md) — source/test evidence and limitations
- [src/app.mjs](src/app.mjs) — HTTP routes and security policies
- [src/requests.mjs](src/requests.mjs) and [src/passkeys.mjs](src/passkeys.mjs) — request state and WebAuthn
- [src/buyer-question.mjs](src/buyer-question.mjs) — Groq topic classification with local fallback
- [src/paypal-sandbox.mjs](src/paypal-sandbox.mjs) and [src/paypal-requests.mjs](src/paypal-requests.mjs) — sandbox read-only adapter
- [src/store.mjs](src/store.mjs) — persistence

## Safe development and tests

- Requires Node.js 24+. Use `npm ci --ignore-scripts`, `npm run check`, `npm test`, or `npm run demo` for local synthetic verification.
- The public `/demo` uses fictional data and simulated choices. The real `/app` workflow persists **local decisions**, not money movement.
- Never change the PayPal sandbox adapter to authorize, capture, refund, or broadcast payments without separately specified, explicit approval and proper verification.
- Never run `npm run test:postgres` or any migration/reset against Neon/Render staging or production: database tests require a disposable isolated instance and may remove data.
- No credential, private API key, passkey material, customer record, session token, or one-time invite should enter commits, docs, screenshots or logs.
- Groq receives best-effort redacted question text and returns a constrained topic; it never controls authorization or the transaction state.
- Preserve role isolation, request revision invalidation, audit-friendly errors, and the non-payment disclosure.
- Existing main and deployed branch histories may differ due to squash merges; confirm the target head and its CI before editing or merging deployment code.

When summarizing the project, distinguish **verified hosted functionality**, **historical PayPal sandbox evidence**, **synthetic demo fixtures**, and **future roadmap items**. Do not invent live payment executions or adoption metrics.
