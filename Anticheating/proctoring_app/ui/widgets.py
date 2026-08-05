from __future__ import annotations

from PySide6.QtCore import QPointF, QRectF, Qt
from PySide6.QtCore import QUrl
from PySide6.QtGui import QColor, QDesktopServices, QFont, QPainter, QPen, QPixmap
from PySide6.QtWidgets import (
    QDialog, QDialogButtonBox, QFrame, QHBoxLayout, QLabel, QPushButton, QVBoxLayout, QWidget,
)


class MetricCard(QFrame):
    def __init__(self, label: str, value: str = "—", parent=None) -> None:
        super().__init__(parent)
        self.setObjectName("metricCard")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(14, 11, 14, 11)
        layout.setSpacing(3)
        heading = QLabel(label.upper())
        heading.setObjectName("metricLabel")
        self.value = QLabel(value)
        self.value.setObjectName("metricValue")
        self.detail = QLabel("")
        self.detail.setObjectName("metricDetail")
        self.detail.hide()
        layout.addWidget(heading)
        layout.addWidget(self.value)
        layout.addWidget(self.detail)

    def set_value(self, value: str, tone: str = "neutral", detail: str = "") -> None:
        self.value.setText(value)
        colors = {
            "neutral": "#E7EEF7", "good": "#45D6B2", "warn": "#F0B94A", "bad": "#FF6868",
        }
        self.value.setStyleSheet(f"color: {colors.get(tone, colors['neutral'])};")
        self.detail.setText(detail)
        self.detail.setVisible(bool(detail))


class StatusPill(QFrame):
    def __init__(self, text: str, parent=None) -> None:
        super().__init__(parent)
        self.setObjectName("statusPill")
        row = QHBoxLayout(self)
        row.setContentsMargins(11, 6, 12, 6)
        row.setSpacing(8)
        self.dot = QLabel("●")
        self.dot.setObjectName("statusDot")
        self.label = QLabel(text)
        self.label.setObjectName("statusText")
        row.addWidget(self.dot)
        row.addWidget(self.label)

    def set_state(self, text: str, tone: str = "good") -> None:
        self.label.setText(text)
        color = {"good": "#45D6B2", "warn": "#F0B94A", "bad": "#FF6868"}.get(tone, "#8BA1B7")
        self.dot.setStyleSheet(f"color: {color};")


class SuspicionDial(QWidget):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self._score = 0.0
        self.setMinimumSize(180, 150)

    def set_score(self, score: float) -> None:
        self._score = max(0.0, min(100.0, score))
        self.update()

    def paintEvent(self, event) -> None:  # noqa: N802
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        size = min(self.width() - 28, self.height() * 1.7)
        rect = QRectF((self.width() - size) / 2, 12, size, size)
        start, span = 210 * 16, -240 * 16
        painter.setPen(QPen(QColor("#24364A"), 12, Qt.SolidLine, Qt.RoundCap))
        painter.drawArc(rect, start, span)
        color = QColor("#45D6B2" if self._score < 40 else "#F0B94A" if self._score < 70 else "#FF6868")
        painter.setPen(QPen(color, 12, Qt.SolidLine, Qt.RoundCap))
        painter.drawArc(rect, start, int(span * self._score / 100))
        center = QPointF(self.width() / 2, self.height() * .52)
        painter.setPen(QColor("#EAF1F8"))
        painter.setFont(QFont("Avenir Next", 30, QFont.DemiBold))
        painter.drawText(QRectF(0, center.y() - 32, self.width(), 48), Qt.AlignCenter, f"{self._score:.0f}")
        painter.setPen(QColor("#8297AD"))
        painter.setFont(QFont("Menlo", 9, QFont.Bold))
        painter.drawText(QRectF(0, center.y() + 14, self.width(), 24), Qt.AlignCenter, "SUSPICION / 100")


class EvidenceDialog(QDialog):
    def __init__(self, image_path: str, audio_path: str | None = None, parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Review detection evidence")
        self.resize(940, 650)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        image = QLabel()
        image.setAlignment(Qt.AlignCenter)
        image.setMinimumSize(760, 480)
        pixmap = QPixmap(image_path)
        if pixmap.isNull():
            image.setText(f"Evidence image is unavailable:\n{image_path}")
        else:
            image.setPixmap(pixmap.scaled(900, 540, Qt.KeepAspectRatio, Qt.SmoothTransformation))
        layout.addWidget(image, 1)
        path = QLabel(image_path, objectName="sessionId")
        path.setTextInteractionFlags(Qt.TextSelectableByMouse)
        layout.addWidget(path)
        actions = QDialogButtonBox(QDialogButtonBox.Close)
        actions.rejected.connect(self.reject)
        if audio_path:
            play = QPushButton("Play recorded clip")
            play.clicked.connect(lambda: QDesktopServices.openUrl(QUrl.fromLocalFile(audio_path)))
            actions.addButton(play, QDialogButtonBox.ActionRole)
        layout.addWidget(actions)
