from fastapi import WebSocket
from typing import Dict, Set, Tuple

class ConnectionManager:
    def __init__(self):
        self.project_room: Dict[int, Set[WebSocket]] = {}
        self.file_room: Dict[Tuple[int, int], Set[WebSocket]] = {}
        self.presence: Dict[int, Set[str]] = {}
        self.editing: Dict[int, Dict[int, Set[str]]] = {}

# Project Level Room
    async def project_connect(self, project_id: int, websocket: WebSocket, username: str):
        
        self.project_room.setdefault(project_id, set()).add(websocket)
        self.presence.setdefault(project_id, set()).add(username)

    def disconnect_project(self, project_id: int, websocket: WebSocket, username: str):
        if project_id in self.project_room:
            self.project_room[project_id].discard(websocket)
            if not self.project_room[project_id]:
                del self.project_room[project_id]
        if project_id in self.presence:
            self.presence[project_id].discard(username)
            if not self.presence[project_id]:
                del self.presence[project_id]

    async def broadcast_project(self, project_id: int, message: str):
        for ws in list(self.project_room.get(project_id, [])):
            try:
                await ws.send_text(message)
            except:
                self.project_room[project_id].discard(ws)
# Users
    def get_users_online(self, project_id: int):
        return list(self.presence.get(project_id, []))
# File room  
    async def file_connect(self, project_id: int, file_id: int , websocket: WebSocket, username: str):
        
        key = (project_id, file_id)
        self.file_room.setdefault(key, set()).add(websocket)
        self.editing.setdefault(project_id, {}).setdefault(file_id, set()).add(username)

    def disconnect_file(self, project_id: int, file_id: int, websocket: WebSocket, username: str):
        key = (project_id, file_id)
        if key in self.file_room:
            self.file_room[key].discard(websocket)
            if not self.file_room[key]:
                del self.file_room[key]
        if project_id in self.editing and file_id in self.editing[project_id]:
            self.editing[project_id][file_id].discard(username)
            if not self.editing[project_id][file_id]:
                del self.editing[project_id][file_id]
            if not self.editing[project_id]:
                del self.editing[project_id]
                    
    async def broadcast_file(self, project_id: int, file_id: int, message: str):
        key = (project_id, file_id)
        for ws in self.file_room.get(key, []):
            await ws.send_text(message)

    def get_editing(self, project_id: int):
        return {
            file_id: list(users)
            for file_id, users in self.editing.get((project_id), {}).items()
        }
    