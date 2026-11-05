# Isolated synthetic consent passkey experiment

This standalone repository tests additional transaction-specific consent. It has no PayPal/Groq integration, payment credentials, real money or final product branding. All requests and merchant identities are synthetic and unverified.

# How to Test

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
4. Select **Register my passkey**. Complete your browser/OS authenticator prompt yourself. A biometric, device unlock or security-key PIN may be handled by your authenticator; **never enter a card PIN into this app**. Choose your own authenticator, not the helper's. User verification is required. Canceling or lacking a suitable authenticator must leave the account unenrolled.
5. Expect **Your passkey was registered to this buyer account. No payment was approved.** Replacement enrollment is disabled. Do not register buyer-a on the helper's device. Do not use a shared OS passkey store if testing independent ownership.
6. In a private terminal run `npm run account -- helper`. In the helper profile sign in as **helper** with only that account's secret. Confirm server-assigned helper role. The helper must see no passkey-registration or buyer-approval controls.
7. Prepare a request for **buyer-a**: merchant ID `SYNTH-SHOP-1`, displayed name `Synthetic shop`, currency `USD`, amount `1.00`, description `Synthetic notebook — no goods or real money`, lifetime `10` minutes. Choose **Create synthetic request**.
8. Return to the buyer profile and choose **Refresh requests**. Independently read the exact merchant name/ID, **1.00 USD**, description, buyer, revision and expiry. The merchant identity is unverified. You do not need a secret invite or helper cookie: the inbox is filtered by your authenticated account on the server.
9. Check the review statement and select **Approve this synthetic request with my passkey**. Complete the native authenticator prompt. Expect status **approved** and **Consent approved for these exact details. No payment was authorized or made.** Refresh the helper profile and confirm it sees the same status.
10. In the buyer profile select **Consume consent once (local test only)**. Expect **consumed**, with no payment. The consume control disappears. Automated tests verify direct repeat requests also fail; hiding the control is not the replay protection.
11. Create a second request and select **Reject this request** as buyer. It becomes **rejected** without requiring a passkey. On another approved request, use **Withdraw consent** before consumption; it becomes **withdrawn** and cannot be consumed.
12. For revision behavior, approve a fresh request without consuming it. In the helper profile choose **Revise request**, change amount to `2.00`, then **Save revision and invalidate consent**. Buyer refresh must show **pending**, revision incremented, **2.00 USD**, and require a new passkey ceremony. Repeat with merchant and currency. Buyer reassignment is blocked server-side as well as disabled in the edit form.
13. Refresh the buyer page and restart the server using Ctrl+C then `npm start` in its terminal. The same database, enrollment, sessions (up to 30 minutes), requests and consumed states must remain. Do not delete `.local/` to retry a failed ceremony.
14. Optional second buyer: in an independent third profile, sign in as **buyer-b**, enroll a different personal passkey, and create a helper request specifically for buyer-b. It must not see buyer-a's requests. Approve its own request. Separate profiles prove session isolation; independent humans/device ownership still need observation.

Report only: OS/browser, authenticator type (platform/security key/hybrid), whether registration and approval completed, exact visible status, and whether each person operated their own device. Do not send passwords, credential IDs, assertions or biometric information. Use your normal screen reader/keyboard if available; report any blocker separately.

If the browser reports no authenticator, use a supported OS/browser passkey provider or user-verifying FIDO2 security key. We do not reduce user-verification requirements or fabricate a passkey success. Linux browser/provider support varies. A phone scanned from desktop is a separate hybrid authenticator flow; success does not prove independent review happened on the phone.

## Automated checks

```sh
npm run check
npm test
npm audit --omit=dev
```

Tests launch installed Google Chrome through Playwright (`channel: chrome`), create isolated browser contexts and use **CDP virtual CTAP2 authenticators**. SimpleWebAuthn generates/verifies real protocol messages and signatures; the verifier is not mocked. These tests are not physical authenticator evidence. They use a separate temporary SQLite database and local-only network routing. Results are written to `evidence/security-results.json`. See [PASSKEY-EXPERIMENT.md](PASSKEY-EXPERIMENT.md) for actual outcomes and gaps.

## Cross-device HTTPS requirements

The current executable intentionally binds **127.0.0.1:3100 only**. A phone's `localhost` is the phone, not this computer. Opening `http://<computer-LAN-IP>:3100` will neither reach this listener nor provide the required trusted secure context. No LAN listener, tunnel or deployment is enabled.

A future local cross-device setup needs a stable DNS hostname, HTTPS certificate trusted by **both** devices, exact server-configured HTTPS origin, valid RP ID equal to that hostname (no scheme/port), Secure cookies and explicit matching Host/Origin checks. Existing localhost credentials do not transfer to another RP ID: use a separately provisioned experiment store and re-enroll independently. Do not disable certificate checks, use insecure-origin browser flags, trust forwarded headers blindly, or change RP configuration against the same credential store. This setup is documented, not implemented or tested here.

## Security scope

Provisioning fixes helper/buyer roles and issues separate random bootstrap secrets. Buyer passkeys are one per buyer; there is no recovery/replacement or role/ownership-change endpoint. Protect the buyer's secret before first enrollment. A compromised bootstrap, local administrator, shared authenticator unlock, synced passkey account or malicious server can undermine ownership. Passkeys authenticate credential control and user verification; they do not prove real-world identity or understanding of the signed purchase. The generic browser prompt does not independently display or attest the transaction wording.

Session cookies are HttpOnly and SameSite Strict; Secure is unavailable on this plain-HTTP localhost configuration. Cookies are stored hashed in SQLite, rotated on login and checked with expiry. Mutations require same origin and session CSRF token. Never expose this localhost research server to an untrusted network. `.local/`, dependencies, private keys and secrets are ignored by Git. No data is sent to an external service by application code; no biometric samples are requested or stored. WebAuthn passes public credential/assertion data and verification flags.
