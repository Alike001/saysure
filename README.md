# SaySure

**Your money. Your final say.**

SaySure is the working name for this standalone accessible payment-consent experiment, testing additional transaction-specific consent. It has a disconnected, mock-tested PayPal read adapter and a separate Groq comprehension evaluation; the buyer app performs no payment operations and uses no payment credentials or real money. The name has no claimed trademark or domain clearance; this is not a production-ready product or a claim of accessibility for all users. All requests and merchant identities are synthetic and unverified.

## How to Test

Node 24+, npm and a WebAuthn-capable browser are required. This checkout was provisioned locally; **do not rerun setup on it**. For a fresh checkout only:

```sh
npm ci --ignore-scripts
npm run setup
npm start
```

For this machine:

```sh
cd /home/ali/Desktop/paypal/accessible-consent-passkey
npm start
```

The agent may already have the server running. If port 3100 is busy, use that existing server rather than launching another. Open **http://localhost:3100** exactly. RP ID is **localhost**, origin **http://localhost:3100**. Do not substitute `127.0.0.1`, a LAN IP or a different port.

## Real passkey: manual procedure

1. Use **two separate browser profiles or different browsers**, one for the helper and one for the buyer. Two tabs share a cookie and are not two identities. Optional buyer-b testing requires a third profile/browser or signing out and signing into that separate account. Never use an automated virtual authenticator for this manual test.
2. In your private terminal, run `npm run account -- buyer-a`. It displays only buyer-a's local username and secret and refuses noninteractive output. Keep the secret out of chat/logs/screenshots. The local machine administrator can read all bootstrap secrets; that is an explicit trust assumption.
3. In the buyer profile, sign into `http://localhost:3100` as **buyer-a** using that secret. Confirm the page says `Signed in as buyer-a. Server-assigned role: buyer.`
4. Select **Register my passkey**. For a real phone-backed test, choose your browser/OS option to use a phone or another device, if offered; follow its native QR/pairing instructions on the buyer’s own phone and unlock there. Provider wording varies; this is not an app button. Keep the desktop buyer profile at the exact localhost URL. If no phone option is offered or pairing fails, record that blocker and stop this phone-backed test; a desktop credential is not a phone-backed result. The authenticator may show the preserved RP display name **Synthetic consent experiment**. Complete your browser/OS authenticator prompt yourself. A biometric, device unlock or security-key PIN may be handled by your authenticator; **never enter a card PIN into this app**. Choose your own authenticator, not the helper's. User verification is required. Canceling or lacking a suitable authenticator must leave the account unenrolled.
5. Expect **Your passkey was registered to this buyer account. No payment was approved.** Replacement enrollment is disabled. Do not register buyer-a on the helper's device. Do not use a shared OS passkey store if testing independent ownership.
6. In a private terminal run `npm run account -- helper`. In the helper profile sign in as **helper** with only that account's secret. Confirm server-assigned helper role. The helper must see no passkey-registration or buyer-approval controls.
7. Prepare a request for **buyer-a**: merchant ID `SYNTH-SHOP-1`, displayed name `Synthetic shop`, currency `USD`, amount `1.00`, description `Synthetic notebook — no goods or real money`, lifetime `10` minutes. Choose **Create synthetic request**.
8. Return to the buyer profile and choose **Refresh requests**. Independently read the exact merchant name/ID, **1.00 USD**, description, buyer, revision and expiry. The merchant identity is unverified. You do not need a secret invite or helper cookie: the inbox is filtered by your authenticated account on the server.
9. Check the review statement and select **Approve this synthetic request with my passkey**. Complete the native authenticator prompt using the same enrolled phone-backed credential for the phone test. Expect status **approved** and **Consent approved for these exact details. No payment was authorized or made.** Refresh the helper profile and confirm it sees the same status.
10. In the buyer profile select **Consume consent once (local test only)**. Expect **consumed**, with no payment. The consume control disappears. Automated tests verify direct repeat requests also fail; hiding the control is not the replay protection.
11. Create a second request and select **Reject this request** as buyer. It becomes **rejected** without requiring a passkey. On another approved request, use **Withdraw consent** before consumption; it becomes **withdrawn** and cannot be consumed.
12. For revision behavior, approve a fresh request without consuming it. In the helper profile choose **Revise request (invalidates consent)**, change amount to `2.00`, then **Save revision and invalidate consent**. Buyer refresh must show **pending**, revision incremented, **2.00 USD**, and require a new passkey ceremony. Repeat with merchant and currency. Buyer reassignment is blocked server-side as well as disabled in the edit form.
13. Stale-review tampering check: leave a fresh pending request visible in the buyer profile, with its review statement checked. In the helper profile revise its amount using **Revise request (invalidates consent)** and **Save revision and invalidate consent**. Without refreshing the buyer page, choose **Approve this synthetic request with my passkey**. Expect **Details changed. Refresh and review the whole request again.** No approval must be recorded. Refresh and independently review the revised amount. Repeat separately for merchant ID, displayed name and currency. Do not edit the database or weaken verification.
14. Expiry: create a separate request with **Request lifetime in minutes (1–30)** set to `1`. Leave it pending past its displayed **Expires** time. Choose **Refresh requests** in the buyer profile; expect **expired**, no approval control and **This request expired. It cannot be approved or consumed.** Also approve a separate one-minute request promptly, leave it unconsumed past expiry, refresh and confirm it cannot be consumed. Challenge expiry (at most two minutes) is tested automatically; if a native prompt stays open past expiry during a manual attempt, completion must not approve it. Record the actual message; do not assume the device allows that timing.
15. Replay UI check: after step 10, refresh both profiles and reopen the buyer page. The same request must remain **consumed** with no consume control. This checks persisted UI state only. Direct replay of a captured assertion and repeated consume API calls are covered by the automated suite, not proved by a hidden button. Do not copy real assertions or credentials into chat.
16. Refresh the buyer page and restart the server using Ctrl+C then `npm start` in its terminal. The same database, enrollment, sessions (up to 30 minutes), requests and consumed states must remain. Do not delete `.local/` to retry a failed ceremony.
17. Optional second buyer: in an independent third profile, sign in as **buyer-b**, enroll a different personal passkey, and create a helper request specifically for buyer-b. It must not see buyer-a's requests. Approve its own request. Separate profiles prove session isolation; independent humans/device ownership still need observation.

Report only: OS/browser, authenticator type (platform/security key/hybrid), whether registration and approval completed, exact visible status, and whether each person operated their own device. Do not send passwords, credential IDs, assertions or biometric information. Use your normal screen reader/keyboard if available; report any blocker separately.

If the browser reports no authenticator, use a supported OS/browser passkey provider or user-verifying FIDO2 security key. We do not reduce user-verification requirements or fabricate a passkey success. Linux browser/provider support varies. A phone scanned from desktop is a separate hybrid authenticator flow; success does not prove independent review happened on the phone.

## Automated virtual-authenticator checks

```sh
npm run check
npm test
npm audit --omit=dev
```

Tests launch installed Google Chrome through Playwright (`channel: chrome`), create isolated browser contexts and use **CDP virtual CTAP2 authenticators**. SimpleWebAuthn generates/verifies real protocol messages and signatures; the verifier is not mocked. These tests are not physical authenticator evidence. They use a separate temporary SQLite database and local-only network routing. Results are written to `evidence/security-results.json`. See [PASSKEY-EXPERIMENT.md](PASSKEY-EXPERIMENT.md) for actual outcomes and gaps.

## Synthetic requests and actual PayPal operations

All requests created here are synthetic local records, including records marked approved or consumed. The prototype cannot charge a PayPal account. No actual PayPal order creation, payment approval, capture, refund or Live operation is implemented or permitted in this test. Synthetic results do not qualify a PayPal integration.

## Cross-device HTTPS requirements

The current executable intentionally binds **127.0.0.1:3100 only**. A phone's `localhost` is the phone, not this computer. Opening `http://<computer-LAN-IP>:3100` will neither reach this listener nor provide the required trusted secure context. No LAN listener, tunnel or deployment is enabled. A native phone-backed hybrid ceremony may work while the buyer browser stays on this computer at localhost; it does not make the review page reachable on the phone or prove independent phone review. Availability must be tested on the actual browser/provider.

A future local cross-device setup needs a stable DNS hostname, HTTPS certificate trusted by **both** devices, exact server-configured HTTPS origin, valid RP ID equal to that hostname (no scheme/port), Secure cookies and explicit matching Host/Origin checks. Existing localhost credentials do not transfer to another RP ID: use a separately provisioned experiment store and re-enroll independently. Do not disable certificate checks, use insecure-origin browser flags, trust forwarded headers blindly, or change RP configuration against the same credential store. This setup is documented, not implemented or tested here.

## Security scope

Provisioning fixes helper/buyer roles and issues separate random bootstrap secrets. Buyer passkeys are one per buyer; there is no recovery/replacement or role/ownership-change endpoint. Protect the buyer's secret before first enrollment. A compromised bootstrap, local administrator, shared authenticator unlock, synced passkey account or malicious server can undermine ownership. Passkeys authenticate credential control and user verification; they do not prove real-world identity or understanding of the signed purchase. The generic browser prompt does not independently display or attest the transaction wording.

Session cookies are HttpOnly and SameSite Strict; Secure is unavailable on this plain-HTTP localhost configuration. Cookies are stored hashed in SQLite, rotated on login and checked with expiry. Mutations require same origin and session CSRF token. Never expose this localhost research server to an untrusted network. `.local/`, dependencies, private keys and secrets are ignored by Git. The buyer app sends no transaction data to Groq or PayPal; an explicit evaluation script sends fixed synthetic questions to Groq. Browser/OS speech voices may use their own services; no biometric samples are requested or stored. WebAuthn passes public credential/assertion data and verification flags.


## Accessible buyer review milestone — 9 November 2026

The physical Chrome/phone passkey test is now recorded as **user-reported manual evidence**: separate sessions, enrollment, synthetic Example Store 1.00 USD review, phone screen-lock PIN authentication, approval and one consumption ending in `consumed`. This is not a fresh automated test or independent production audit. See [milestone evidence, phone blocker, PayPal plan and AI evaluation](docs/MILESTONE.md).

To try the new experience on this already-provisioned checkout:

1. If an older server is running, stop it with Ctrl+C in its terminal, then run `npm start`. Do not rerun setup or delete `.local/`.
2. Open **http://localhost:3100** in separate Helper and Buyer profiles. Retrieve your own secret privately with `npm run account -- helper` or `npm run account -- buyer-a`. Reuse buyer-a's enrolled passkey; do not register again.
3. As Helper create a synthetic request for buyer-a: merchant `SYNTH-SHOP-1`, name `Example Store`, amount `1.00`, currency `USD`, description `Synthetic notebook — no real money`, lifetime `10` minutes.
4. As Buyer select **Refresh requests**. Confirm amount, currency, merchant reference/name, description, expiry, revision and the synthetic/unverified notice. Select **Read payment details aloud**; try **Pause audio**, **Resume audio**, **Stop audio**. No action approves automatically. Try **Questions about these details** for ordinary grounded answers.
5. Use Tab/Shift+Tab, Enter and Space to navigate. First use **Decline / Reject this request** on a throwaway request. Create another, review it, check the confirmation and explicitly choose **Approve this synthetic request with my passkey**. Complete your existing native phone-assisted authenticator flow. Approval is local consent only.
6. Optionally consume once using the local test control. Try the existing revision/expiry procedures above: stale details must be refused. With a one-minute request, expiry disables consent controls without approving anything. Listening remains available for historical details.
7. Test browser zoom and a narrow window; then your actual screen reader. Report voice pronunciation, pause behavior, focus and any misunderstanding. Direct phone-browser review is blocked pending a separate reviewed HTTPS environment and fresh enrollment for that domain.

The app displays ordinary help, not live AI chat. A fresh six-question synthetic Groq evaluation selected 6/6 expected categories, but no incremental comprehension benefit was demonstrated. An explicit optional rerun is `node scripts/evaluate-comprehension.mjs`; it requires the existing private Groq configuration and sends only fixed synthetic questions. Automated tests never call Groq or PayPal.


Milestone verification: **39/39 automated tests passed**, including every original security test; syntax/source-size checks and production dependency audit passed (zero vulnerabilities). Actual audio and intended-user screen-reader testing remain manual gates. Full changed-file inventory and limitations are in [the milestone report](docs/MILESTONE.md#final-verification-and-file-inventory).
