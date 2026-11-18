"""Only accept fields the caller is permitted to control."""
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Request(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)


class RegisterRequest(Request):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_-]+$")
    password: str = Field(min_length=8, max_length=128)


class ProjectSchema(Request):
    name: str = Field(min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def valid_name(cls, value):
        if not value.strip():
            raise ValueError("Name must not be blank")
        return value.strip()


class FileSchema(Request):
    name: str = Field(min_length=1, max_length=120)
    content: str = Field(default="", max_length=200_000)

    @field_validator("name")
    @classmethod
    def valid_name(cls, value):
        if not value.strip() or any(c in value for c in ("/", "\\", "\x00")):
            raise ValueError("Use a filename, not a path")
        return value.strip()


class FileUpdate(Request):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    content: str | None = Field(default=None, max_length=200_000)
    version: int | None = Field(default=None, ge=0)

    @field_validator("name")
    @classmethod
    def valid_name(cls, value):
        return FileSchema.valid_name(value) if value is not None else value

    @model_validator(mode="after")
    def valid_update(self):
        if self.name is None and self.content is None:
            raise ValueError("Provide a name or content")
        if self.content is not None and self.version is None:
            raise ValueError("Content updates require the last observed version")
        return self
