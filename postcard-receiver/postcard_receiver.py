from __future__ import annotations

import csv
from concurrent.futures import ThreadPoolExecutor
from difflib import SequenceMatcher
import hashlib
import hmac
import io
import json
import mimetypes
import os
from pathlib import Path
import re
import secrets
import subprocess
import threading
import time
import traceback
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import quote, unquote, urlparse
from urllib.request import Request, urlopen

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parent
SITE_ROOT = ROOT.parent / "postcards"
DATA_DIR = ROOT / "data"
PENDING_DIR = DATA_DIR / "pending"
INBOX_DIR = DATA_DIR / "inbox"
PROCESSED_DIR = DATA_DIR / "processed"
LOG_DIR = ROOT / "logs"
LOG_PATH = LOG_DIR / "receiver.log"
TOKEN_PATH = DATA_DIR / "access-token.txt"
CATALOG_PATH = SITE_ROOT / "data" / "postcards.json"
IMAGE_DIR = SITE_ROOT / "images"
GEOCODE_CACHE_PATH = DATA_DIR / "geocode-cache.json"
TESSERACT = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
MAX_UPLOAD_BYTES = 16 * 1024 * 1024
HOST = "0.0.0.0"
PORT = 8766
PROCESSOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="postcard-processor")
_log_lock = threading.Lock()
_auth_lock = threading.Lock()
_auth_failures: dict[str, list[float]] = {}


def atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_bytes(content)
    os.replace(temporary, path)


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def log_event(message: str) -> None:
    line = f"{now_iso()} {message}\n"
    with _log_lock:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        with LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(line)


def normalized(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def clean_source_id(value: str | None) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "", value or "")[:32]
    return cleaned or "1"


def field_quality_issue(fields: dict) -> str | None:
    """Reject obvious OCR fragments before a coincidental geocode can publish them."""
    stop_name = str(fields.get("stopName", "")).strip()
    location = str(fields.get("locationText", "")).strip()
    letters = re.sub(r"[^A-Za-z]", "", stop_name)
    normalized_location = normalized(location)
    visible_characters = re.sub(r"\s", "", stop_name)
    readable_characters = re.sub(r"[^A-Za-z0-9'&.,!?() -]", "", stop_name)

    if len(letters) < 4:
        return "PokéStop name is too short to trust"
    if visible_characters and len(readable_characters) / len(visible_characters) < 0.75:
        return "PokéStop name contains too many unreadable characters"
    if not normalized_location and len(letters) < 6:
        return "Short PokéStop name has no readable location"
    return None


def load_token() -> str:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    pin = TOKEN_PATH.read_text(encoding="ascii").strip() if TOKEN_PATH.exists() else ""
    if not re.fullmatch(r"\d{4}", pin):
        pin = f"{secrets.randbelow(10_000):04d}"
        atomic_write(TOKEN_PATH, (pin + "\n").encode("ascii"))
    return pin


def auth_is_rate_limited(address: str) -> bool:
    cutoff = time.monotonic() - 300
    with _auth_lock:
        recent = [attempt for attempt in _auth_failures.get(address, []) if attempt >= cutoff]
        _auth_failures[address] = recent
        return len(recent) >= 8


def record_auth_failure(address: str) -> None:
    with _auth_lock:
        _auth_failures.setdefault(address, []).append(time.monotonic())


def clear_auth_failures(address: str) -> None:
    with _auth_lock:
        _auth_failures.pop(address, None)


def load_json(path: Path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def run_ocr(jpeg: bytes) -> list[dict]:
    if not TESSERACT.exists():
        raise RuntimeError(f"Tesseract was not found at {TESSERACT}")
    result = subprocess.run(
        [str(TESSERACT), "stdin", "stdout", "-l", "eng", "--psm", "11", "tsv"],
        input=jpeg,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=40,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.decode("utf-8", errors="replace").strip() or "Tesseract failed")
    rows: list[dict] = []
    reader = csv.DictReader(io.StringIO(result.stdout.decode("utf-8", errors="replace")), delimiter="\t")
    for row in reader:
        text = (row.get("text") or "").strip()
        try:
            confidence = float(row.get("conf") or -1)
        except ValueError:
            confidence = -1
        if not text or confidence < 18:
            continue
        try:
            rows.append({
                "text": text,
                "confidence": confidence,
                "left": int(row["left"]),
                "top": int(row["top"]),
                "width": int(row["width"]),
                "height": int(row["height"]),
                "line": (int(row["block_num"]), int(row["par_num"]), int(row["line_num"])),
            })
        except (KeyError, TypeError, ValueError):
            continue
    return rows


def detect_text_panel(image: np.ndarray, words: list[dict] | None = None) -> tuple[int, int, int, int] | None:
    height, width = image.shape[:2]
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    # Keep true white card stock separate from the bright cyan/orange game backgrounds.
    mask = cv2.inRange(hsv, np.array([0, 0, 165]), np.array([179, 50, 255]))
    mask[: int(height * 0.23), :] = 0
    mask[int(height * 0.84) :, :] = 0
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(5, width // 80), max(5, width // 80)))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates: list[tuple[float, tuple[int, int, int, int]]] = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if x < width * 0.03 or y < height * 0.20:
            continue
        if w < width * 0.16 or h < height * 0.08 or h > height * 0.42:
            continue
        fill = cv2.contourArea(contour) / max(1, w * h)
        score = (w * h) * max(0.2, fill) * (1.25 if x + w > width * 0.70 else 1.0)
        # Wide contours are the complete postcard; its text occupies the right half.
        panel = (x + int(w * 0.48), y, int(w * 0.52), h) if w >= width * 0.52 else (x, y, w, h)
        candidates.append((score, panel))
    if not candidates:
        return None
    greeting_words = [word for word in (words or []) if "greeting" in normalized(word["text"])]
    if greeting_words:
        greeting = max(greeting_words, key=lambda word: word["confidence"])
        gx = greeting["left"] + greeting["width"] / 2
        gy = greeting["top"] + greeting["height"] / 2
        anchored = [item for item in candidates if item[1][0] <= gx <= item[1][0] + item[1][2] and item[1][1] <= gy <= item[1][1] + item[1][3]]
        if anchored:
            return max(anchored, key=lambda item: item[0])[1]
    return max(candidates, key=lambda item: item[0])[1]


def run_ocr_region(image: np.ndarray, region: tuple[int, int, int, int]) -> list[dict]:
    image_height, image_width = image.shape[:2]
    x, y, w, h = region
    margin_x = int(w * 0.12)
    margin_y = int(h * 0.05)
    left = max(0, x - margin_x)
    top = max(0, y - margin_y)
    right = min(image_width, x + w + margin_x)
    bottom = min(image_height, y + h + margin_y)
    crop = image[top:bottom, left:right]
    if crop.size == 0:
        return []
    scale = 2.5

    def recognize(source: np.ndarray) -> list[dict]:
        enlarged = cv2.resize(source, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        ok, encoded = cv2.imencode(".png", enlarged)
        if not ok:
            return []
        result = run_ocr(encoded.tobytes())
        for word in result:
            word["left"] = left + int(word["left"] / scale)
            word["top"] = top + int(word["top"] / scale)
            word["width"] = max(1, int(word["width"] / scale))
            word["height"] = max(1, int(word["height"] / scale))
        return result

    colour_words = recognize(crop)
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    high_contrast = cv2.threshold(gray, 210, 255, cv2.THRESH_BINARY)[1]
    contrast_words = recognize(high_contrast)

    def score(candidate: list[dict]) -> int:
        greeting_bonus = 20 if any("greeting" in normalized(word["text"]) for word in candidate) else 0
        return greeting_bonus + len(candidate)

    return max((colour_words, contrast_words), key=score)


def deskew_postcard(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, np.array([0, 0, 165]), np.array([179, 50, 255]))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        center_y = y + h / 2
        if w >= width * 0.52 and height * 0.28 <= center_y <= height * 0.68:
            candidates.append(contour)
    if not candidates:
        return image
    contour = max(candidates, key=cv2.contourArea)
    center, size, angle = cv2.minAreaRect(contour)
    if size[0] < size[1]:
        angle += 90
    if abs(angle) < 0.5 or abs(angle) > 12:
        return image
    transform = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(image, transform, (width, height), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def group_lines(words: list[dict]) -> list[dict]:
    grouped: dict[tuple[int, int, int], list[dict]] = {}
    for word in words:
        grouped.setdefault(word["line"], []).append(word)
    lines = []
    for line_words in grouped.values():
        line_words.sort(key=lambda word: word["left"])
        left = min(word["left"] for word in line_words)
        top = min(word["top"] for word in line_words)
        right = max(word["left"] + word["width"] for word in line_words)
        bottom = max(word["top"] + word["height"] for word in line_words)
        lines.append({
            "text": " ".join(word["text"] for word in line_words),
            "left": left,
            "top": top,
            "right": right,
            "bottom": bottom,
            "words": line_words,
        })
    return sorted(lines, key=lambda line: (line["top"], line["left"]))


def teal_score(image: np.ndarray, line: dict) -> float:
    height, width = image.shape[:2]
    x1 = max(0, line["left"] - 3)
    y1 = max(0, line["top"] - 3)
    x2 = min(width, line["right"] + 3)
    y2 = min(height, line["bottom"] + 3)
    region = image[y1:y2, x1:x2]
    if region.size == 0:
        return 0.0
    hsv = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
    saturated = hsv[:, :, 1] > 65
    teal = saturated & (hsv[:, :, 0] >= 70) & (hsv[:, :, 0] <= 105)
    return float(teal.sum()) / max(1, int(saturated.sum()))


def extract_fields(image: np.ndarray, words: list[dict], panel: tuple[int, int, int, int]) -> dict:
    x, y, w, h = panel
    lines = [
        line for line in group_lines(words)
        if line["right"] >= x - w * 0.08
        and line["left"] <= x + w * 1.15
        and y - h * 0.10 <= (line["top"] + line["bottom"]) / 2 <= y + h * 1.08
    ]
    greeting_index = next(
        (index for index, line in enumerate(lines) if "greeting" in normalized(line["text"])),
        -1,
    )
    has_greeting = greeting_index >= 0
    after_greeting = lines[greeting_index + 1 :] if greeting_index >= 0 else lines
    ignored = {"open", "pin", "snap", "greetings", "from"}
    usable = [line for line in after_greeting if normalized(line["text"]) not in ignored]

    title_lines = []
    location_lines = []
    username = ""
    for line in usable:
        center_y = (line["top"] + line["bottom"]) / 2
        text = line["text"].strip(" -|_")
        if not text:
            continue
        if has_greeting and center_y > y + h * 0.66 and re.fullmatch(r"[A-Za-z0-9_.-]{3,24}", text.replace(" ", "")):
            username = text.replace(" ", "")
            continue
        if center_y > y + h * 0.78:
            continue
        if teal_score(image, line) >= 0.35:
            title_lines.append(text)
        elif title_lines and len(normalized(text)) > 2:
            location_lines.append(text.strip(" ,"))

    if not title_lines and usable:
        title_lines.append(usable[0]["text"])
        location_lines = [line["text"] for line in usable[1:3]]

    return {
        "stopName": " ".join(title_lines).strip(),
        "locationText": ", ".join(part for part in location_lines if part).strip(" ,"),
        "friendUsername": username,
        "ocrLines": [line["text"] for line in lines],
    }


def crop_postcard_photo(image: np.ndarray, panel: tuple[int, int, int, int]) -> np.ndarray:
    height, width = image.shape[:2]
    x, y, w, h = panel
    # The photo sits immediately left of the text panel. Stay inside that edge
    # so the published image never includes a sliver of PokéStop text.
    right = min(width, x - int(w * 0.06))
    left = max(0, x - int(w * 0.92))
    top = max(0, y - int(h * 0.03))
    bottom = min(height, y + h + int(h * 0.03))
    crop = image[top:bottom, left:right]
    if crop.size == 0:
        raise RuntimeError("Could not crop the postcard photo")
    return crop


def image_hash(image: np.ndarray) -> str:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, (9, 8), interpolation=cv2.INTER_AREA)
    bits = resized[:, 1:] > resized[:, :-1]
    value = 0
    for bit in bits.flatten():
        value = (value << 1) | int(bit)
    return f"{value:016x}"


def hamming_hash(left: str, right: str) -> int:
    return (int(left, 16) ^ int(right, 16)).bit_count()


def coordinates_close(record: dict, coordinates: dict, tolerance: float = 0.002) -> bool:
    try:
        return abs(float(record["lat"]) - float(coordinates["lat"])) <= tolerance and abs(float(record["lon"]) - float(coordinates["lon"])) <= tolerance
    except (KeyError, TypeError, ValueError):
        return False


def titles_match(left: str, right: str) -> bool:
    first = normalized(left)
    second = normalized(right)
    return bool(first and second) and (first == second or SequenceMatcher(None, first, second).ratio() >= 0.88)


_geocode_lock = threading.RLock()
_last_geocode_at = 0.0


def geocode(stop_name: str, location_text: str) -> dict | None:
    global _last_geocode_at
    query = ", ".join(part for part in (stop_name, location_text) if part).strip()
    if not query:
        return None
    cache = load_json(GEOCODE_CACHE_PATH, {})
    key = normalized(query)
    if key in cache:
        return cache[key]
    with _geocode_lock:
        delay = 1.05 - (time.monotonic() - _last_geocode_at)
        if delay > 0:
            time.sleep(delay)
        request = Request(
            "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=" + quote(query),
            headers={"User-Agent": "DRE-Postcard-Map/1.0 (private personal map)"},
        )
        try:
            with urlopen(request, timeout=15) as response:
                results = json.loads(response.read().decode("utf-8"))
        finally:
            _last_geocode_at = time.monotonic()
        if not results and location_text and normalized(location_text) != key:
            return geocode("", location_text)
        if not results:
            return None
        address = results[0].get("address", {})
        result = {
            "lat": float(results[0]["lat"]),
            "lon": float(results[0]["lon"]),
            "displayName": results[0].get("display_name", query),
            "country": address.get("country", ""),
            "countryCode": address.get("country_code", "").upper(),
            "state": address.get("state", ""),
        }
        cache[key] = result
        atomic_write(GEOCODE_CACHE_PATH, (json.dumps(cache, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
        return result


def save_pending(jpeg: bytes, details: dict, reason: str) -> str:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    PENDING_DIR.mkdir(parents=True, exist_ok=True)
    image_name = f"pending-{stamp}.jpg"
    atomic_write(PENDING_DIR / image_name, jpeg)
    details = {**details, "reason": reason, "capturedAt": now_iso(), "screenshot": image_name}
    atomic_write(PENDING_DIR / f"pending-{stamp}.json", (json.dumps(details, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
    return image_name


def process_postcard(jpeg: bytes, source_id: str = "1") -> tuple[bool, str]:
    source_id = clean_source_id(source_id)
    image = cv2.imdecode(np.frombuffer(jpeg, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("The uploaded image is not a valid JPEG")
    image = deskew_postcard(image)
    ok, ocr_source = cv2.imencode(".png", image)
    words = run_ocr(ocr_source.tobytes() if ok else jpeg)
    panel = detect_text_panel(image, words)
    if panel is None:
        pending = save_pending(jpeg, {"sourceId": source_id, "ocrLines": [line["text"] for line in group_lines(words)]}, "Postcard text panel not found")
        return False, f"Needs review ({pending})"
    focused_words = run_ocr_region(image, panel)
    fields = extract_fields(image, focused_words or words, panel)
    fields["sourceId"] = source_id
    quality_issue = field_quality_issue(fields)
    if quality_issue:
        pending = save_pending(jpeg, fields, quality_issue)
        return False, f"Needs review ({pending})"
    try:
        coordinates = geocode(fields["stopName"], fields["locationText"])
    except Exception as error:
        pending = save_pending(jpeg, fields, f"Geocoding failed: {error}")
        return False, f"Needs review ({pending})"
    if coordinates is None:
        pending = save_pending(jpeg, fields, "Location could not be geocoded")
        return False, f"Needs review ({pending})"

    photo = crop_postcard_photo(image, panel)
    photo_hash = image_hash(photo)
    catalog = load_json(CATALOG_PATH, {"updatedAt": None, "postcards": []})
    records = catalog.get("postcards", [])
    dedupe_key = hashlib.sha256(
        f"{normalized(fields['stopName'])}|{normalized(fields['locationText'])}".encode("utf-8")
    ).hexdigest()[:20]
    for record in records:
        if record.get("dedupeKey") == dedupe_key:
            return True, f"Duplicate discarded: {fields['stopName']}"
        if titles_match(record.get("stopName", ""), fields["stopName"]) and coordinates_close(record, coordinates):
            return True, f"Duplicate name/location discarded: {fields['stopName']}"
        existing_hash = record.get("imageHash")
        if existing_hash and hamming_hash(existing_hash, photo_hash) <= 5:
            return True, f"Duplicate image discarded: {fields['stopName']}"

    identifier = f"{datetime.now().strftime('%Y%m%d%H%M%S')}-{dedupe_key[:8]}"
    image_name = f"{identifier}.webp"
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    ok, encoded = cv2.imencode(".webp", photo, [cv2.IMWRITE_WEBP_QUALITY, 88])
    if not ok:
        raise RuntimeError("Could not encode postcard photo")
    atomic_write(IMAGE_DIR / image_name, encoded.tobytes())
    record = {
        "id": identifier,
        "stopName": fields["stopName"],
        "locationText": fields["locationText"],
        "friendUsername": fields["friendUsername"],
        "lat": coordinates["lat"],
        "lon": coordinates["lon"],
        "geocodedName": coordinates["displayName"],
        "country": coordinates.get("country", ""),
        "countryCode": coordinates.get("countryCode", ""),
        "state": coordinates.get("state", ""),
        "image": f"images/{image_name}",
        "capturedAt": now_iso(),
        "dedupeKey": dedupe_key,
        "imageHash": photo_hash,
        "sourceId": source_id,
    }
    records.append(record)
    catalog = {"updatedAt": now_iso(), "postcards": records}
    atomic_write(CATALOG_PATH, (json.dumps(catalog, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
    return True, f"Saved {fields['stopName']}"


def process_inbox(path: Path) -> None:
    success = False
    metadata_path = path.with_suffix(".json")
    try:
        jpeg = path.read_bytes()
        metadata = load_json(metadata_path, {})
        success, message = process_postcard(jpeg, metadata.get("sourceId", "1"))
        log_event(f"processed {path.name} success={success} message={message}")
    except Exception as error:
        try:
            pending = save_pending(path.read_bytes(), {}, f"Unhandled processing error: {error}")
            log_event(f"processing-error {path.name} retained={pending} error={error}\n{traceback.format_exc()}")
        except Exception:
            log_event(f"processing-error {path.name} inbox-retained error={error}\n{traceback.format_exc()}")
            return
    if success:
        PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        archived = PROCESSED_DIR / path.name
        if archived.exists():
            archived = PROCESSED_DIR / f"{path.stem}-{time.time_ns()}{path.suffix}"
        os.replace(path, archived)
        if metadata_path.exists():
            os.replace(metadata_path, archived.with_suffix(".json"))
    else:
        # Failed captures have already been copied to the review queue.
        path.unlink(missing_ok=True)
        metadata_path.unlink(missing_ok=True)


class Handler(BaseHTTPRequestHandler):
    server_version = "DREPostcardReceiver/1.0"

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/health":
            self.send_text(HTTPStatus.OK, "ok")
            return
        if path == "/setup" and self.client_address[0] in {"127.0.0.1", "::1"}:
            self.send_text(HTTPStatus.OK, f"Android receiver URL: http://192.168.1.119:{PORT}/upload\nReceiver PIN: {self.server.access_token}\n")
            return
        if path == "/postcards":
            self.send_response(HTTPStatus.MOVED_PERMANENTLY)
            self.send_header("Location", "/postcards/")
            self.end_headers()
            return
        if path.startswith("/postcards/"):
            relative = unquote(path.removeprefix("/postcards/") or "index.html")
            requested = (SITE_ROOT / relative).resolve()
            try:
                requested.relative_to(SITE_ROOT.resolve())
            except ValueError:
                self.send_text(HTTPStatus.FORBIDDEN, "forbidden")
                return
            if requested.is_file():
                self.send_file(requested)
                return
        self.send_text(HTTPStatus.NOT_FOUND, "not found")

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/upload":
            self.send_text(HTTPStatus.NOT_FOUND, "not found")
            return
        address = self.client_address[0]
        supplied = self.headers.get("Authorization", "").removeprefix("Bearer ").strip()
        if auth_is_rate_limited(address):
            log_event(f"rejected ip={address} reason=rate-limited")
            self.send_text(HTTPStatus.TOO_MANY_REQUESTS, "too many incorrect PIN attempts; wait five minutes")
            return
        if not supplied or not hmac.compare_digest(supplied, self.server.access_token):
            record_auth_failure(address)
            log_event(f"rejected ip={address} reason=invalid-token")
            self.send_text(HTTPStatus.UNAUTHORIZED, "invalid receiver PIN")
            return
        clear_auth_failures(address)
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_UPLOAD_BYTES:
            log_event(f"rejected ip={self.client_address[0]} reason=invalid-size size={length}")
            self.send_text(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "invalid image size")
            return
        try:
            jpeg = self.rfile.read(length)
            identifier = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
            inbox_path = INBOX_DIR / f"capture-{identifier}.jpg"
            source_id = clean_source_id(self.headers.get("X-Postcard-Source"))
            atomic_write(inbox_path, jpeg)
            atomic_write(inbox_path.with_suffix(".json"), (json.dumps({"sourceId": source_id}) + "\n").encode("utf-8"))
            log_event(f"accepted ip={self.client_address[0]} source={source_id} file={inbox_path.name} bytes={len(jpeg)}")
            PROCESSOR.submit(process_inbox, inbox_path)
            self.send_text(HTTPStatus.ACCEPTED, "Captured; desktop processing queued")
        except Exception as error:
            log_event(f"upload-error ip={self.client_address[0]} error={error}\n{traceback.format_exc()}")
            self.send_text(HTTPStatus.INTERNAL_SERVER_ERROR, str(error))

    def send_file(self, path: Path) -> None:
        body = path.read_bytes()
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store" if path.suffix in {".html", ".css", ".js", ".json"} else "public, max-age=300")
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, status: HTTPStatus, text: str) -> None:
        body = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args) -> None:
        print(f"{self.address_string()} - {format % args}")


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, handler, access_token: str):
        super().__init__(address, handler)
        self.access_token = access_token


def main() -> None:
    token = load_token()
    CATALOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    INBOX_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    if not CATALOG_PATH.exists():
        atomic_write(CATALOG_PATH, b'{"updatedAt": null, "postcards": []}\n')
    for inbox_path in sorted(INBOX_DIR.glob("*.jpg")):
        PROCESSOR.submit(process_inbox, inbox_path)
    print(f"Postcard receiver listening on http://127.0.0.1:{PORT}")
    print(f"Open http://127.0.0.1:{PORT}/setup for Android settings")
    print(f"Open http://127.0.0.1:{PORT}/postcards/ for the local map")
    log_event("receiver-started")
    Server((HOST, PORT), Handler, token).serve_forever()


if __name__ == "__main__":
    main()
