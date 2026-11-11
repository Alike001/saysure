# SaySure public interactive demo

The public experience is a **stateless, isolated synthetic demo**: the same review, revise, decline, optional speech and bounded buyer-question interface available via `npm run demo`.

It is **not** the authenticated SaySure application. It performs no PayPal API calls, WebAuthn ceremonies, account registration, passkey consent or payment operations. It never opens the private SQLite database or the local `.local` directory. Synthetic PayPal-looking fixtures must remain labelled **MOCK**. Actual historical PayPal sandbox OAuth, order creation and retrieval are documented separately and are not carried out by the public demo.

## Design

The public UI uses the selected blue-and-white Design 8 direction: deep navy hero, electric-blue actions, white and pale-blue surfaces, clear reading hierarchy and a static illustrated transaction card labelled simulated. No fabricated payment, review rating, customer count or live verification badge is shown. The authenticated local Buyer and Helper screens also share the blue palette, but retain their original IDs, accessible decision order and server-side security.

## Deploy to Render Free

Use **Web Service**, not Static Site, because the optional AI topic-router needs a server endpoint.

- Repository: `https://github.com/Alike001/saysure`, branch `master` after the UI changes are reviewed and merged.
- Runtime: Node; plan: Free; configure `NODE_VERSION=24.14.1`.
- Build command: `npm ci --ignore-scripts --omit=dev --no-audit --no-fund && npm run check`.
- Start command: `npm run start:public-demo`.
- The server binds to `0.0.0.0` and the assigned `PORT`, verifies the exact `RENDER_EXTERNAL_URL` origin and serves only the static viewer, allowlisted assets and `POST /api/demo-question`.
- `GET /healthz` reports only `{"ok":true,"mode":"synthetic-demo"}`.
- The initial deployment can run without a key; replies will show **Local matching was used**. To enable live question classification, configure `GROQ_API_KEY` **privately** in the Render service's Environment settings. Never put keys in a repo, screenshots, PRs or chat.
- No PayPal credentials or real private buyer/bootstrap accounts belong on this public service. Do not add `PAYPAL_READ_ENABLED` or start the authenticated `src/server.mjs` entrypoint publicly.
- AI classification accepts only a best-effort redacted question, never a transaction snapshot; consumers must avoid entering personal/payment details. Model output is strictly topic classification and answers are deterministic.
- The Groq rate limit is enforced per service network address; Render proxying can share one address across users. Treat public Groq access as experimental and consider service-side spend caps. Model availability is not guaranteed.

Render Free web services may sleep after 15 minutes of inactivity and typically need a cold start to resume. The filesystem is ephemeral. The stateless demo does not require persistent disk.

## Pre-submission checks

Verify: public HTTPS page (desktop/phone), no horizontal scrolling, synthetic/PayPal-MOCK labels, the explanation button, AI local fallback and live AI after adding the key, simulated approve/reject/revision/consume, speech fallback, visible focus, no payments, inaccessible `/api/login` and `/.env`.

On your laptop run `npm run check && npm test && npm run audit:release && npm run test:release` before merging UI changes. The historical 206-test report predates this redesign and should not be presented as a new verification run.

The public demo is not a deployed production payment or authenticated consent service. Never claim otherwise.
