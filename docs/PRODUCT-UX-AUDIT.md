# SaySure product experience and judge UX audit

Date: 10 November 2026. Audited release: `b2ddd815dfa8f98138db78fcd785a42aa2bf5db6`, directly following security-approved `22c116be7f0a88843a50d6ff3f5cf6464c152177`.

## Implementation update — 10 November 2026

The assessment below is preserved as the historical release audit. The local, uncommitted implementation now addresses its presentation and interaction findings; the original measurements and “not implemented” statements describe `b2ddd815`, not the revised working tree. This update is not a new security approval or a human accessibility/comprehension study.

| Findings | Completed local changes | Remaining human validation |
| --- | --- | --- |
| UX-01 | Human problem statement, explicit Helper/Buyer roles, one guided-demo entry; no login or credentials for the simulation | Cold-start judge comprehension and timing |
| UX-02, UX-12 | Compact account/inbox; transaction heading, exact amount/currency, full description, expiry and status precede consent/decision controls; raw technical identifiers in Advanced; explanation navigation beside the request | Intended-user reading effort, long-content usability |
| UX-03 | Consumption retained in a closed, labelled operator/developer testing disclosure; withdrawal remains a normal Buyer choice | Operator comprehension |
| UX-04 | Separate Start again action; selected-mode semantics; reselecting the same mode preserves refusal/approval; switching mode explicitly documented as a reset | Scenario-switch comprehension |
| UX-05, UX-06 | Mode-coherent recipient/reference in help and narration; mock speech explicitly says MOCK/no authenticated response; expected/recorded quantity spoken | Actual voice intelligibility |
| UX-07, UX-08 | Routine updates announce without global focus jumps; replaced decision controls lead to the same request heading; inline passkey/review prerequisites; decline needs no passkey | VoiceOver/TalkBack and physical authenticator usability |
| UX-09 | Shared payment/explanation playback owner; play/read, pause, resume, stop, finished/error/unavailable states; readable fallback | Audible quality, pronunciation, privacy and comprehension |
| UX-10 | Corrective amount errors and safe authentication errors associated with fields; invalid fields identified and focused; native required/range constraints retained | Screen-reader error announcements |
| UX-11 | Local expiry updates status, clears confirmation and locks mutation controls; stale/change refusals lock the old review and require refresh; server enforcement retained | Real-device timing and announcements |
| UX-13, UX-14 | Shared spacing/type/action hierarchy, visible focus, large controls, role-specific empty guidance, direct passkey-setup link and secondary operator import tools | Touch/motor usability and human visual review |

No backend, canonicalization, provenance authority, WebAuthn verifier, provider adapter, receipt-validation or database/security contract was changed. Authenticated application login remains required. The automated security and consumption tests still exercise the real local verifier with virtual authenticators and isolated synthetic data. No real enrollment or provider operation is part of this work.

Current validation and exact layout measurements are recorded in the completion evidence below. Automated scans do not establish WCAG conformance, speech comprehension or real assistive-technology usability.

## Historical verdict at the audited release

SaySure has a readable, honest consent prototype and a credential-free instant demo. Its presentation does not yet make the independence problem or the Helper/Buyer relationship obvious. The main product gap is information hierarchy: account administration, research terminology and technical evidence precede the buyer's decision. Mobile content reflows, but the decision takes several screens to reach.

This is a product/design assessment, not a new security approval or a measured ten-second comprehension study. The recommendations below are proposals only. No application changes were made. The existing 196/196 passing test result is the approved baseline, not a fresh full-suite run for this audit.

## Scope and evidence

- Ran `npm run demo` and inspected `http://localhost:3200` in Chrome.
- Inspected the actual authenticated application using [the existing test harness](../test/harness.mjs): temporary synthetic accounts/database, separate Helper/Buyer browser contexts and the unchanged application. The operator's provisioned localhost:3100 store was not opened. The fixture application used an ephemeral localhost port and no PayPal adapter/configuration.
- Inspected viewport widths 320, 375, 390, 768 and 1440 CSS pixels, each at 900px height, for the demo, sign-in, Helper and pending Buyer views. Recorded geometry and screenshots; visually inspected desktop, narrow mobile and tablet layouts.
- Ran 20 axe scans across those four views/five widths, plus two scans for approved and consumed authenticated Buyer states at 390px. All 22 scans reported zero violations for the selected WCAG A/AA tags. This does not establish full WCAG conformance.
- Exercised both demo fixture modes; all six questions in each; approval, decline, revision, consumption, reset, speech-control calls and speech-unavailable fallback.
- Exercised authenticated invalid sign-in, empty inbox, synthetic creation, invalid amount, edit/cancel/save, independent Buyer refresh, enrollment prerequisite, review prerequisite, virtual passkey enrollment/approval, cancellation, stale review, withdrawal, decline, consumption and sign-out.
- Exercised frontend expiry with the temporary browser clock advanced past its synthetic deadline. This was a UI-state check, not a fresh server-expiry test or a historical-record edit.
- Speech was instrumented to inspect utterance text, pause, resume, stop and fallback behavior. Native speech APIs were present but the initial headless voice list was empty. No audible pronunciation, intelligibility, real voice-provider privacy behavior, VoiceOver, TalkBack or physical authenticator usability is established.
- Browser traffic observed during the main walkthrough stayed on localhost; no `/api/paypal` request occurred, no demo cookies were set, and no page errors or blocked external requests were recorded. The offline preload is a best-effort JavaScript guard, not an OS firewall.

Temporary screenshots, scripts and measurements are under `/tmp/saysure-product-ux-audit/`; they are not application assets or historical evidence and are not part of the proposed commit. Primary source references are listed below so findings do not depend on temporary files surviving.

## Current strengths

1. **Independent choice is real in the authenticated product.** Helper and Buyer have separate role-specific controls. The Helper prepares or revises; the Buyer reviews, declines or uses its own passkey. No login or account creation is needed for the isolated demo. Authentication remains present in the actual app.
2. **The transaction heading is explicit.** Amount, currency and merchant appear together, such as `2.00 USD — Example Store`. Unverified merchant details are labelled; exact values remain available in text and speech.
3. **Consent is not represented as payment completion.** The header, review confirmation, approval message and consumed state repeat that no payment was made. Mock PayPal labels and the lack of authenticated verification are visible. Preserve these boundaries through redesign.
4. **The foundation supports accessible interaction.** Native buttons/forms/details, associated labels, labelled sections/articles, live status regions, a working skip link and a visible 3px blue focus outline are present. Keyboard Enter activated reading and decline; Tab after reading reached Pause audio. Checkbox activation and named pause/resume/stop controls worked.
5. **Reflow and basic contrast are strong.** No horizontal document overflow occurred at any tested width. Visible buttons measured at least about 57px high in the measured states. Source-color contrast calculations give about 13.23:1 for body text, 10.93:1 for enabled button text and 7.66:1 for the blue focus color against white; these samples are not an exhaustive contrast certification.
6. **There is no fabricated financial activity.** No user-count claims, made-up trust badges, balances or decorative financial charts were found. The subdued teal/neutral palette, system font and lack of motion are useful foundations.

Sources: [demo HTML](../public/demo.html), [app HTML](../public/index.html), [review renderer](../public/review.js), [presentation/speech](../public/presentation.js), [styles](../public/style.css).

## Ten-second judge assessment

| Question | Current experience | Assessment |
| --- | --- | --- |
| What problem does this solve? | Name/tagline, then a large fixture disclaimer; no plain explanation of assistance and independence | Not clear enough without narration |
| Who are Helper and Buyer? | No role walkthrough in the instant demo; server-role wording appears in the authenticated app | Core distinction is missing from the first encounter |
| What should I do first? | Two equally styled buttons headed “Choose fixture evidence” | Selects an evidence mode before explaining the task; no guided start |
| What is the Buyer deciding? | Clear amount/merchant heading, reached after the fixture selector | Good local clarity, weak page priority |
| Why should I trust the boundary? | Many accurate disclaimers; detailed protocol meaning largely in documentation | Honest but difficult to scan; explain the control boundary in one short sentence |
| Can I try it immediately? | Yes: no login, WebAuthn, provider account or credentials | Preserve this path |

Suggested future first-frame copy: **“Get help with the payment. Keep the final say.”** Follow with “A Helper prepares the request. The Buyer reviews the recipient, exact amount and currency, then declines or records consent with their own passkey.” Keep an adjacent, readable **“Interactive simulation. No payment is made.”** notice. A proposed **“Start the guided demo”** action should lead directly to the transaction review. This copy and action are not implemented.

The positioning is the intended benefit; improved independence, accessibility and comprehension have not been established through intended-user research.

## Responsive measurements

Positions below are document Y coordinates at scroll position zero, rounded to CSS pixels. The Buyer matrix is one pending synthetic request after Refresh, with an unenrolled Buyer and a visible status message. Enrollment and message content affect these numbers.

| Width | Demo page height | Demo amount Y | Demo approval Y | Buyer page height | Buyer amount Y | Buyer approval Y | Horizontal overflow |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 320 | 3159 | 938 | 1832 | 3760 | 1533 | 3329 | None |
| 375 | 2980 | 909 | 1713 | 3463 | 1444 | 3091 | None |
| 390 | 2885 | 872 | 1676 | 3374 | 1414 | 3032 | None |
| 768 | 2145 | 801 | 1262 | 2800 | 1303 | 2488 | None |
| 1440 | 1967 | 757 | 1188 | 2681 | 1288 | 2444 | None |

Enrollment alone does not resolve the hierarchy: a separate enrolled Buyer sample at 390px still placed the amount around Y=1231 and approval around Y=2848. A narrow Helper view was about 3056px tall at 390px even before any request cards; Refresh requests appeared around Y=2796. The disabled-by-configuration PayPal import panel is still visible to the Helper and contributes to this distance.

These are viewport checks on Linux Chrome, not physical-phone, touch-motor or cross-platform results. At narrow widths, long button labels wrap to two or three lines and the native question selector truncates the visible selected sentence. Nothing overlapped in the measured initial states, but scrolling and reading effort remain high.

## UX and accessibility findings

Priority means product-presentation urgency, not security severity. P0 should be resolved before presenting an unassisted polished demo; P1 should follow in the first accessibility-focused redesign; P2 is subsequent polish. No security bypass was found by this UX audit.

| ID | Priority | Observed problem and consequence | Recommended improvement |
| --- | --- | --- | --- |
| UX-01 | P0 | Demo first view contains “deterministic fixtures”, “fixture evidence” and no Helper/Buyer explanation. A judge must infer the purpose. | Lead with the human problem, two role sentences and one start action; retain explicit simulation labels. |
| UX-02 | P0 | Amount/recipient and decision controls are far below the initial viewport, including after enrollment. All sections/articles use the same bordered white-box treatment. | Put the transaction summary first; reduce account chrome; use one dominant review surface with secondary technical disclosure. Keep amount, currency, recipient/source and description together. |
| UX-03 | P0 | “Consume consent once” competes with approve/decline in the demo and becomes the next main action after authenticated approval. Its internal security meaning is unexplained. | Make the primary story review → decide → clear consent outcome. Present single-use consumption as an explicitly labelled advanced local test, without changing its security checks or suggesting payment completion. |
| UX-04 | P1 | Selecting either fixture button resets status, revision and quantity, including a completed/refused fixture; no selected-mode semantics are exposed. The reset is explained only after it occurs. | Separate “Start again” from mode choice, state when a switch resets the simulation, and expose selected mode accessibly. Reset must remain demo-only. |
| UX-05 | P1 | Mock-mode payment speech begins “Synthetic request” and follows the synthetic-summary path. It never speaks the on-screen phrase “MOCK PayPal fixture”. | Make fixture source labels consistent across visible and spoken summaries; keep explicit absence of real API verification. Do not fabricate a genuine provider snapshot to solve copy. |
| UX-06 | P1 | Demo payment speech reads the amount/merchant/description but omits the recorded-versus-expected quantity difference. Merchant help uses `MOCKPAYEE123` in both modes, while the synthetic review displays `SYNTH-SHOP-1`; mock help says “Example Store” while its heading says “MOCK payee MOCKPAYEE123”. | Derive each mode's visible review, spoken summary and help from one coherent fixture record. Explain the quantity difference when presenting the mismatch scenario. |
| UX-07 | P1 | Every demo notification focuses the top message. After keyboard approval, the next Tab returns to “Synthetic request”, not the next relevant choice. App errors/outcomes also focus the global message. | Keep relevant status near the transaction; announce routine updates without needless focus jumps; move focus deliberately for new screens/errors and retain a clear next step. Verify actual screen-reader behavior before claiming improvement. |
| UX-08 | P1 | Approve is enabled before the review box is checked and before enrollment. It correctly refuses, but missing-review handling briefly focuses the checkbox then the global error overrides that focus. | Expose prerequisites inline with the review control. Keep decline available without a passkey; preserve explicit buyer action and server-side validation. |
| UX-09 | P1 | Core payment speech has pause/resume/stop, but the separate demo explanation reader has only Read/Stop, no reading/paused/finished status or pause/resume. Stop is enabled when idle. Speech-unavailable explanation Read remains enabled, though it reports a safe fallback when pressed. | Give both readers consistent stateful controls and visible fallback; make support/help content readable without audio. |
| UX-10 | P1 | Invalid amount produces “The action was refused (INVALID_DECIMAL_AMOUNT). Refresh and check the request.” The error is not associated with the amount input. Invalid sign-in has a clearer message but no field/error association. | Provide plain corrective text beside the relevant field, a navigable error summary when useful and appropriate error associations. Keep authentication failures nonspecific and retain safe error handling. |
| UX-11 | P1 | Live expiry adds “This review expired” and disables choices, but the detail list still says `Status pending` until refresh. Stale-review refusal leaves the old amount visible until refresh. | Reconcile visible presentation with the local expired/stale state and make the required refresh obvious. Never make a stale snapshot actionable or imply a server transition that has not occurred. |
| UX-12 | P1 | At mobile widths, raw request UUIDs, minor units, revision, account IDs and repeated cautions separate the financial summary from the decision. Help can expand six nested disclosures above the choices. | Keep exact financial details and source labels primary; move diagnostics to clearly labelled detail disclosure; place help so expansion does not bury decision controls. Do not hide or abbreviate the actual amount/currency/recipient/description. |
| UX-13 | P2 | Approve, decline, reset, refresh and read use nearly identical styling; the page has little hierarchy beyond heading size. | Define a small typography/spacing/action system. Make decline equally discoverable; use text and shape as well as color. Keep calm colors, contrast, large targets and visible focus. |
| UX-14 | P2 | Empty inbox says only “No requests for this account”; the Helper sees the unavailable PayPal path before the inbox; enrollment is prominent without a task-oriented explanation. | Give role-specific next-step guidance, compress account administration, and explain unavailable capabilities without encouraging configuration or provider calls. Preserve actual authentication. |

Additional accessibility observations: a checkbox itself measured about 23.4px square, but its associated multiline label was a much larger clickable area; do not classify that measurement alone as a target-size failure. No confirmed contrast or unlabeled-control violation emerged from these scans. The live-region/focus findings are observed interaction costs, not a claimed assistive-technology test result. Browser/OS passkey prompt design remains outside application control; the virtual authenticator does not provide physical prompt, biometric, QR or hybrid-flow usability evidence.

Sources: [demo behavior](../public/demo.js), [question answer rendering](../public/buyer-help.js), [app actions/errors](../public/app.js), [request rendering and expiry](../public/review.js), [speech controls](../public/presentation.js), [style rules](../public/style.css).

## Screens and states requiring redesign

| Surface | Keep | Redesign focus |
| --- | --- | --- |
| Instant-demo entry | No login, simulation notice | Ten-second problem/roles explanation, one guided start, visible current mode |
| Demo transaction review | Exact amount/currency, unverified recipient label | Summary-first layout, coherent fixture/help/audio, plain step guidance |
| Sign-in | Real role-bound authentication, safe failure | Concise role explanation and local error guidance; no demo credential requirement |
| Helper preparation/inbox | Buyer selection, immutable buyer during revision | Task-first form, inbox navigation, revised-details feedback and explicit unavailable-provider state |
| Buyer inbox/enrollment | Independent account and passkey ownership | Compact identity, useful empty state, prerequisites without obscuring the request |
| Buyer exact-details review | Explicit review, decline and passkey choice | Clear financial hierarchy, shorter technical disclosure, accessible speech and help |
| Outcome/error/expiry | Accurate local-consent boundary and receipt validation | Persistent plain state, transaction-local feedback, appropriate focus, explicit refresh/next step |

Do not introduce dashboard balances, payment activity, fake social proof, automatic approval, default checked consent, a custom fake native passkey prompt or an implication that declining SaySure reverses an external payment. Decorative gradients, motion and a framework migration are unnecessary for the identified problems.

## Exact files for a future implementation

No changes to these application/test files are made by this audit.

| File | Proposed responsibility |
| --- | --- |
| [public/demo.html](../public/demo.html) | First-frame problem/role copy, guided entry, fixture labels and explanation-control structure |
| [public/demo.js](../public/demo.js) | Demo-only guide/reset/mode state, coherent fixture data, source-aware narration and local notifications |
| [public/style.css](../public/style.css) | Shared typography, spacing, review layout, action hierarchy, mobile reflow and focus treatment |
| [public/index.html](../public/index.html) | Compact authenticated account/enrollment layout, task-oriented Helper/Buyer structure and form guidance |
| [public/review.js](../public/review.js) | Transaction-first rendering, accessible status/detail disclosure and review/outcome/expiry presentation |
| [public/app.js](../public/app.js) | Error-copy mapping, field/error associations and deliberate focus/refresh behavior |
| [public/presentation.js](../public/presentation.js) | Consistent speech states and fixture-appropriate exact summaries; preserve authentic evidence boundaries |
| [test/demo.test.mjs](../test/demo.test.mjs) | Guided demo, mode/reset/source consistency, keyboard, speech fallback and five-width regressions |
| [test/review.test.mjs](../test/review.test.mjs) | Authenticated review, focus, field errors, speech states, mobile and local-expiry presentation |
| [test/buyer-questions.test.mjs](../test/buyer-questions.test.mjs) | Fixture/help coherence and grounded answer expectations if wording/data changes |

The initial presentation redesign need not modify backend `src/`, schemas, provider adapters, passkey/session policy, canonical binding or receipt validation. Any proposal that changes those contracts requires separate security review. Existing consumption/provenance/security regressions must remain passing alongside meaningful new UX checks. Source-state selectors can be retained where useful; behavior and accessibility should be tested rather than incidental markup.

## Recommended order and acceptance evidence

1. Resolve UX-01–03: a clear first frame and transaction-first narrative, with a readily visible local-consent/payment boundary. Use the current runnable route in [FINAL-DEMO-FLOW.md](FINAL-DEMO-FLOW.md) until a redesign is authorized.
2. Resolve UX-04–12: coherent source/help/audio, stateful speech, local error/expiry guidance and keyboard continuity. Demonstrate no consent creation from speech, help, navigation or reset in the authenticated app.
3. Refine UX-13–14: visual hierarchy, role-specific empty states and unavailable-provider presentation.
4. Recheck all five widths, keyboard-only flows, selected axe rules, contrast, zoom/text enlargement and long content. Proposed target: at 390×900 the product purpose and transaction summary should be discoverable in the first viewport; establish an agreed decision-layout target without skipping exact-details review.
5. Obtain timed cold-start judge feedback and intended-user accessibility/comprehension sessions. Test real screen readers, actual audio and physical authenticators separately before claiming those outcomes. Keep the fixture demo credential-free and the authenticated app authenticated.

## Repository preservation

Final verification found exactly two new repository files: this audit and [FINAL-DEMO-FLOW.md](FINAL-DEMO-FLOW.md). No tracked application file or Git index entry changed; HEAD remains `b2ddd815` with `22c116b` as its direct parent. All 75 local Markdown links/anchors across the 14 Markdown files passed, and both new documents passed whitespace checks. Historical/private preservation passed 44/44 checks: 31 private SHA-256 baselines plus 13 tracked historical evidence artifacts. Temporary virtual credentials and synthetic consent records were cleaned up by the harness; operator credentials and historical orders were not audit inputs. Nothing was staged, committed, pushed, deployed or published.


## Completion evidence for the local implementation

The implementation verification used temporary synthetic accounts and databases, localhost-only application servers, mocked provider transports and virtual authenticators. It did not use the provisioned operator store, real enrollment, PayPal/OAuth/payment operations or historical-order operations.

- `npm test`: **200/200 passed**, zero failed, skipped or cancelled. Existing WebAuthn verification, identity/ownership, canonical binding, provenance authority, expiry, provider matching, durable read budgets, revalidation, atomic consumption, duplicates, correlation and committed-receipt checks remain present and pass.
- Final `node --import ./scripts/offline-test-guard.mjs --test test/product-ux.test.mjs`: **4/4 passed** after the final spacing change. Checks cover guided entry, mode/reset semantics, coherent mock narration, explanation pause/resume/stop/finish/unavailable states, keyboard refresh/decline continuity, accessible amount/login/merchant errors and long unbroken content.
- Final `node --import ./scripts/offline-test-guard.mjs --test test/consumption-provenance.test.mjs`: **5/5 passed**, including a promoted import-response label, promoted receipt metadata and a formerly current observation becoming stale. No frontend notification claims authenticated evidence from the import response; review provenance comes from the validated request list.
- **23 selected WCAG A/AA axe scans: zero reported violations.** Matrix: demo, sign-in, Helper and pending Buyer at 320, 375, 390, 768 and 1440px, plus declined Buyer and two field-error states. These results supplement the existing suite's browser/axe checks and do not establish full WCAG conformance.
- No horizontal document overflow in that matrix or with the maximum 120-character merchant name and 500-character unbroken description at each width. Financial facts precede decision controls. Large transaction content remains fully visible and can increase page height.
- `npm run check`, `git diff --check` and local links in both updated documents pass. The pre-existing nonfatal 208-line security-test target warning remains; the hard source-size limit passes. Its UI scan timeout is now 90 seconds and overall test timeout 300 seconds, retaining all assertions and race/replay counts.

Positions below are document Y coordinates at scroll zero, rounded to CSS pixels. The temporary Buyer is unenrolled, with one pending synthetic request and no extra global notification. Account state, notifications, errors and longer transaction text affect geometry. The original audit matrix above remains the historical baseline.

| Width | Transaction heading Y | Passkey approval Y | Horizontal overflow |
| --- | ---: | ---: | --- |
| 320 | 287 | 897 | None |
| 375 | 287 | 871 | None |
| 390 | 287 | 814 | None |
| 768 | 281 | 700 | None |
| 1440 | 287 | 706 | None |

At 390px, approval moved from the historical approximately 3,032px to approximately 814px. Exact recipient, amount/currency, description, expiry and status stay visible before the decision. Advanced details are closed; audio and help remain available through the adjacent explanation link and below the decisions. The skip link remains keyboard-accessible and appears with visible focus.

Evidence is temporary, not application assets or historical evidence: `/tmp/saysure-final-ux/` contains 20 full-page screenshots (`buyer`, `helper`, `signin`, `demo` at each width), `measurements.json`, `axe-results.json`, `full-suite.log`, `ux-regression.log`, `provenance-regression.log` and an evidence README. This evidence can be regenerated with the commands above; temporary files are not guaranteed to survive environment cleanup.

Both approved commits remain in history and HEAD remains `b2ddd815dfa8f98138db78fcd785a42aa2bf5db6`. No backend, adapter, canonical/receipt validator, dependency or historical tracked artifact changed. The final working tree has 15 modified tracked UI/test files and three untracked files (the two supplied audit/runbook documents and the new UX regression). Nothing is staged, committed, pushed, deployed or published; PayTale and private/historical evidence were not modified.

Outstanding human testing: physical VoiceOver/TalkBack, real audible speech quality and comprehension, physical authenticator/biometric usability, touch/motor usability and cold-start judge/intended-user comprehension. Browser automation and virtual authenticators do not establish these outcomes, production readiness or completed payment.
