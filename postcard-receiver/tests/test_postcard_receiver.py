import unittest

import cv2
import numpy as np

from postcard_receiver import clean_friend_username, clean_source_id, coordinates_close, detect_text_panel, field_quality_issue, hamming_hash, normalized, title_looks_like_location, titles_match


class PostcardReceiverTest(unittest.TestCase):
    def test_normalization_is_stable_for_deduplication(self):
        self.assertEqual("town of greenport park", normalized("Town Of Greenport Park!"))

    def test_perceptual_hash_distance(self):
        self.assertEqual(0, hamming_hash("000000000000000f", "000000000000000f"))
        self.assertEqual(1, hamming_hash("000000000000000f", "000000000000000e"))

    def test_duplicate_title_matching_tolerates_small_ocr_changes(self):
        self.assertTrue(titles_match("Åvallen", "Avallen"))
        self.assertFalse(titles_match("Forceful", "Eevee Explorers: Red Man Statues"))

    def test_duplicate_coordinates_allow_small_geocoder_drift(self):
        record = {"lat": -27.4792, "lon": 153.0201}
        self.assertTrue(coordinates_close(record, {"lat": -27.4793, "lon": 153.0202}))
        self.assertFalse(coordinates_close(record, {"lat": -27.4669, "lon": 153.0052}))

    def test_detects_postcard_text_panel_on_game_coloured_background(self):
        image = np.full((2400, 1080, 3), (230, 205, 45), dtype=np.uint8)
        cv2.rectangle(image, (530, 860), (1010, 1480), (248, 248, 248), thickness=-1)
        panel = detect_text_panel(image)
        self.assertIsNotNone(panel)
        x, y, width, height = panel
        self.assertLess(abs(x - 530), 25)
        self.assertLess(abs(y - 860), 25)
        self.assertGreater(width, 430)
        self.assertGreater(height, 570)

    def test_detects_postcard_panel_on_orange_scrapbook_background(self):
        image = np.full((2400, 1080, 3), (35, 125, 235), dtype=np.uint8)
        cv2.rectangle(image, (515, 790), (1015, 1450), (248, 248, 248), thickness=-1)
        panel = detect_text_panel(image)
        self.assertIsNotNone(panel)
        self.assertLess(abs(panel[0] - 515), 25)

    def test_greeting_anchor_avoids_larger_warning_dialog(self):
        image = np.full((2400, 1080, 3), (230, 205, 45), dtype=np.uint8)
        cv2.rectangle(image, (350, 610), (1025, 990), (250, 250, 250), thickness=-1)
        cv2.rectangle(image, (560, 1110), (1010, 1690), (248, 248, 248), thickness=-1)
        words = [{
            "text": "Greetings",
            "confidence": 95.0,
            "left": 650,
            "top": 1220,
            "width": 120,
            "height": 38,
        }]
        panel = detect_text_panel(image, words)
        self.assertIsNotNone(panel)
        self.assertGreater(panel[1], 1000)

    def test_rejects_obvious_ocr_fragments(self):
        self.assertIsNotNone(field_quality_issue({"stopName": "HA", "locationText": "Koga, Japan"}))
        self.assertIsNotNone(field_quality_issue({"stopName": "Uizi", "locationText": ""}))
        self.assertIsNotNone(field_quality_issue({"stopName": "=~Â»", "locationText": "i k }, Unt"}))

    def test_accepts_plausible_names(self):
        self.assertIsNone(field_quality_issue({"stopName": "Icarus", "locationText": ""}))
        self.assertIsNone(field_quality_issue({"stopName": "O'Brien's", "locationText": "Brisbane, Australia"}))

    def test_capture_source_id_is_safe_and_has_a_default(self):
        self.assertEqual("1", clean_source_id(""))
        self.assertEqual("phone-2", clean_source_id("phone-2"))
        self.assertEqual("phone2", clean_source_id("phone 2!"))

    def test_quality_gate_accepts_native_text_and_rejects_fragments(self):
        self.assertIsNone(field_quality_issue({"stopName": "千葉神社", "locationText": "Funabashi", "titleConfidence": 70}))
        self.assertIsNotNone(field_quality_issue({"stopName": "AP Re fe iat 2218 9 5", "locationText": "Tokyo", "titleConfidence": 70}))
        self.assertIsNotNone(field_quality_issue({"stopName": "Valid name", "locationText": "Brisbane", "titleConfidence": 12}))

    def test_location_is_not_mistaken_for_friend_username(self):
        fields = {"friendUsername": "UnitedStates", "locationText": "Chicago, Illinois, United States"}
        coordinates = {"country": "United States", "state": "Illinois"}
        self.assertEqual("", clean_friend_username(fields, coordinates))
        fields["friendUsername"] = "CaptWintio"
        self.assertEqual("CaptWintio", clean_friend_username(fields, coordinates))

    def test_location_text_cannot_be_published_as_the_title(self):
        coordinates = {
            "displayName": "Chandler, Maricopa County, Arizona, United States",
            "country": "United States",
            "state": "Arizona",
        }
        self.assertTrue(title_looks_like_location({"stopName": "Chandler, Arizona, United", "locationText": "States"}, coordinates))
        self.assertFalse(title_looks_like_location({"stopName": "Pelican Fountain", "locationText": "Chandler, Arizona"}, coordinates))


if __name__ == "__main__":
    unittest.main()
