# Project quality profile

Isolated experiment, Nov 5, 2026. Inspected the prior dependency-free Node 24 harness and research before choosing this separate Node 24 ESM/SQLite application. SimpleWebAuthn is the only runtime integration; static semantic HTML/CSS/JS needs no compilation or framework.

Required local gates: `npm run check` (syntax and source size), `npm test` (canonicalization/amount tests and real Chrome protocol tests with virtual authenticators), and `npm audit --omit=dev`. Lockfile pins dependencies; install with `npm ci --ignore-scripts`. Browser tests require installed Google Chrome. No verifier mocks are used. Human passkey and assistive-technology gates are recorded separately and cannot be replaced by automated scores.

Source files target 200 lines, warn above 200 and fail above 300. Generated dependency files, lockfiles, JSON evidence and Markdown are excluded. No build step, deployment, hooks or remote CI is configured for this local experiment. Before any future publication, rerun these same gates in CI and independently review test access/secrets. Local commits use descriptive conventional commit messages. No repository instruction files or cloned references are modified.
