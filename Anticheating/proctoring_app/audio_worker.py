from __future__ import annotations

import queue
import time
import wave
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
from PySide6.QtCore import QThread, Signal

from .config import AppConfig
from .models import ProctorEvent, Severity
from .voice_analysis import SpeakerSignatureTracker


class AudioWorker(QThread):
    event_ready = Signal(object)
    state_changed = Signal(str)
    level_ready = Signal(float)
    speakers_changed = Signal(int)
    voice_activity_changed = Signal(bool)
    fatal_error = Signal(str)

    def __init__(self, config: AppConfig, evidence_directory: str | Path, parent=None) -> None:
        super().__init__(parent)
        self.config = config
        self.evidence_directory = Path(evidence_directory)
        self._running = True
        self._paused = False
        self._blocks: queue.Queue[np.ndarray] = queue.Queue(maxsize=50)
        self._last_voice_state = False
        self._last_event_at = -1e9
        self._tracker = SpeakerSignatureTracker(
            config.speaker_distance_threshold, config.speaker_confirmation_segments
        )

    def run(self) -> None:
        try:
            import sounddevice as sd

            device_index, device_name = self._select_microphone(sd)
            block_size = int(self.config.audio_sample_rate * self.config.audio_block_ms / 1000)

            def callback(indata, frames, timing, status) -> None:
                if status:
                    return
                try:
                    self._blocks.put_nowait(indata[:, 0].copy())
                except queue.Full:
                    try:
                        self._blocks.get_nowait()
                        self._blocks.put_nowait(indata[:, 0].copy())
                    except queue.Empty:
                        pass

            with sd.InputStream(
                device=device_index,
                samplerate=self.config.audio_sample_rate,
                channels=1,
                dtype="float32",
                blocksize=block_size,
                callback=callback,
            ):
                self.state_changed.emit(f"Listening · {device_name}")
                self._monitor_blocks()
        except Exception as exc:
            self.fatal_error.emit(f"Voice monitoring unavailable: {exc}")

    def _monitor_blocks(self) -> None:
        segment: list[np.ndarray] = []
        silence_blocks = 0
        noise_floor = 0.002
        silence_needed = max(1, round(self.config.voice_silence_seconds * 1000 / self.config.audio_block_ms))
        max_blocks = max(1, round(self.config.voice_max_segment_seconds * 1000 / self.config.audio_block_ms))
        while self._running:
            try:
                block = self._blocks.get(timeout=0.25)
            except queue.Empty:
                continue
            if self._paused:
                segment.clear()
                silence_blocks = 0
                self._set_voice_state(False)
                continue
            rms = float(np.sqrt(np.mean(np.square(block)) + 1e-12))
            threshold = max(self.config.voice_energy_threshold, noise_floor * 3.2)
            voiced = rms >= threshold
            self.level_ready.emit(min(1.0, rms / max(threshold * 4, 1e-6)))
            if not voiced and not segment:
                noise_floor = noise_floor * 0.98 + rms * 0.02
                self._set_voice_state(False)
                continue
            segment.append(block)
            if voiced:
                silence_blocks = 0
                self._set_voice_state(True)
            else:
                silence_blocks += 1
            if silence_blocks >= silence_needed or len(segment) >= max_blocks:
                trailing = silence_blocks * len(block)
                audio = np.concatenate(segment)
                if trailing and trailing < len(audio):
                    audio = audio[:-trailing]
                self._process_segment(audio)
                segment.clear()
                silence_blocks = 0
                self._set_voice_state(False)

    def _process_segment(self, audio: np.ndarray) -> None:
        duration = len(audio) / self.config.audio_sample_rate
        if duration < self.config.voice_min_segment_seconds:
            return
        observation = self._tracker.observe(audio, self.config.audio_sample_rate)
        self.speakers_changed.emit(observation.speaker_count)
        now = time.monotonic()
        if not observation.new_speaker or now - self._last_event_at < self.config.voice_event_cooldown_seconds:
            return
        self._last_event_at = now
        image_path, audio_path = self._save_evidence(audio, observation.speaker_count, observation.distance)
        self.event_ready.emit(ProctorEvent(
            event_type="Multiple voice signatures",
            severity=Severity.WARNING,
            description=(
                f"Audio contains {observation.speaker_count} distinct recurring voice signatures "
                f"(difference {observation.distance:.2f}). Human review required."
            ),
            score_delta=self.config.weights.multiple_voice_signatures,
            evidence_path=str(image_path),
            audio_path=str(audio_path),
        ))

    def _save_evidence(self, audio: np.ndarray, count: int, distance: float) -> tuple[Path, Path]:
        self.evidence_directory.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        image_path = self.evidence_directory / f"voice-{stamp}.png"
        audio_path = self.evidence_directory / f"voice-{stamp}.wav"

        pcm = np.int16(np.clip(audio, -1, 1) * 32767)
        with wave.open(str(audio_path), "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(self.config.audio_sample_rate)
            output.writeframes(pcm.tobytes())

        canvas = np.full((360, 960, 3), (24, 14, 9), dtype=np.uint8)
        for y in range(90, 321, 46):
            cv2.line(canvas, (42, y), (918, y), (49, 38, 28), 1)
        points = min(876, len(audio))
        if points:
            indices = np.linspace(0, len(audio) - 1, points).astype(int)
            values = audio[indices] / max(float(np.max(np.abs(audio))), 1e-6)
            coords = np.column_stack((np.arange(points) + 42, 207 - values * 105)).astype(np.int32)
            cv2.polylines(canvas, [coords], False, (178, 214, 69), 2, cv2.LINE_AA)
        cv2.putText(canvas, "VOICE SIGNATURE REVIEW", (42, 48), cv2.FONT_HERSHEY_SIMPLEX,
                    .65, (247, 238, 224), 2, cv2.LINE_AA)
        cv2.putText(canvas, f"{count} recurring signatures  |  difference {distance:.2f}", (42, 76),
                    cv2.FONT_HERSHEY_SIMPLEX, .48, (74, 185, 240), 1, cv2.LINE_AA)
        cv2.putText(canvas, "Waveform is evidence of captured audio; listen to the clip for review.",
                    (42, 340), cv2.FONT_HERSHEY_SIMPLEX, .42, (173, 151, 130), 1, cv2.LINE_AA)
        cv2.imwrite(str(image_path), canvas)
        return image_path, audio_path

    def _select_microphone(self, sd) -> tuple[int, str]:
        devices = sd.query_devices()
        candidates = [
            (index, str(device["name"])) for index, device in enumerate(devices)
            if int(device["max_input_channels"]) > 0
        ]
        blocked = tuple(term.casefold() for term in self.config.blocked_microphone_name_terms)
        allowed = [(index, name) for index, name in candidates if not any(term in name.casefold() for term in blocked)]
        if not allowed:
            raise RuntimeError("No permitted microphone is available; iPhone/Continuity inputs are blocked.")
        preferred = self.config.preferred_microphone_name.casefold()
        for index, name in allowed:
            if preferred and preferred in name.casefold():
                return index, name
        return allowed[0]

    def _set_voice_state(self, active: bool) -> None:
        if active != self._last_voice_state:
            self._last_voice_state = active
            self.voice_activity_changed.emit(active)

    def set_paused(self, paused: bool) -> None:
        self._paused = paused
        self.state_changed.emit("Paused" if paused else "Listening")

    def stop(self) -> None:
        self._running = False
        self.wait(3000)
