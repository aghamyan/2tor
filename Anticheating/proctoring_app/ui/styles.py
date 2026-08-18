APP_STYLESHEET = """
QWidget { background: #09131F; color: #DCE6F0; font-family: "Avenir Next", "Segoe UI", sans-serif; font-size: 13px; }
QLabel { background: transparent; }
QMainWindow { background: #09131F; }
QFrame#topBar, QFrame#panel { background: #0E1B2A; border: 1px solid #1B3044; border-radius: 12px; }
QLabel#brand { color: #F2F7FB; font-size: 21px; font-weight: 700; letter-spacing: 1px; }
QLabel#eyebrow, QLabel#metricLabel, QLabel#sectionLabel { color: #6F879E; font-family: Menlo, monospace; font-size: 10px; font-weight: 700; letter-spacing: 1px; }
QLabel#sessionId { color: #8297AD; font-family: Menlo, monospace; font-size: 10px; }
QFrame#statusPill { background: #102434; border: 1px solid #24425A; border-radius: 15px; }
QLabel#statusDot { background: transparent; font-size: 10px; }
QLabel#statusText { background: transparent; color: #BFD0DE; font-size: 11px; font-weight: 600; }
QFrame#metricCard { background: #111F2E; border: 1px solid #1C3348; border-radius: 9px; }
QFrame#metricCard:hover { border-color: #2A506B; }
QLabel#metricValue { background: transparent; font-size: 16px; font-weight: 600; }
QLabel#metricDetail { background: transparent; color: #71889D; font-size: 10px; }
QLabel#video { background: #050B12; border: 1px solid #1D3448; border-radius: 10px; color: #657C91; }
QLabel#overlayBadge { background: rgba(7, 16, 25, 190); color: #B7CAD9; border: 1px solid #284257; border-radius: 6px; padding: 5px 8px; font-family: Menlo, monospace; font-size: 10px; }
QPushButton { background: #15293B; border: 1px solid #29465E; border-radius: 7px; padding: 8px 13px; color: #D7E4EE; font-weight: 600; }
QPushButton:hover { background: #1B344A; border-color: #3D6683; }
QPushButton:pressed { background: #102131; }
QPushButton#primary { background: #2B8EA1; border-color: #45ADC0; color: #F6FCFD; }
QPushButton#danger { color: #FF8A8A; }
QTableWidget { background: #0B1724; alternate-background-color: #0E1C2A; border: none; gridline-color: #182B3C; selection-background-color: #17364A; }
QHeaderView::section { background: #102131; color: #71889D; border: none; border-bottom: 1px solid #20394E; padding: 8px; font-family: Menlo, monospace; font-size: 10px; font-weight: 700; }
QTableWidget::item { padding: 7px; border-bottom: 1px solid #15283A; }
QScrollBar:vertical { background: #0B1724; width: 9px; margin: 0; }
QScrollBar::handle:vertical { background: #2A4054; min-height: 24px; border-radius: 4px; }
QSplitter::handle { background: transparent; height: 8px; width: 8px; }
QToolTip { background: #182A3B; color: #E5EEF6; border: 1px solid #315069; padding: 5px; }
"""
