# CodeCollab

A collaborative code workspace built with **Next.js, TypeScript, Monaco, FastAPI, WebSockets, and SQLite**. Create a project, invite another registered user, and edit shared files with presence indicators and explicit version-conflict handling.

This is a portfolio-scale application, not a distributed editor or a code-execution sandbox. The source includes the server implementation, automated regression tests, and a reproducible local setup.

## What works

- Registration and login with salted scrypt password hashes and expiring JWTs.
- Project ownership and membership checked by the server on REST and WebSocket access.
- Persistent users, projects, memberships, file contents, and file versions in SQLite.
- Project/file creation, rename, deletion, and owner-controlled project sharing.
- File-room WebSocket synchronization, collaborator presence, and remote cursors.
- Self-hosted Monaco editor and workers built from installed dependencies; no runtime editor CDN requirement.
- Server-confirmed save status; stale versions are rejected rather than silently overwriting a newer save.
- Explicit conflict choices, debounced saves, and navigation safeguards.
- GitHub Actions checks for backend tests, lint, TypeScript, and production build.

## Quick start

Prerequisites: **Python 3.13** and **Node.js 22+**. Run all commands from the repository root. There are no `backend/` or `frontend/` subdirectories.

```sh
git clone https://github.com/BhavyaS-25/LiveCodeProject.git
cd LiveCodeProject
# If reviewing the improvement PR before it is merged:
git switch improve/recruiter-ready
python3 -m venv .venv
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r requirements-lock.txt
npm ci
cp .env.example .env
# Windows PowerShell: Copy-Item .env.example .env
```

Generate a fresh signing key locally:

```sh
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Paste that value into `CODECOLLAB_SECRET_KEY=` in `.env`. Do not commit it. The backend deliberately refuses to start without a sufficiently long key. Never put a signing key in a `NEXT_PUBLIC_*` variable.

Terminal 1, from the root with the virtual environment activated:

```sh
python -m uvicorn main:app --env-file .env --host 127.0.0.1 --port 8000
```

Terminal 2, from the root:

```sh
npm run dev
```

Open http://localhost:3000. API documentation: http://localhost:8000/docs. Health check: http://localhost:8000/health.

### Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `CODECOLLAB_SECRET_KEY` | Random server-only JWT signing key | Required |
| `CODECOLLAB_DATABASE_PATH` | Persistent SQLite file | `./data/codecollab.sqlite3` |
| `CODECOLLAB_ALLOWED_ORIGINS` | Comma-separated frontend origins, used for CORS and WebSockets | localhost and 127.0.0.1 on port 3000 |
| `NEXT_PUBLIC_API_URL` | Browser-visible API origin | `http://localhost:8000` |

Next.js reads `.env` for frontend configuration. Restart it after changing variables. For production, `NEXT_PUBLIC_API_URL` is set at frontend build time. WebSocket URLs derive `ws`/`wss` from this origin. Local data and environment files are ignored by Git.

## Try a two-user demo

1. Register an owner account, create a project, then create `hello.py`.
2. In a private browser window, register a second account.
3. As the owner, share the project with that account's username.
4. Open the same file in both windows. Wait for **connected** in each.
5. Type in one window. The other receives the saved content; the sender shows **Saved** only after the server acknowledges persistence.
6. For a conflict demonstration, both clients send edits based on the same version. The first committed edit wins that version; the other client sees a conflict and retains its local text for review.
7. Restart the backend. Sign in again and verify that the project/files remain.

Do not type real secrets or sensitive code into a demo. There is no public hosted demo URL in this repository yet.

## Run the checks

```sh
python -m pytest -q
npm run lint
npm run typecheck
npm run build
npm audit
```

`requirements.txt` and `requirements-dev.txt` list direct dependencies. `requirements-lock.txt` pins the development/test environment, including transitive packages. `package-lock.json` is used by `npm ci`. Tests create isolated temporary databases and test-only signing keys; they do not use your `.env` or local project data.

The frontend includes a same-major DOMPurify override because Monaco pins an older sanitizer. Recheck that override on dependency upgrades; do not remove it without running the dependency audit and editor smoke test.

## Architecture and tradeoffs

See [architecture](docs/architecture.md) for the request flow, access-control model, and conflict protocol, and [security](SECURITY.md) for deployment boundaries and signing-key migration.

## Repository layout

```text
app/                    Next.js routes and styles
lib/api.ts              Shared HTTP configuration, errors, and WS URL builder
main.py                 FastAPI REST and WebSocket application
config.py               Server configuration validation
database.py             SQLite schema and connections
models.py               Validated request schemas
ws.py                   In-process file-room/presence manager
tests/                  API, authorization, persistence, and collaboration tests
.github/workflows/ci.yml Automated backend/frontend checks
.env.example            Configuration template with no credentials
```

## Limitations

- Collaboration uses full-document messages and optimistic versions, not CRDT/OT merging. Simultaneous edits require a user decision; it is not Google Docs-style automatic merge.
- Run **one API worker**: room membership is in memory. SQLite persists documents, not socket rooms. Multi-worker deployment needs shared pub/sub and coordinated presence.
- Browser bearer tokens are in local storage. XSS prevention remains important; production cookie/session design deserves a separate review.
- No password reset, email verification, abuse throttling, role-based read-only sharing, offline queue, or code execution.
- Public hosting requires HTTPS/WSS, restricted origins, persistent storage/backups, resource limits, rate limiting, and operational monitoring. Passing tests is not a production security certification.
- Refresh/closing a tab can discard unsaved changes; the editor warns where browsers permit it. Do not treat the browser as durable storage.
