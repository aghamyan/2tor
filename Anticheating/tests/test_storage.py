from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from proctoring_app.models import ProctorEvent, Severity
from proctoring_app.storage import EventStore


class EventStoreTests(unittest.TestCase):
    def test_persists_and_exports_events(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = EventStore(str(Path(directory) / "events.db"))
            store.start_session()
            store.add(ProctorEvent(
                "Phone detected", Severity.CRITICAL, "A phone is visible.", 20,
                evidence_path="evidence.jpg", audio_path="evidence.wav",
            ))
            events = store.recent()
            self.assertEqual(len(events), 1)
            self.assertEqual(events[0].score_delta, 20)
            self.assertEqual(events[0].evidence_path, "evidence.jpg")
            self.assertEqual(events[0].audio_path, "evidence.wav")
            exported = Path(directory) / "events.csv"
            self.assertEqual(store.export_csv(exported), 1)
            self.assertIn("Phone detected", exported.read_text(encoding="utf-8"))
            store.close()


if __name__ == "__main__":
    unittest.main()
