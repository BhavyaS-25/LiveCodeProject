from pydantic import BaseModel
from typing import Optional

# =======================
# AUTH MODELS
# =======================

class RegisterRequest(BaseModel):
    username: str
    password: str


class LoginSchema(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str


# =======================
# PROJECT MODELS
# =======================

class ProjectSchema(BaseModel):
    id: int
    name: str
    owner_id: int


# =======================
# FILE MODELS
# =======================

class FileSchema(BaseModel):
    id: int
    project_id: int
    name: str
    content: str


class FileUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None