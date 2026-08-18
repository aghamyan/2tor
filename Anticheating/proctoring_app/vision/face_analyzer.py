from __future__ import annotations

import math

import cv2
import numpy as np

from ..config import Thresholds
from ..models import FaceMetrics


class FaceAnalyzer:
    """MediaPipe Face Mesh wrapper for face count, pose, visibility and gaze."""

    _POSE_INDICES = (1, 152, 33, 263, 61, 291)
    _MODEL_POINTS = np.array(
        [(0, 0, 0), (0, -63.6, -12.5), (-43.3, 32.7, -26),
         (43.3, 32.7, -26), (-28.9, -28.9, -24.1), (28.9, -28.9, -24.1)],
        dtype=np.float64,
    )

    def __init__(self, thresholds: Thresholds) -> None:
        try:
            import mediapipe as mp
        except ImportError as exc:
            raise RuntimeError("MediaPipe is required for face analysis. Run: pip install -r requirements.txt") from exc
        self.thresholds = thresholds
        self._mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=3,
            refine_landmarks=True,
            min_detection_confidence=0.55,
            min_tracking_confidence=0.55,
        )

    def analyze(self, frame: np.ndarray) -> FaceMetrics:
        height, width = frame.shape[:2]
        output = self._mesh.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        faces = output.multi_face_landmarks or []
        metrics = FaceMetrics(detected=bool(faces), count=len(faces))
        if not faces:
            return metrics

        areas: list[tuple[float, object, tuple[int, int, int, int]]] = []
        for face in faces:
            xs = [point.x for point in face.landmark]
            ys = [point.y for point in face.landmark]
            box = (
                max(0, int(min(xs) * width)), max(0, int(min(ys) * height)),
                min(width - 1, int(max(xs) * width)), min(height - 1, int(max(ys) * height)),
            )
            areas.append(((box[2] - box[0]) * (box[3] - box[1]), face, box))
            metrics.boxes.append(box)
        _, primary, primary_box = max(areas, key=lambda item: item[0])

        metrics.yaw, metrics.pitch, metrics.roll = self._head_pose(primary.landmark, width, height)
        metrics.head_direction = self._head_direction(metrics.yaw, metrics.pitch)
        metrics.eye_direction = self._eye_direction(primary.landmark, width, height)
        metrics.eyes_closed = self._eyes_closed(primary.landmark, width, height)
        metrics.visibility, metrics.face_covered = self._visibility(primary.landmark, primary_box, width, height)
        return metrics

    def _head_pose(self, landmarks: list, width: int, height: int) -> tuple[float, float, float]:
        image_points = np.array(
            [(landmarks[i].x * width, landmarks[i].y * height) for i in self._POSE_INDICES],
            dtype=np.float64,
        )
        focal = float(width)
        camera = np.array([[focal, 0, width / 2], [0, focal, height / 2], [0, 0, 1]], dtype=np.float64)
        success, rotation, _ = cv2.solvePnP(
            self._MODEL_POINTS, image_points, camera, np.zeros((4, 1)), flags=cv2.SOLVEPNP_ITERATIVE
        )
        if not success:
            return 0.0, 0.0, 0.0
        matrix, _ = cv2.Rodrigues(rotation)
        projection = np.hstack((matrix, np.zeros((3, 1))))
        _, _, _, _, _, _, euler = cv2.decomposeProjectionMatrix(projection)
        pitch, yaw, roll = (self._normalize_angle(float(v)) for v in euler.ravel())
        return yaw, pitch, roll

    @staticmethod
    def _normalize_angle(value: float) -> float:
        while value > 90:
            value -= 180
        while value < -90:
            value += 180
        return value

    def _head_direction(self, yaw: float, pitch: float) -> str:
        t = self.thresholds
        if abs(yaw) > 52:
            return "Behind"
        if yaw < -t.yaw_degrees:
            return "Left"
        if yaw > t.yaw_degrees:
            return "Right"
        if pitch < -t.pitch_up_degrees:
            return "Up"
        if pitch > t.pitch_down_degrees:
            return "Down"
        return "Center"

    @staticmethod
    def _distance(a, b, width: int, height: int) -> float:
        return math.hypot((a.x - b.x) * width, (a.y - b.y) * height)

    def _eyes_closed(self, points: list, width: int, height: int) -> bool:
        def ear(indices: tuple[int, int, int, int, int, int]) -> float:
            p1, p2, p3, p4, p5, p6 = (points[i] for i in indices)
            vertical = self._distance(p2, p6, width, height) + self._distance(p3, p5, width, height)
            horizontal = 2 * self._distance(p1, p4, width, height)
            return vertical / horizontal if horizontal else 1.0

        return (ear((33, 160, 158, 133, 153, 144)) + ear((362, 385, 387, 263, 373, 380))) / 2 < 0.18

    @staticmethod
    def _eye_direction(points: list, width: int, height: int) -> str:
        if len(points) < 478:
            return "Center"
        ratios: list[tuple[float, float]] = []
        for iris, left, right, top, bottom in ((468, 33, 133, 159, 145), (473, 362, 263, 386, 374)):
            x1, x2 = sorted((points[left].x, points[right].x))
            y1, y2 = sorted((points[top].y, points[bottom].y))
            ratios.append(((points[iris].x - x1) / max(x2 - x1, 1e-5), (points[iris].y - y1) / max(y2 - y1, 1e-5)))
        horizontal = sum(item[0] for item in ratios) / 2
        vertical = sum(item[1] for item in ratios) / 2
        # Mirrored preview: low iris ratio corresponds to the subject looking right.
        if horizontal < 0.34:
            return "Right"
        if horizontal > 0.66:
            return "Left"
        if vertical < 0.30:
            return "Up"
        if vertical > 0.70:
            return "Down"
        return "Center"

    @staticmethod
    def _visibility(points: list, box: tuple[int, int, int, int], width: int, height: int) -> tuple[str, bool]:
        x1, y1, x2, y2 = box
        face_area = max(0, x2 - x1) * max(0, y2 - y1)
        frame_area = width * height
        touches_edge = x1 < 4 or y1 < 4 or x2 > width - 5 or y2 > height - 5
        key_points = [points[i] for i in (1, 33, 263, 61, 291, 152)]
        key_visible = sum(0.01 < p.x < 0.99 and 0.01 < p.y < 0.99 for p in key_points)
        if face_area < frame_area * 0.018:
            return "Too far / unclear", True
        if touches_edge or key_visible < 6:
            return "Partially visible", True
        return "Visible", False

    def close(self) -> None:
        self._mesh.close()
