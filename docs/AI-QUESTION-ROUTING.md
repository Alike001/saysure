# Buyer question routing — AI boundary

SaySure uses Groq only to classify a buyer's free-text question into one of six fixed topics: amount, merchant, consent, availability, fees or unknown. The model does not write the answer. The browser generates the answer locally from the currently displayed request using the existing deterministic answer function.

## Data sent

The server sends a redacted question string only. It does not attach the request snapshot, amount, currency, merchant/payee identifiers, order ID, buyer account, passkey data, consent digest, or provider response. Common email addresses, URLs, phone-like numbers, currency amounts, long references and many proper names are redacted before transmission. This redaction is best-effort, not a guarantee that all personal or confidential wording is removed. Buyers are told not to include personal, merchant or payment details in the question.

The API key stays in the server's ignored local .env or server environment. It is never sent to the browser, committed, logged or included in the API response.

## Authority and failure behaviour

The model returns a JSON topic enum only. Unknown or malformed output, provider errors, timeouts and missing configuration use deterministic local keyword routing. The answer always comes from local code and the request already shown to the buyer. The AI cannot approve, decline, revise, consume, authorize, capture, refund or execute a payment.

The authenticated endpoint is buyer-only, same-origin, session/CSRF protected and rate-limited to eight questions per buyer per minute. The standalone demo endpoint accepts only a question and is limited to the local fixture viewer. No question or provider response is persisted.

## Configure locally

Run npm run configure:ai to copy the existing Groq key from the environment, this repository's ignored .env, or the existing sibling capturedesk-feasibility/.env into this repository's ignored .env. The script never prints the key. Then run npm run demo or npm start. Without a key, the feature remains usable through local deterministic matching.

The configured model is openai/gpt-oss-120b. The app makes no retries. See the tests for the redaction, strict topic contract, fallback and rate-limit checks.
