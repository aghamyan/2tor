from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class ScoreWeights:
    face_missing: int = 15
    phone_detected: int = 20
    multiple_faces: int = 30
    looking_away: int = 10
    looking_away_repeated: int = 20
    face_covered: int = 15
    camera_disconnected: int = 40
    eyes_closed_long: int = 10
    multiple_voice_signatures: int = 20


@dataclass(slots=True)
class Thresholds:
    face_missing_seconds: float = 2.0
    looking_away_seconds: float = 5.0
    writing_grace_seconds: float = 8.0
    eyes_closed_seconds: float = 2.0
    event_cooldown_seconds: float = 8.0
    repeated_away_window_seconds: float = 90.0
    repeated_away_count: int = 3
    yaw_degrees: float = 24.0
    pitch_up_degrees: float = 18.0
    pitch_down_degrees: float = 20.0
    object_confidence: float = 0.45


@dataclass(slots=True)
class AppConfig:
    camera_index: int = 0
    preferred_camera_name: str = "FaceTime HD Camera"
    blocked_camera_name_terms: list[str] = field(default_factory=lambda: ["iphone", "continuity"])
    camera_width: int = 1280
    camera_height: int = 720
    object_detection_every_n_frames: int = 5
    yolo_model: str = "yolov8n.pt"
    exam_duration_minutes: int = 60
    database_path: str = "data/proctoring.db"
    evidence_directory: str = "data/evidence"
    score_decay_per_second: float = 0.12
    enable_voice_detection: bool = True
    preferred_microphone_name: str = "MacBook Pro Microphone"
    blocked_microphone_name_terms: list[str] = field(default_factory=lambda: ["iphone", "continuity"])
    audio_sample_rate: int = 16000
    audio_block_ms: int = 100
    voice_energy_threshold: float = 0.008
    voice_silence_seconds: float = 0.6
    voice_min_segment_seconds: float = 0.8
    voice_max_segment_seconds: float = 8.0
    speaker_distance_threshold: float = 0.22
    speaker_confirmation_segments: int = 2
    voice_event_cooldown_seconds: float = 30.0
    weights: ScoreWeights = field(default_factory=ScoreWeights)
    thresholds: Thresholds = field(default_factory=Thresholds)

    @classmethod
    def load(cls, path: str | Path = "config.json") -> "AppConfig":
        config_path = Path(path)
        if not config_path.exists():
            config = cls()
            config.save(config_path)
            return config
        raw: dict[str, Any] = json.loads(config_path.read_text(encoding="utf-8"))
        raw["weights"] = ScoreWeights(**raw.get("weights", {}))
        raw["thresholds"] = Thresholds(**raw.get("thresholds", {}))
        return cls(**raw)

    def save(self, path: str | Path = "config.json") -> None:
        config_path = Path(path)
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text(json.dumps(asdict(self), indent=2), encoding="utf-8")
