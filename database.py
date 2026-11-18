"""Small, durable SQLite store. Foreign keys enforce project/file cleanup."""
import os
import sqlite3
from pathlib import Path


def connect(path):
    connection = sqlite3.connect(path, timeout=10, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize(path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as db:
        db.execute("PRAGMA journal_mode = WAL")
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            hashed_password TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS project_members (
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            PRIMARY KEY (project_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            version INTEGER NOT NULL DEFAULT 0,
            UNIQUE (project_id, name)
        );
        CREATE INDEX IF NOT EXISTS member_user_idx ON project_members(user_id);
        CREATE INDEX IF NOT EXISTS file_project_idx ON files(project_id);
        """)


def configured_path():
    return os.environ.get("CODECOLLAB_DATABASE_PATH", "./data/codecollab.sqlite3")
