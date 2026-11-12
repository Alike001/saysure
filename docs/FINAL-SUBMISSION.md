# SaySure — minimal submission preparation

**Your money. Your final say.** This document began as the 10 November release-preparation record; its historical gates and checkpoints are preserved below. On 11 November, optional AI-assisted buyer-question routing was merged into the public `master` branch as PR #1. Local verification on merged `master` passed 206/206 automated tests, and the Groq question was answered in the local demo. No hosted deployment or Devpost submission is established by this document. The AI feature does not authorize PayPal order creation, capture, payment execution, new accounts or a public deployment. The old attended attempt is historical and must not be rerun. Verify the actual submission form cutoff/timezone rather than relying on an earlier converted deadline.

Final independent security approval covers commit **22c116be7f0a88843a50d6ff3f5cf6464c152177** (`22c116b`), with **186/186 tests passed** and no outstanding security findings. This approves the local prototype, not payment completion, comprehension, deployment or publication.

The subsequent release-readiness audit verified a temporary fresh local clone on the existing Linux host: Node 24.14.1, npm 11.13.0, installed Google Chrome/system libraries and the host npm cache. Dependency installation, 186 tests, syntax checks, default synthetic app startup, Helper/Buyer screens and the isolated demo passed without private configuration. Production-only and full dependency audits reported zero known vulnerabilities at that check. This is not cross-platform or blank-machine verification.

## Release preparation Phase A — 10 November 2026

At the Phase A checkpoint, documentation and release tooling were implemented but remained unstaged/uncommitted for review. The application/security source, frontend, configuration, lockfile and package license metadata were unchanged from `22c116b`. No LICENSE had been installed at that checkpoint; the subsequent approved licensing preparation is recorded below.

Verification: **196/196 tests passed**, preserving all 186 approved regression cases and adding 10 release-audit tests. Syntax and whitespace checks passed (only the existing 208-line security-test advisory). All 44 local documentation links/anchors passed, and synthetic API examples parsed with matching canonical digest/receipt bindings. The non-destructive local source/history scan reported no findings; all 44 historical/private baseline hashes matched.

A temporary local clone of `22c116b` with only the 11 uncommitted Phase A files overlaid passed `npm ci --ignore-scripts --no-audit --no-fund`, syntax checks, 10/10 release-tooling tests, the configuration-free stdout audit and the isolated demo test. It contained no copied private configuration, accounts or order evidence. This checks the proposed snapshot on the same Linux/Node/Chrome host; it is not a new commit, blank-machine test or cross-platform guarantee. No provider call, real passkey enrollment, publication or license change occurred.

## Reproducible judge experience

README supplies a credential-free path: Node 24+, `npm ci --ignore-scripts`, `npm run demo`, then **http://localhost:3200**. The locked dependencies and current automated demo/browser tests exercise the existing checkout. A subsequent release-readiness audit completed the clean-clone checks summarized above. Judges need no operator PayPal/Groq credentials, private `.local/` data or phone to inspect this deterministic fixture demo. Its transaction and approval controls explicitly say Simulate and perform no PayPal or WebAuthn operation. An additional optional AI-assisted question calls Groq server-side when a key is configured; otherwise it uses deterministic local routing.

For protocol evidence, install Google Chrome and run `npm run check` and `npm test`. Tests use temporary accounts/databases, mocked provider responses and virtual CTAP2 authenticators with the real verifier. They are not physical phone evidence. A judge who wants physical authentication uses their own fresh checkout/enrollment; never distribute the operator's passkeys/accounts. Existing operator enrollment is retained solely in the working local app.

## Public repository safety checklist (final release publication remains gated)

- Review the complete intended source/docs and run `npm run audit:release`; it prints to stdout without changing tracked evidence and scans tracked/nonignored untracked files and history for exact configured credentials/bootstrap values, prohibited private paths and private-key markers. A pass does not prove absence of unknown secrets, PII, rights or licensing issues.
- Keep `.env*`, all `.local/` attempts/grants/evidence/SQLite/accounts, HARs, tokens, credentials/assertions, native QR screenshots and browser traces ignored/untracked. Do not upload this machine's evidence bundle. Review public order/merchant references and historical docs separately before wider distribution.
- Preserve third-party copyright/license notices and review the lockfile/dependency list. Do not claim a historical zero-vulnerability audit is a fresh registry scan; no external dependency audit ran in this offline preparation.
- Retain the approved MIT license and copyright notice, confirm the exact submitted scope and remove misleading stale readiness claims. README's current state and latest milestone take priority over labelled historical reports.
- Verify clean-clone install/demo/test instructions, final video labels/captions and the deadline/entry fields. The supplied checkout has no public demo URL or configured remote; create/push/deploy only under a later explicit publication grant. If actual credentials are discovered, stop and address them rather than publishing after a cosmetic deletion.

**Current licensing status: MIT approved and prepared.** After Phase A, the project owner explicitly confirmed ownership of the original SaySure code and assets and approved MIT licensing. The root [LICENSE](../LICENSE) contains the complete standard MIT text and `Copyright (c) 2026 Hammed Ali Oyeleye`; `package.json` and the root `package-lock.json` metadata declare MIT, and README links to LICENSE. The independent release review approved this licensing implementation. License preparation does not authorize or establish public publication, push, deployment or submission.

Existing direct dependency metadata previously inspected: SimpleWebAuthn server/browser MIT, Playwright Apache-2.0, axe Playwright MPL-2.0. Keep their respective notices/terms; SaySure's MIT license does not relicense dependencies. These metadata observations are not a completed transitive rights/compatibility audit.

## UI and accessibility review

The UI already separates helper/buyer accounts, displays exact amount/currency/payee/order/revision/expiry, labels unverified names, supports optional exact speech/pause/stop and ordinary question expanders, and requires explicit review before the native passkey ceremony. The approved implementation retains those controls, genuine/mock provenance, stale-state refusal and distinct **PayPal order verified**, **Buyer consent approved**, **Consent consumed**, **PayPal buyer approval not established** and **Payment not captured** labels.

Existing browser evidence includes keyboard/focus, responsive layout, selected WCAG/axe checks, missing-speech fallback and WebAuthn/replay/role/security tests. Automated success is not a full accessibility certification. Real voice pronunciation/audio, TalkBack/VoiceOver, intended-user comprehension and direct phone-browser access remain unverified/manual. Keep the unchanged localhost desktop review and phone-assisted authentication distinction. No redesign, new auth path, HTTPS deployment or direct-mobile claim is added for this deadline.

## Truthful demo script — 2 minutes 45 seconds

Record only approved/non-sensitive surfaces. Use cuts to omit login, native QR, secrets and pairing delays. Label cuts, prior footage and virtual evidence honestly; never replace a failed real step with an unlabeled simulation. No video is recorded/rendered by this preparation.

| Time | Picture and narration |
| --- | --- |
| 0:00–0:15 | SaySure title/tagline. “A buyer independently reviews exact details and records passkey-backed local consent. This demonstration does not make a payment.” |
| 0:15–0:40 | **SIMULATED FIXTURE DEMO** at localhost:3200: quantity change invalidates simulated consent; point out readable totals and optional speech/grounded help. “No PayPal or WebAuthn call occurs in this viewer.” |
| 0:40–1:05 | Show a **HISTORICAL SANDBOX OBSERVATION** card only from reviewed existing records, with its original observation time and expired-local-window limitation. Do not expose private IDs or claim a current authenticated read. Otherwise keep the MOCK fixture visible. No provider request is part of recording. |
| 1:05–1:40 | Show the verified test result with **VIRTUAL AUTHENTICATOR / MOCK PAYPAL** and explain challenge, signature and buyer ownership checks. Existing synthetic physical-phone observations may be described only as user-reported historical evidence. Do not imply that historical PayPal-order consumption succeeded. |
| 1:40–2:00 | Show **SIMULATED** approved then consumed fixture state and explain that the backend regression suite separately tests atomic single-use consumption. State: “This simulation is not payment execution. Historical PayPal-order consumption remains unconfirmed.” |
| 2:00–2:25 | Explain the bounded AI evaluation: “On 17 fixed researcher-authored questions, constrained topic routing matched 17 versus 13 for ordinary keywords. The optional buyer-question feature now uses the model only to select a fixed topic from a redacted question; deterministic code provides the answer. If Groq is not configured, local matching is used.” |
| 2:25–2:45 | “We have not demonstrated improved human comprehension, production readiness, receiving eligibility or completed checkout. Current proof separates real API observations, human passkey events and simulated fixtures.” Show README's judge instructions and remaining gates. |

Provide captions for narration; avoid relying on speech alone or representing an automated axe scan as target-user validation. If real consent fails, the final narrative must say so and use the labelled fixture/protocol evidence without claiming the objective succeeded.

## AI claim boundary

The earlier 17/17 versus 13/17 result covers question-topic routing on fixed, non-blind paraphrases; four examples distinguish the ordinary baseline. It is not a universal model-accuracy comparison and does not measure comprehension. The current optional buyer-question feature uses Groq only to select one of six fixed topics from a best-effort redacted question. No request snapshot, amount, currency, merchant/payee identifier, order ID, buyer account, passkey data or provider response is attached. The model does not write the answer; deterministic local code generates it from the displayed request. Missing configuration, provider errors, timeouts and invalid output fall back to local keyword matching. The key remains server-side. Buyers are warned not to include personal, merchant or payment details; redaction is best-effort, not a guarantee. This feature is not evidence of improved comprehension, decision safety, accessibility benefit or production generalization. It has no payment authority and cannot approve, consume, capture, refund or execute a payment. Optional live use can incur Groq API costs. See [AI question-routing boundary](AI-QUESTION-ROUTING.md).

## Current remaining release work, in order

1. Keep the approved security baseline in history and preserve all private/historical evidence. Do not reuse the old attended authorization or execution marker. Historical PayPal-order consumption remains unconfirmed.
2. The Phase A release-preparation notes above are historical. Review the current feature branch locally, run the full verification suite and security/release scan, then decide whether to merge it. The feature branch has been pushed to the public repository; it has not been merged to master or deployed.
3. Preserve the subsequently approved and prepared MIT license, `Copyright (c) 2026 Hammed Ali Oyeleye`, matching package metadata and all third-party notices. License approval and preparation are complete; public publication remains separately gated.
4. Record/export the under-three-minute labelled fixture demonstration and captions. Use actual existing evidence only when its scope is stated accurately; no current provider observation or successful historical consumption is inferred. Review for private information and unsupported claims.
5. Complete intended-user speech/screen-reader checks and confirm deadline/eligibility/required entry fields with the operator. Review and test the public feature branch before merging; deployment/hosting and final submission remain separate gates.

Avoid expanding the product, changing payment operations, tuning AI, redesigning enrollment or weakening security to meet the deadline. No public publication action is included here.


## November 12, 2026 hosted judge update

Hosted entry: https://saysure-staging-cnhm.onrender.com/. The guest demo is clearly synthetic, while the actual workspace supports a persisted Helper→Buyer request flow with passkey-verified local consent. Testers choose **Start testing** or **Join as Buyer**; returning account sign-in is available but secondary. The trial identities cannot read PayPal orders or submit payment operations. AI matching on the current Render staging uses a deterministic fallback unless a private Groq key is configured. This does not satisfy a live AI proof by itself.

According to https://paypalaihackathon.devpost.com/rules, PayPal developer technology and AI are both required, and the project must be demonstrably functional. Submit a public code repository with a visible open-source license, a freely accessible running project or complete setup steps, and a publicly accessible YouTube demonstration below three minutes. Do not present historical PayPal sandbox testing as a current verified checkout, or local consent as a completed PayPal payment.

Hard blocker for claiming both integrations together publicly: operator-controlled PayPal read configuration and live AI availability are not verified on the current judge-facing trial. Do not make unapproved API writes to remove this blocker.

## November 12 guest-entry cleanup

The judge-facing `/app` entry now displays only **Start testing**, **Join as Buyer** and the no-login demo link. Returning or owner accounts use `/app/login` directly with previously saved credentials; it is intentionally absent from the public entry. Authentication, account isolation, Buyer passkeys and all PayPal trial restrictions are unchanged. The hosted README has been updated to show the current public flow rather than implying every tester must know fixed account passwords.
