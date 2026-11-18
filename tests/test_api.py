import os
import sqlite3
import subprocess
import sys

import pytest
from fastapi.testclient import TestClient
from conftest import authorization, project_file, register
from main import create_app


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_register_login_and_me(client):
    token = register(client)
    me = client.get("/auth/me", headers=authorization(token))
    assert me.status_code == 200
    assert me.json()["username"] == "owner"
    assert "hashed_password" not in me.json()
    login = client.post("/auth/login", data={"username": "owner", "password": "test-password-42"})
    assert login.status_code == 200
    assert login.json()["token_type"] == "bearer"
    assert client.get("/auth/me", headers=authorization(login.json()["access_token"])).status_code == 200


def test_password_stored_as_salted_hash(client):
    register(client, "first")
    register(client, "second")
    with sqlite3.connect(client.app.state.database_path) as db:
        hashes = [row[0] for row in db.execute("SELECT hashed_password FROM users")]
    assert hashes[0] != hashes[1]
    assert all(value.startswith("scrypt$") and "test-password-42" not in value for value in hashes)


def test_duplicate_username(client):
    register(client)
    response = client.post("/auth/register", json={"username": "owner", "password": "different-password"})
    assert response.status_code == 409


@pytest.mark.parametrize("username,password", [("x", "test-password"), ("bad<script>", "test-password"),
                                                 ("owner", "short"), ("owner", "x" * 129)])
def test_registration_validation(client, username, password):
    assert client.post("/auth/register", json={"username": username, "password": password}).status_code == 422


@pytest.mark.parametrize("password", ["wrong-password", "x" * 129])
def test_wrong_password(client, password):
    register(client)
    assert client.post("/auth/login", data={"username": "owner", "password": password}).status_code == 401


@pytest.mark.parametrize("route", ["/auth/me", "/projects", "/projects/1", "/projects/1/files", "/projects/1/files/1"])
def test_authentication_required(client, route):
    assert client.get(route).status_code == 401
    assert client.get(route, headers=authorization("not-a-token")).status_code == 401


def test_project_lifecycle(client):
    token = register(client)
    headers = authorization(token)
    project = client.post("/projects", headers=headers, json={"name": "My project"}).json()["project"]
    base = f"/projects/{project['id']}"
    assert client.get(base, headers=headers).json()["name"] == "My project"
    assert len(client.get("/projects", headers=headers).json()) == 1
    assert client.put(base, headers=headers, json={"name": "Renamed"}).json()["name"] == "Renamed"
    assert client.delete(base, headers=headers).status_code == 200
    assert client.get(base, headers=headers).status_code == 404


def test_caller_cannot_set_owner(client):
    token = register(client)
    assert client.post("/projects", headers=authorization(token), json={"name": "Bad", "owner_id": 999}).status_code == 422


def test_unrelated_user_cannot_read_or_mutate(client):
    owner = register(client)
    outsider = register(client, "outsider")
    project, file = project_file(client, owner)
    base = f"/projects/{project['id']}"
    headers = authorization(outsider)
    assert client.get("/projects", headers=headers).json() == []
    for method, route, payload in [("get", base, None), ("put", base, {"name": "stolen"}),
        ("delete", base, None), ("post", base + "/files", {"name": "x.py"}),
        ("get", base + "/files", None), ("get", base + f"/files/{file['id']}", None),
        ("put", base + f"/files/{file['id']}", {"content": "stolen", "version": 0}),
        ("delete", base + f"/files/{file['id']}", None)]:
        kwargs = {"headers": headers}
        if payload is not None:
            kwargs["json"] = payload
        assert getattr(client, method)(route, **kwargs).status_code == 404


def test_shared_members_can_edit_but_not_manage_project(client):
    owner, member = register(client), register(client, "member")
    project, file = project_file(client, owner)
    base = f"/projects/{project['id']}"
    assert client.post(base + "/members", headers=authorization(owner), params={"username": "member"}).status_code == 200
    headers = authorization(member)
    assert len(client.get("/projects", headers=headers).json()) == 1
    assert client.put(base + f"/files/{file['id']}", headers=headers, json={"content": "shared", "version": 0}).status_code == 200
    assert client.delete(base, headers=headers).status_code == 403
    assert client.put(base, headers=headers, json={"name": "bad"}).status_code == 403
    assert client.post(base + "/members", headers=headers, params={"username": "owner"}).status_code == 403


def test_nested_file_ids_are_scoped_to_project(client):
    token = register(client)
    p1, f1 = project_file(client, token)
    p2, f2 = project_file(client, token)
    assert client.get(f"/projects/{p1['id']}/files/{f2['id']}", headers=authorization(token)).status_code == 404


def test_file_lifecycle_and_conflict(client):
    token = register(client)
    project, file = project_file(client, token)
    headers = authorization(token)
    base = f"/projects/{project['id']}/files/{file['id']}"
    renamed = client.put(base, headers=headers, json={"name": "renamed.py"})
    assert renamed.json()["name"] == "renamed.py"
    saved = client.put(base, headers=headers, json={"content": "new", "version": 0})
    assert saved.json()["version"] == 1
    stale = client.put(base, headers=headers, json={"content": "old", "version": 0})
    assert stale.status_code == 409
    assert stale.json()["detail"]["content"] == "new"
    assert client.get(base, headers=headers).json()["content"] == "new"
    assert client.put(base, headers=headers, json={"content": "no version"}).status_code == 422
    assert client.delete(base, headers=headers).status_code == 200
    assert client.get(base, headers=headers).status_code == 404


def test_duplicate_file_and_blank_names(client):
    token = register(client)
    project, file = project_file(client, token)
    base = f"/projects/{project['id']}/files"
    headers = authorization(token)
    assert client.post(base, headers=headers, json={"name": file["name"]}).status_code == 409
    for name in [" ", "../bad.py", "folder/file.py"]:
        assert client.post(base, headers=headers, json={"name": name}).status_code == 422
    assert client.post("/projects", headers=headers, json={"name": " "}).status_code == 422


def test_deletion_cascades(client):
    token = register(client)
    project, file = project_file(client, token)
    client.delete(f"/projects/{project['id']}", headers=authorization(token))
    with sqlite3.connect(client.app.state.database_path) as db:
        assert db.execute("SELECT COUNT(*) FROM files").fetchone()[0] == 0


def test_state_survives_new_app_instance(client):
    token = register(client)
    project, file = project_file(client, token)
    # A new app object and connection simulate restart. Login again with a new signing key.
    new_app = create_app(client.app.state.database_path, secret_key="test-only-new-signing-key-1234567890")
    with TestClient(new_app) as restarted:
        login = restarted.post("/auth/login", data={"username": "owner", "password": "test-password-42"})
        headers = authorization(login.json()["access_token"])
        assert restarted.get(f"/projects/{project['id']}/files/{file['id']}", headers=headers).json()["content"] == file["content"]


def test_missing_key_fails_closed():
    env = os.environ.copy()
    env.pop("CODECOLLAB_SECRET_KEY", None)
    result = subprocess.run([sys.executable, "-c", "import main"], env=env, capture_output=True, text=True)
    assert result.returncode != 0
    assert "Set CODECOLLAB_SECRET_KEY" in result.stderr


def test_cors_allowlist(client):
    allowed = client.options("/projects", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
    denied = client.options("/projects", headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in denied.headers


def test_forged_and_expired_tokens_rejected(client):
    import jwt
    from datetime import datetime, timedelta, timezone
    token = register(client)
    now = datetime.now(timezone.utc)
    payload = {"sub": "1", "iat": now, "exp": now + timedelta(hours=1)}
    forged = jwt.encode(payload, "test-only-untrusted-key-123456789012", algorithm="HS256")
    assert client.get("/projects", headers=authorization(forged)).status_code == 401
    test_key = "test-only-known-key-1234567890123456"
    with TestClient(create_app(client.app.state.database_path, secret_key=test_key)) as app:
        expired = jwt.encode({"sub": "1", "iat": now - timedelta(hours=2), "exp": now - timedelta(hours=1)}, test_key, algorithm="HS256")
        assert app.get("/projects", headers=authorization(expired)).status_code == 401
