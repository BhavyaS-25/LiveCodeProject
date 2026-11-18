# Architecture and engineering decisions

## Request flow

The Next.js client sends bearer-authenticated REST requests to FastAPI. SQLite stores users, projects, membership, and versioned files. The same permission helpers protect nested REST endpoints and the WebSocket handshake; file IDs are always scoped to their project.

A project owner may invite an existing user, rename the project, or delete it. Members may read and edit project files. Nonmembers receive 404 rather than discovering another user's project metadata. Client-supplied IDs cannot assign ownership.

## Why SQLite?

It makes a small, single-instance demo reproducible without an external database account. Parameterized queries avoid SQL string interpolation; foreign keys cascade deleted projects to their memberships/files. WAL and a busy timeout support the small concurrent-write workload. This is a deliberate scope choice, not a scalability claim.

## Why REST and WebSockets?

REST handles account and project/file lifecycle operations. WebSockets carry active-file edits, save confirmations, presence, and cursor positions. The token is sent in the first WebSocket frame, not a URL query parameter. Origins are checked and connections stop when authentication expires.

## Versioned saves

Each file has a monotonically increasing version. A save submits its last observed version. The database executes a conditional update:

```sql
UPDATE files
SET content = ?, version = version + 1
WHERE id = ? AND project_id = ? AND version = ?;
```

One matching row means the edit was committed. No matching row means another save won first; the server returns the latest content/version without overwriting it. HTTP content writes use the same check and notify active editors.

The browser debounces local edits and does not call a send operation proof of persistence. A `saved` acknowledgement confirms the database write. Incoming updates must not echo back into the send loop. Pending local text must survive a conflict until the user selects the server text or explicitly retries their own text against the newer version.

### WebSocket protocol

1. Connect to `/ws/{project_id}/files/{file_id}` with an allowed Origin.
2. Within five seconds send `{ "type": "auth", "token": "<local bearer token>" }`.
3. Server returns `auth_ok` with canonical content/version and `presence` with unique usernames.
4. Send `edit` with `content` and `version`; receive `saved` or `conflict`. Other sockets in the same room receive `edit` after commit.
5. Cursor messages carry offsets. Usernames are server-derived; clients cannot impersonate another editor through a message's `user` property.

This prevents stale overwrites but does not merge concurrent insertions/deletions. A CRDT would improve simultaneous typing but add substantial state and testing complexity. The limitation is visible in the UI rather than hidden behind a “real-time” label.

## Failure behavior

- Missing/invalid/expired JWT: unauthorized HTTP response or policy-close WebSocket.
- Invalid payload: validation error or WS error; no write.
- Version mismatch: explicit conflict; latest persisted content retained.
- Deleted project/file: later access fails instead of recreating data.
- Multiple tabs for one username: presence remains until that user's final connection leaves.
- Restart: SQLite documents survive; users reconnect and rooms are rebuilt.

## Testing boundaries

The regression suite exercises API auth, owner/member boundaries, nested file scoping, password hashing, stale writes, restart persistence, room isolation, multiple-tab presence, and two connected WebSocket clients. Frontend lint/type checking and production build catch integration/static issues. Browser smoke checks complement these but are not a comprehensive automated end-to-end or load test suite.

## Editor dependency boundary

Monaco is bundled through a client-only component. The predev/prebuild script bundles five language/editor workers with esbuild into ignored generated assets. This keeps the browser on the installed Monaco/DOMPurify versions instead of the React loader’s separate CDN default.
