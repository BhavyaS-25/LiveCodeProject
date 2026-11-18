"""Single-process file rooms; preserve presence across a user's multiple tabs."""
from fastapi import WebSocket, WebSocketDisconnect


class ConnectionManager:
    def __init__(self):
        self.rooms: dict[tuple[int, int], dict[WebSocket, str]] = {}

    def connect(self, key, socket, username):
        self.rooms.setdefault(key, {})[socket] = username

    def disconnect(self, key, socket):
        room = self.rooms.get(key)
        if room is not None:
            room.pop(socket, None)
            if not room:
                self.rooms.pop(key, None)

    def users(self, key):
        return sorted(set(self.rooms.get(key, {}).values()))

    async def broadcast(self, key, message, exclude=None):
        for socket in list(self.rooms.get(key, {})):
            if socket is exclude:
                continue
            try:
                await socket.send_json(message)
            except (RuntimeError, OSError, WebSocketDisconnect):
                self.disconnect(key, socket)

    async def presence(self, key):
        await self.broadcast(key, {"type": "presence", "users": self.users(key)})
