import asyncio
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from starlette.websockets import WebSocketDisconnect

from conftest import authorization, project_file, register
from ws import ConnectionManager


def join(client, route, token):
    return client.websocket_connect(route)


def auth(socket, token):
    socket.send_json({"type": "auth", "token": token})
    ack = socket.receive_json()
    assert ack["type"] == "auth_ok"
    assert socket.receive_json()["type"] == "presence"
    return ack


def test_two_clients_sync_ack_conflicts_and_persistence(client):
    owner, member = register(client), register(client, "member")
    project, file = project_file(client, owner)
    client.post(f"/projects/{project['id']}/members", headers=authorization(owner), params={"username": "member"})
    route = f"/ws/{project['id']}/files/{file['id']}"
    with client.websocket_connect(route) as a:
        assert auth(a, owner)["version"] == 0
        with client.websocket_connect(route) as b:
            auth(b, member)
            assert a.receive_json()["users"] == ["member", "owner"]
            a.send_json({"type": "edit", "content": "saved by owner", "version": 0})
            assert a.receive_json() == {"type": "saved", "version": 1, "content": "saved by owner"}
            update = b.receive_json()
            assert update["type"] == "edit" and update["user"] == "owner" and update["version"] == 1
            b.send_json({"type": "edit", "content": "stale text", "version": 0})
            conflict = b.receive_json()
            assert conflict["type"] == "conflict" and conflict["content"] == "saved by owner"
            b.send_json({"type": "edit", "content": "reviewed merge", "version": 1})
            assert b.receive_json()["version"] == 2
            assert a.receive_json()["content"] == "reviewed merge"
        assert a.receive_json()["users"] == ["owner"]
    saved = client.get(f"/projects/{project['id']}/files/{file['id']}", headers=authorization(owner)).json()
    assert saved["content"] == "reviewed merge" and saved["version"] == 2


@pytest.mark.parametrize("token_mode", ["invalid", "outsider"])
def test_websocket_rejects_bad_auth_or_nonmember(client, token_mode):
    token = register(client)
    project, file = project_file(client, token)
    bad = "invalid" if token_mode == "invalid" else register(client, "outsider")
    with client.websocket_connect(f"/ws/{project['id']}/files/{file['id']}") as ws:
        ws.send_json({"type": "auth", "token": bad})
        with pytest.raises(WebSocketDisconnect) as error:
            ws.receive_json()
        assert error.value.code == 1008


def test_query_string_token_does_not_authenticate(client):
    token = register(client)
    project, file = project_file(client, token)
    # A query value is deliberately ignored. The initial auth frame is mandatory.
    with client.websocket_connect(f"/ws/{project['id']}/files/{file['id']}?token=ignored") as ws:
        ws.send_json({"type": "edit", "content": "bad", "version": 0})
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()


def test_websocket_origin_allowlist(client):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/1/files/1", headers={"origin": "https://untrusted.example"}):
            pass


def test_websocket_invalid_content_does_not_write(client):
    token = register(client)
    project, file = project_file(client, token)
    with client.websocket_connect(f"/ws/{project['id']}/files/{file['id']}") as ws:
        auth(ws, token)
        for message in [{"type": "edit", "content": "x" * 200001, "version": 0},
                        {"type": "edit", "content": "bad", "version": True}, ["not an object"]]:
            ws.send_json(message)
            assert ws.receive_json()["type"] == "error"
    assert client.get(f"/projects/{project['id']}/files/{file['id']}", headers=authorization(token)).json()["version"] == 0


def test_multiple_tabs_keep_presence_until_last_tab_leaves(client):
    token = register(client)
    project, file = project_file(client, token)
    route = f"/ws/{project['id']}/files/{file['id']}"
    with client.websocket_connect(route) as first:
        auth(first, token)
        with client.websocket_connect(route) as second:
            auth(second, token)
            assert first.receive_json()["users"] == ["owner"]
        assert first.receive_json()["users"] == ["owner"]


def test_room_broadcast_handles_disconnected_peer():
    class Socket:
        def __init__(self, fail=False):
            self.fail = fail
            self.messages = []
        async def send_json(self, message):
            if self.fail:
                raise RuntimeError("closed")
            self.messages.append(message)
    async def scenario():
        manager = ConnectionManager()
        bad, good = Socket(True), Socket()
        manager.connect((1, 1), bad, "bad")
        manager.connect((1, 1), good, "good")
        await manager.broadcast((1, 1), {"type": "test"})
        assert good.messages == [{"type": "test"}]
        assert manager.users((1, 1)) == ["good"]
    asyncio.run(scenario())


def test_http_save_notifies_connected_editor(client):
    token = register(client)
    project, file = project_file(client, token)
    with client.websocket_connect(f"/ws/{project['id']}/files/{file['id']}") as ws:
        auth(ws, token)
        saved = client.put(f"/projects/{project['id']}/files/{file['id']}", headers=authorization(token),
                           json={"content": "HTTP save", "version": 0})
        assert saved.status_code == 200
        assert ws.receive_json() == {"type": "edit", "user": "owner", "content": "HTTP save", "version": 1}


def test_file_rooms_do_not_leak_edits(client):
    token = register(client)
    project, file = project_file(client, token)
    other = client.post(f"/projects/{project['id']}/files", headers=authorization(token), json={"name": "other.py"}).json()
    with client.websocket_connect(f"/ws/{project['id']}/files/{file['id']}") as a:
        auth(a, token)
        with client.websocket_connect(f"/ws/{project['id']}/files/{other['id']}") as b:
            auth(b, token)
            a.send_json({"type": "edit", "content": "first file only", "version": 0})
            assert a.receive_json()["type"] == "saved"
            # Its next response must be its own save acknowledgement, not the other room's edit.
            b.send_json({"type": "edit", "content": "second file only", "version": 0})
            assert b.receive_json()["type"] == "saved"
