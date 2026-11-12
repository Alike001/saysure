# SaySure staging workspace access

The public landing page and synthetic demo are open. The authenticated workspace is intentionally not public-sign-up.

## Current staging test accounts

The staging database contains three fixed test identities:

| Username | Role | Use |
| --- | --- | --- |
| `helper` | Helper | Creates synthetic requests and chooses which Buyer receives each request |
| `buyer-a` | Buyer | Reviews requests addressed to buyer-a and makes the independent decision |
| `buyer-b` | Buyer | A second, separate Buyer identity for another tester |

Passwords are generated and distributed privately by the project owner. They are not committed to this repository, printed in deployment logs, or displayed on the public login page. Never put account secrets in a GitHub issue, README, screenshot or public chat.

No PayPal account is required to sign in to SaySure.

## Test a complete Helper-to-Buyer flow

1. Open **https://saysure-staging-cnhm.onrender.com/app**.
2. Sign in as `helper` using the Helper secret supplied privately by the project owner.
3. Create a clearly synthetic request. Select `buyer-a` or `buyer-b` as the recipient.
4. Open a separate browser profile or another device. Sign in as the selected Buyer.
5. Refresh the Buyer request list and open the new request.
6. Check the merchant label, amount, currency, description, expiry and request status.
7. The Buyer can decline without registering a passkey. To test consent, the Buyer first registers their own passkey on their own device, then reviews the request again and approves it.
8. Return to the Helper profile and refresh to observe the updated request status.

Use a separate browser profile for each role because a browser profile has one SaySure session cookie. Do not share the Buyer's password or authenticator with the Helper. Each person must make their own decision.

The workspace is a local-consent experiment. Approval records SaySure consent only; it does not approve a PayPal checkout, authorize a charge, capture funds or prove payment completion. Keep PayPal checkout/capture/refunds disabled.

## Reset the three staging account secrets

Only do this when the project owner intentionally wants to replace the staging test passwords. This rotates the existing fixed accounts; it does not delete requests or reset the database. Existing sessions are invalidated. Existing Buyer passkeys are retained.

1. Generate three different high-entropy passwords (at least 16 characters) and store them in a password manager.
2. In the private Render environment for the main SaySure web service, set:
   - `STAGING_ROTATE_PASSWORDS=true`
   - `STAGING_HELPER_PASSWORD=<new helper secret>`
   - `STAGING_BUYER_A_PASSWORD=<new buyer-a secret>`
   - `STAGING_BUYER_B_PASSWORD=<new buyer-b secret>`
3. Deploy the current `feat/saysure-postgres-runtime` branch once. Confirm the startup log says the three staging passwords were rotated and PostgreSQL is ready. The app never prints the secret values.
4. Immediately remove `STAGING_ROTATE_PASSWORDS` and all three `STAGING_*_PASSWORD` variables from Render and redeploy.
5. Distribute each account's new secret privately to its intended tester. Keep a separate record in a password manager.

The rotation is accepted only when the database contains exactly the expected three identities and roles. It refuses unexpected account state. Do not set the rotation flag unless all three new secrets are ready.

## Adding more people

Public registration is deliberately disabled. The current staging release supports one Helper and two Buyer test accounts. Do not share one Buyer identity among multiple people if you need attributable, independent test evidence. Additional named test accounts and an invitation workflow should be designed separately before expanding access.
