---
status: accepted
superseded_by:
area: contracts
by: hem
date: 2026-10-10T02:27+05:30
---
# Accounts: Amazon Cognito sign-in to create anything; browsing stays open

Context: a device token alone is easy to reset, which weakens reputation, rate limits and votes. Confirmed in chat on 10 Oct.

Decision:
- One Amazon Cognito user pool per stage: email and password, an emailed verification code, forgot-password by code.
- Browsing is open. Creating reports, scans, votes, cleanups and letters needs a signed-in user: the Cognito ID token as `Authorization: Bearer <token>`. The api verifies the JWT against the pool's JWKS.
- `user_id` is the token's `sub`, opaque. The api sets it on `report_upload`, `scan_session`, votes and cleanups; it never trusts one sent by the phone.
- `device_token` stays. Reputation and rate limits count per user and per device.
- `GET /reports/{id}` and `GET /scans/{id}` show to the owning user; a device token still opens a guest report made before accounts.
- No names or emails in any shape, table or log; the email lives only in Cognito.

Consequences for other lanes: replaces "no login" in 20261010-0115 (the rest stands). Contract: auth section, 401 `unauthorized` and 403 `forbidden`, `COGNITO_*` env vars, a `users` table. I1 adds the pool; the api verifies tokens; the frontend adds sign-in.

Rejected alternatives: no accounts (device token only); phone OTP (SMS cost); social sign-in (more setup, more personal data).
