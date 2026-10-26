from __future__ import annotations

import argparse
import csv
import hashlib
import hmac
import ipaddress
import json
import logging
from logging.handlers import RotatingFileHandler
import math
import os
from pathlib import Path
import shutil
import signal
import sys
import threading
import time
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, urlparse

import cv2
import numpy as np
from motion_recorder import MotionRecorder
from push_notifications import FirebasePushNotifier
from alert_broker import AlertBrokerClient


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
REFERENCE_DIR = ROOT / "references"
LOG_DIR = ROOT / "logs"
ENV_PATH = ROOT / ".env"
DEFAULT_CONFIG_PATH = ROOT / "config.json"
SETTINGS_PATH = DATA_DIR / "settings.json"
SNAPSHOT_PATH = DATA_DIR / "current.jpg"
STATE_HISTORY_PATH = DATA_DIR / "state-history.csv"
SETUP_PATH = ROOT / "setup.html"

LABELS = ("OPEN", "CLOSED")
DESCRIPTOR_SIZE = (192, 128)


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def load_env(path: Path) -> dict[str, str]:
    # User-level environment variables are convenient for machine-only producer
    # credentials; the local .env remains authoritative for camera settings.
    values: dict[str, str] = dict(os.environ)
    if not path.exists():
        return values
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1]
        values[key.strip()] = value
    return values


def atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_bytes(content)
    os.replace(temporary, path)


def load_settings() -> dict:
    settings = json.loads(DEFAULT_CONFIG_PATH.read_text(encoding="utf-8"))
    if SETTINGS_PATH.exists():
        settings.update(json.loads(SETTINGS_PATH.read_text(encoding="utf-8")))
    validate_settings(settings)
    return settings


def validate_settings(settings: dict) -> None:
    interval = float(settings.get("sampleIntervalSeconds", 60))
    fast_interval = float(settings.get("fastSampleIntervalSeconds", 10))
    consecutive = int(settings.get("requiredConsecutive", 3))
    if interval < 10 or interval > 3600:
        raise ValueError("sampleIntervalSeconds must be between 10 and 3600")
    if fast_interval < 3 or fast_interval > interval:
        raise ValueError("fastSampleIntervalSeconds must be between 3 and sampleIntervalSeconds")
    if consecutive < 1 or consecutive > 10:
        raise ValueError("requiredConsecutive must be between 1 and 10")
    for key in ("minimumSimilarity", "minimumMargin", "roiVoteMargin"):
        value = float(settings.get(key, 0))
        if not 0 <= value <= 1:
            raise ValueError(f"{key} must be between 0 and 1")
    rois = settings.get("rois")
    if not isinstance(rois, list) or not 1 <= len(rois) <= 8:
        raise ValueError("rois must contain between 1 and 8 regions")
    for index, roi in enumerate(rois):
        for key in ("x", "y", "width", "height"):
            if key not in roi or not isinstance(roi[key], (int, float)):
                raise ValueError(f"ROI {index + 1} has an invalid {key}")
        if roi["x"] < 0 or roi["y"] < 0 or roi["width"] <= 0 or roi["height"] <= 0:
            raise ValueError(f"ROI {index + 1} is outside the frame")
        if roi["x"] + roi["width"] > 1.0001 or roi["y"] + roi["height"] > 1.0001:
            raise ValueError(f"ROI {index + 1} extends outside the frame")


def save_settings(settings: dict) -> None:
    validate_settings(settings)
    atomic_write(SETTINGS_PATH, (json.dumps(settings, indent=2) + "\n").encode("utf-8"))


def crop_roi(frame: np.ndarray, roi: dict) -> np.ndarray:
    height, width = frame.shape[:2]
    x1 = max(0, min(width - 1, round(float(roi["x"]) * width)))
    y1 = max(0, min(height - 1, round(float(roi["y"]) * height)))
    x2 = max(x1 + 1, min(width, round((float(roi["x"]) + float(roi["width"])) * width)))
    y2 = max(y1 + 1, min(height, round((float(roi["y"]) + float(roi["height"])) * height)))
    return frame[y1:y2, x1:x2]


def describe_roi(image: np.ndarray) -> dict[str, np.ndarray | float] | None:
    if image.size == 0:
        return None
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    normalized = cv2.resize(gray, DESCRIPTOR_SIZE, interpolation=cv2.INTER_AREA)
    normalized = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(normalized)
    normalized = cv2.GaussianBlur(normalized, (3, 3), 0)

    gx = cv2.Sobel(normalized, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(normalized, cv2.CV_32F, 0, 1, ksize=3)
    magnitude, angle = cv2.cartToPolar(gx, gy, angleInDegrees=True)
    angle %= 180.0

    median = float(np.median(normalized))
    lower = int(max(25, 0.66 * median))
    upper = int(min(230, max(lower + 30, 1.33 * median)))
    edges = cv2.Canny(normalized, lower, upper)
    edge_density = float(np.count_nonzero(edges)) / float(edges.size)
    if edge_density < 0.003:
        return None

    cells_y, cells_x, bins = 4, 6, 9
    histograms: list[np.ndarray] = []
    cell_h = normalized.shape[0] // cells_y
    cell_w = normalized.shape[1] // cells_x
    for row in range(cells_y):
        for col in range(cells_x):
            y1, y2 = row * cell_h, (row + 1) * cell_h
            x1, x2 = col * cell_w, (col + 1) * cell_w
            hist, _ = np.histogram(
                angle[y1:y2, x1:x2],
                bins=bins,
                range=(0, 180),
                weights=magnitude[y1:y2, x1:x2],
            )
            hist = hist.astype(np.float32)
            hist /= float(np.linalg.norm(hist) + 1e-6)
            histograms.append(hist)
    hog = np.concatenate(histograms)
    hog /= float(np.linalg.norm(hog) + 1e-6)
    return {"hog": hog, "edges": edges, "edgeDensity": edge_density}


def descriptor_similarity(first: dict, second: dict) -> float:
    hog_score = float(np.clip(np.dot(first["hog"], second["hog"]), 0.0, 1.0))

    first_edges = first["edges"]
    second_edges = second["edges"]
    if not np.any(first_edges) or not np.any(second_edges):
        return 0.0
    distance_to_first = cv2.distanceTransform(255 - first_edges, cv2.DIST_L2, 3)
    distance_to_second = cv2.distanceTransform(255 - second_edges, cv2.DIST_L2, 3)
    forward = float(np.mean(distance_to_second[first_edges > 0]))
    reverse = float(np.mean(distance_to_first[second_edges > 0]))
    chamfer_score = math.exp(-((forward + reverse) / 2.0) / 4.0)
    return float(np.clip(0.62 * hog_score + 0.38 * chamfer_score, 0.0, 1.0))


class StructuralClassifier:
    def __init__(self, reference_dir: Path):
        self.reference_dir = reference_dir
        self._cache: dict[tuple, list[dict | None]] = {}

    def reference_files(self) -> dict[str, list[Path]]:
        return {
            label: sorted((self.reference_dir / label.lower()).glob("*.jpg"))
            for label in LABELS
        }

    @staticmethod
    def _roi_signature(rois: list[dict]) -> str:
        return hashlib.sha1(json.dumps(rois, sort_keys=True).encode("utf-8")).hexdigest()

    def _descriptors(self, path: Path, rois: list[dict]) -> list[dict | None] | None:
        try:
            key = (str(path), path.stat().st_mtime_ns, self._roi_signature(rois))
        except FileNotFoundError:
            return None
        if key in self._cache:
            return self._cache[key]
        image = cv2.imread(str(path), cv2.IMREAD_COLOR)
        if image is None:
            return None
        result = [describe_roi(crop_roi(image, roi)) for roi in rois]
        self._cache = {cache_key: value for cache_key, value in self._cache.items() if cache_key[0] != str(path)}
        self._cache[key] = result
        return result

    def clear_cache(self) -> None:
        self._cache.clear()

    def classify(self, frame: np.ndarray, settings: dict) -> dict:
        rois = settings["rois"]
        files = self.reference_files()
        counts = {label: len(files[label]) for label in LABELS}
        if any(counts[label] == 0 for label in LABELS):
            return {
                "state": "UNKNOWN",
                "confidence": 0.0,
                "reason": "Both OPEN and CLOSED references are required",
                "scores": {},
                "referenceCounts": counts,
            }

        current = [describe_roi(crop_roi(frame, roi)) for roi in rois]
        scored: dict[str, list[dict]] = {label: [] for label in LABELS}
        for label in LABELS:
            for path in files[label]:
                reference = self._descriptors(path, rois)
                if reference is None:
                    continue
                roi_scores: list[float | None] = []
                for current_roi, reference_roi in zip(current, reference):
                    if current_roi is None or reference_roi is None:
                        roi_scores.append(None)
                    else:
                        roi_scores.append(descriptor_similarity(current_roi, reference_roi))
                valid = [score for score in roi_scores if score is not None]
                if valid:
                    scored[label].append({
                        "file": path.name,
                        "score": float(np.median(valid)),
                        "roiScores": roi_scores,
                    })

        if any(not scored[label] for label in LABELS):
            return {
                "state": "UNKNOWN",
                "confidence": 0.0,
                "reason": "No usable structural features in one or more reference classes",
                "scores": {},
                "referenceCounts": counts,
            }

        best = {label: max(scored[label], key=lambda item: item["score"]) for label in LABELS}
        winner = max(LABELS, key=lambda label: best[label]["score"])
        loser = "CLOSED" if winner == "OPEN" else "OPEN"
        winner_score = float(best[winner]["score"])
        loser_score = float(best[loser]["score"])
        margin = winner_score - loser_score

        winner_votes = 0
        loser_votes = 0
        decisive_rois = 0
        for index in range(len(rois)):
            per_label: dict[str, float] = {}
            for label in LABELS:
                values = [item["roiScores"][index] for item in scored[label] if item["roiScores"][index] is not None]
                if values:
                    per_label[label] = max(values)
            if len(per_label) != 2:
                continue
            roi_difference = per_label[winner] - per_label[loser]
            if abs(roi_difference) >= float(settings["roiVoteMargin"]):
                decisive_rois += 1
                if roi_difference > 0:
                    winner_votes += 1
                else:
                    loser_votes += 1

        reason = "Confident structural match"
        state = winner
        if winner_score < float(settings["minimumSimilarity"]):
            state, reason = "UNKNOWN", "No reference is structurally similar enough"
        elif margin < float(settings["minimumMargin"]):
            state, reason = "UNKNOWN", "OPEN and CLOSED references disagree or are too close"
        elif decisive_rois == 0 or winner_votes <= loser_votes:
            state, reason = "UNKNOWN", "Selected regions do not agree"

        margin_quality = min(1.0, margin / max(0.001, 2.0 * float(settings["minimumMargin"])))
        confidence = winner_score * (0.55 + 0.45 * margin_quality) if state != "UNKNOWN" else 0.0
        return {
            "state": state,
            "confidence": round(float(np.clip(confidence, 0.0, 1.0)), 3),
            "reason": reason,
            "scores": {
                "OPEN": round(float(best["OPEN"]["score"]), 3),
                "CLOSED": round(float(best["CLOSED"]["score"]), 3),
                "margin": round(float(margin), 3),
                "winnerVotes": winner_votes,
                "loserVotes": loser_votes,
                "decisiveRois": decisive_rois,
            },
            "referenceCounts": counts,
        }


class Debouncer:
    def __init__(self, required: int):
        self.required = required
        self.reported = "UNKNOWN"
        self.since = now_iso()
        self.candidate: str | None = None
        self.count = 0

    def observe(self, observed: str) -> None:
        if observed not in LABELS:
            self.candidate = None
            self.count = 0
            self._set_reported("UNKNOWN")
            return
        if observed == self.reported:
            self.candidate = None
            self.count = 0
            return
        if observed == self.candidate:
            self.count += 1
        else:
            self.candidate = observed
            self.count = 1
        if self.count >= self.required:
            self._set_reported(observed)
            self.candidate = None
            self.count = 0

    def _set_reported(self, state: str) -> None:
        if state != self.reported:
            self.reported = state
            self.since = now_iso()


class ErrorThrottle:
    def __init__(self, seconds: float = 300):
        self.seconds = seconds
        self.last: dict[str, float] = {}

    def should_log(self, message: str) -> bool:
        current = time.monotonic()
        previous = self.last.get(message, 0)
        if current - previous >= self.seconds:
            self.last[message] = current
            return True
        return False


class StateHistory:
    HEADER = ("timestamp", "state", "confidence")

    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.Lock()
        self.last_state = self._read_last_state()

    def _read_last_state(self) -> str | None:
        if not self.path.exists():
            return None
        try:
            last: str | None = None
            with self.path.open("r", encoding="utf-8", newline="") as source:
                for row in csv.DictReader(source):
                    if row.get("state") in LABELS:
                        last = row["state"]
            return last
        except (OSError, csv.Error):
            return None

    def record(self, state: str, confidence: float, timestamp: str | None = None) -> bool:
        if state not in LABELS:
            return False
        with self.lock:
            if state == self.last_state:
                return False
            self.path.parent.mkdir(parents=True, exist_ok=True)
            needs_header = not self.path.exists() or self.path.stat().st_size == 0
            with self.path.open("a", encoding="utf-8", newline="") as destination:
                writer = csv.writer(destination, lineterminator="\n")
                if needs_header:
                    writer.writerow(self.HEADER)
                writer.writerow((timestamp or now_iso(), state, f"{confidence:.3f}"))
                destination.flush()
                os.fsync(destination.fileno())
            self.last_state = state
            return True

    def recent(self, limit: int = 100) -> list[dict]:
        limit = max(1, min(int(limit), 1000))
        if not self.path.exists():
            return []
        with self.lock:
            try:
                with self.path.open("r", encoding="utf-8", newline="") as source:
                    rows = list(csv.DictReader(source))
                return list(reversed(rows[-limit:]))
            except (OSError, csv.Error):
                return []


class GarageMonitor:
    def __init__(self, env: dict[str, str], logger: logging.Logger):
        self.env = env
        self.logger = logger
        self.settings = load_settings()
        self.classifier = StructuralClassifier(REFERENCE_DIR)
        self.history = StateHistory(STATE_HISTORY_PATH)
        self.debouncer = Debouncer(int(self.settings["requiredConsecutive"]))
        self.lock = threading.RLock()
        self.sample_lock = threading.Lock()
        self.stop_event = threading.Event()
        self.recorder = MotionRecorder(self)
        self.push = FirebasePushNotifier(env, logger)
        self.alert_broker = AlertBrokerClient(env, logger)
        self.last_frame: str | None = None
        self.last_raw: np.ndarray | None = None
        self.last_raw_jpeg: bytes | None = None
        self.last_error: str | None = None
        self.rapid_until_closed = False
        self.observation = {
            "state": "UNKNOWN",
            "confidence": 0.0,
            "reason": "Waiting for first sample",
            "scores": {},
            "referenceCounts": self.reference_counts(),
        }
        self.error_throttle = ErrorThrottle()
        cv2.setNumThreads(1)

    def reference_counts(self) -> dict[str, int]:
        files = self.classifier.reference_files()
        return {label: len(files[label]) for label in LABELS}

    def valid_api_token(self, authorization: str | None) -> bool:
        configured = self.env.get("MONITOR_API_TOKEN", "")
        if not configured or not authorization or not authorization.startswith("Bearer "):
            return False
        return hmac.compare_digest(configured, authorization.removeprefix("Bearer ").strip())

    def _stream_url(self) -> str:
        username = self.env.get("TAPO_USERNAME", "")
        password = self.env.get("TAPO_PASSWORD", "")
        if not username or not password:
            raise RuntimeError("TAPO_USERNAME and TAPO_PASSWORD must be set in .env")
        return f"rtsp://{quote(username, safe='')}:{quote(password, safe='')}@192.168.1.125:554/stream2"

    def capture(self) -> np.ndarray:
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
        capture = cv2.VideoCapture(
            self._stream_url(),
            cv2.CAP_FFMPEG,
            [cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000, cv2.CAP_PROP_READ_TIMEOUT_MSEC, 10000],
        )
        try:
            if not capture.isOpened():
                raise RuntimeError("Could not open the authenticated RTSP stream")
            frame = None
            for _ in range(6):
                ok, candidate = capture.read()
                if ok and candidate is not None and candidate.size:
                    frame = candidate
            if frame is None:
                raise RuntimeError("RTSP stream opened but no frame was decoded")
            return frame
        finally:
            capture.release()

    @staticmethod
    def encode_jpeg(frame: np.ndarray, quality: int = 90) -> bytes:
        ok, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
        if not ok:
            raise RuntimeError("Could not encode camera frame")
        return encoded.tobytes()

    def annotated(self, frame: np.ndarray, observation: dict) -> np.ndarray:
        result = frame.copy()
        height, width = result.shape[:2]
        color = {"OPEN": (40, 190, 40), "CLOSED": (210, 140, 20)}.get(observation["state"], (40, 170, 230))
        for roi in self.settings["rois"]:
            x1 = round(float(roi["x"]) * width)
            y1 = round(float(roi["y"]) * height)
            x2 = round((float(roi["x"]) + float(roi["width"])) * width)
            y2 = round((float(roi["y"]) + float(roi["height"])) * height)
            cv2.rectangle(result, (x1, y1), (x2, y2), color, 2)
        text = f"Observed: {observation['state']}  confidence: {observation['confidence']:.3f}"
        cv2.rectangle(result, (0, height - 28), (min(width, 470), height), (0, 0, 0), -1)
        cv2.putText(result, text, (8, height - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.52, color, 1, cv2.LINE_AA)
        return result

    def sample(self, wait_for_lock: bool = False) -> dict:
        if not self.sample_lock.acquire(blocking=wait_for_lock):
            return self.status()
        try:
            frame = self.capture()
            observation = self.classifier.classify(frame, self.settings)
            timestamp = now_iso()
            raw_jpeg = self.encode_jpeg(frame, 92)
            annotated_jpeg = self.encode_jpeg(self.annotated(frame, observation), 90)
            atomic_write(SNAPSHOT_PATH, annotated_jpeg)
            with self.lock:
                previous = self.debouncer.reported
                self.debouncer.required = int(self.settings["requiredConsecutive"])
                self.debouncer.observe(observation["state"])
                if observation["state"] == "OPEN":
                    self.rapid_until_closed = True
                elif self.debouncer.reported == "CLOSED":
                    self.rapid_until_closed = False
                self.last_frame = timestamp
                self.last_raw = frame
                self.last_raw_jpeg = raw_jpeg
                self.last_error = None
                self.observation = observation
                current = self.debouncer.reported
            if current != previous:
                self.logger.info("State changed from %s to %s (%s)", previous, current, observation["reason"])
                if self.history.record(current, float(observation["confidence"])):
                    self.logger.info("Recorded confirmed %s transition in state history", current)
            self.push.observe_confirmed_state(current, float(observation["confidence"]), timestamp)
            self.alert_broker.observe_confirmed_state(current, float(observation["confidence"]), timestamp)
            return self.status()
        except Exception as error:
            message = str(error) or error.__class__.__name__
            with self.lock:
                previous = self.debouncer.reported
                self.debouncer.observe("UNKNOWN")
                self.last_error = message
                self.observation = {
                    "state": "UNKNOWN",
                    "confidence": 0.0,
                    "reason": message,
                    "scores": {},
                    "referenceCounts": self.reference_counts(),
                }
            if previous != "UNKNOWN":
                self.logger.info("State changed from %s to UNKNOWN (camera or analysis error)", previous)
            if self.error_throttle.should_log(message):
                self.logger.error("Sampling failed: %s", message)
            return self.status()
        finally:
            self.sample_lock.release()

    def confirmation_burst(self) -> dict:
        """Run enough independent captures to satisfy hysteresis with one setup action."""
        attempts = 0
        status = self.status()
        for _ in range(int(self.settings["requiredConsecutive"])):
            status = self.sample(wait_for_lock=True)
            attempts += 1
            if status["observedState"] == "UNKNOWN":
                break
            if status["state"] == status["observedState"] and status["candidate"] is None:
                break
        result = dict(status)
        result["confirmationSamples"] = attempts
        return result

    def status(self) -> dict:
        with self.lock:
            return {
                "state": self.debouncer.reported,
                "confidence": self.observation["confidence"],
                "lastFrame": self.last_frame,
                "since": self.debouncer.since,
                "observedState": self.observation["state"],
                "reason": self.observation["reason"],
                "candidate": self.debouncer.candidate,
                "candidateCount": self.debouncer.count,
                "requiredConsecutive": self.debouncer.required,
                "scores": self.observation.get("scores", {}),
                "referenceCounts": self.observation.get("referenceCounts", self.reference_counts()),
                "lastError": self.last_error,
                "samplingMode": "FAST" if self.is_fast_sampling() else "NORMAL",
                "sampleIntervalSeconds": self.current_interval(),
            }

    def is_fast_sampling(self) -> bool:
        return self.rapid_until_closed or self.debouncer.candidate is not None

    def current_interval(self) -> float:
        key = "fastSampleIntervalSeconds" if self.is_fast_sampling() else "sampleIntervalSeconds"
        return float(self.settings[key])

    def capture_reference(self, label: str) -> dict:
        label = label.upper()
        if label not in LABELS:
            raise ValueError("Reference label must be OPEN or CLOSED")
        with self.sample_lock:
            frame = self.capture()
            timestamp = datetime.now().astimezone().strftime("%Y%m%d-%H%M%S")
            destination = REFERENCE_DIR / label.lower() / f"{label.lower()}-{timestamp}.jpg"
            atomic_write(destination, self.encode_jpeg(frame, 94))
            self.classifier.clear_cache()
            self.logger.info("Captured %s reference %s", label, destination.name)
        self.sample()
        return {"saved": destination.name, "label": label, "referenceCounts": self.reference_counts()}

    def clear_references(self, label: str) -> dict:
        requested = label.upper()
        labels = LABELS if requested == "ALL" else (requested,)
        if any(item not in LABELS for item in labels):
            raise ValueError("Reference label must be OPEN, CLOSED, or ALL")
        removed = 0
        for item in labels:
            directory = REFERENCE_DIR / item.lower()
            for path in directory.glob("*.jpg"):
                path.unlink()
                removed += 1
        self.classifier.clear_cache()
        with self.lock:
            self.debouncer.observe("UNKNOWN")
            self.observation = {
                "state": "UNKNOWN",
                "confidence": 0.0,
                "reason": "References changed; waiting for a new sample",
                "scores": {},
                "referenceCounts": self.reference_counts(),
            }
        self.logger.info("Removed %d %s reference images", removed, requested)
        return {"removed": removed, "referenceCounts": self.reference_counts()}

    def update_rois(self, rois: list[dict]) -> dict:
        updated = dict(self.settings)
        updated["rois"] = rois
        validate_settings(updated)
        save_settings(updated)
        with self.lock:
            self.settings = updated
            self.classifier.clear_cache()
            self.debouncer = Debouncer(int(updated["requiredConsecutive"]))
            self.observation = {
                "state": "UNKNOWN",
                "confidence": 0.0,
                "reason": "Regions changed; recapture references for this camera position",
                "scores": {},
                "referenceCounts": self.reference_counts(),
            }
        self.logger.info("Updated %d detection regions", len(rois))
        return {"settings": updated, "warning": "Recapture both OPEN and CLOSED references after moving regions"}

    def worker(self) -> None:
        while not self.stop_event.is_set():
            started = time.monotonic()
            self.sample()
            delay = max(1.0, self.current_interval() - (time.monotonic() - started))
            self.stop_event.wait(delay)


class MonitorHttpServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, handler, monitor: GarageMonitor):
        super().__init__(address, handler)
        self.monitor = monitor


class RequestHandler(BaseHTTPRequestHandler):
    server: MonitorHttpServer

    def log_message(self, format_string: str, *args) -> None:
        self.server.monitor.logger.debug("HTTP %s", format_string % args)

    def _send_bytes(self, content: bytes, content_type: str, status: int = 200, cache: bool = False) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "private, max-age=10" if cache else "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(content)

    def _json(self, value, status: int = 200) -> None:
        self._send_bytes(json.dumps(value, separators=(",", ":")).encode("utf-8"), "application/json; charset=utf-8", status)

    def _body_json(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as error:
            raise ValueError("Invalid Content-Length") from error
        if length > 64 * 1024:
            raise ValueError("Request body is too large")
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        monitor = self.server.monitor
        if not self._is_loopback_client():
            if parsed.path not in ("/status", "/health"):
                self._json({"error": "This endpoint is available only from the monitor PC"}, HTTPStatus.FORBIDDEN)
                return
            if not monitor.valid_api_token(self.headers.get("Authorization")):
                self._json({"error": "Valid bearer token required"}, HTTPStatus.UNAUTHORIZED)
                return
        if parsed.path == "/status":
            self._json(monitor.status())
        elif parsed.path == "/snapshot":
            query = parse_qs(parsed.query)
            raw = query.get("raw", ["0"])[0] == "1"
            with monitor.lock:
                content = monitor.last_raw_jpeg if raw else (SNAPSHOT_PATH.read_bytes() if SNAPSHOT_PATH.exists() else None)
            if content is None:
                self._json({"error": "No frame has been captured yet"}, HTTPStatus.SERVICE_UNAVAILABLE)
            else:
                self._send_bytes(content, "image/jpeg")
        elif parsed.path in ("/", "/setup"):
            self._send_bytes(SETUP_PATH.read_bytes(), "text/html; charset=utf-8")
        elif parsed.path == "/api/settings":
            self._json({"settings": monitor.settings, "referenceCounts": monitor.reference_counts()})
        elif parsed.path == "/api/client-config":
            self._json({
                "serverUrl": self.server.monitor.env.get("MONITOR_CLIENT_URL", "http://192.168.1.119:8765"),
                "apiToken": self.server.monitor.env.get("MONITOR_API_TOKEN", ""),
            })
        elif parsed.path == "/api/history":
            query = parse_qs(parsed.query)
            try:
                limit = int(query.get("limit", ["100"])[0])
            except ValueError:
                limit = 100
            self._json({"events": monitor.history.recent(limit)})
        elif parsed.path == "/api/push/status":
            self._json(monitor.push.status())
        elif parsed.path == "/api/clips":
            self._json(monitor.recorder.status())
        elif parsed.path == "/api/clips/video":
            try:
                name = parse_qs(parsed.query).get("id", [""])[0]
                with monitor.recorder.lock:
                    source = monitor.recorder.path(name).open("rb")
                with source:
                    size = os.fstat(source.fileno()).st_size
                    start, end = 0, size - 1
                    partial = self.headers.get("Range")
                    if partial:
                        import re
                        match = re.fullmatch(r"bytes=(\d+)-(\d*)", partial)
                        if not match:
                            raise ValueError("Unsupported range")
                        start = int(match[1])
                        end = min(int(match[2]) if match[2] else end, end)
                        if start > end:
                            self._json({"error": "Range unavailable"}, 416)
                            return
                    self.send_response(206 if partial else 200)
                    self.send_header("Content-Type", "video/mp4")
                    self.send_header("Accept-Ranges", "bytes")
                    self.send_header("Content-Length", str(end - start + 1))
                    if partial:
                        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
                    self.end_headers()
                    source.seek(start)
                    remaining = end - start + 1
                    while remaining:
                        chunk = source.read(min(65536, remaining))
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        remaining -= len(chunk)
            except (ValueError, FileNotFoundError):
                self._json({"error": "Clip unavailable"}, 404)
            except (BrokenPipeError, ConnectionResetError):
                pass
        elif parsed.path == "/health":
            self._json({"ok": True})
        else:
            self._json({"error": "Not found"}, HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        monitor = self.server.monitor
        if parsed.path == "/api/push/register":
            if not monitor.valid_api_token(self.headers.get("Authorization")):
                self._json({"error": "Valid bearer token required"}, HTTPStatus.UNAUTHORIZED)
                return
            try:
                body = self._body_json()
                self._json(monitor.push.register(body.get("token", ""), body.get("device", ""), body.get("appVersion", "")))
            except (ValueError, json.JSONDecodeError) as error:
                self._json({"error": str(error)}, HTTPStatus.BAD_REQUEST)
            except Exception as error:
                monitor.logger.exception("Push registration failed")
                self._json({"error": str(error) or error.__class__.__name__}, HTTPStatus.INTERNAL_SERVER_ERROR)
            return
        if not self._is_loopback_client():
            self._json({"error": "Setup actions are available only from the monitor PC"}, HTTPStatus.FORBIDDEN)
            return
        try:
            body = self._body_json()
            if parsed.path == "/api/clips/keep":
                self._json(monitor.recorder.keep(body.get("id")))
            elif parsed.path == "/api/sample":
                self._json(monitor.sample())
            elif parsed.path == "/api/push/test":
                self._json(monitor.push.send_test())
            elif parsed.path == "/api/confirm":
                self._json(monitor.confirmation_burst())
            elif parsed.path == "/api/references/capture":
                self._json(monitor.capture_reference(str(body.get("label", ""))))
            elif parsed.path == "/api/references/clear":
                self._json(monitor.clear_references(str(body.get("label", ""))))
            elif parsed.path == "/api/rois":
                rois = body.get("rois")
                if not isinstance(rois, list):
                    raise ValueError("rois must be a list")
                self._json(monitor.update_rois(rois))
            else:
                self._json({"error": "Not found"}, HTTPStatus.NOT_FOUND)
        except (ValueError, json.JSONDecodeError) as error:
            self._json({"error": str(error)}, HTTPStatus.BAD_REQUEST)
        except Exception as error:
            monitor.logger.exception("HTTP action failed")
            self._json({"error": str(error) or error.__class__.__name__}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def _is_loopback_client(self) -> bool:
        try:
            return ipaddress.ip_address(self.client_address[0]).is_loopback
        except ValueError:
            return False


def configure_logging(verbose: bool = False) -> logging.Logger:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("garage-monitor")
    logger.setLevel(logging.DEBUG if verbose else logging.INFO)
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s", "%Y-%m-%d %H:%M:%S")
    file_handler = RotatingFileHandler(LOG_DIR / "garage-monitor.log", maxBytes=512_000, backupCount=2, encoding="utf-8")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    if sys.stderr is not None:
        console = logging.StreamHandler()
        console.setFormatter(formatter)
        logger.addHandler(console)
    return logger


def prepare_directories() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    for label in LABELS:
        (REFERENCE_DIR / label.lower()).mkdir(parents=True, exist_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Local structural garage-door monitor")
    parser.add_argument("--once", action="store_true", help="Capture and classify one frame, print JSON, then exit")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    prepare_directories()
    logger = configure_logging(args.verbose)
    env = load_env(ENV_PATH)
    monitor = GarageMonitor(env, logger)
    if args.once:
        print(json.dumps(monitor.sample(), indent=2))
        return 0 if monitor.last_frame else 1

    host = env.get("MONITOR_HOST", "127.0.0.1")
    try:
        port = int(env.get("MONITOR_PORT", "8765"))
    except ValueError:
        logger.error("MONITOR_PORT must be a number")
        return 2

    server = MonitorHttpServer((host, port), RequestHandler, monitor)
    worker = threading.Thread(target=monitor.worker, name="camera-sampler", daemon=True)
    worker.start()
    recorder_worker = threading.Thread(target=monitor.recorder.worker, name="motion-recorder", daemon=True)
    recorder_worker.start()

    def stop_server(_signum=None, _frame=None):
        monitor.stop_event.set()
        threading.Thread(target=server.shutdown, daemon=True).start()

    if threading.current_thread() is threading.main_thread():
        signal.signal(signal.SIGINT, stop_server)
        signal.signal(signal.SIGTERM, stop_server)
    logger.info("Garage monitor listening on http://%s:%d", host, port)
    try:
        server.serve_forever(poll_interval=0.5)
    finally:
        monitor.stop_event.set()
        monitor.recorder.stop()
        recorder_worker.join(timeout=15)
        server.server_close()
        worker.join(timeout=12)
        logger.info("Garage monitor stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
