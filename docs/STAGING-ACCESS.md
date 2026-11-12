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

1. Open the owner's returning-account page **https://saysure-staging-cnhm.onrender.com/app/login**.
2. Sign in as `helper` using the Helper secret supplied privately by the project owner.
3. Create a clearly synthetic request. Select `buyer-a` or `buyer-b` as the recipient.
4. Open **/app/login** in a separate browser profile or device, then sign in as the selected Buyer.
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


## Self-service judge testing (private synthetic trial)
The public staging workspace now provides a bounded, no-signup way to exercise **the actual authenticated Helper/Buyer APIs**:
1. Open `/app` and select **Start testing**. The server creates an isolated Helper and Buyer identity, logs the Helper in, and preloads one clearly fictional request. Save the **Helper username/password** presented once.
2. Copy **only** the one-time Buyer invitation code (valid for 30 minutes), and give it to another person or open a separate browser profile/device. The Helper must not use the Buyer's passkey.
3. The Buyer opens `/app`, enters the invitation code under **Join as Buyer**, and receives a private username/password upon claiming it. The invitation cannot be reused.
4. Buyer refreshes the pending request, then declines without a passkey or registers their own passkey for local consent. The Helper sees their own request status after refreshing.
5. Test trials do **not** allow PayPal order imports or payment operations. Private trial accounts are limited and isolated to their designated Buyer; there is no email identity verification and these are not production user accounts.

Staging maintains its original fixed accounts for owner testing. Trial identities are stored separately and do not affect their passwords, sessions, passkeys or records. A trial invite is shown once; retain the code before closing that page.

## Public workspace entry and returning-test access (November 12 update)

The public `/app` route intentionally has no sign-in form and no public registration. New visitors choose **Start testing** or **Join as Buyer**; their credentials are issued by the server and may be saved privately. A separate owner/returning-test page, `/app/login`, accepts previously issued username/password pairs so sessions can be resumed without deleting previous accounts, requests or passkeys. This route does not enable new user sign-up, nor does it bypass authentication. The **Copy my login** control includes the returning-test page URL. When finished, sign out to return to the clean public workspace entry.
