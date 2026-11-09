# SaySure — submission preparation

**Latest checkpoint:** A separately authorized one-order sandbox create/read succeeded and is preserved privately. That grant is consumed; order availability is not assumed current. The [real order-bound consent milestone](REAL-ORDER-CONSENT.md) prepares the next bounded read authorization and preserves existing passkeys/security. Real order-bound human consent remains unproved. The earlier results and next-action statements below are historical; no new order is authorized.

Target supplied by the operator: November 12, 2026, 12:00 PM Pacific / 9:00 PM WAT. This is a bounded release-preparation checkpoint, not a submission, deployment or claim of payment completion.

## Accurate product pitch

**SaySure — Your money. Your final say.** SaySure gives a buyer an independent, readable and spoken review of a helper-prepared payment request. The buyer can decline or explicitly record passkey-backed consent for exact server-held details. The localhost security prototype has user-reported physical phone-assisted authentication and automated replay, revision and role-separation checks. A sandbox Orders adapter binds observed PayPal order fields to local consent, but only OAuth has been verified in SaySure against the real service; current-order GET and complete checkout remain open. A constrained AI experiment improves question routing on fixed examples; human comprehension benefit remains unproven.

## Credential-free judge setup

```sh
npm ci --ignore-scripts
npm run demo
```

Open **http://localhost:3200**. Node 24+ required; no setup, login, PayPal/Groq account, database or passkey enrollment is needed. The demo is a standalone static fixture viewer, isolated from the real localhost:3100 app. It sets no cookies and reads no private configuration/store. It never calls WebAuthn, AI or PayPal. Financial fields are deterministic fixtures; all consent controls say **Simulate**. They do not exercise server security or prove real approval. Changing quantity visibly invalidates simulated consent; consumption can be simulated only once; decline cannot be overridden within that fixture. Resetting a fixture resets only browser memory.

Use the six question choices to show deterministic grounded answers and ordinary on-demand speech. The demo contains no live AI call; the recorded Groq routing evaluation is separate. Hosted or recorded demo screenshots must retain the fixture banner. Do not call a mock fixture a real PayPal response. The ordinary app remains at http://localhost:3100 with its existing accounts/passkeys intact; do not rerun setup there.

For actual verification, install Google Chrome and run `npm run check`, `npm test`, `npm audit --omit=dev`, and `npm run audit:release`. Browser tests use separate temporary accounts/databases, mocked provider transport and virtual authenticators with the real signature verifier. This is a reproducible alternative to sharing the operator's account secrets. For an independent real-device test, judges can provision their own fresh checkout and passkey using README instructions; never distribute the operator's private `.local/` folder. A judge without a supported authenticator can still inspect fixtures and run Chrome protocol tests, but cannot claim a physical passkey result.

## Three-minute demonstration outline (aim for 2:50)

| Time | What to show / say |
| --- | --- |
| 0:00–0:20 | SaySure and buyer control: “Your money. Your final say.” State that the screen is a deterministic fixture demo, not completed payment |
| 0:20–0:55 | Synthetic review: visible amount/currency, unverified helper merchant, quantity mismatch; read aloud and stop. State that voices are browser/OS-dependent |
| 0:55–1:25 | Buyer questions: why the total differs, item list, merchant source and payment status. Show the answer's supported facts and explicit unknowns. Note no model is called in this demo |
| 1:25–1:50 | Simulate decline; reset and simulate consent, change quantity to invalidate it, then simulate single consumption. Keep “simulated” wording visible |
| 1:50–2:20 | Brief actual localhost:3100 evidence, if operator can record safely: already signed-in buyer reviews a synthetic request and explicitly uses the existing phone passkey. Hide all login secrets/native QR/account details. Otherwise show the test counts and label them automated/virtual; never replace physical proof with simulation |
| 2:20–2:40 | MOCK PayPal view: no authenticated response claim. Show saved genuine OAuth HTTP 200 and explain that current GET / buyer approval remain blocked pending controlled authorization |
| 2:40–2:50 | State limitations and next gate: one separately authorized 1.00 USD sandbox create/GET, no capture. Close on independent buyer review |

No video has been recorded or rendered by this task. Keep the final clip below any applicable submission limit; the outline deliberately leaves ten seconds of margin. Do not display `.env`, secrets, tokens, credential IDs/assertions, private account records or native pairing details in recordings.

## AI before / after

The previous six-question experiment selected all relevant grounded references, but three outputs added irrelevant A5/ruled definitions: `mock-quantity`, `mock-extra`, `synthetic-missing`. This was a relevance failure, not three invented monetary values.

The old selection validator now permits glossary terms only if requested by the question. The new question router can choose only one of nine answer types; it cannot supply prose, facts, amounts or action instructions. Deterministic answers separately explain totals/expected quantities, item lists, helper-supplied merchant names, identity uncertainty, payment status, refusal, simpler language, definitions and stale evidence. Refusal/freshness boundaries are inserted regardless of selected topic. Unknown merchant identity and fees remain unknown. Historical/expired evidence is never described as payable.

Fresh real Groq evaluation: **17/17 topic matches**, including **6/6** original questions; ordinary keyword routing **13/17**. Four additional paraphrases were routed correctly by Groq (“jump in the bill”, “things on this list”, “business I had in mind”, “funds move out of my wallet”). A merchant-reference mismatch case is included. Both approaches render the same deterministic answers and all structured information remains available without AI. The old and new output contracts differ; the six-case improvement also reflects reduced output freedom, not a universal model-accuracy claim.

**Demonstrated added value:** question routing on four researcher-authored paraphrases that this ordinary keyword baseline missed. **Not demonstrated:** better human comprehension, safer decisions, task completion, screen-reader usability or incremental supported facts. These are fixed, non-blind examples, not a user study or a broad generalization benchmark. The demo therefore keeps ordinary help/speech. [`readiness-ai-evaluation.json`](../evidence/readiness-ai-evaluation.json) records the actual provider run, latency and all rendered answers. No real order/buyer data or credentials were sent in its prompt. One Groq call was made in this checkpoint; no PayPal calls were made.

## License decision — operator approval pending

**Recommendation: MIT** for SaySure's original source, subject to confirming the copyright holder and the operator's explicit choice. The [OSI MIT license](https://opensource.org/license/mit) permits broad reuse subject to retaining its notice and includes a warranty disclaimer. This is a recommendation, not a license grant. No LICENSE is installed until approval. Apache-2.0 remains an alternative if the operator prefers its terms; do not select it by assumption.

Installed direct dependency metadata: SimpleWebAuthn server/browser MIT, Playwright Apache-2.0, axe Playwright MPL-2.0. Third-party licenses/notices remain their own; adopting MIT for original code does not relicense dependencies. These four metadata observations are not a complete transitive/IP audit. The operator must confirm authorship and license choice before publication. A choice was requested during this task; absent an explicit answer, this blocker remains open.

## Public release safety

`npm run audit:release` scans tracked current files and Git history blobs against the exact configured PayPal/Groq/bootstrap secret values privately, rejects private artifact paths and checks private key markers. It reports locations/reasons only, never matching values. New ignores cover HAR, SQLite/database files and traces. `.env`, `.local/`, key files, dependency folders and browser reports remain ignored. The scan must be rerun after staging all final files so new files are included.

This audit cannot certify unknown/unconfigured secrets, all PII, legal rights or every dependency. Public merchant/order references in historical documentation are evidence identifiers, not login credentials; review whether to redact them before wider distribution. No operator token, password, private key, saved passkey or real account credential may be published. If a genuine secret is ever found in Git history, stop and rotate/rewrite under a separate reviewed action; a current-file deletion is insufficient.

## Hosting / HTTPS / judge access

No repository was created remotely, no push or deployment occurred, and no public URL is claimed. The current source has no configured remote. A public repo with an operator-approved license, final demo video/link and tested fresh-clone instructions remain release gates. Local instructions and tests do not prove competition acceptance; verify the final submission form and eligibility separately with the operator.

The standalone fixture demo could later be served as static assets, with its banner intact, after explicit hosting authorization. It would still be a fixture demo, not hosted PayPal consent. The actual app is **localhost-only**, with fixed Host/Origin and RP ID `localhost`. Hosted real consent needs reviewed access control/rate limits, secure secret/account distribution, HTTPS/trusted certificate, exact origin/RP checks, Secure cookies, private stores and redacted logging. Current code refuses non-localhost origins; changing configuration alone is not a supported deployment path.

Use a separate credential store, accounts and enrollment for the final HTTPS domain. Do not copy existing localhost credentials into a new domain, change the RP against the same database, disable certificate checks, tunnel the private app, or treat LAN HTTP as a secure WebAuthn origin. Direct Android/iPhone browser review remains untested. Existing phone-assisted desktop authentication is preserved and is not direct phone-browser testing.

## Remaining security / accessibility limits

- Passkeys prove credential control and required local user verification, not real-world identity, PayPal payer ownership or human understanding. The generic authenticator prompt does not independently display the transaction.
- A compromised helper's financial fields are synthetic/unverified; actual API fields must come from server reads. A compromised server/admin can undermine the model. A remote order may change after GET; consent does not freeze it or prevent external merchant actions.
- Recovery, production account provisioning, internet security, actual capture/refund/authorization and guaranteed receiving eligibility are out of scope.
- Chrome keyboard, axe and responsive checks are automated evidence. Actual speech audio, TalkBack/VoiceOver, intended-user comprehension and direct mobile browser compatibility remain manual gates. Only English summaries are supplied; voice pronunciation/privacy depend on browser/OS.

## Release decision and next action

**GO:** record an honest local fixture + existing synthetic-passkey demonstration, complete the public-ready documentation and choose a license. **NO-GO:** executing sandbox creation, claiming current GET/payment success, public publishing or deployment without the explicit gates.

The highest-impact next action is operator confirmation of the intended Sandbox REST app/merchant and legitimate account capability, followed by the tightly scoped approval in [the operator sheet](SANDBOX-OPERATOR-APPROVAL.md). This can turn prepared code into a genuine new order/GET observation. While that is pending, record the short truthful demo and settle the license; do not spend the remaining deadline window adding payment features.

## Final acceptance evidence

Baseline **55/55**, final **59/59** automated tests passed, zero failures/skips. Existing protocol, role, replay/concurrency, API-failure, buyer keyboard/axe and mobile-layout checks are retained; new coverage rejects the three old glossary failures, checks grounded answers/injections and tests the standalone fixture journey with zero account/API/WebAuthn calls. Syntax/size checks passed (existing 208-line advisory); production dependency audit reported zero vulnerabilities; whitespace checks passed. A 390px fixture demo screenshot was inspected locally, not presented as API or physical audio evidence.

A read-only before/after fingerprint of the actual local credential and request records matched (one registered credential and one saved request); no RP/origin/passkey/store setting was changed. PayTale's source/config/records were read only, with its prior HEAD and untracked research unchanged. Saved experiment evidence is retained; the automated security artifact records this run separately from user-reported physical evidence. No PayPal request, order creation, remote repo, push, deployment or video creation occurred.

[Verification record](../evidence/submission-readiness-verification.json) · [release scan](../evidence/release-audit.json) · [preflight](../evidence/sandbox-preflight.json). The release scan is limited as described above; a passing scan does not remove the pending license/merchant/authorization/publication gates.
