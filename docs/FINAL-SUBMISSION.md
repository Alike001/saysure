# SaySure — minimal submission preparation

**Your money. Your final say.** Current scope: prepare the attended local test and an honest judge experience. No publication, hosting, remote repository, new provider call, account creation or submission is authorized by this preparation. Aim to finish before November 12; verify the actual submission form cutoff/timezone rather than relying on an earlier converted deadline.

## Reproducible judge experience

README supplies a credential-free path: Node 24+, `npm ci --ignore-scripts`, `npm run demo`, then **http://localhost:3200**. The locked dependencies and current automated demo/browser tests exercise the existing checkout. A completely fresh networked install was **not** executed during this offline preparation; test a clean clone before publication when authorized. Judges need no operator PayPal/Groq credentials, private `.local/` data or phone to inspect this deterministic fixture demo. Its controls explicitly say Simulate and it performs no WebAuthn/API/AI operation.

For protocol evidence, install Google Chrome and run `npm run check` and `npm test`. Tests use temporary accounts/databases, mocked provider responses and virtual CTAP2 authenticators with the real verifier. They are not physical phone evidence. A judge who wants physical authentication uses their own fresh checkout/enrollment; never distribute the operator's passkeys/accounts. Existing operator enrollment is retained solely in the working local app.

## Public repository safety checklist (publication remains gated)

- Review final staged source/docs and run `npm run audit:release`; it scans tracked files and history for exact configured credentials/bootstrap values, prohibited private paths and private-key markers. A pass does not prove absence of unknown secrets, PII, rights or licensing issues.
- Keep `.env*`, all `.local/` attempts/grants/evidence/SQLite/accounts, HARs, tokens, credentials/assertions, native QR screenshots and browser traces ignored/untracked. Do not upload this machine's evidence bundle. Review public order/merchant references and historical docs separately before wider distribution.
- Preserve third-party copyright/license notices and review the lockfile/dependency list. Do not claim a historical zero-vulnerability audit is a fresh registry scan; no external dependency audit ran in this offline preparation.
- Obtain explicit license/copyright-holder approval, confirm the exact submitted scope and remove misleading stale readiness claims. README's current state and latest milestone take priority over labelled historical reports.
- Verify clean-clone install/demo/test instructions, final video labels/captions and the deadline/entry fields. No public repo or URL exists yet; create/push/deploy only under a later explicit publication grant. If actual credentials are discovered, stop and address them rather than publishing after a cosmetic deletion.

**Recommended original-source license: MIT**, subject to explicit operator confirmation of the rights holder and choice. Existing direct dependency metadata previously inspected: SimpleWebAuthn server/browser MIT, Playwright Apache-2.0, axe Playwright MPL-2.0. Keep their respective notices/terms; an MIT license for SaySure's original code does not relicense dependencies. This is a practical recommendation, not a completed transitive rights/compatibility audit. No LICENSE is installed by this task. The operator should explicitly provide the chosen license and copyright name/year. [MIT text](https://opensource.org/license/mit).

## UI and accessibility review

The UI already separates helper/buyer accounts, displays exact amount/currency/payee/order/revision/expiry, labels unverified names, supports optional exact speech/pause/stop and ordinary question expanders, and requires explicit review before the native passkey ceremony. The new attended path retains those controls, genuine/mock provenance, stale-state refusal and distinct **PayPal order verified**, **Buyer consent approved**, **Consent consumed**, **PayPal buyer approval not established** and **Payment not captured** labels.

Existing browser evidence includes keyboard/focus, responsive layout, selected WCAG/axe checks, missing-speech fallback and WebAuthn/replay/role/security tests. Automated success is not a full accessibility certification. Real voice pronunciation/audio, TalkBack/VoiceOver, intended-user comprehension and direct phone-browser access remain unverified/manual. Keep the unchanged localhost desktop review and phone-assisted authentication distinction. No redesign, new auth path, HTTPS deployment or direct-mobile claim is added for this deadline.

## Truthful demo script — 2 minutes 45 seconds

Record only approved/non-sensitive surfaces. Use cuts to omit login, native QR, secrets and pairing delays. Label cuts, prior footage and virtual evidence honestly; never replace a failed real step with an unlabeled simulation. No video is recorded/rendered by this preparation.

| Time | Picture and narration |
| --- | --- |
| 0:00–0:15 | SaySure title/tagline. “A buyer independently reviews exact details and records passkey-backed local consent. This demonstration does not make a payment.” |
| 0:15–0:40 | **SIMULATED FIXTURE DEMO** at localhost:3200: quantity change invalidates simulated consent; point out readable totals and optional speech/grounded help. “No PayPal or WebAuthn call occurs in this viewer.” |
| 0:40–1:05 | If the attended run succeeded, cut to **REAL PAYPAL SANDBOX API EVIDENCE** in localhost:3100: new order ID, 1.00 USD, payee reference, CREATED and fresh read time. “These fields came from authenticated reads. Shop identity and receiving eligibility are not proved.” If unavailable, show a truthful NO-GO card and retain fixture labels; do not imply current verification. |
| 1:05–1:40 | Only after actual successful human authentication: **LIVE LOCAL PASSKEY CONSENT — PHONE-BACKED**. Show the Buyer's independent review and explicit approval. Cut over private pairing details. “The existing buyer completed required user verification. The server re-read the exact order before the challenge and after verifying the signature.” If unperformed, show the automated result with **VIRTUAL AUTHENTICATOR / MOCK PAYPAL**, not a fake real ceremony. |
| 1:40–2:00 | Show the actual approved then consumed local state, if obtained. “A final fresh read precedes single-use local consumption. PayPal buyer approval is not established; payment is not captured.” Otherwise label the fixture simulation explicitly. |
| 2:00–2:25 | Explain the bounded AI evaluation: “On 17 fixed researcher-authored questions, constrained topic routing matched 17 versus 13 for ordinary keywords. It selects a topic; deterministic code provides exact facts. The fixture demo has no live model call.” |
| 2:25–2:45 | “We have not demonstrated improved human comprehension, production readiness, receiving eligibility or completed checkout. Current proof separates real API observations, human passkey events and simulated fixtures.” Show README's judge instructions and remaining gates. |

Provide captions for narration; avoid relying on speech alone or representing an automated axe scan as target-user validation. If real consent fails, the final narrative must say so and use the labelled fixture/protocol evidence without claiming the objective succeeded.

## AI claim boundary

The 17/17 versus 13/17 result covers question-topic routing on fixed, non-blind paraphrases; four examples distinguish the ordinary baseline. Both routes return the same deterministic answers and no extra verified financial facts. The revised contract also reduced output freedom, so it is not a universal model-accuracy comparison. No improved comprehension, decision safety, accessibility benefit or production generalization was measured. No real order, passkey or buyer data is sent to AI. The milestone adds no model integration/evaluation or API spend.

## Minimum remaining work, in order

1. Arrange one ready Helper/Buyer/phone session, review the fresh private attempt and obtain the independent approval in [ATTENDED-FINAL-TEST.md](ATTENDED-FINAL-TEST.md). Execute at most once while attended. Preserve actual failures without retry/replacement.
2. Confirm actual order/merchant/1.00 USD, real human signature verification, checkpoint reads and one consumption from private evidence. If NO-GO, accurately retain the synthetic/fixture/protocol demonstration and disclose the gap.
3. Record/export the under-three-minute labelled demonstration and captions; inspect it for private information and unsupported claims. Obtain explicit license choice/rights-holder details.
4. Complete the local source/history safety review and an authorized clean-clone check. Verify deadline/eligibility/required fields with the operator. Only then seek the explicit public repository/push/hosting/submission authorization needed for the selected entry route.

Avoid expanding the product, changing payment operations, tuning AI, redesigning enrollment or weakening security to meet the deadline. No public publication action is included here.
