from __future__ import annotations

import unittest

from proctoring_app.config import AppConfig
from proctoring_app.models import AnalysisResult, FaceMetrics
from proctoring_app.scoring import SuspicionEngine


class FakeClock:
    def __init__(self) -> None:
        self.now = 100.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


class SuspicionEngineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.clock = FakeClock()
        self.config = AppConfig(score_decay_per_second=0)
        self.engine = SuspicionEngine(self.config, clock=self.clock)

    def test_missing_face_must_be_sustained(self) -> None:
        result = AnalysisResult(face=FaceMetrics(detected=False))
        self.engine.update(result)
        self.assertEqual(result.events, [])
        self.clock.advance(self.config.thresholds.face_missing_seconds)
        self.engine.update(result)
        self.assertEqual(result.events[0].event_type, "Face missing")
        self.assertEqual(result.suspicion_score, self.config.weights.face_missing)

    def test_brief_downward_look_gets_writing_grace(self) -> None:
        result = AnalysisResult(
            face=FaceMetrics(detected=True, head_direction="Down", eye_direction="Down"),
            looking_away=True,
        )
        self.engine.update(result)
        self.clock.advance(self.config.thresholds.looking_away_seconds + 0.5)
        self.engine.update(result)
        self.assertFalse(any(event.event_type == "Looking away" for event in result.events))
        self.clock.advance(self.config.thresholds.writing_grace_seconds)
        self.engine.update(result)
        self.assertTrue(any(event.event_type == "Looking away" for event in result.events))

    def test_score_is_capped_and_never_returns_fail(self) -> None:
        result = AnalysisResult(camera_connected=False)
        for _ in range(5):
            self.engine.update(result)
            self.clock.advance(self.config.thresholds.event_cooldown_seconds)
        self.assertLessEqual(result.suspicion_score, 100)
        self.assertNotIn("fail", result.status.lower())


if __name__ == "__main__":
    unittest.main()
