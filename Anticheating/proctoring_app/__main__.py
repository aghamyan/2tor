from __future__ import annotations

import os
import sys

from PySide6.QtWidgets import QApplication

from .config import AppConfig
from .ui.main_window import MainWindow
from .ui.styles import APP_STYLESHEET


def main() -> int:
    os.environ.setdefault("QT_ENABLE_HIGHDPI_SCALING", "1")
    app = QApplication(sys.argv)
    app.setApplicationName("Sentinel")
    app.setOrganizationName("Local Proctoring Lab")
    app.setStyle("Fusion")
    app.setStyleSheet(APP_STYLESHEET)
    config = AppConfig.load()
    window = MainWindow(config)
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
