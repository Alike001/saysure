# SaySure final judge demonstration flow

Originally prepared 10 November 2026 for approved release `b2ddd815`; product observations and priorities are in [PRODUCT-UX-AUDIT.md](PRODUCT-UX-AUDIT.md). The implemented working-tree journey appears first below, followed by the preserved historical runbook. This document does not authorize provider operations.

## Updated working-tree demonstration

The local implementation now follows this journey. The original release runbook below is preserved as historical context; its missing-control/first-frame warnings describe `b2ddd815` and are superseded for the revised UI by this section. Nothing has been committed or published.

Start with `npm run demo` and open **http://localhost:3200**. The simulation requires no account, PayPal credentials or passkey. Keep its **DEMO ONLY — interactive simulation** notice visible.

1. Show the opening: **“Getting help with a payment should never mean giving up control of your money.”** Read the Helper/Buyer role explanation, then choose **Start the guided demo**. It focuses **Review, then decide**.
2. Review **2.00 USD — Example Store**, the unverified synthetic source, the notebook, recorded quantity two and expected quantity one. The exact facts precede the choices. No simulated action makes a payment.
3. Follow **Listen / explain the quantity difference**. Choose the difference question, then **Explain selected question**. The deterministic answer compares 2.00 USD with the expected 1.00 USD. Optional **Read explanation aloud**, **Pause explanation audio**, **Resume explanation audio**, **Stop explanation audio** reflect the reader state. Use visible text if speech is unavailable; controls do not validate voice quality or comprehension.
4. Choose **Simulate decline**. Approval becomes unavailable and the same review remains the focus context. The simulation records refusal only.
5. Open **Advanced: simulation scenarios and operator testing**. Choose **Start again** to restart the selected scenario, then **Change fixture quantity (invalidates simulated consent)** to show 1.00 USD. Recheck the details and choose **Simulate local consent approval**. There is no real passkey ceremony.
6. Change quantity again. The revision increases, the total returns to 2.00 USD and prior simulated consent is invalidated. Re-explain that real backend enforcement is exercised separately by automated protocol tests.
7. Optionally choose **MOCK PayPal order** in Advanced. Switching types resets the scenario, as the adjacent text explains. The selected button exposes its state; reselecting it does not erase a decision. Text, help and payment narration identify mock evidence and its matching mock recipient. No authenticated provider observation is created.
8. Optional operator illustration: **Start again**, simulate consent approval, then **Simulate consuming consent once** in Advanced. It becomes unavailable after use. This is a single-use local-consent illustration, not checkout, capture or a real payment.

In the authenticated application, the Buyer sees the transaction before passkey administration and technical diagnostics. Review confirmation and the Buyer's own enrolled passkey are required for approval; decline remains independent. A setup link leads to the existing real enrollment control. Actual enrollment is outside this review task. Advanced consumption retains server revalidation, receipt validation and single-use enforcement. No authentication or security gate has been removed.

Do not claim physical VoiceOver/TalkBack, audible voice quality, physical authenticator usability, intended-user benefit or cold-start comprehension from browser automation. Those remain outstanding human tests. No deployment, provider operation, publication or remote push is authorized by this runbook.

## Historical release runbook

The following sections document the original audited release, including the then-proposed future flow.

## The message to land in ten seconds

“SaySure helps a person keep the final say when someone assists with a digital payment. The Helper prepares the request; the Buyer independently checks the recipient, amount, currency and details, then declines or records consent with their own passkey. SaySure consent does not complete a PayPal payment.”

For the instant viewer, immediately add: **“This is an interactive simulation. No real passkey or payment operation occurs here.”** The current viewer does not show the two role workspaces, so explain the roles; do not suggest its fixture selector authenticates a Helper or Buyer.

## Start the current instant demo

From a checkout with dependencies installed:

```sh
npm run demo
```

Open **http://localhost:3200**. Use `localhost` exactly. A fresh checkout first needs Node 24+ and `npm ci --ignore-scripts`, as described in [README](../README.md). There is no judge login, account creation, database setup or PayPal credential step for this viewer.

Keep the **DEMO ONLY** banner visible in recordings or include it clearly at each cut. Current UI is at its best with a deliberately framed transaction review after the opening explanation; it is not yet an effective unassisted first-frame introduction. Do not crop away source or payment-status limitations to make the layout appear simpler.

Do not run setup against an already provisioned checkout. Do not open private accounts, historical-order evidence or native pairing/credential screens to make this instant demo work. The authenticated application retains its own login and separate roles.

## Runnable current flow — about 2 minutes 45 seconds

The fixture starts with two notebook items at 1.00 USD each, a recorded total of 2.00 USD and an expected quantity of one. All transitions in this table are browser-fixture simulations.

| Time | Exact current action | What the judge should understand |
| --- | --- | --- |
| 0:00–0:15 | Show SaySure, tagline and DEMO ONLY banner. Explain the two roles using the opening message. | Help does not give the Helper the Buyer's final decision; this viewer is simulated. |
| 0:15–0:35 | Select **Synthetic request** to start/reset. Scroll to **Payment review**. Point to **2.00 USD — Example Store**, expected quantity 1 and recorded quantity 2. | The Buyer reviews a specific amount, currency and unverified helper-supplied recipient; the difference matters. |
| 0:35–0:55 | Select **Why does my total differ from what I expected?**, then **Explain selected question**. Show the 2.00 USD recorded total versus 1.00 USD expected total. Optionally use **Read explanation aloud** only if audio is working. | The explanation stays grounded in fixture values; it does not invent fees or verify the merchant. No model is called. |
| 0:55–1:10 | Select **Simulate decline**. Show the refusal message and disabled approval control. | Saying no is an independent choice. No consent or payment was approved; refusal cannot be overridden within that fixture. |
| 1:10–1:30 | Select **Synthetic request** again; explain that it resets browser simulation only. Select **Change fixture quantity (invalidates simulated consent)** once, producing 1.00 USD. Select **Simulate local consent approval**. | The user can review corrected exact details and then choose. This button does not invoke a passkey. |
| 1:30–1:50 | Select **Change fixture quantity (invalidates simulated consent)** again: amount returns to 2.00 USD, revision increments and local consent returns to pending. | Approval does not carry over to changed details. This viewer illustrates a property enforced separately by the authenticated backend and tests. |
| 1:50–2:05 | If useful, switch to **MOCK PayPal order**, explicitly calling out that switching resets the fixture. Show the MOCK label and “not established” provider/payment statuses. | A PayPal-shaped fixture is not an authenticated API response, PayPal buyer approval or payment completion. |
| 2:05–2:25 | Optional advanced proof illustration: return to **Synthetic request**, simulate approval, then **Simulate consuming consent once**. Show that consumption becomes unavailable. | This is single-use local consent simulation, not sending money. The security suite separately checks actual backend atomicity and replay refusal. |
| 2:25–2:45 | Close on the product distinction, README instructions and limitations. | “The buyer keeps the decision. Tests exercise the real verifier with virtual authenticators. We have not established comprehension benefit, production readiness or completed payment.” |

If time is short, omit the mock-mode and consumption segments. Keep the core chain: exact review → grounded explanation → independent decline/approval → changed details invalidate consent. Do not replace that chain with protocol jargon or a tour of every control.

## Speech and keyboard notes for the current build

- **Read payment details aloud**, **Pause audio** (which becomes **Resume audio**) and **Stop audio** belong to the core payment reader. Listening never approves consent. Keep the visible amount/recipient/currency available throughout.
- The separate explanation reader currently has **Read explanation aloud** and **Stop explanation audio**, without pause/resume or equivalent reading-state feedback. Do not promise those missing controls.
- Known issue: in MOCK mode the payment reader uses the synthetic-summary wording. Until corrected, show the explicit MOCK source text and avoid presenting that narration as a consistent spoken PayPal-source explanation.
- The payment-summary narration does not itself read the expected-versus-recorded item mismatch. Use the selected quantity-difference explanation for that information; distinguish this demo help from authenticated API evidence.
- If no voice is available, stop attempting audio and use the visible exact text. State that audible speech was not demonstrated. Never add an unrelated voiceover and represent it as successful native playback.
- Tab and Enter work for the named buttons; the skip link moves past the header. Current notifications often focus the top message, so the presenter may need to return to the review. That is a current friction point, not an accessibility feature to advertise.
- Native controls and automated scans are not evidence of real VoiceOver/TalkBack usability. Do not claim those technologies were tested.

## Separate authenticated proof, when needed

The instant viewer cannot prove account isolation, real passkey verification or backend atomicity. Show the approved test result separately, labelled **AUTOMATED PROTOCOL TESTS / VIRTUAL AUTHENTICATOR / SYNTHETIC DATA**. The current approved full-suite result is 196/196; this audit did not rerun the full suite. Keep the security approval tied to `22c116b` and the release preparation tied to `b2ddd815`.

This audit inspected the unchanged real application through temporary isolated accounts and a temporary database, with no provider adapter. It exercised Helper creation/revision and Buyer enrollment, review, cancellation, stale-details refusal, decline, approval, withdrawal and consumption using virtual authenticators. These are browser/protocol observations, not a real phone ceremony or improved human understanding.

If a future authorized recording includes physical authentication, use a separately prepared synthetic environment and the participant's own authenticator; retain application login and explicit Buyer action. It needs its own safe procedure. Do not substitute an animated fake native prompt, reuse historical grants or claim a native prompt displays and attests the purchase details. No actual private-store enrollment or provider operation is authorized by this runbook.

## Proposed polished product flow — not implemented

| Stage | Intended experience | Boundary to preserve |
| --- | --- | --- |
| Entry | Plain problem statement, Helper/Buyer explanation, one **Start the guided demo** action | Instant demo requires no account, provider credentials or passkey |
| Review | Transaction-first recipient/source, exact amount/currency, description and relevant difference | Fixture and unverified-recipient labels remain readable; authentic evidence must stay authentic |
| Understand | Optional Listen, Pause/Resume/Stop and readable grounded answers near the transaction | Speech and help never approve or alter the transaction |
| Decide | Clear decline and explicit consent choice; in the actual app, enrollment/review prerequisites and the Buyer's own passkey | No default consent, Helper approval, authentication bypass or obscured decline |
| Outcome | Plain consent status and **No payment was made**; changed details require a new review | Retain canonical binding, expiry, provenance and committed-receipt validation |
| Advanced proof | Separate local single-use test and honestly labelled protocol evidence | Consumption is not PayPal checkout, capture or payment completion |

Use calm typography, strong contrast, large touch targets and one dominant review surface. Keep developer identifiers and detailed diagnostics in secondary disclosure. No payment activity feed, invented statistics, trust badges or decorative dashboard panels are needed.

## Presentation readiness checklist

- A cold-start judge can explain the problem and the two roles after the opening; this requires human feedback, not a claim inferred from an axe pass.
- Check the complete flow at 320, 375, 390, 768 and 1440px after any redesign; current measured reflow does not prove future layouts.
- Keep quantity, amount, currency, recipient and source coherent across text, help and speech. Resolve the audit's P0 presentation gaps before calling the new experience polished.
- Verify keyboard continuity, visible focus, error announcements, expiry guidance and all speech states after changes. Test actual audio and intended screen readers separately.
- Label every simulation and prerecorded/virtual segment; keep captions and payment boundaries clear.
- Review recordings for secrets, account material, native QR/pairing details and unsupported claims.
- Public repository push, hosting, submission and publication remain separate authorized actions. Preparing these audit documents performs none of them.


## Working-tree verification result

The completed local implementation passed the 200-test offline suite, a final four-test UX regression run and five provenance regressions. The final UX run produced 23 selected WCAG A/AA axe scans with zero reported violations and 20 screenshots across 320, 375, 390, 768 and 1440px, with no horizontal overflow. At 390px the pending synthetic Buyer's transaction heading is around Y=287 and passkey approval around Y=814. Notifications, account state and long content affect these coordinates. See the completion evidence in [PRODUCT-UX-AUDIT.md](PRODUCT-UX-AUDIT.md) and temporary artifacts under `/tmp/saysure-final-ux/`.

The approved commits remain in history. Application authentication and backend security protections remain in place. Physical audio, screen readers, authenticators and human comprehension remain unvalidated. Stop for local review; nothing has been staged, committed, pushed, deployed or published.
