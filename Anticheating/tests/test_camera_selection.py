from __future__ import annotations

import unittest

from proctoring_app.camera_selection import CameraSelectionError, select_camera_index


class CameraSelectionTests(unittest.TestCase):
    def test_prefers_facetime_and_blocks_iphone(self) -> None:
        index, name = select_camera_index(
            ["Arthur's iPhone Camera", "FaceTime HD Camera"],
            requested_index=0,
            preferred_name="FaceTime HD Camera",
            blocked_terms=["iphone", "continuity"],
        )
        self.assertEqual((index, name), (1, "FaceTime HD Camera"))

    def test_never_falls_back_to_only_blocked_camera(self) -> None:
        with self.assertRaises(CameraSelectionError):
            select_camera_index(
                ["Arthur's iPhone Camera"], 0, "FaceTime HD Camera", ["iphone", "continuity"]
            )


if __name__ == "__main__":
    unittest.main()
