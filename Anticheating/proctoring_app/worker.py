from __future__ import annotations

import time
import sys
import queue

import cv2
from PySide6.QtCore import QThread, Signal

from .camera_selection import CameraSelectionError, select_camera_index
from .config import AppConfig
from .models import AnalysisResult, ProctorEvent, Severity
from .scoring import SuspicionEngine
from .vision.pipeline import VisionPipeline


class CameraWorker(QThread):
    frame_ready = Signal(object)
    analysis_ready = Signal(object)
    event_ready = Signal(object)
    state_changed = Signal(str)
    fatal_error = Signal(str)

    def __init__(self, config: AppConfig, parent=None) -> None:
        super().__init__(parent)
        self.config = config
        self._running = True
        self._paused = False
        self._external_events: queue.Queue[ProctorEvent] = queue.Queue()

    def run(self) -> None:
        try:
            camera_index, camera_name = self._select_camera()
        except CameraSelectionError as exc:
            self.fatal_error.emit(str(exc))
            return
        backend = cv2.CAP_AVFOUNDATION if sys.platform == "darwin" else cv2.CAP_ANY
        capture = cv2.VideoCapture(camera_index, backend)
        capture.set(cv2.CAP_PROP_FRAME_WIDTH, self.config.camera_width)
        capture.set(cv2.CAP_PROP_FRAME_HEIGHT, self.config.camera_height)
        if not capture.isOpened():
            message = f"{camera_name} is unavailable. Check permissions or config.json."
            self.fatal_error.emit(message)
            result = AnalysisResult(camera_connected=False, status="Camera unavailable")
            engine = SuspicionEngine(self.config)
            engine.update(result)
            self.analysis_ready.emit(result)
            for event in result.events:
                self.event_ready.emit(event)
            capture.release()
            return

        # Show the camera immediately. Importing Torch/YOLO can take several seconds
        # on its first run and must not make a working camera appear unavailable.
        ok, preview_frame = capture.read()
        if not ok:
            capture.release()
            self.fatal_error.emit(
                f"{camera_name} opened but did not return video frames."
            )
            return
        self.frame_ready.emit(cv2.flip(preview_frame, 1))
        self.state_changed.emit(f"{camera_name} · loading AI")
        try:
            pipeline = VisionPipeline(self.config)
        except Exception as exc:
            capture.release()
            self.fatal_error.emit(str(exc))
            return
        engine = SuspicionEngine(self.config)
        if pipeline.object_error:
            self.event_ready.emit(ProctorEvent(
                "Object detector unavailable", Severity.WARNING,
                f"Face monitoring is active, but object detection is offline: {pipeline.object_error}",
            ))
        self.state_changed.emit("Live monitoring")
        previous = time.perf_counter()
        smoothed_fps = 0.0

        try:
            while self._running:
                if self._paused:
                    self.msleep(60)
                    continue
                ok, frame = capture.read()
                if not ok:
                    result = AnalysisResult(camera_connected=False)
                    engine.update(result)
                    self.analysis_ready.emit(result)
                    for event in result.events:
                        self.event_ready.emit(event)
                    self.msleep(250)
                    continue
                frame = cv2.flip(frame, 1)
                try:
                    result = pipeline.analyze(frame)
                except Exception as exc:
                    self.event_ready.emit(ProctorEvent(
                        "Analysis error", Severity.WARNING, f"A video frame could not be analyzed: {exc}"
                    ))
                    self.msleep(100)
                    continue
                while True:
                    try:
                        engine.apply_external(self._external_events.get_nowait())
                    except queue.Empty:
                        break
                engine.update(result)
                now = time.perf_counter()
                instant_fps = 1.0 / max(now - previous, 1e-4)
                smoothed_fps = instant_fps if not smoothed_fps else smoothed_fps * .9 + instant_fps * .1
                previous = now
                result.fps = smoothed_fps
                annotated = pipeline.annotate(frame, result)
                self.frame_ready.emit(annotated)
                self.analysis_ready.emit(result)
                for event in result.events:
                    self.event_ready.emit(event)
        finally:
            pipeline.close()
            capture.release()

    def set_paused(self, paused: bool) -> None:
        self._paused = paused
        self.state_changed.emit("Monitoring paused" if paused else "Live monitoring")

    def add_external_event(self, event: ProctorEvent) -> None:
        self._external_events.put(event)

    def _select_camera(self) -> tuple[int, str]:
        if sys.platform != "darwin":
            return self.config.camera_index, f"Camera {self.config.camera_index}"
        try:
            from PySide6.QtMultimedia import QMediaDevices

            descriptions = [device.description() for device in QMediaDevices.videoInputs()]
        except Exception:
            descriptions = []
        return select_camera_index(
            descriptions,
            self.config.camera_index,
            self.config.preferred_camera_name,
            self.config.blocked_camera_name_terms,
        )

    def stop(self) -> None:
        self._running = False
        self.wait(3000)
