from __future__ import annotations

from datetime import datetime
from pathlib import Path

import cv2
from PySide6.QtCore import QSize, Qt, QTimer
from PySide6.QtGui import QColor, QCloseEvent, QIcon, QImage, QPainter, QPixmap
from PySide6.QtWidgets import (
    QAbstractItemView,
    QFileDialog,
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QSizePolicy,
    QSplitter,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from ..config import AppConfig
from ..audio_worker import AudioWorker
from ..models import AnalysisResult, ProctorEvent, Severity
from ..storage import EventStore
from ..worker import CameraWorker
from .widgets import EvidenceDialog, MetricCard, StatusPill, SuspicionDial


class MainWindow(QMainWindow):
    def __init__(self, config: AppConfig) -> None:
        super().__init__()
        self.config = config
        self.store = EventStore(config.database_path)
        self.session_id = self.store.start_session()
        self.worker: CameraWorker | None = None
        self.audio_worker: AudioWorker | None = None
        self.current_score = 0.0
        self.remaining_seconds = config.exam_duration_minutes * 60
        self.paused = False
        self._latest_pixmap: QPixmap | None = None

        self.setWindowTitle("Sentinel — AI Exam Monitor")
        self.resize(1440, 940)
        self.setMinimumSize(1100, 760)
        self._build_ui()
        self._clock = QTimer(self)
        self._clock.timeout.connect(self._tick_timer)
        self._clock.start(1000)
        self._log_event(ProctorEvent("Session started", Severity.INFO, "Local monitoring session started."))
        QTimer.singleShot(150, self.start_monitoring)

    def _build_ui(self) -> None:
        root = QWidget()
        outer = QVBoxLayout(root)
        outer.setContentsMargins(18, 16, 18, 16)
        outer.setSpacing(12)
        outer.addWidget(self._header())

        vertical = QSplitter(Qt.Vertical)
        vertical.setChildrenCollapsible(False)
        content = QWidget()
        row = QHBoxLayout(content)
        row.setContentsMargins(0, 0, 0, 0)
        row.setSpacing(12)
        row.addWidget(self._video_panel(), 7)
        row.addWidget(self._stats_panel(), 4)
        vertical.addWidget(content)
        vertical.addWidget(self._events_panel())
        vertical.setSizes([610, 260])
        outer.addWidget(vertical, 1)
        self.setCentralWidget(root)

    def _header(self) -> QFrame:
        frame = QFrame(objectName="topBar")
        row = QHBoxLayout(frame)
        row.setContentsMargins(18, 12, 14, 12)
        title_col = QVBoxLayout()
        title_col.setSpacing(0)
        eyebrow = QLabel("LOCAL PROCTORING CONSOLE", objectName="eyebrow")
        brand = QLabel("SENTINEL", objectName="brand")
        title_col.addWidget(eyebrow)
        title_col.addWidget(brand)
        row.addLayout(title_col)
        row.addStretch()
        session = QLabel(f"SESSION  {self.session_id.split('-')[0].upper()}", objectName="sessionId")
        row.addWidget(session)
        self.live_pill = StatusPill("Starting camera")
        row.addWidget(self.live_pill)
        self.pause_button = QPushButton("Pause monitoring")
        self.pause_button.clicked.connect(self.toggle_pause)
        row.addWidget(self.pause_button)
        return frame

    def _video_panel(self) -> QFrame:
        panel = QFrame(objectName="panel")
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(14, 13, 14, 14)
        layout.setSpacing(10)
        header = QHBoxLayout()
        header.addWidget(QLabel("LIVE CAMERA", objectName="sectionLabel"))
        header.addStretch()
        self.fps_label = QLabel("— FPS", objectName="sessionId")
        header.addWidget(self.fps_label)
        layout.addLayout(header)
        self.video = QLabel("Opening camera…", objectName="video")
        self.video.setAlignment(Qt.AlignCenter)
        self.video.setMinimumSize(600, 338)
        self.video.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        layout.addWidget(self.video, 1)
        footer = QHBoxLayout()
        self.pose_badge = QLabel("POSE  Y —  P —  R —", objectName="overlayBadge")
        self.visibility_badge = QLabel("FACE VISIBILITY  WAITING", objectName="overlayBadge")
        footer.addWidget(self.pose_badge)
        footer.addWidget(self.visibility_badge)
        footer.addStretch()
        footer.addWidget(QLabel("Bounding boxes are evidence overlays only", objectName="sessionId"))
        layout.addLayout(footer)
        return panel

    def _stats_panel(self) -> QFrame:
        panel = QFrame(objectName="panel")
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(14, 13, 14, 14)
        layout.setSpacing(10)
        heading = QHBoxLayout()
        heading.addWidget(QLabel("LIVE ASSESSMENT", objectName="sectionLabel"))
        heading.addStretch()
        self.timer_label = QLabel(self._format_time(), objectName="brand")
        self.timer_label.setToolTip("Exam time remaining")
        heading.addWidget(self.timer_label)
        layout.addLayout(heading)
        self.dial = SuspicionDial()
        layout.addWidget(self.dial)
        self.status_card = MetricCard("Current status", "Monitoring normally")
        layout.addWidget(self.status_card)
        grid = QGridLayout()
        grid.setSpacing(8)
        labels = [
            ("face", "Face detected"), ("head", "Head direction"),
            ("eyes", "Eyes direction"), ("away", "Looking away"),
            ("multi", "Multiple faces"), ("phone", "Phone detection"),
            ("person", "Person detection"), ("closed", "Eyes closed"),
            ("visibility", "Face visibility"),
            ("mic", "Microphone"), ("voice", "Voice activity"),
            ("speakers", "Voice signatures"),
        ]
        self.cards: dict[str, MetricCard] = {}
        for index, (key, title) in enumerate(labels):
            card = MetricCard(title)
            self.cards[key] = card
            grid.addWidget(card, index // 3, index % 3)
        self.cards["mic"].set_value("Starting", "neutral")
        self.cards["voice"].set_value("Quiet", "good")
        self.cards["speakers"].set_value("0", "good", "Session-local")
        layout.addLayout(grid)
        layout.addStretch()
        note = QLabel("Scores indicate review priority—not guilt or an automatic exam outcome.")
        note.setWordWrap(True)
        note.setObjectName("sessionId")
        layout.addWidget(note)
        return panel

    def _events_panel(self) -> QFrame:
        panel = QFrame(objectName="panel")
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(14, 13, 14, 14)
        bar = QHBoxLayout()
        bar.addWidget(QLabel("EVENT TIMELINE", objectName="sectionLabel"))
        bar.addStretch()
        self.event_count = QLabel("0 EVENTS", objectName="sessionId")
        bar.addWidget(self.event_count)
        export = QPushButton("Export CSV")
        export.clicked.connect(self.export_events)
        bar.addWidget(export)
        layout.addLayout(bar)
        self.table = QTableWidget(0, 6)
        self.table.setHorizontalHeaderLabels(["Time", "Severity", "Event", "Description", "Evidence", "Score"])
        self.table.verticalHeader().hide()
        self.table.setAlternatingRowColors(True)
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(1, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(2, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(3, QHeaderView.Stretch)
        header.setSectionResizeMode(4, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(5, QHeaderView.ResizeToContents)
        layout.addWidget(self.table)
        return panel

    def start_monitoring(self) -> None:
        if self.worker and self.worker.isRunning():
            return
        self.worker = CameraWorker(self.config, self)
        self.worker.frame_ready.connect(self._show_frame)
        self.worker.analysis_ready.connect(self._update_analysis)
        self.worker.event_ready.connect(self._log_event)
        self.worker.state_changed.connect(lambda state: self.live_pill.set_state(state, "good"))
        self.worker.fatal_error.connect(self._camera_error)
        self.worker.start()
        if self.config.enable_voice_detection:
            evidence_dir = Path(self.config.evidence_directory) / self.session_id
            self.audio_worker = AudioWorker(self.config, evidence_dir, self)
            self.audio_worker.state_changed.connect(self._audio_state)
            self.audio_worker.level_ready.connect(self._audio_level)
            self.audio_worker.speakers_changed.connect(self._speaker_count)
            self.audio_worker.voice_activity_changed.connect(self._voice_activity)
            self.audio_worker.event_ready.connect(self._handle_voice_event)
            self.audio_worker.fatal_error.connect(self._audio_error)
            self.audio_worker.start()

    def _show_frame(self, frame) -> None:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        height, width, channels = rgb.shape
        image = QImage(rgb.data, width, height, channels * width, QImage.Format_RGB888).copy()
        self._latest_pixmap = QPixmap.fromImage(image)
        self._scale_video()

    def _scale_video(self) -> None:
        if self._latest_pixmap:
            self.video.setPixmap(self._latest_pixmap.scaled(self.video.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation))

    def resizeEvent(self, event) -> None:  # noqa: N802
        super().resizeEvent(event)
        self._scale_video()

    def _update_analysis(self, result: AnalysisResult) -> None:
        f = result.face
        self.current_score = result.suspicion_score
        self.dial.set_score(result.suspicion_score)
        status_tone = "bad" if result.suspicion_score >= 70 else "warn" if result.suspicion_score >= 40 else "good"
        self.status_card.set_value(result.status, status_tone)
        self.live_pill.set_state(result.status, status_tone)
        self.cards["face"].set_value("Yes" if f.detected else "No", "good" if f.detected else "bad", f.visibility)
        self.cards["head"].set_value(f.head_direction, "good" if f.head_direction == "Center" else "warn")
        self.cards["eyes"].set_value(f.eye_direction, "good" if f.eye_direction == "Center" else "warn")
        self.cards["away"].set_value("Yes" if result.looking_away else "No", "warn" if result.looking_away else "good")
        self.cards["multi"].set_value("Yes" if result.multiple_faces else "No", "bad" if result.multiple_faces else "good")
        self.cards["phone"].set_value("Detected" if result.phone_detected else "Clear", "bad" if result.phone_detected else "good")
        self.cards["person"].set_value("Present" if result.person_detected else "Missing", "good" if result.person_detected else "bad")
        self.cards["closed"].set_value("Yes" if f.eyes_closed else "No", "warn" if f.eyes_closed else "good")
        visibility_tone = "good" if f.visibility == "Visible" else "bad" if f.visibility == "No face" else "warn"
        self.cards["visibility"].set_value(f.visibility, visibility_tone)
        self.pose_badge.setText(f"POSE  Y {f.yaw:+.0f}°  P {f.pitch:+.0f}°  R {f.roll:+.0f}°")
        self.visibility_badge.setText(f"FACE VISIBILITY  {f.visibility.upper()}")
        self.fps_label.setText(f"{result.fps:.1f} FPS")

    def _log_event(self, event: ProctorEvent) -> None:
        self._attach_visual_evidence(event)
        self.store.add(event)
        self.table.insertRow(0)
        time_text = event.timestamp.astimezone().strftime("%H:%M:%S")
        values = [time_text, event.severity.value.upper(), event.event_type, event.description,
                  f"+{event.score_delta:g}" if event.score_delta else "—"]
        tone = {
            Severity.INFO: QColor("#7F96AA"), Severity.NOTICE: QColor("#F0B94A"),
            Severity.WARNING: QColor("#FF9C5A"), Severity.CRITICAL: QColor("#FF6868"),
        }[event.severity]
        for column, value in enumerate(values[:4]):
            item = QTableWidgetItem(value)
            if column == 1:
                item.setForeground(tone)
            self.table.setItem(0, column, item)
        score_item = QTableWidgetItem(values[4])
        score_item.setForeground(tone)
        self.table.setItem(0, 5, score_item)
        if event.evidence_path and Path(event.evidence_path).exists():
            preview = QPushButton("View")
            preview.setToolTip("Open evidence image")
            preview.setIcon(QIcon(event.evidence_path))
            preview.setIconSize(QSize(38, 28))
            preview.setFixedSize(88, 42)
            preview.clicked.connect(
                lambda checked=False, image=event.evidence_path, audio=event.audio_path:
                self._review_evidence(image, audio)
            )
            self.table.setCellWidget(0, 4, preview)
            self.table.setRowHeight(0, 48)
        else:
            self.table.setItem(0, 4, QTableWidgetItem("—"))
        self.event_count.setText(f"{self.table.rowCount()} EVENTS")

    def _attach_visual_evidence(self, event: ProctorEvent) -> None:
        if event.evidence_path or event.score_delta <= 0 or not self._latest_pixmap:
            return
        directory = Path(self.config.evidence_directory) / self.session_id
        directory.mkdir(parents=True, exist_ok=True)
        safe_type = "-".join(event.event_type.lower().split())
        destination = directory / f"{event.timestamp:%Y%m%d-%H%M%S-%f}-{safe_type}.jpg"
        evidence = self._latest_pixmap.copy()
        painter = QPainter(evidence)
        band_height = max(42, evidence.height() // 13)
        painter.fillRect(0, evidence.height() - band_height, evidence.width(), band_height, QColor(5, 11, 18, 220))
        painter.setPen(QColor("#F2F7FB"))
        font = painter.font()
        font.setBold(True)
        font.setPixelSize(max(15, evidence.height() // 34))
        painter.setFont(font)
        painter.drawText(
            18, evidence.height() - band_height, evidence.width() - 36, band_height,
            Qt.AlignVCenter | Qt.AlignLeft,
            f"{event.event_type.upper()}  ·  {event.timestamp.astimezone():%H:%M:%S}",
        )
        painter.end()
        if evidence.save(str(destination), "JPG", 92):
            event.evidence_path = str(destination)

    def _review_evidence(self, image_path: str, audio_path: str | None) -> None:
        EvidenceDialog(image_path, audio_path, self).exec()

    def _handle_voice_event(self, event: ProctorEvent) -> None:
        if self.worker and self.worker.isRunning():
            self.worker.add_external_event(event)
        else:
            self.current_score = min(100.0, self.current_score + event.score_delta)
            self.dial.set_score(self.current_score)
        self._log_event(event)

    def _audio_state(self, state: str) -> None:
        self.cards["mic"].set_value("Ready", "good", state)

    def _audio_level(self, level: float) -> None:
        self.cards["voice"].detail.setText(f"Input level {level:.0%}")
        self.cards["voice"].detail.show()

    def _speaker_count(self, count: int) -> None:
        self.cards["speakers"].set_value(
            str(count), "warn" if count > 1 else "good",
            "Review required" if count > 1 else "Session-local",
        )

    def _voice_activity(self, active: bool) -> None:
        self.cards["voice"].set_value("Speaking" if active else "Quiet", "warn" if active else "good")

    def _audio_error(self, message: str) -> None:
        self.cards["mic"].set_value("Unavailable", "bad", "Check microphone permission")
        self._log_event(ProctorEvent("Voice monitor unavailable", Severity.WARNING, message))

    def _camera_error(self, message: str) -> None:
        self.video.setText(message)
        self.live_pill.set_state("Camera unavailable", "bad")
        QMessageBox.warning(self, "Camera unavailable", message)

    def toggle_pause(self) -> None:
        self.paused = not self.paused
        self.pause_button.setText("Resume monitoring" if self.paused else "Pause monitoring")
        if self.worker:
            self.worker.set_paused(self.paused)
        if self.audio_worker:
            self.audio_worker.set_paused(self.paused)
        self._log_event(ProctorEvent(
            "Monitoring paused" if self.paused else "Monitoring resumed",
            Severity.INFO,
            "Video analysis was paused by the operator." if self.paused else "Video analysis resumed.",
        ))

    def _tick_timer(self) -> None:
        if not self.paused and self.remaining_seconds > 0:
            self.remaining_seconds -= 1
        self.timer_label.setText(self._format_time())
        if self.remaining_seconds == 0:
            self._clock.stop()
            self._log_event(ProctorEvent("Exam timer ended", Severity.NOTICE, "The configured exam duration elapsed."))

    def _format_time(self) -> str:
        hours, remainder = divmod(self.remaining_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

    def export_events(self) -> None:
        default = str(Path.cwd() / f"proctor-events-{datetime.now():%Y%m%d-%H%M%S}.csv")
        destination, _ = QFileDialog.getSaveFileName(self, "Export event timeline", default, "CSV files (*.csv)")
        if destination:
            count = self.store.export_csv(destination)
            self.statusBar().showMessage(f"Exported {count} events to {destination}", 6000)

    def closeEvent(self, event: QCloseEvent) -> None:  # noqa: N802
        if self.worker:
            self.worker.stop()
        if self.audio_worker:
            self.audio_worker.stop()
        self.store.end_session(self.current_score)
        self.store.close()
        event.accept()
