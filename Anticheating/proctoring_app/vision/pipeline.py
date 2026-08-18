from __future__ import annotations

import cv2
import numpy as np

from ..config import AppConfig
from ..models import AnalysisResult, ObjectDetection
from .face_analyzer import FaceAnalyzer
from .object_detector import ObjectDetector


class VisionPipeline:
    def __init__(self, config: AppConfig) -> None:
        self.config = config
        self.face = FaceAnalyzer(config.thresholds)
        self.objects: ObjectDetector | None = None
        self.object_error: str | None = None
        self._cached_objects: list[ObjectDetection] = []
        self._frame_number = 0
        try:
            self.objects = ObjectDetector(config.yolo_model, config.thresholds.object_confidence)
        except Exception as exc:  # Face monitoring remains usable if YOLO is unavailable.
            self.object_error = str(exc)

    def analyze(self, frame: np.ndarray) -> AnalysisResult:
        self._frame_number += 1
        face = self.face.analyze(frame)
        if self.objects and self._frame_number % max(1, self.config.object_detection_every_n_frames) == 0:
            try:
                self._cached_objects = self.objects.analyze(frame)
            except Exception as exc:
                self.object_error = str(exc)
                self.objects = None
        labels = {obj.label for obj in self._cached_objects}
        phone = bool(labels & {"cell phone", "mobile phone", "phone"})
        people = sum(obj.label == "person" for obj in self._cached_objects)
        multiple = face.count > 1 or people > 1
        away = face.detected and (face.head_direction != "Center" or face.eye_direction != "Center")
        return AnalysisResult(
            face=face,
            objects=list(self._cached_objects),
            phone_detected=phone,
            person_detected=people > 0 or face.detected,
            multiple_faces=multiple,
            looking_away=away,
        )

    @staticmethod
    def annotate(frame: np.ndarray, result: AnalysisResult) -> np.ndarray:
        output = frame.copy()
        for box in result.face.boxes:
            x1, y1, x2, y2 = box
            cv2.rectangle(output, (x1, y1), (x2, y2), (69, 214, 178), 2, cv2.LINE_AA)
            cv2.putText(output, "FACE", (x1, max(20, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, .45, (69, 214, 178), 1, cv2.LINE_AA)
        for item in result.objects:
            x1, y1, x2, y2 = item.box
            color = (60, 104, 255) if "phone" in item.label else (235, 184, 74)
            cv2.rectangle(output, (x1, y1), (x2, y2), color, 2, cv2.LINE_AA)
            label = f"{item.label.upper()} {item.confidence:.0%}"
            cv2.putText(output, label, (x1, max(20, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, .45, color, 1, cv2.LINE_AA)
        return output

    def close(self) -> None:
        self.face.close()
