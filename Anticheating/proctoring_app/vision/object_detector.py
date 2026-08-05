from __future__ import annotations

import numpy as np

from ..models import ObjectDetection


class ObjectDetector:
    """Lazy YOLO detector. Calculator support can be added via a custom model label."""

    TARGET_LABELS = {"person", "cell phone", "mobile phone", "phone", "calculator"}

    def __init__(self, model_name: str, confidence: float) -> None:
        try:
            from ultralytics import YOLO
        except ImportError as exc:
            raise RuntimeError("Ultralytics is required for object detection. Run: pip install -r requirements.txt") from exc
        self.model = YOLO(model_name)
        self.confidence = confidence

    def analyze(self, frame: np.ndarray) -> list[ObjectDetection]:
        result = self.model.predict(frame, conf=self.confidence, verbose=False, imgsz=640)[0]
        names = result.names
        detections: list[ObjectDetection] = []
        for box in result.boxes:
            label = str(names[int(box.cls.item())]).lower()
            if label not in self.TARGET_LABELS:
                continue
            coords = tuple(int(value) for value in box.xyxy[0].tolist())
            detections.append(ObjectDetection(label, float(box.conf.item()), coords))
        return detections

