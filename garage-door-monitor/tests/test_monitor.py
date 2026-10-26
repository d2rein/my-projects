import logging
from pathlib import Path
import sys
import tempfile
import unittest

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from garage_monitor import Debouncer, GarageMonitor, StateHistory, StructuralClassifier, describe_roi, descriptor_similarity


class DescriptorTests(unittest.TestCase):
    def test_structural_similarity_prefers_matching_edges(self):
        horizontal = np.zeros((128, 192, 3), dtype=np.uint8)
        vertical = np.zeros_like(horizontal)
        for y in range(12, 128, 18):
            cv2.line(horizontal, (0, y), (191, y), (255, 255, 255), 3)
        for x in range(12, 192, 18):
            cv2.line(vertical, (x, 0), (x, 127), (255, 255, 255), 3)
        first = describe_roi(horizontal)
        same = describe_roi(horizontal.copy())
        different = describe_roi(vertical)
        self.assertIsNotNone(first)
        self.assertGreater(descriptor_similarity(first, same), descriptor_similarity(first, different) + 0.15)

    def test_multiple_reference_classifier(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "open").mkdir()
            (root / "closed").mkdir()
            open_image = np.zeros((180, 320, 3), dtype=np.uint8)
            closed_image = np.zeros_like(open_image)
            for x in range(20, 320, 35):
                cv2.line(open_image, (x, 0), (x, 179), (255, 255, 255), 3)
            for y in range(15, 180, 25):
                cv2.line(closed_image, (0, y), (319, y), (255, 255, 255), 3)
            cv2.imwrite(str(root / "open" / "one.jpg"), open_image)
            cv2.imwrite(str(root / "closed" / "one.jpg"), closed_image)
            settings = {
                "minimumSimilarity": 0.4,
                "minimumMargin": 0.05,
                "roiVoteMargin": 0.03,
                "rois": [{"name": "all", "x": 0, "y": 0, "width": 1, "height": 1}],
            }
            result = StructuralClassifier(root).classify(open_image, settings)
            self.assertEqual("OPEN", result["state"])


class DebouncerTests(unittest.TestCase):
    def test_requires_consecutive_observations(self):
        debounce = Debouncer(3)
        debounce.observe("OPEN")
        debounce.observe("OPEN")
        self.assertEqual("UNKNOWN", debounce.reported)
        debounce.observe("OPEN")
        self.assertEqual("OPEN", debounce.reported)

    def test_unknown_is_immediate_and_resets_candidate(self):
        debounce = Debouncer(2)
        debounce.observe("CLOSED")
        debounce.observe("UNKNOWN")
        self.assertEqual("UNKNOWN", debounce.reported)
        self.assertIsNone(debounce.candidate)

    def test_candidate_exposes_pending_transition(self):
        debounce = Debouncer(3)
        debounce.observe("OPEN")
        self.assertEqual("OPEN", debounce.candidate)
        self.assertEqual(1, debounce.count)


class ApiSecurityTests(unittest.TestCase):
    def test_bearer_token_comparison(self):
        monitor = GarageMonitor.__new__(GarageMonitor)
        monitor.env = {"MONITOR_API_TOKEN": "secret-token"}
        self.assertTrue(monitor.valid_api_token("Bearer secret-token"))
        self.assertFalse(monitor.valid_api_token("Bearer wrong"))
        self.assertFalse(monitor.valid_api_token(None))


class StateHistoryTests(unittest.TestCase):
    def test_records_only_changed_confirmed_states_and_survives_restart(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "history.csv"
            history = StateHistory(path)
            self.assertFalse(history.record("UNKNOWN", 0.0))
            self.assertTrue(history.record("CLOSED", 0.91, "2026-08-13T10:00:00+10:00"))
            self.assertFalse(history.record("CLOSED", 0.95, "2026-08-13T10:01:00+10:00"))
            restarted = StateHistory(path)
            self.assertFalse(restarted.record("CLOSED", 0.96, "2026-08-13T10:02:00+10:00"))
            self.assertTrue(restarted.record("OPEN", 0.92, "2026-08-13T10:03:00+10:00"))
            events = restarted.recent()
            self.assertEqual(["OPEN", "CLOSED"], [event["state"] for event in events])


if __name__ == "__main__":
    logging.disable(logging.CRITICAL)
    unittest.main()
