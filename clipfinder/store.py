"""SQLite store: dedupes clips across runs and tracks edit/permission status."""

from __future__ import annotations

import sqlite3
import time
from pathlib import Path

from .models import Clip

SCHEMA = """
CREATE TABLE IF NOT EXISTS clips (
    id TEXT PRIMARY KEY,
    author TEXT, description TEXT, created_at INTEGER,
    views INTEGER, likes INTEGER, comments INTEGER, shares INTEGER, saves INTEGER,
    duration INTEGER, music TEXT, source TEXT,
    first_seen INTEGER, last_seen INTEGER,
    status TEXT DEFAULT 'new',          -- new | shortlisted | downloaded | edited | skipped
    permission TEXT DEFAULT 'unknown',  -- unknown | requested | granted | denied
    file_path TEXT
);
"""

STATUSES = ("new", "shortlisted", "downloaded", "edited", "skipped")
PERMISSIONS = ("unknown", "requested", "granted", "denied")


class Store:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)

    def upsert_many(self, clips: list[Clip]) -> int:
        """Insert or refresh stats. Returns how many clips were new."""
        now = int(time.time())
        new = 0
        for c in clips:
            exists = self.db.execute("SELECT 1 FROM clips WHERE id=?", (c.id,)).fetchone()
            if exists:
                self.db.execute(
                    "UPDATE clips SET views=?, likes=?, comments=?, shares=?, saves=?, last_seen=? WHERE id=?",
                    (c.views, c.likes, c.comments, c.shares, c.saves, now, c.id),
                )
            else:
                new += 1
                self.db.execute(
                    "INSERT INTO clips (id, author, description, created_at, views, likes, comments,"
                    " shares, saves, duration, music, source, first_seen, last_seen)"
                    " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (c.id, c.author, c.description, c.created_at, c.views, c.likes, c.comments,
                     c.shares, c.saves, c.duration, c.music, c.source, now, now),
                )
        self.db.commit()
        return new

    def all_clips(self, statuses: tuple[str, ...] | None = None) -> list[Clip]:
        rows = self.db.execute("SELECT * FROM clips").fetchall()
        return [self._clip(r) for r in rows if statuses is None or r["status"] in statuses]

    def get_clip(self, clip_id: str) -> Clip | None:
        r = self.db.execute("SELECT * FROM clips WHERE id=?", (clip_id,)).fetchone()
        return self._clip(r) if r else None

    def meta(self, clip_id: str) -> dict:
        r = self.db.execute("SELECT status, permission, file_path FROM clips WHERE id=?", (clip_id,)).fetchone()
        return dict(r) if r else {}

    def set_fields(self, clip_id: str, **fields) -> bool:
        allowed = {"status", "permission", "file_path"}
        fields = {k: v for k, v in fields.items() if k in allowed and v is not None}
        if not fields:
            return False
        sets = ", ".join(f"{k}=?" for k in fields)
        cur = self.db.execute(f"UPDATE clips SET {sets} WHERE id=?", (*fields.values(), clip_id))
        self.db.commit()
        return cur.rowcount > 0

    @staticmethod
    def _clip(r: sqlite3.Row) -> Clip:
        return Clip(
            id=r["id"], author=r["author"], description=r["description"],
            created_at=r["created_at"], views=r["views"], likes=r["likes"],
            comments=r["comments"], shares=r["shares"], saves=r["saves"],
            duration=r["duration"], music=r["music"], source=r["source"],
        )
