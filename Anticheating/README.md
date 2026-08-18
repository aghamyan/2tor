# Sentinel — standalone AI exam proctoring demo

Sentinel is a local-only Python desktop prototype for testing webcam-based exam monitoring before integrating similar signals into a larger system. It combines MediaPipe Face Mesh, a small Ultralytics YOLO model, configurable temporal scoring, a PySide6 monitoring console, and an SQLite audit trail.

It is deliberately a review aid. It never fails a candidate, determines intent, or makes an exam decision automatically.

## Features

- Automatic webcam preview with face and object evidence overlays
- Multi-face tracking, face visibility, yaw/pitch/roll, head direction, iris-based gaze, and long-eye-closure detection
- YOLO detection for people and COCO's `cell phone` class
- Built-in microphone voice activity monitoring and repeated speaker-signature comparison
- Grace periods for ordinary motion, blinking, and looking down to write
- Sustained and repeated-behavior rules with cooldowns and gradual score decay
- Live suspicion dial, exam timer, health/status indicators, and event timeline
- Threaded video analysis so the desktop interface remains responsive
- Review evidence for scored events: annotated frame images, voice waveform images, and WAV clips
- Per-session SQLite history, clickable timeline thumbnails, and one-click CSV export
- Graceful face-only operation when the YOLO detector is unavailable

## Set up

Python 3.10–3.12 is recommended. The dependency lock deliberately keeps MediaPipe on its Face Mesh-compatible API line and OpenCV on 4.x. From this directory:

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python main.py
```

On macOS, allow the terminal or Python camera and microphone access in **System Settings → Privacy & Security → Camera / Microphone**. On first launch, Ultralytics may download the small `yolov8n.pt` model. Later launches use the cached model.

## Configuration

Edit [`config.json`](config.json) before launch. All suspicion weights and timing thresholds are named there. Important controls include:

- `camera_index`: switch to `1` or another index for an external webcam.
- `preferred_camera_name`: name fragment for the preferred camera. It defaults to the built-in `FaceTime HD Camera`.
- `blocked_camera_name_terms`: devices containing these terms are never opened. The defaults block iPhone and Continuity cameras.
- `object_detection_every_n_frames`: trade object-detection latency for CPU usage.
- `writing_grace_seconds`: how long a downward look is allowed before an event.
- `event_cooldown_seconds`: prevents the same sustained condition from spamming events.
- `score_decay_per_second`: slowly lowers the live review priority after clear behavior.
- `yolo_model`: use a custom `.pt` model to add a `calculator` class. The detector already accepts that label when a model supplies it.
- `preferred_microphone_name`: preferred local microphone; it defaults to the MacBook microphone.
- `blocked_microphone_name_terms`: defaults to blocking iPhone and Continuity audio inputs.
- `speaker_distance_threshold`: how different two recurring acoustic signatures must be. Lower values are stricter.
- `speaker_confirmation_segments`: matching candidate segments required before reporting another signature.
- `voice_min_segment_seconds`: ignores speech or noise bursts shorter than this duration.

Restart the application after changing configuration. Existing session data remains under `data/proctoring.db`.

## Evidence review

Every scored visual detection saves the current annotated camera frame under `data/evidence/<session-id>/`. Voice-signature detections save a waveform PNG and the corresponding WAV segment. The Event Timeline displays a **View** thumbnail; open it to inspect the image and, for voice events, choose **Play recorded clip**. Evidence paths are also preserved in SQLite and CSV exports.

Evidence files can contain sensitive video and audio. Establish consent, retention limits, access controls, and deletion procedures before using this prototype with real candidates.

## How scoring works

Raw per-frame labels do not immediately become events. Each configured condition must persist for its grace period. Emitted events add their configured weight to the live score, identical conditions are throttled, and the score decays toward zero over time. The score is capped at 100 and maps only to these operator statuses:

- Monitoring normally
- Minor concerns
- Elevated attention
- Review recommended

## Run tests

The scoring and storage suites do not require Qt, a webcam, or AI model files:

```bash
python -m unittest discover -v
```

## Project layout

```text
proctoring_app/
  config.py             configuration data classes
  models.py             shared observations and events
  scoring.py            temporal suspicion engine
  storage.py            SQLite event repository
  worker.py             camera/analysis background thread
  audio_worker.py       microphone capture and evidence recording
  voice_analysis.py     voice signatures and session clustering
  vision/               MediaPipe and YOLO analyzers
  ui/                   monitoring console and visual system
tests/                   headless unit tests
```

## Prototype limitations

Head-pose and iris heuristics need calibration for each camera position and population. Occlusion is inferred from landmark completeness and face framing; robust mask/hand occlusion needs a dedicated trained classifier. Standard COCO YOLO models detect phones but do not include calculators. The voice system compares recurring spectral signatures within one session; it is not biometric speaker identification, and noise, room acoustics, illness, or overlapping speech can affect it. Lighting, glasses, skin tone, assistive technology, and atypical movement can also affect visual signals. Always require human review.
