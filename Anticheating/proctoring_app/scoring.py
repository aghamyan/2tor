from __future__ import annotations

import time
from collections import defaultdict, deque
from dataclasses import dataclass

from .config import AppConfig
from .models import AnalysisResult, ProctorEvent, Severity


@dataclass(slots=True)
class _Condition:
    active_since: float | None = None
    last_emitted: float = -1e9


class SuspicionEngine:
    """Turns sustained observations into throttled events and a decaying score."""

    def __init__(self, config: AppConfig, clock=time.monotonic) -> None:
        self.config = config
        self._clock = clock
        self.score = 0.0
        self._last_tick = clock()
        self._conditions: dict[str, _Condition] = defaultdict(_Condition)
        self._away_occurrences: deque[float] = deque()

    def _decay(self, now: float) -> None:
        elapsed = max(0.0, now - self._last_tick)
        self.score = max(0.0, self.score - elapsed * self.config.score_decay_per_second)
        self._last_tick = now

    def _sustained(
        self, key: str, active: bool, delay: float, weight: float,
        severity: Severity, description: str, now: float,
    ) -> ProctorEvent | None:
        state = self._conditions[key]
        if not active:
            state.active_since = None
            return None
        if state.active_since is None:
            state.active_since = now
        cooldown = self.config.thresholds.event_cooldown_seconds
        if now - state.active_since >= delay and now - state.last_emitted >= cooldown:
            state.last_emitted = now
            self.score = min(100.0, self.score + weight)
            return ProctorEvent(key, severity, description, weight)
        return None

    def update(self, result: AnalysisResult) -> list[ProctorEvent]:
        now = self._clock()
        self._decay(now)
        w, t = self.config.weights, self.config.thresholds
        checks = [
            ("Camera disconnected", not result.camera_connected, 0.0, w.camera_disconnected,
             Severity.CRITICAL, "Camera feed was disconnected."),
            ("Face missing", result.camera_connected and not result.face.detected,
             t.face_missing_seconds, w.face_missing, Severity.WARNING,
             "No face has been visible for the allowed interval."),
            ("Multiple faces", result.multiple_faces, 0.4, w.multiple_faces,
             Severity.CRITICAL, "More than one face is visible in the camera frame."),
            ("Phone detected", result.phone_detected, 0.25, w.phone_detected,
             Severity.CRITICAL, "A mobile phone was detected in the camera frame."),
            ("Face covered", result.face.face_covered, 1.5, w.face_covered,
             Severity.WARNING, "The face appears partially hidden or covered."),
            ("Eyes closed", result.face.eyes_closed, t.eyes_closed_seconds, w.eyes_closed_long,
             Severity.WARNING, "Eyes remained closed unusually long; normal blinks are ignored."),
        ]
        events: list[ProctorEvent] = []
        for args in checks:
            event = self._sustained(*args, now)
            if event:
                events.append(event)

        away_delay = t.writing_grace_seconds if result.face.head_direction == "Down" else t.looking_away_seconds
        away = self._sustained(
            "Looking away", result.looking_away, away_delay, w.looking_away,
            Severity.NOTICE, f"Sustained gaze away ({result.face.head_direction.lower()}).", now,
        )
        if away:
            events.append(away)
            self._away_occurrences.append(now)
            cutoff = now - t.repeated_away_window_seconds
            while self._away_occurrences and self._away_occurrences[0] < cutoff:
                self._away_occurrences.popleft()
            repeated = self._conditions["Repeated looking away"]
            if len(self._away_occurrences) >= t.repeated_away_count and now - repeated.last_emitted >= t.event_cooldown_seconds:
                repeated.last_emitted = now
                self.score = min(100.0, self.score + w.looking_away_repeated)
                events.append(ProctorEvent(
                    "Repeated looking away", Severity.WARNING,
                    f"Looking away occurred {len(self._away_occurrences)} times recently.",
                    w.looking_away_repeated,
                ))

        result.suspicion_score = round(self.score, 1)
        result.status = self.status_for_score(self.score)
        result.events = events
        return events

    def apply_external(self, event: ProctorEvent) -> None:
        """Add a scored event produced outside the video pipeline, such as audio."""
        now = self._clock()
        self._decay(now)
        self.score = min(100.0, self.score + max(0.0, event.score_delta))

    @staticmethod
    def status_for_score(score: float) -> str:
        if score >= 70:
            return "Review recommended"
        if score >= 40:
            return "Elevated attention"
        if score >= 15:
            return "Minor concerns"
        return "Monitoring normally"
