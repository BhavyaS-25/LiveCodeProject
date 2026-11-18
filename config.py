"""Explicit configuration: never fall back to a checked-in signing key."""
import os


def signing_key():
    key = os.environ.get("CODECOLLAB_SECRET_KEY", "")
    if len(key) < 32 or key.lower() in {"change-me", "your-secret-key", "replace-me"}:
        raise RuntimeError("Set CODECOLLAB_SECRET_KEY to a random value of at least 32 characters.")
    return key


def allowed_origins():
    return [origin.strip() for origin in os.environ.get(
        "CODECOLLAB_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",") if origin.strip()]
