from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum


class Severity(str, Enum):
    INFO = "Info"
    NOTICE = "Notice"
    WARNING = "Warning"
    CRITICAL = "Critical"


@dataclass(slots=True)
class ProctorEvent:
    event_type: str
    severity: Severity
    description: str
    score_delta: float = 0.0
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    evidence_path: str | None = None
    audio_path: str | None = None


@dataclass(slots=True)
class FaceMetrics:
    detected: bool = False
    count: int = 0
    visibility: str = "No face"
    head_direction: str = "Unknown"
    eye_direction: str = "Unknown"
    yaw: float = 0.0
    pitch: float = 0.0
    roll: float = 0.0
    eyes_closed: bool = False
    face_covered: bool = False
    boxes: list[tuple[int, int, int, int]] = field(default_factory=list)


@dataclass(slots=True)
class ObjectDetection:
    label: str
    confidence: float
    box: tuple[int, int, int, int]


@dataclass(slots=True)
class AnalysisResult:
    face: FaceMetrics = field(default_factory=FaceMetrics)
    objects: list[ObjectDetection] = field(default_factory=list)
    phone_detected: bool = False
    person_detected: bool = False
    multiple_faces: bool = False
    looking_away: bool = False
    camera_connected: bool = True
    suspicion_score: float = 0.0
    status: str = "Monitoring"
    fps: float = 0.0
    events: list[ProctorEvent] = field(default_factory=list)
