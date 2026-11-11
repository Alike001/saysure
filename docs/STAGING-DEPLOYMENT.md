# SaySure HTTPS staging

This service runs the authenticated SaySure application on Render and stores its state in the existing Neon PostgreSQL project. It is separate from the localhost SQLite experiment and does not copy or modify the local `.local/consent.sqlite` database.

## Deployment source

- Repository: `Alike001/saysure`
- Branch: `feat/saysure-postgres-runtime`
- Blueprint: [render.yaml](../render.yaml)
- Runtime: Node 24
- Database: Neon PostgreSQL 17, using the pooled connection string
- Render plan: Free
- Region: Frankfurt
- Health check: `/healthz` (liveness only)
- Database readiness: `/readyz` (executes a bounded `SELECT 1`)

Render auto-deploy is disabled. Deploy only after the branch's GitHub Actions checks pass.

## Required private environment variables

Set these in the Render service environment settings. Do not commit them or paste them into chat.

| Variable | Requirement |
| --- | --- |
| `DATABASE_URL` | Neon pooled PostgreSQL connection string, including TLS settings |
| `STAGING_HELPER_PASSWORD` | At least 16 characters |
| `STAGING_BUYER_A_PASSWORD` | At least 16 characters |
| `STAGING_BUYER_B_PASSWORD` | At least 16 characters |

The blueprint sets `NODE_ENV=production` and `PG_POOL_MAX=4`. Render supplies `PORT` and `RENDER_EXTERNAL_URL`; the server derives the public origin and exact WebAuthn RP ID from that URL.

The first successful PostgreSQL startup creates only the three staging accounts (`helper`, `buyer-a`, `buyer-b`) if the users table is empty. It hashes the supplied passwords and never prints or writes the plaintext values to an account file. If users already exist, startup does not change their passwords. A partial or unexpected account state fails closed.

After the first successful provisioning, remove the three `STAGING_*_PASSWORD` values from Render's environment settings. Subsequent restarts detect the existing three accounts and do not need the bootstrap secrets.

## First deployment checklist

1. Confirm GitHub Actions passes the existing security/browser suite and the PostgreSQL 17 integration suite.
2. Create the Render Blueprint in the intended workspace.
3. Set the five private variables above in the Render service settings before the first deployment.
4. Trigger the first deployment manually.
5. Confirm `/healthz` returns liveness and `/readyz` returns `{"status":"ready","database":"postgres"}`.
6. Sign in with the three staging accounts and enroll new passkeys on the public HTTPS hostname.
7. Remove the bootstrap password variables after confirming account provisioning.

WebAuthn credentials are origin/RP-ID bound. Passkeys enrolled on `localhost` cannot be reused on the Render hostname; enroll fresh staging passkeys. The local SQLite records and local passkeys remain unchanged.

## Safety boundaries

- The Render service uses PostgreSQL; it does not use an ephemeral local SQLite file for production persistence.
- PayPal integration is disabled unless explicitly enabled by a separate operator configuration. This blueprint does not enable it.
- No PayPal order creation, authorization, capture, refund, payout or buyer automation is enabled by this staging configuration.
- The only normal payment-request path available without PayPal configuration is the synthetic review flow.
- Operational diagnostics are bounded and best-effort; they do not authorize or change consent.
- The database pool is capped at four connections with bounded connection, statement and query timeouts.
- The liveness endpoint does not wake Neon. Use `/readyz` when you specifically want to test database readiness.

## Local development

Without `DATABASE_URL`, `npm start` continues to use the existing local SQLite experiment. Do not run `npm run setup` against an already provisioned local database. For PostgreSQL maintenance, set `DATABASE_URL` in the private environment and use `npm run migrate` or `npm run provision:staging`.
