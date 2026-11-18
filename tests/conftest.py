import os
import secrets
import tempfile

import pytest
from fastapi.testclient import TestClient

# Test-only configuration; no developer or production credentials are read.
_import_store = tempfile.TemporaryDirectory()
os.environ["CODECOLLAB_SECRET_KEY"] = secrets.token_urlsafe(48)
os.environ["CODECOLLAB_DATABASE_PATH"] = _import_store.name + "/import.sqlite3"

from main import create_app


@pytest.fixture
def client(tmp_path):
    app = create_app(str(tmp_path / "test.sqlite3"), secret_key=secrets.token_urlsafe(48))
    with TestClient(app) as test_client:
        yield test_client


def register(client, username="owner"):
    response = client.post("/auth/register", json={"username": username, "password": "test-password-42"})
    assert response.status_code == 201
    return response.json()["access_token"]


def authorization(token):
    return {"Authorization": f"Bearer {token}"}


def project_file(client, token):
    headers = authorization(token)
    project = client.post("/projects", headers=headers, json={"name": "Workspace"}).json()["project"]
    file = client.post(f"/projects/{project['id']}/files", headers=headers,
                       json={"name": "hello.py", "content": "print('hello')"}).json()
    return project, file
