"""CodeCollab API: authenticated projects, durable files, versioned collaboration."""
import asyncio
import hashlib
import hmac
import secrets
import sqlite3
import time
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

from config import allowed_origins, signing_key
from database import configured_path, connect, initialize
from models import FileSchema, FileUpdate, ProjectSchema, RegisterRequest
from ws import ConnectionManager

ALGORITHM = "HS256"
TOKEN_MINUTES = 60
bearer = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password, stored):
    try:
        algorithm, salt, expected = stored.split("$")
        if algorithm != "scrypt":
            return False
        actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1)
        return hmac.compare_digest(actual, bytes.fromhex(expected))
    except (ValueError, TypeError):
        return False


def create_app(database_path=None, secret_key=None):
    key = secret_key or signing_key()
    db_path = database_path or configured_path()
    initialize(db_path)
    app = FastAPI(title="CodeCollab API", version="0.2.0")
    app.add_middleware(CORSMiddleware, allow_origins=allowed_origins(),
                       allow_methods=["GET", "POST", "PUT", "DELETE"],
                       allow_headers=["Authorization", "Content-Type"])
    manager = ConnectionManager()
    app.state.database_path = db_path
    app.state.manager = manager

    def get_db():
        db = connect(db_path)
        try:
            yield db
        finally:
            db.close()

    def issue_token(user):
        now = datetime.now(timezone.utc)
        token = jwt.encode({"sub": str(user["id"]), "iat": now,
                            "exp": now + timedelta(minutes=TOKEN_MINUTES)}, key, algorithm=ALGORITHM)
        return {"access_token": token, "token_type": "bearer"}

    def authenticate(token, db):
        try:
            payload = jwt.decode(token, key, algorithms=[ALGORITHM],
                                 options={"require": ["sub", "iat", "exp"]})
            user_id = int(payload["sub"])
            user = db.execute("SELECT id, username FROM users WHERE id = ?", (user_id,)).fetchone()
            if user is not None:
                return dict(user), payload["exp"]
        except (jwt.PyJWTError, ValueError, TypeError):
            pass
        raise HTTPException(401, "Invalid or expired authentication", headers={"WWW-Authenticate": "Bearer"})

    def current_user(token: str = Depends(bearer), db=Depends(get_db)):
        return authenticate(token, db)[0]

    def accessible_project(db, project_id, user, owner_only=False):
        project = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if project is None:
            raise HTTPException(404, "Project not found")
        if project["owner_id"] != user["id"]:
            member = db.execute("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?",
                                (project_id, user["id"])).fetchone()
            if member is None:
                # Do not reveal whether someone else's project exists.
                raise HTTPException(404, "Project not found")
            if owner_only:
                raise HTTPException(403, "Only the project owner can perform this operation")
        return dict(project)

    def require_file(db, project_id, file_id):
        item = db.execute("SELECT * FROM files WHERE id = ? AND project_id = ?", (file_id, project_id)).fetchone()
        if item is None:
            raise HTTPException(404, "File not found")
        return dict(item)

    def update_file_content(db, project_id, file_id, content, version):
        with db:
            result = db.execute("UPDATE files SET content = ?, version = version + 1 WHERE id = ? AND project_id = ? AND version = ?",
                                (content, file_id, project_id, version))
            item = require_file(db, project_id, file_id)
            if result.rowcount == 0:
                raise HTTPException(409, {"message": "File changed; review the latest version before saving.",
                                          "content": item["content"], "version": item["version"]})
        return item

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.post("/auth/register", status_code=201)
    def register(payload: RegisterRequest, db=Depends(get_db)):
        try:
            with db:
                cursor = db.execute("INSERT INTO users (username, hashed_password) VALUES (?, ?)",
                                    (payload.username, hash_password(payload.password)))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "Username is already registered")
        return issue_token({"id": cursor.lastrowid})

    @app.post("/auth/login")
    def login(form: OAuth2PasswordRequestForm = Depends(), db=Depends(get_db)):
        if len(form.password) > 128:
            raise HTTPException(401, "Invalid username or password")
        user = db.execute("SELECT * FROM users WHERE username = ?", (form.username,)).fetchone()
        if user is None or not verify_password(form.password, user["hashed_password"]):
            raise HTTPException(401, "Invalid username or password", headers={"WWW-Authenticate": "Bearer"})
        return issue_token(user)

    @app.get("/auth/me")
    def me(user=Depends(current_user)):
        return user

    @app.get("/projects")
    def list_projects(user=Depends(current_user), db=Depends(get_db)):
        return [dict(row) for row in db.execute("""SELECT p.* FROM projects p
            WHERE p.owner_id = ? OR EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = ?)
            ORDER BY p.id""", (user["id"], user["id"]))]

    @app.post("/projects", status_code=201)
    def create_project(payload: ProjectSchema, user=Depends(current_user), db=Depends(get_db)):
        with db:
            cursor = db.execute("INSERT INTO projects (name, owner_id) VALUES (?, ?)", (payload.name, user["id"]))
        return {"project": accessible_project(db, cursor.lastrowid, user)}

    @app.get("/projects/{project_id}")
    def get_project(project_id: int, user=Depends(current_user), db=Depends(get_db)):
        return accessible_project(db, project_id, user)

    @app.put("/projects/{project_id}")
    def rename_project(project_id: int, payload: ProjectSchema, user=Depends(current_user), db=Depends(get_db)):
        accessible_project(db, project_id, user, owner_only=True)
        with db:
            db.execute("UPDATE projects SET name = ? WHERE id = ?", (payload.name, project_id))
        return accessible_project(db, project_id, user)

    @app.delete("/projects/{project_id}")
    def delete_project(project_id: int, user=Depends(current_user), db=Depends(get_db)):
        accessible_project(db, project_id, user, owner_only=True)
        with db:
            db.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        return {"message": "Project deleted"}

    @app.post("/projects/{project_id}/members")
    def add_member(project_id: int, username: str, user=Depends(current_user), db=Depends(get_db)):
        accessible_project(db, project_id, user, owner_only=True)
        member = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if member is None:
            raise HTTPException(404, "User not found")
        with db:
            db.execute("INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)", (project_id, member["id"]))
        return {"message": "Project shared", "username": username}

    @app.get("/projects/{project_id}/files")
    def list_files(project_id: int, user=Depends(current_user), db=Depends(get_db)):
        accessible_project(db, project_id, user)
        return [dict(row) for row in db.execute("SELECT * FROM files WHERE project_id = ? ORDER BY id", (project_id,))]

    @app.post("/projects/{project_id}/files", status_code=201)
    def create_file(project_id: int, payload: FileSchema, user=Depends(current_user), db=Depends(get_db)):
        accessible_project(db, project_id, user)
        try:
            with db:
                cursor = db.execute("INSERT INTO files (project_id, name, content) VALUES (?, ?, ?)",
                                    (project_id, payload.name, payload.content))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "A file with that name already exists")
        return require_file(db, project_id, cursor.lastrowid)

    @app.get("/projects/{project_id}/files/{file_id}")
    def get_file(project_id: int, file_id: int, user=Depends(current_user), db=Depends(get_db)):
        accessible_project(db, project_id, user)
        return require_file(db, project_id, file_id)

    @app.put("/projects/{project_id}/files/{file_id}")
    async def update_file(project_id: int, file_id: int, payload: FileUpdate, user=Depends(current_user), db=Depends(get_db)):
        accessible_project(db, project_id, user)
        require_file(db, project_id, file_id)
        try:
            # One transaction ensures an optional rename and content update succeed together.
            with db:
                if payload.content is not None:
                    result = db.execute("UPDATE files SET content = ?, version = version + 1 WHERE id = ? AND project_id = ? AND version = ?",
                                        (payload.content, file_id, project_id, payload.version))
                    if result.rowcount == 0:
                        latest = require_file(db, project_id, file_id)
                        raise HTTPException(409, {"message": "File changed; reload before saving.", "content": latest["content"], "version": latest["version"]})
                if payload.name is not None:
                    db.execute("UPDATE files SET name = ? WHERE id = ? AND project_id = ?", (payload.name, file_id, project_id))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "A file with that name already exists")
        saved = require_file(db, project_id, file_id)
        if payload.content is not None:
            await manager.broadcast((project_id, file_id), {"type": "edit", "user": user["username"], "content": saved["content"], "version": saved["version"]})
        return saved

    @app.delete("/projects/{project_id}/files/{file_id}")
    def delete_file(project_id: int, file_id: int, user=Depends(current_user), db=Depends(get_db)):
        accessible_project(db, project_id, user)
        require_file(db, project_id, file_id)
        with db:
            db.execute("DELETE FROM files WHERE id = ? AND project_id = ?", (file_id, project_id))
        return {"message": "File deleted"}

    @app.websocket("/ws/{project_id}/files/{file_id}")
    async def collaborate(socket: WebSocket, project_id: int, file_id: int):
        origin = socket.headers.get("origin")
        if origin is not None and origin not in allowed_origins():
            await socket.close(code=1008)
            return
        await socket.accept()
        room_key = (project_id, file_id)
        joined = False
        db = connect(db_path)
        try:
            # Authenticate in the first frame rather than leaking bearer tokens in URLs/logs.
            auth = await asyncio.wait_for(socket.receive_json(), timeout=5)
            if not isinstance(auth, dict) or auth.get("type") != "auth" or not isinstance(auth.get("token"), str):
                await socket.close(code=1008)
                return
            user, expires = authenticate(auth["token"], db)
            accessible_project(db, project_id, user)
            item = require_file(db, project_id, file_id)
            manager.connect(room_key, socket, user["username"])
            joined = True
            await socket.send_json({"type": "auth_ok", "user": user["username"], "content": item["content"], "version": item["version"]})
            await manager.presence(room_key)
            while True:
                remaining = expires - time.time()
                if remaining <= 0:
                    await socket.close(code=1008)
                    break
                message = await asyncio.wait_for(socket.receive_json(), timeout=remaining)
                accessible_project(db, project_id, user)
                if not isinstance(message, dict):
                    await socket.send_json({"type": "error", "message": "Expected an object"})
                    continue
                if message.get("type") == "edit":
                    content, version = message.get("content"), message.get("version")
                    if not isinstance(content, str) or len(content) > 200_000 or type(version) is not int or version < 0:
                        await socket.send_json({"type": "error", "message": "Provide content (up to 200000 characters) and a nonnegative integer version"})
                        continue
                    try:
                        item = update_file_content(db, project_id, file_id, content, version)
                    except HTTPException as exc:
                        if exc.status_code != 409:
                            raise
                        await socket.send_json({"type": "conflict", **exc.detail})
                        continue
                    await socket.send_json({"type": "saved", "version": item["version"], "content": item["content"]})
                    await manager.broadcast(room_key, {"type": "edit", "user": user["username"], "content": item["content"], "version": item["version"]}, exclude=socket)
                elif message.get("type") == "cursor":
                    position = message.get("position")
                    if type(position) is int and 0 <= position <= 200_000:
                        await manager.broadcast(room_key, {"type": "cursor", "user": user["username"], "position": position}, exclude=socket)
                else:
                    await socket.send_json({"type": "error", "message": "Unknown message type"})
        except (WebSocketDisconnect, RuntimeError):
            pass
        except (HTTPException, asyncio.TimeoutError, ValueError):
            try:
                await socket.close(code=1008)
            except RuntimeError:
                pass
        finally:
            db.close()
            if joined:
                manager.disconnect(room_key, socket)
                await manager.presence(room_key)

    return app


app = create_app()
