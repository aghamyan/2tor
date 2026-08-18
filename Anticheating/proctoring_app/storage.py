from __future__ import annotations

import csv
import sqlite3
import threading
import uuid
from pathlib import Path

from .models import ProctorEvent, Severity


class EventStore:
    """Small thread-safe SQLite event repository with one active exam session."""

    def __init__(self, database_path: str) -> None:
        self.path = Path(database_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._connection = sqlite3.connect(self.path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._create_schema()
        self.session_id: str | None = None

    def _create_schema(self) -> None:
        with self._connection:
            self._connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    started_at TEXT NOT NULL,
                    ended_at TEXT,
                    final_score REAL NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    description TEXT NOT NULL,
                    score_delta REAL NOT NULL DEFAULT 0,
                    evidence_path TEXT,
                    audio_path TEXT,
                    FOREIGN KEY(session_id) REFERENCES sessions(id)
                );
                CREATE INDEX IF NOT EXISTS idx_events_session_time
                    ON events(session_id, timestamp DESC);
                """
            )
            columns = {
                row[1] for row in self._connection.execute("PRAGMA table_info(events)").fetchall()
            }
            if "evidence_path" not in columns:
                self._connection.execute("ALTER TABLE events ADD COLUMN evidence_path TEXT")
            if "audio_path" not in columns:
                self._connection.execute("ALTER TABLE events ADD COLUMN audio_path TEXT")

    def start_session(self) -> str:
        from datetime import datetime, timezone

        with self._lock, self._connection:
            self.session_id = str(uuid.uuid4())
            self._connection.execute(
                "INSERT INTO sessions(id, started_at) VALUES (?, ?)",
                (self.session_id, datetime.now(timezone.utc).isoformat()),
            )
        return self.session_id

    def end_session(self, final_score: float) -> None:
        from datetime import datetime, timezone

        if not self.session_id:
            return
        with self._lock, self._connection:
            self._connection.execute(
                "UPDATE sessions SET ended_at = ?, final_score = ? WHERE id = ?",
                (datetime.now(timezone.utc).isoformat(), final_score, self.session_id),
            )

    def add(self, event: ProctorEvent) -> None:
        if not self.session_id:
            self.start_session()
        with self._lock, self._connection:
            self._connection.execute(
                """INSERT INTO events
                   (session_id, timestamp, event_type, severity, description, score_delta,
                    evidence_path, audio_path)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    self.session_id,
                    event.timestamp.isoformat(),
                    event.event_type,
                    event.severity.value,
                    event.description,
                    event.score_delta,
                    event.evidence_path,
                    event.audio_path,
                ),
            )

    def recent(self, limit: int = 200) -> list[ProctorEvent]:
        if not self.session_id:
            return []
        with self._lock:
            rows = self._connection.execute(
                "SELECT * FROM events WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?",
                (self.session_id, limit),
            ).fetchall()
        return [
            ProctorEvent(
                event_type=row["event_type"],
                severity=Severity(row["severity"]),
                description=row["description"],
                score_delta=row["score_delta"],
                timestamp=__import__("datetime").datetime.fromisoformat(row["timestamp"]),
                evidence_path=row["evidence_path"],
                audio_path=row["audio_path"],
            )
            for row in rows
        ]

    def export_csv(self, destination: str | Path) -> int:
        rows = self.recent(100_000)
        with Path(destination).open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow([
                "timestamp", "event_type", "severity", "description", "score_delta",
                "evidence_path", "audio_path",
            ])
            for event in reversed(rows):
                writer.writerow([
                    event.timestamp.isoformat(), event.event_type, event.severity.value,
                    event.description, event.score_delta, event.evidence_path, event.audio_path,
                ])
        return len(rows)

    def close(self) -> None:
        with self._lock:
            self._connection.close()
