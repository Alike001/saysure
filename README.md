# SaySure

**Your money. Your final say.**

Getting help with a digital payment should not mean giving someone else the final say. People who need assistance completing payments, including people who cannot comfortably operate conventional payment interfaces, still need a way to review the details and decide for themselves.

SaySure separates the **Helper**, who prepares a request, from the **Buyer**, who independently reviews the exact amount, currency, merchant reference and description. Readable details, optional speech and grounded questions support that review. Only the Buyer can record passkey-backed local consent; changing reviewed details invalidates it. The Buyer can decline without a passkey.

This is a localhost prototype for exploring that separation. It does not execute payments. Accessibility, comprehension benefits and suitability for intended users have not been established through user research; passkey authentication proves credential control and required user verification, not understanding of a purchase.

## HOW TO TEST — judge quick start

Requires **Node.js 24+ and npm**. Run from the repository directory:

```sh
npm ci --ignore-scripts
npm run demo
```

Open **http://localhost:3200**. This is an **isolated synthetic demonstration**. No PayPal account, credentials, passkey or live AI service is required. Select Synthetic request or **MOCK PayPal order**, try quantity changes and decline, then simulate approval and single consumption. Mock PayPal evidence remains visibly labelled. Simulated consumption changes browser fixture state only; it is not a PayPal payment. No real payment occurs and the demo never reads the authenticated app's private store.

The demo also includes an **AI-assisted question** control. To enable live Groq classification, supply your own `GROQ_API_KEY` privately in the environment or an ignored `.env`, or run `npm run configure:ai` if a key is already available in the existing local configuration. Never include a key in a video, issue or commit. Without a key, the control uses local deterministic matching. The model receives only a best-effort redacted question string, not the transaction snapshot or order data, and returns a fixed topic; SaySure generates the explanation locally. Do not include personal, merchant or payment details in questions. Redaction is best-effort, not a guarantee. See [AI question-routing boundary](docs/AI-QUESTION-ROUTING.md).

## Hosted staging entry point

The PostgreSQL-backed staging service opens the SaySure product landing page at **https://saysure-staging-cnhm.onrender.com/**. Visitors can choose the no-login synthetic walkthrough or open the protected workspace at **https://saysure-staging-cnhm.onrender.com/app**. Workspace accounts remain provisioned by the project owner; do not publish account secrets. The separate public walkthrough at https://saysure-public-demo.onrender.com is simulation-only and does not exercise the authenticated backend.

## Public interactive demo — Design 8 deployment

A new **navy, electric-blue and white** judge experience is prepared on branch `feat/design8-hosted-demo`. It includes an interactive transaction preview, grounded explanation flow, simulated decisions and the optional Groq-assisted free-text question feature. The authenticated Buyer/Helper app shares the updated palette, while retaining its separate protected localhost-only WebAuthn workflows.

The public service has a deliberately isolated start command: `npm run start:public-demo`. It does **not** expose the protected application, open local SQLite data, execute PayPal APIs or perform actual passkey ceremonies. **Live public walkthrough:** https://saysure-public-demo.onrender.com (Render Free, Frankfurt). The hosted build passed its source checks and 2/2 dedicated isolation/origin smoke tests. The public deployment currently uses deterministic local question matching; live Groq classification is not configured on Render yet. See [Render deployment and safety boundary](docs/PUBLIC-DEMO-DEPLOYMENT.md).

**Release verification still required:** the previous 206/206 passing tests predate the visual redesign. Run `npm run check && npm test && npm run audit:release && npm run test:release` after checking out this branch and before merging. Once the public service is live, separately verify the AI result indicates `AI matched your question` with a privately configured Groq key.

## Automated verification

**Latest local verification (November 11, 2026): 206/206 automated tests passed on merged `master`, with no failures or skips; `npm run check` also passed.** These results were run on the contributor's local Linux machine; remote CI and cross-platform accessibility certification are not established. The following earlier checkpoints remain historical.

Install **Google Chrome** separately; the tests launch its `chrome` channel through Playwright. With dependencies installed:

```sh
npm run check
npm test
npm run test:release
npm run audit:release
```

The approved security baseline is commit **22c116be7f0a88843a50d6ff3f5cf6464c152177**, with final independent security approval and **186/186 tests passed**. Phase A verification passed **196/196 tests**, including all 186 baseline cases plus 10 new release-tooling tests. These uncommitted release changes do not extend the earlier independent security approval. Protocol tests use temporary synthetic accounts, virtual CTAP2 authenticators, labelled mock provider transports and the real WebAuthn verifier. No operator accounts or real passkeys are used. The test preload is a best-effort JavaScript network guard, not an OS firewall.

The release-readiness audit verified a fresh local clone on the existing **Linux environment, Node 24.14.1, npm 11.13.0 and installed Google Chrome**: dependency installation, 186 tests, syntax checks, both servers and Helper/Buyer/demo screens passed. It reused host tools, system libraries and the npm cache. Other operating systems and a blank-machine installation have not been verified. No `.env` is needed for the demo, tests or default synthetic application.

`npm audit --omit=dev` optionally checks production dependency advisories using the npm registry; it is a networked dependency check, not an offline application-security audit.

## Authenticated local application — separate from the demo

For a **fresh, unprovisioned checkout only**, after installing dependencies:

```sh
npm run setup
npm start
```

Open **http://localhost:3100/app** exactly for the authenticated workspace. The product landing page is at `http://localhost:3100/`; the no-login synthetic walkthrough is at `http://localhost:3200`. The listener is loopback-only; expected origin remains `http://localhost:3100` and RP ID is `localhost`. Do not substitute a LAN address, `127.0.0.1` in the browser, or a different port. If the port is occupied, identify and stop the conflicting process before using this checkout.

Setup creates separate Helper, buyer-a and buyer-b accounts in ignored private storage. Retrieve each account's secret in a private interactive terminal with `npm run account -- helper` or `npm run account -- buyer-a`. Use separate browser profiles: the Helper creates a synthetic request; the Buyer refreshes their inbox, reviews exact details, and chooses decline or explicit passkey consent. Optional local consumption is single-use and does not move money. A manual passkey test requires the Buyer's own supported authenticator; the detailed procedure follows below.

**Existing provisioned checkouts:** run `npm start` and reuse their accounts/enrollment. Do not rerun setup, delete `.local/`, or replace a credential. PayPal reads remain **disabled by default**. Enabling sandbox reads requires private SaySure configuration, a confirmed payee, allowlisted current orders and separately authorized operations; see [config/sandbox.example](config/sandbox.example). Judge testing does not require enabling them.

## Non-destructive release scan

Git is required for the release scan. `npm run audit:release` prints a JSON report to stdout and writes no file by default. It scans tracked and nonignored untracked source files and Git history; exact private-value comparisons use only this repository's optional `.env`, local account secrets and process environment. It does not read sibling repositories or private order evidence. A clean clone can run it without private configuration. Findings return exit status 1; a pass cannot establish absence of unknown secrets, PII or rights issues.

For an optional report, supply an **untracked** output path whose parent directory exists:

```sh
npm run audit:release -- --output /tmp/saysure-release-report.json
```

Existing files are refused unless `--overwrite` is explicitly added. Tracked files (including historical evidence), private input filenames and linked output files remain protected even with that flag. Reports contain counts, safe findings and limitations, never credential values. To capture JSON without npm's command banner, use `npm run --silent audit:release`.

## Current scope and evidence

The implementation supports synthetic consent and server-authenticated fixed-endpoint PayPal sandbox observations, with provenance bound into `paypal-consent-v2`. Injected provider fixtures remain mock. The guided fixture demo and authenticated buyer interface now offer optional server-side Groq topic routing, with deterministic answers and local fallback when unconfigured. Historical Groq evaluations are separate from authenticated PayPal order evidence. API payee evidence does not independently establish shop identity or PayPal payer ownership. See the [API reference](docs/API.md), [architecture/security record](PASSKEY-EXPERIMENT.md) and [consumption corrections](docs/CONSUMPTION-CORRECTIONS.md).

Historical sandbox create/read observations and user-reported synthetic phone-assisted consent do not establish current provider availability, successful historical PayPal-order consumption, completed checkout or improved comprehension. **Historical PayPal-order consumption remains unconfirmed.** The old attended reservation is used and its instructions are historical: never reuse its authorization or execution marker. No new provider operation is authorized. MIT licensing and ownership of the original SaySure code and assets are owner-confirmed. The source repository is public; hosted deployment, demo recording and hackathon submission remain separate gates. See [release preparation](docs/FINAL-SUBMISSION.md) for the earlier preparation record and the [License section](#license) for current licensing.

SaySure is a working name without trademark/domain clearance. This is not a production-ready service or a claim of universal accessibility.

## Real passkey: manual procedure

1. Use **two separate browser profiles or different browsers**, one for the helper and one for the buyer. Two tabs share a cookie and are not two identities. Optional buyer-b testing requires a third profile/browser or signing out and signing into that separate account. Never use an automated virtual authenticator for this manual test.
2. In your private terminal, run `npm run account -- buyer-a`. It displays only buyer-a's local username and secret and refuses noninteractive output. Keep the secret out of chat/logs/screenshots. The local machine administrator can read all bootstrap secrets; that is an explicit trust assumption.
3. In the buyer profile, sign into `http://localhost:3100/app` as **buyer-a** using that secret. Confirm the page says `Signed in as buyer-a. Server-assigned role: buyer.`
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

Tests launch installed Google Chrome through Playwright (`channel: chrome`), create isolated browser contexts and use **CDP virtual CTAP2 authenticators**. SimpleWebAuthn generates/verifies real protocol messages and signatures; the verifier is not mocked. These tests are not physical authenticator evidence. They use a separate temporary SQLite database and local-only network routing. New test results are written only inside the temporary test directory and removed on cleanup; the historical `evidence/security-results.json` is preserved. See [PASSKEY-EXPERIMENT.md](PASSKEY-EXPERIMENT.md) for actual outcomes and gaps.

## Synthetic requests and actual PayPal operations

Synthetic and PayPal-backed requests are distinct. Approved/consumed are local consent states, never proof of PayPal approval or payment completion. Enabled PayPal reads require private sandbox credentials, a confirmed expected merchant ID and operator-allowlisted current orders. There is no payment API route. A separate creation adapter is disabled by default and must not be executed without new approval. One controlled sandbox create/read was performed; its order has since exceeded the local policy window. No capture, refund, payment authorization or Live operation was performed. Any future provider operation requires a new separately reviewed authorization; the historical attended reservation cannot be reused. Historical unavailable/expired-local-window orders are not current evidence.

## Cross-device HTTPS requirements

The current executable intentionally binds **127.0.0.1:3100 only**. A phone's `localhost` is the phone, not this computer. Opening `http://<computer-LAN-IP>:3100` will neither reach this listener nor provide the required trusted secure context. No LAN listener, tunnel or deployment is enabled. A native phone-backed hybrid ceremony may work while the buyer browser stays on this computer at localhost; it does not make the review page reachable on the phone or prove independent phone review. Availability must be tested on the actual browser/provider.

A future local cross-device setup needs a stable DNS hostname, HTTPS certificate trusted by **both** devices, exact server-configured HTTPS origin, valid RP ID equal to that hostname (no scheme/port), Secure cookies and explicit matching Host/Origin checks. Existing localhost credentials do not transfer to another RP ID: use a separately provisioned experiment store and re-enroll independently. Do not disable certificate checks, use insecure-origin browser flags, trust forwarded headers blindly, or change RP configuration against the same credential store. This setup is documented, not implemented or tested here.

## Security scope

Provisioning fixes helper/buyer roles and issues separate random bootstrap secrets. Buyer passkeys are one per buyer; there is no recovery/replacement or role/ownership-change endpoint. Protect the buyer's secret before first enrollment. A compromised bootstrap, local administrator, shared authenticator unlock, synced passkey account or malicious server can undermine ownership. Passkeys authenticate credential control and user verification; they do not prove real-world identity or understanding of the signed purchase. The generic browser prompt does not independently display or attest the transaction wording.

Session cookies are HttpOnly and SameSite Strict; Secure is unavailable on this plain-HTTP localhost configuration. Cookies are stored hashed in SQLite, rotated on login and checked with expiry. Mutations require same origin and session CSRF token. Never expose this localhost research server to an untrusted network. `.local/`, dependencies, private keys and secrets are ignored by Git. The browser communicates only with this localhost backend. When explicitly configured, the backend sends allowlisted order IDs to the sandbox Orders API; raw payer information is omitted from storage/UI. The optional buyer-question feature sends only a best-effort redacted question to Groq for fixed-topic classification; it does not attach a transaction snapshot, and deterministic local code supplies the answer. The feature has a local fallback when the key is absent or the provider fails. No question is persisted. See [AI question-routing boundary](docs/AI-QUESTION-ROUTING.md). Browser/OS speech voices may use their own services; no biometric samples are requested or stored. WebAuthn passes public credential/assertion data and verification flags.


## Historical experiments and milestones

These dated observations preserve the original results and limitations. They are not current operator instructions or grants. The approved security baseline and current testing instructions are above.

### Accessible buyer review milestone — 9 November 2026

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


## Milestone 3 — historical PayPal integration checkpoint

[Full integration report, exact browser procedure, operator gate and submission checklist](docs/PAYPAL-INTEGRATION-MILESTONE.md).

- Real sandbox OAuth: HTTP 200. No current order is configured, so **no genuine order GET or order-bound checkout success is claimed**.
- Backend OAuth/GET, payee/order allowlisting, exact multi-purchase-unit totals, distinct canonical PayPal consent binding, approval/consumption revalidation and refusal-preserving revisions are implemented and mock-tested.
- Existing localhost credentials remain intact. A private `.env` can be prepared from [config/sandbox.example](config/sandbox.example). Keep reads disabled until the operator confirms the merchant and current order allowlist. No environment flag enables order creation.
- Run `npm run check` and `npm test` for local validation; `npm audit --omit=dev` is a separate registry check. Focused provider/browser checks: `node --test test/paypal-client.test.mjs test/paypal-flow.test.mjs` (explicitly mocked provider transport, real verifier).
- An explicit read-only real probe is `node scripts/paypal-readiness.mjs` with private SaySure configuration; it authenticates, and GETs only a separately configured current allowlisted order. Never use the historical 404 order as current evidence.
- The item-question AI experiment covers unfamiliar terms and expected-versus-recorded items. It included all required grounded references in 6/6 cases, but matched exact requested focus in only 3/6. Ordinary help already contained the same facts; usefulness remains unproven. No real provider data is sent to AI.
- At that historical checkpoint a separately approved sandbox test was proposed. That proposal is superseded by the used attended reservation and is not a current next action. License choice, judge materials and any later publication remain release gates.

Milestone 3 verification: **55/55 tests passed**, including all previous 39. Syntax/size checks passed and production dependency audit reported zero vulnerabilities. Real API evidence is OAuth only; genuine current-order GET remains blocked.


## Submission-readiness checkpoint

The historical [submission pack](docs/SUBMISSION-READINESS.md) distinguishes genuine OAuth evidence from fixture demonstrations, documents the license decision and remaining release gates, and supplies a credential-free judge setup. The [controlled sandbox preflight](docs/SANDBOX-OPERATOR-APPROVAL.md) matched the full private client fingerprint to the historical app record. The operator confirmed the Sandbox PayTale app/NG Business association; receiving eligibility remains unverified. The operator subsequently authorized and completed the reserved one-time sandbox create/read workflow. Its private permanent execution marker prevents reuse; transaction evidence remains ignored. No retry or further order/read is authorized. Real order-bound passkey consent still requires separately authorized revalidation reads. No payment execution route is enabled.

The revised fixed-question AI evaluation matched 17/17 intended topics versus 13/17 ordinary keyword routes; it resolved the original three irrelevant-definition selections. This demonstrates bounded paraphrase routing, not proven human comprehension or completed payments. The fixture demo retains deterministic fixed-question answers and ordinary browser speech; its separate free-text question control optionally uses server-side Groq topic routing when configured, with deterministic local fallback otherwise.

Historical readiness acceptance: **59/59 tests passed** (baseline 55), with the registered credential and saved consent record unchanged. See [the final acceptance evidence](docs/SUBMISSION-READINESS.md#final-acceptance-evidence). The optional AI buyer-question feature is now on public branch feat/buyer-ai-question-routing and awaits local verification/review before merge. License choice, current merchant/app confirmation, new sandbox creation authorization, genuine current GET, final release merge/deployment and demo-video recording remain separate gates.

The [real order-bound consent milestone](docs/REAL-ORDER-CONSENT.md) and [attended-test archive](docs/ATTENDED-FINAL-TEST.md) retain historical preparation records. Both old orders/grants are NO-GO for reuse. Do not run their preflight or execution instructions as a next release step. The attended attempt has execution/result records, and historical consumption remains unconfirmed; the later security corrections do not repair that historical outcome.

## License

The original SaySure code and assets are licensed under the [MIT License](LICENSE).

Copyright (c) 2026 Hammed Ali Oyeleye

Third-party dependencies retain their respective licenses and copyright notices. SaySure's MIT license does not relicense those dependencies; their license terms and required notices continue to apply.
