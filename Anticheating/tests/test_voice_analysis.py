from __future__ import annotations

import unittest

import numpy as np

from proctoring_app.voice_analysis import SpeakerSignatureTracker


class VoiceSignatureTests(unittest.TestCase):
    @staticmethod
    def _voice(frequencies: tuple[float, ...], phase: float = 0.0) -> np.ndarray:
        sample_rate = 16_000
        time = np.arange(int(sample_rate * 1.4)) / sample_rate
        audio = sum(
            (0.5 / (index + 1)) * np.sin(2 * np.pi * frequency * time + phase)
            for index, frequency in enumerate(frequencies)
        )
        return np.asarray(audio, dtype=np.float32)

    def test_requires_confirmation_before_second_signature(self) -> None:
        tracker = SpeakerSignatureTracker(distance_threshold=0.22, confirmations=2)
        first = self._voice((130, 520, 1040))
        same = self._voice((130, 520, 1040), phase=0.7)
        different = self._voice((240, 1440, 2800))

        self.assertEqual(tracker.observe(first, 16_000).speaker_count, 1)
        self.assertFalse(tracker.observe(same, 16_000).new_speaker)
        candidate = tracker.observe(different, 16_000)
        self.assertEqual(candidate.confirmation_progress, 1)
        confirmed = tracker.observe(different, 16_000)
        self.assertTrue(confirmed.new_speaker)
        self.assertEqual(confirmed.speaker_count, 2)


if __name__ == "__main__":
    unittest.main()
