# Verification record

Checked locally on 18 November 2026. These are observed results, not performance or production-readiness claims.

- Backend: `python -m pytest -q` — 37 tests passed.
- Frontend: `npm run lint` and `npm run typecheck` passed.
- `npm run build` produced the optimized Next.js application successfully.
- `npm audit` reported zero known dependency vulnerabilities in the resolved tree at verification time. This is time-sensitive and does not prove the absence of security defects.
- Browser smoke checks against the production-built frontend: account registration, project creation, file creation, authenticated editor connection, native Monaco typing, server-confirmed saves, and edits propagating between two browser tabs (same account).
- The automated WebSocket integration test separately covers two distinct registered users, sharing, synchronized edits, stale-write rejection, and persistence. It is not a browser automation suite.
- Monaco and its language/editor workers were served locally; the browser console had no errors during the editor smoke check.

One dependency emits a Starlette/httpx test-client deprecation warning; tests pass. Local Node 26 produced a Node deprecation warning while building. CI targets Node 22 and Python 3.13.

Not verified here: public deployment, load testing, multi-worker operation, a full penetration test, or all browser/mobile combinations. The code deliberately documents those boundaries rather than claiming production readiness.
