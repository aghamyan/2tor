from __future__ import annotations

from dataclasses import dataclass

import numpy as np


def extract_voice_signature(samples: np.ndarray, sample_rate: int) -> np.ndarray | None:
    """Create a small spectral-envelope signature without speech-to-text or biometrics."""
    audio = np.asarray(samples, dtype=np.float32).reshape(-1)
    if audio.size < sample_rate // 2:
        return None
    audio = audio - float(np.mean(audio))
    peak = float(np.max(np.abs(audio)))
    if peak < 1e-5:
        return None
    audio = audio / peak
    audio = np.append(audio[0], audio[1:] - 0.97 * audio[:-1])

    frame_length = max(256, int(sample_rate * 0.025))
    hop = max(128, int(sample_rate * 0.010))
    frame_count = 1 + (len(audio) - frame_length) // hop
    if frame_count < 3:
        return None
    indices = np.arange(frame_length)[None, :] + hop * np.arange(frame_count)[:, None]
    frames = audio[indices] * np.hanning(frame_length)
    n_fft = 1 << (frame_length - 1).bit_length()
    spectra = np.abs(np.fft.rfft(frames, n=n_fft, axis=1)) ** 2
    frequencies = np.fft.rfftfreq(n_fft, 1.0 / sample_rate)

    # Mel-spaced bands capture vocal-tract shape better than raw FFT bins.
    hz_to_mel = lambda hz: 2595.0 * np.log10(1.0 + hz / 700.0)
    mel_to_hz = lambda mel: 700.0 * (10 ** (mel / 2595.0) - 1.0)
    edges = mel_to_hz(np.linspace(hz_to_mel(80), hz_to_mel(min(7600, sample_rate / 2)), 26))
    bands: list[np.ndarray] = []
    for low, high in zip(edges[:-1], edges[1:]):
        mask = (frequencies >= low) & (frequencies < high)
        bands.append(np.mean(spectra[:, mask], axis=1) if np.any(mask) else np.zeros(frame_count))
    log_bands = np.log(np.stack(bands, axis=1) + 1e-9)
    log_bands -= np.mean(log_bands, axis=1, keepdims=True)
    signature = np.concatenate((np.median(log_bands, axis=0), np.std(log_bands, axis=0)))
    norm = float(np.linalg.norm(signature))
    return (signature / norm).astype(np.float32) if norm > 1e-8 else None


def cosine_distance(left: np.ndarray, right: np.ndarray) -> float:
    return float(max(0.0, min(2.0, 1.0 - np.dot(left, right))))


@dataclass(slots=True)
class SpeakerObservation:
    speaker_count: int
    new_speaker: bool = False
    distance: float = 0.0
    confirmation_progress: int = 0


class SpeakerSignatureTracker:
    """Session-local clustering of repeated speech segments.

    This detects acoustically different signatures; it does not identify people.
    """

    def __init__(self, distance_threshold: float = 0.22, confirmations: int = 2) -> None:
        self.distance_threshold = distance_threshold
        self.confirmations = max(1, confirmations)
        self.profiles: list[np.ndarray] = []
        self.profile_samples: list[int] = []
        self._candidate: np.ndarray | None = None
        self._candidate_count = 0

    def observe(self, samples: np.ndarray, sample_rate: int) -> SpeakerObservation:
        signature = extract_voice_signature(samples, sample_rate)
        if signature is None:
            return SpeakerObservation(len(self.profiles))
        if not self.profiles:
            self.profiles.append(signature)
            self.profile_samples.append(1)
            return SpeakerObservation(1)

        distances = [cosine_distance(signature, profile) for profile in self.profiles]
        closest = int(np.argmin(distances))
        distance = distances[closest]
        if distance <= self.distance_threshold:
            count = self.profile_samples[closest]
            updated = self.profiles[closest] * count + signature
            self.profiles[closest] = updated / max(float(np.linalg.norm(updated)), 1e-8)
            self.profile_samples[closest] = count + 1
            self._candidate = None
            self._candidate_count = 0
            return SpeakerObservation(len(self.profiles), distance=distance)

        if self._candidate is None or cosine_distance(signature, self._candidate) > self.distance_threshold:
            self._candidate = signature
            self._candidate_count = 1
        else:
            updated = self._candidate * self._candidate_count + signature
            self._candidate = updated / max(float(np.linalg.norm(updated)), 1e-8)
            self._candidate_count += 1

        if self._candidate_count >= self.confirmations:
            self.profiles.append(self._candidate)
            self.profile_samples.append(self._candidate_count)
            self._candidate = None
            self._candidate_count = 0
            return SpeakerObservation(len(self.profiles), new_speaker=True, distance=distance)
        return SpeakerObservation(
            len(self.profiles), distance=distance, confirmation_progress=self._candidate_count
        )

