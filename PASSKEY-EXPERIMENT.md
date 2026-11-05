# Isolated accessible consent passkey experiment

5 November 2026. **The implemented mechanism passes automated browser/protocol tests; the experiment is not fully qualified until a human-controlled authenticator completes registration and approval.** The user elected to perform the manual test; no result has yet been recorded here. No complete hackathon product is started.

## Architecture and implementation

Standalone repository: `/home/ali/Desktop/paypal/accessible-consent-passkey`. PayTale and its history remain in the sibling `capturedesk-feasibility` repository, at `674aba330e2abbba3c4d8b8a054a919352db0cbe`; its existing untracked research is preserved. No old source, baseline database, reference repository, PayPal integration or commit is modified by this experiment.

| Files | Implemented responsibility |
| --- | --- |
| `src/server.mjs`, `src/app.mjs` | Loopback server, exact Host/Origin, bounded JSON, CSRF, CSP, explicit static-file allowlist and role-checked API |
| `src/identity.mjs`, `scripts/setup.mjs`, `scripts/account.mjs` | Fixed helper/buyer-a/buyer-b provisioning; separate random secrets; scrypt hashes; hashed opaque session cookies, login rotation, expiry/logout |
| `src/store.mjs` | Private durable SQLite, WAL/FULL sync, immediate transactions, users/credentials/sessions/requests/challenges/events |
| `src/core.mjs` | Exact integer currency conversion; fixed canonical snapshot encoding and SHA-256 digest; input checks |
| `src/requests.mjs` | Helper creation/revision; immutable buyer ownership; filtered inbox; reject/withdraw; one-time consent consumption |
| `src/passkeys.mjs` | Maintained-library registration and assertion verification; buyer/credential/session binding; required UV; expiring single-use challenges |
| `public/` | Minimal semantic forms, buyer inbox/review, native authenticator calls, plain state feedback/focus; no branding or marketing |
| `test/` | Canonical/amount tests, separate browser contexts and virtual authenticators, negative protocol/signature tests, restart/concurrency and accessibility checks |
| `README.md`, `QUALITY.md`, `evidence/` | Exact manual instructions, local verification gates and recorded actual test evidence |

Helper and buyers authenticate using distinct provisioned secrets; roles come from the database, not tabs, parameters, form choices or a client cookie role. One buyer credential is accepted per account. The helper has no enrollment, approval, rejection or consumption privilege, cannot change buyer ownership, and cannot enroll a replacement. The local administrator's initial provisioning and secret distribution are trusted; this is not verified civil identity or PayPal account ownership.

States: pending → approved → consumed, with rejected/withdrawn/expired terminal alternatives. A permitted helper revision of an unconsumed pending/approved request increments revision, rotates nonce and expiry, resets to pending, clears consent and invalidates challenges. Closed requests cannot be edited. “Consumed” is a local test action, never a payment operation.

## Dependencies and documentation

- Node **24.14.1**, npm **11.13.0** in the inspected environment; experimental built-in `node:sqlite`.
- Runtime: `@simplewebauthn/server` **14.0.3**, `@simplewebauthn/browser` **14.0.0**.
- Development: Playwright **1.64.1**, `@axe-core/playwright` **4.14.0**. Exact transitive resolution is in `package-lock.json`.
- `npm install --ignore-scripts`: 30 packages added, zero vulnerabilities reported. `npm audit --omit=dev`: zero vulnerabilities in the executed check; not a security audit of this code.
- Current registration/authentication/browser usage fetched through Context7 from [SimpleWebAuthn server](https://simplewebauthn.dev/docs/packages/server), [browser](https://simplewebauthn.dev/docs/packages/browser), and [Playwright context isolation](https://playwright.dev/docs/browser-contexts). Installed source/types were inspected to confirm credential format and the distributable bundle path. No CDN or runtime dependency download is used by the page.

## Actual automated security outcomes

**28/28 tests passed** (25 browser scenario groups, their parent test, and two canonical/amount tests); syntax/source-size checks pass. See [machine-readable final run](evidence/security-results.json). Chrome was **153.0.8010.52**. Tests use actual `navigator.credentials.create/get` via the browser library and verify the resulting signatures with SimpleWebAuthn. **The authenticators are Chrome CDP virtual CTAP2 authenticators with resident keys and user verification, not physical devices or human biometric evidence.** Verifier responses are not mocked.

| Requested test | Actual automated result |
| --- | --- |
| 1. Valid approval | PASS: browser-generated signature accepted, exact consent digest stored |
| 2. Changed amount | PASS: signed old assertion and stale review digest rejected; revision returns request to pending |
| 3. Changed merchant | PASS for both merchant ID and displayed name; old challenge invalidated |
| 4. Changed currency | PASS: prior assertion/review rejected |
| 5. Changed buyer | PASS: helper reassignment API denied; deliberately corrupted synthetic ownership fails closed; different buyer cannot see/approve the request |
| 6. Expired approval | PASS: server-expired challenge rejects a previously generated assertion; expired request blocks options/consumption path |
| 7. Replayed assertion | PASS: 100 repeats rejected after one approval; exactly one consent event |
| 8. Reused consent | PASS: one consume only; restart and repeated use remain denied |
| 9. Incorrect passkey | PASS: other buyer credential ID rejected; invalid signature rejected |
| 10. Helper approval | PASS: options, captured buyer proof, enrollment substitution, reject and consume attempts denied |
| 11. Concurrent duplicate | PASS: 20 parallel approvals yield one success; 20 parallel consumes yield one success |
| 12. Refresh/restart | PASS: real database close/reopen and HTTP server restart retain sessions/challenges/credentials/state; consumed proof remains unusable |

Additional executed coverage includes description/revision changes, verified-UV enrollment, replacement refusal, required signature/origin/RP-ID/challenge/type/UP/UV checks, CSRF, Host, Origin, anonymous access, input/role injection, safe literal rendering of HTML-like merchant text, keyboard-focus restoration, and two independent buyer accounts. Altered field-check assertions are re-signed using the virtual test private key, so rejection does not rely only on invalid signatures. Test keys never leave temporary test memory or enter evidence.

Same-buyer second-session challenge reuse was denied. In twenty withdrawal-versus-consumption races, exactly one transition succeeded each time. These are executed final-suite results; do not infer physical-device behavior from them.

The [first run](evidence/initial-security-results.json) retained a failed Host-header test: Node fetch did not transmit the intended forged Host header. Replaced that probe with `node:http.request` and obtained the expected 403. No server validation was relaxed. Additional verification-field tests were strengthened by re-signing modified assertions. Early passing cases remain limited to their original coverage; the retained initial artifact is not the final result.

A later verification run stalled while the test harness gracefully closed the HTTP server with browser connections still open. That run was terminated without claiming a new completed result. The restart test now explicitly closes connections to simulate an abrupt server restart and has bounded scenario/suite timeouts. It still closes/reopens the database and preserves the same records. This was a test lifecycle failure, not a demonstrated duplicate approval or verifier bypass.

## Browser and accessibility evidence

Automated Chrome uses separate contexts/cookies for helper, buyer-a and buyer-b, with distinct authenticator credentials. This proves server-enforced role/account/session separation in those tests, not independent people controlling separate phones. The UI approval flow was exercised through the native WebAuthn browser API backed by the virtual authenticator. Registration was exercised through browser API calls to the real backend. The helper form and buyer review had zero violations in the executed axe scans, and buyer review reflowed at a 320-pixel viewport. Dynamic result focus was checked. This is not screen-reader usability testing or WCAG certification.

The [unmodified tool-browser check](evidence/browser-capability.json) found a secure localhost context, WebAuthn API and browser bundle available, but **no user-verifying platform authenticator**. No physical registration was attempted from that browser. This observation does not rule out a user browser, passkey provider or security key.

**Human passkey result: PENDING.** The user elected to test in their own browser. [README manual steps](README.md#real-passkey-manual-procedure) explain independent profiles, private secret retrieval, registration, review, approval, rejection, revisions, restart and second-buyer testing. Record user-reported outcomes separately from backend observations. Do not claim physical enrollment, independent-device approval, human comprehension, mobile compatibility or screen-reader success before those results exist.

## Transaction-binding guarantees and limits

The fixed server-side canonical encoding contains request ID, merchant ID/name, exact minor units/currency, description, buyer ID, 32-random-byte nonce, expiry and revision, with a versioned purpose tag. The server hashes it with SHA-256. It stores a random cryptographic WebAuthn challenge associated with the digest, buyer and session. The authenticator signs WebAuthn data containing that challenge; it does **not** directly sign a readable payment invoice.

Before accepting the signature and again inside the atomic approval transition, the server requires the request to remain pending, unexpired, owned by the same buyer, internally consistent and at the same digest. Required origin, RP-ID, type, user presence, user verification and stored buyer public key are verified. A challenge is durably claimed once before asynchronous verification. A failed attempt spends that challenge; retry requires a fresh review/options call. New options supersede prior in-flight challenges for that session. Transactions serialize approval/revision/withdrawal/consumption. Consumption is an independent atomic one-time state change.

Within a trusted server/database/frontend, this binds an accepted credential assertion to one unchanged synthetic snapshot. It prevents the tested stale, replayed, wrong-role, wrong-buyer and duplicate actions. It does not prove that the user read or understood the snapshot, that displayed merchant identity is genuine, that the helper's goods description is true, or that the device belongs exclusively to that buyer. A compromised frontend can display different prose; a compromised server/local administrator can change records. Cryptographic primitives and all possible browser/OS attacks were not independently audited.

There is no PayPal order or processor binding here. No account can be charged, no payment can be authorized, and no completion/settlement claim is made. No AI decision is involved. WebAuthn provides public-key/assertion data and UV flags to the server; device biometric samples are neither requested nor transmitted to this app. Device providers may use their own passkey sync mechanisms outside the app's control.

## Identity, device and operational risks

Buyer account ownership depends on trusted provisioning and private distribution of the initial secret. Someone who obtains an unenrolled buyer's secret can enroll their own credential. Helpers cannot do so using their helper role, but the prototype does not solve malicious local administration or compromised buyer credentials. Enrollment replacement and account recovery are deliberately unavailable rather than weakly implemented.

Synced passkeys/shared device unlock codes can allow access from multiple devices or people. Same-device browser profiles isolate cookies, not authenticator ownership. No attestation policy proves a specific physical phone, and `attestation: none` intentionally avoids claiming hardware provenance. User verification can mean local device unlock or security-key verification, not necessarily biometrics. Bootstrap secrets also allow read/reject/withdraw/consume of that buyer's local state; only approving requires the enrolled passkey. This is a local feasibility boundary, not production account security.

The listener uses plain HTTP only on loopback, with HttpOnly/SameSite Strict cookies and exact host/origin checks. Secure cookie transport and mobile/LAN testing require a future explicitly configured, trusted HTTPS origin and matching RP ID; this is documented but not implemented. Sessions expire after 30 minutes and challenges after at most two minutes or request/session expiry. Request expiry is checked server-side; the UI needs refresh to show changes. No automated timing extension, production brute-force/rate-limit service, multi-process deployment or account recovery was qualified.

All request data is synthetic, but users can still type sensitive text: do not do so. Private bootstrap records, SQLite/public credential data and sessions remain ignored under `.local/` with restrictive filesystem permissions. Test output records no private keys, credentials, passwords, assertions or biometric data. No remote service, PayPal operation, deployment, push or reference-repository edit is performed.

## Viability and next step

**Provisionally technically viable at the browser/protocol level; physical-user consent and accessibility qualification remain open.** Full product development stays NO-GO. Complete the human-controlled enrollment/approval and independent-session check first. If it fails, preserve the failure, identify the actual browser/provider limitation and do not substitute virtual success or reduce required verification. If it passes, next observe a screen-reader user independently reviewing, rejecting and approving revised synthetic requests; broader PayPal/AI work remains outside this experiment.
