# Security notes

## Signing-key migration

Earlier repository revisions included a fixed JWT signing value. Treat that value as compromised. This version no longer uses it. Generate a new random `CODECOLLAB_SECRET_KEY` for every environment; changing it invalidates existing tokens. If any deployed instance used the old value, change its runtime configuration and require users to sign in again. Removing a value from current source does not erase Git history. Never reuse the old value.

## Implemented controls

- Server-side project/file membership checks, including WebSocket access.
- Signed, expiring JWTs with explicit algorithm and required claims.
- Salted scrypt password hashes; no plaintext passwords stored.
- Parameterized SQL, input length limits, and filename/username validation.
- Allowlisted HTTP and WebSocket origins.
- Authentication in the first WebSocket frame instead of URL query parameters.
- Conditional file-version writes to reject stale changes.
- Ignored environment/database files and a credential-free configuration template.

## Not a production guarantee

Before internet-facing hosting, add rate limits (especially login/registration), TLS, a considered token/session strategy, backups, dependency monitoring, and resource/request-size limits. The app has no account recovery, email verification, audit-log system, or security penetration-test certification. It uses a single-process room manager and should run with one API worker.

## Reporting

Do not post credentials or exploit data in a public issue. Use GitHub's private vulnerability reporting if enabled or contact the repository owner privately.
