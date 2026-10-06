from __future__ import annotations

import csv
from concurrent.futures import ThreadPoolExecutor
from difflib import SequenceMatcher
import hashlib
import hmac
from html import escape
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
from urllib.parse import parse_qs, quote, unquote, urlparse
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
REVIEW_PATH = DATA_DIR / "review-records.json"
DISCARDED_DIR = DATA_DIR / "discarded"
TESSERACT = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
MAX_UPLOAD_BYTES = 16 * 1024 * 1024
HOST = "0.0.0.0"
PORT = 8766
PROCESSOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="postcard-processor")
_log_lock = threading.Lock()
_auth_lock = threading.Lock()
_catalog_lock = threading.RLock()
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


def compact_text(value: str) -> str:
    return "".join(character.lower() for character in value if character.isalnum())


def clean_friend_username(fields: dict, coordinates: dict) -> str:
    username = str(fields.get("friendUsername", "")).strip()
    if not username:
        return ""
    candidate = compact_text(username)
    location_parts = re.split(r"[,/]", str(fields.get("locationText", "")))
    forbidden = {
        compact_text(value)
        for value in [*location_parts, coordinates.get("country", ""), coordinates.get("state", "")]
        if len(compact_text(value)) >= 3
    }
    forbidden.update({"unitedstates", "states", "australia", "canada"})
    return "" if candidate in forbidden else username


def title_looks_like_location(fields: dict, coordinates: dict) -> bool:
    title_tokens = [token for token in normalized(str(fields.get("stopName", ""))).split() if len(token) > 1]
    if not title_tokens:
        return False
    context = " ".join([
        str(fields.get("locationText", "")),
        str(coordinates.get("displayName", "")),
        str(coordinates.get("country", "")),
        str(coordinates.get("state", "")),
    ])
    context_tokens = set(normalized(context).split())
    overlap = sum(token in context_tokens for token in title_tokens) / len(title_tokens)
    return overlap >= 0.75


def field_quality_issue(fields: dict) -> str | None:
    """Reject obvious OCR fragments before a coincidental geocode can publish them."""
    stop_name = str(fields.get("stopName", "")).strip()
    location = str(fields.get("locationText", "")).strip()
    letters = "".join(character for character in stop_name if character.isalpha())
    normalized_location = normalized(location)
    visible_characters = [character for character in stop_name if not character.isspace()]
    readable_characters = [character for character in visible_characters if character.isalnum() or character in "'&.,!?()-/#"]
    tokens = re.findall(r"[^\W_]+(?:['’][^\W_]+)*|\d+", stop_name, flags=re.UNICODE)

    if len(letters) < 4:
        return "PokéStop name is too short to trust"
    if visible_characters and len(readable_characters) / len(visible_characters) < 0.70:
        return "PokéStop name contains too many unreadable characters"
    if len(tokens) >= 3 and sum(len(token) <= 2 for token in tokens) / len(tokens) >= 0.60:
        return "PokéStop name looks like fragmented OCR"
    if float(fields.get("titleConfidence", 100.0)) < 30.0:
        return "PokéStop name OCR confidence is too low"
    if not normalized_location and len(letters) < 6:
        return "Short PokéStop name has no readable location"
    return None


COUNTRY_OCR_LANGUAGES = {
    "CN": "eng+chi_sim",
    "GR": "eng+ell",
    "HK": "eng+chi_tra",
    "JP": "eng+jpn",
    "KR": "eng+kor",
    "RS": "eng+srp+srp_latn",
    "TH": "eng+tha",
    "TW": "eng+chi_tra",
    "VN": "eng+vie",
}


def has_non_latin_letters(value: str) -> bool:
    return any(character.isalpha() and not ("A" <= character.upper() <= "Z") for character in value)


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


def run_ocr(jpeg: bytes, languages: str = "eng") -> list[dict]:
    if not TESSERACT.exists():
        raise RuntimeError(f"Tesseract was not found at {TESSERACT}")
    result = subprocess.run(
        [str(TESSERACT), "stdin", "stdout", "-l", languages, "--psm", "11", "tsv"],
        input=jpeg,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
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


def run_ocr_region(image: np.ndarray, region: tuple[int, int, int, int], languages: str = "eng") -> list[dict]:
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
        result = run_ocr(encoded.tobytes(), languages)
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
    title_confidences = []
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
            title_confidences.extend(word["confidence"] for word in line["words"])
        elif title_lines and len(normalized(text)) > 2:
            location_lines.append(text.strip(" ,"))

    if not title_lines and usable:
        title_lines.append(usable[0]["text"])
        title_confidences.extend(word["confidence"] for word in usable[0]["words"])
        location_lines = [line["text"] for line in usable[1:3]]

    if username:
        location_lines = [part for part in location_lines if compact_text(part) != compact_text(username)]

    return {
        "stopName": " ".join(title_lines).strip(),
        "locationText": ", ".join(part for part in location_lines if part).strip(" ,"),
        "friendUsername": username,
        "ocrLines": [line["text"] for line in lines],
        "titleConfidence": round(sum(title_confidences) / len(title_confidences), 1) if title_confidences else 0.0,
        "hasGreeting": has_greeting,
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


def store_postcard(photo: np.ndarray, fields: dict, coordinates: dict, source_id: str, manually_reviewed: bool = False) -> tuple[bool, str]:
    photo_hash = image_hash(photo)
    dedupe_key = hashlib.sha256(
        f"{normalized(fields['stopName'])}|{normalized(fields['locationText'])}".encode("utf-8")
    ).hexdigest()[:20]
    with _catalog_lock:
        catalog = load_json(CATALOG_PATH, {"updatedAt": None, "postcards": []})
        records = catalog.get("postcards", [])
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
            "friendUsername": fields.get("friendUsername", ""),
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
            "sourceId": clean_source_id(source_id),
            "ocrConfidence": fields.get("titleConfidence"),
            "ocrHasGreeting": fields.get("hasGreeting", False),
        }
        if manually_reviewed:
            record["manuallyReviewed"] = True
        records.append(record)
        atomic_write(CATALOG_PATH, (json.dumps({"updatedAt": now_iso(), "postcards": records}, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
    return True, f"Saved {fields['stopName']}"


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
    try:
        coordinates = geocode(fields["stopName"], fields["locationText"])
    except Exception as error:
        pending = save_pending(jpeg, fields, f"Geocoding failed: {error}")
        return False, f"Needs review ({pending})"
    if coordinates is None:
        pending = save_pending(jpeg, fields, "Location could not be geocoded")
        return False, f"Needs review ({pending})"

    regional_languages = COUNTRY_OCR_LANGUAGES.get(coordinates.get("countryCode", ""))
    if regional_languages and not has_non_latin_letters(fields["stopName"]):
        regional_words = run_ocr_region(image, panel, regional_languages)
        regional_fields = extract_fields(image, regional_words, panel) if regional_words else None
        if regional_fields and regional_fields["stopName"] and (
            has_non_latin_letters(regional_fields["stopName"])
            or regional_fields["titleConfidence"] > fields["titleConfidence"] + 8
        ):
            regional_fields["sourceId"] = source_id
            if not regional_fields["friendUsername"]:
                regional_fields["friendUsername"] = fields["friendUsername"]
            fields = regional_fields

    quality_issue = field_quality_issue(fields)
    if quality_issue:
        pending = save_pending(jpeg, fields, quality_issue)
        return False, f"Needs review ({pending})"
    if title_looks_like_location(fields, coordinates):
        pending = save_pending(jpeg, fields, "PokéStop title appears to contain only location text")
        return False, f"Needs review ({pending})"
    fields["friendUsername"] = clean_friend_username(fields, coordinates)

    return store_postcard(crop_postcard_photo(image, panel), fields, coordinates, source_id)


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


def pending_paths(item: str) -> tuple[Path, Path]:
    safe_name = Path(item).name
    if safe_name != item or not safe_name.endswith(".jpg"):
        raise ValueError("Invalid pending item")
    image_path = PENDING_DIR / safe_name
    metadata_path = image_path.with_suffix(".json")
    if not image_path.is_file() or not metadata_path.is_file():
        raise FileNotFoundError("Pending capture no longer exists")
    return image_path, metadata_path


def archive_files(paths: list[Path], category: str) -> None:
    destination = DISCARDED_DIR / category
    destination.mkdir(parents=True, exist_ok=True)
    for path in paths:
        if path.exists():
            target = destination / path.name
            if target.exists():
                target = destination / f"{path.stem}-{time.time_ns()}{path.suffix}"
            os.replace(path, target)


def finish_pending(image_path: Path, metadata_path: Path) -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    for path in (image_path, metadata_path):
        if path.exists():
            target = PROCESSED_DIR / path.name
            if target.exists():
                target = PROCESSED_DIR / f"{path.stem}-{time.time_ns()}{path.suffix}"
            os.replace(path, target)


def approve_pending(item: str, stop_name: str, location_text: str, friend_username: str) -> str:
    image_path, metadata_path = pending_paths(item)
    stop_name = stop_name.strip()
    location_text = location_text.strip()
    if not stop_name:
        raise ValueError("Enter the Pokestop name before approving")
    coordinates = geocode(stop_name, location_text)
    if coordinates is None:
        raise ValueError("That name/location could not be geocoded; add a city, state or country")
    jpeg = image_path.read_bytes()
    image = cv2.imdecode(np.frombuffer(jpeg, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("The pending screenshot is unreadable")
    image = deskew_postcard(image)
    ok, ocr_source = cv2.imencode(".png", image)
    words = run_ocr(ocr_source.tobytes() if ok else jpeg)
    panel = detect_text_panel(image, words)
    if panel is None:
        raise ValueError("The postcard panel cannot be located automatically; keep this item for a future crop fix")
    metadata = load_json(metadata_path, {})
    fields = {
        "stopName": stop_name,
        "locationText": location_text,
        "friendUsername": friend_username.strip(),
        "titleConfidence": metadata.get("titleConfidence"),
        "hasGreeting": metadata.get("hasGreeting", False),
    }
    success, message = store_postcard(
        crop_postcard_photo(image, panel), fields, coordinates, metadata.get("sourceId", "1"), manually_reviewed=True
    )
    if success:
        finish_pending(image_path, metadata_path)
    return message


def retry_pending(item: str) -> str:
    image_path, metadata_path = pending_paths(item)
    metadata = load_json(metadata_path, {})
    before = {path.name for path in PENDING_DIR.iterdir()}
    success, message = process_postcard(image_path.read_bytes(), metadata.get("sourceId", "1"))
    if success:
        finish_pending(image_path, metadata_path)
    else:
        # Keep the original review item and remove the duplicate generated by this retry.
        for path in PENDING_DIR.iterdir():
            if path.name not in before:
                path.unlink(missing_ok=True)
    return message


def review_records() -> list[dict]:
    value = load_json(REVIEW_PATH, {"records": []})
    return value.get("records", []) if isinstance(value, dict) else []


def restore_review_record(identifier: str, stop_name: str, location_text: str, friend_username: str) -> str:
    stop_name = stop_name.strip()
    location_text = location_text.strip()
    if not stop_name:
        raise ValueError("Enter the Pokestop name before restoring")
    coordinates = geocode(stop_name, location_text)
    if coordinates is None:
        raise ValueError("That name/location could not be geocoded; add a city, state or country")
    with _catalog_lock:
        review = load_json(REVIEW_PATH, {"updatedAt": None, "records": []})
        records = review.get("records", [])
        record = next((entry for entry in records if entry.get("id") == identifier), None)
        if record is None:
            raise FileNotFoundError("Review record no longer exists")
        catalog = load_json(CATALOG_PATH, {"updatedAt": None, "postcards": []})
        active = catalog.get("postcards", [])
        dedupe_key = hashlib.sha256(f"{normalized(stop_name)}|{normalized(location_text)}".encode("utf-8")).hexdigest()[:20]
        if not any(entry.get("dedupeKey") == dedupe_key for entry in active):
            record.update({
                "stopName": stop_name,
                "locationText": location_text,
                "friendUsername": friend_username.strip(),
                "lat": coordinates["lat"],
                "lon": coordinates["lon"],
                "geocodedName": coordinates["displayName"],
                "country": coordinates.get("country", ""),
                "countryCode": coordinates.get("countryCode", ""),
                "state": coordinates.get("state", ""),
                "dedupeKey": dedupe_key,
                "manuallyReviewed": True,
            })
            record.pop("reviewReason", None)
            active.append(record)
            atomic_write(CATALOG_PATH, (json.dumps({"updatedAt": now_iso(), "postcards": active}, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
            message = f"Restored {stop_name}"
        else:
            message = f"Duplicate archived: {stop_name}"
        review["records"] = [entry for entry in records if entry.get("id") != identifier]
        review["updatedAt"] = now_iso()
        atomic_write(REVIEW_PATH, (json.dumps(review, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
    return message


def archive_review_record(identifier: str) -> str:
    with _catalog_lock:
        review = load_json(REVIEW_PATH, {"updatedAt": None, "records": []})
        records = review.get("records", [])
        selected = [entry for entry in records if entry.get("id") == identifier]
        if not selected:
            raise FileNotFoundError("Review record no longer exists")
        discarded_path = DISCARDED_DIR / "review-records.json"
        discarded = load_json(discarded_path, {"updatedAt": None, "records": []})
        discarded["records"] = discarded.get("records", []) + selected
        discarded["updatedAt"] = now_iso()
        atomic_write(discarded_path, (json.dumps(discarded, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
        review["records"] = [entry for entry in records if entry.get("id") != identifier]
        review["updatedAt"] = now_iso()
        atomic_write(REVIEW_PATH, (json.dumps(review, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
    return "Archived quarantined record"


def review_page(message: str = "") -> str:
    pending = []
    for metadata_path in sorted(PENDING_DIR.glob("*.json")):
        metadata = load_json(metadata_path, {})
        screenshot = metadata.get("screenshot") or metadata_path.with_suffix(".jpg").name
        if (PENDING_DIR / Path(screenshot).name).is_file():
            pending.append((Path(screenshot).name, metadata))
    quarantined = review_records()

    def field(name: str, value: object, label: str) -> str:
        return f'<label>{escape(label)}<input name="{name}" value="{escape(str(value or ""), quote=True)}"></label>'

    cards = []
    for screenshot, metadata in pending:
        cards.append(f'''<form class="card" method="post" action="/review/action">
          <img src="/review/image?kind=pending&amp;name={quote(screenshot)}" alt="Pending postcard screenshot">
          <div class="body"><span class="badge">Pending screenshot</span><p class="reason">{escape(str(metadata.get("reason", "Needs review")))}</p>
          {field("stopName", metadata.get("stopName"), "Pokestop name")}{field("locationText", metadata.get("locationText"), "Location")}{field("friendUsername", metadata.get("friendUsername"), "Friend username")}
          <input type="hidden" name="kind" value="pending"><input type="hidden" name="item" value="{escape(screenshot, quote=True)}">
          <div class="actions"><button name="action" value="approve">Approve edits</button><button class="secondary" name="action" value="retry">Retry OCR</button><button class="danger" name="action" value="archive">Archive</button></div></div></form>''')
    for record in quarantined:
        cards.append(f'''<form class="card" method="post" action="/review/action">
          <img src="/review/image?kind=quarantine&amp;id={quote(str(record.get("id", "")))}" alt="Quarantined postcard crop">
          <div class="body"><span class="badge quarantine">Quarantined crop</span><p class="reason">{escape(str(record.get("reviewReason", "Unreliable OCR")))}</p>
          {field("stopName", record.get("stopName"), "Pokestop name")}{field("locationText", record.get("locationText"), "Location")}{field("friendUsername", record.get("friendUsername"), "Friend username")}
          <input type="hidden" name="kind" value="quarantine"><input type="hidden" name="item" value="{escape(str(record.get("id", "")), quote=True)}">
          <div class="actions"><button name="action" value="restore">Restore edits</button><button class="danger" name="action" value="archive">Archive</button></div></div></form>''')
    notice = f'<div class="notice">{escape(message)}</div>' if message else ""
    content = "".join(cards) or '<div class="empty">Nothing currently needs manual review.</div>'
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Postcard review</title><style>
      :root{{--ink:#173335;--paper:#f7f3e7;--teal:#087f78;--red:#b94432;--line:#d5d0c3}}*{{box-sizing:border-box}}body{{margin:0;background:#d7e8e5;color:var(--ink);font:15px/1.4 "Segoe UI",sans-serif}}header{{position:sticky;top:0;z-index:2;padding:18px 24px;background:rgba(247,243,231,.96);border-bottom:1px solid var(--line)}}h1{{margin:0;font:700 28px Georgia,serif}}header p{{margin:4px 0 0;color:#536769}}main{{padding:20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:18px}}.card{{overflow:hidden;background:var(--paper);border:1px solid var(--line);border-radius:18px;box-shadow:0 12px 28px rgba(23,51,53,.1)}}.card>img{{display:block;width:100%;height:280px;object-fit:contain;background:#152327}}.body{{padding:16px}}.badge{{display:inline-block;padding:4px 9px;border-radius:999px;background:#cde6df;color:#075f5a;font-size:12px;font-weight:700}}.badge.quarantine{{background:#f4ddb1;color:#73500d}}.reason{{min-height:42px;color:#6e443b}}label{{display:block;margin:10px 0 4px;font-size:12px;font-weight:700}}input{{display:block;width:100%;margin-top:4px;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:white;color:var(--ink);font:inherit}}.actions{{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}}button{{border:0;border-radius:9px;padding:9px 12px;background:var(--teal);color:white;font-weight:700;cursor:pointer}}button.secondary{{background:#52686a}}button.danger{{background:var(--red)}}.notice,.empty{{margin:20px;padding:14px 18px;border-radius:12px;background:var(--paper)}}.notice{{grid-column:1/-1;border-left:5px solid var(--teal)}}.empty{{grid-column:1/-1}}@media(max-width:500px){{main{{padding:10px;grid-template-columns:1fr}}header{{padding:14px}}}}
    </style></head><body><header><h1>Postcard review</h1><p>{len(pending)} pending screenshots, {len(quarantined)} quarantined crops. Changes stay local until the site is deployed.</p></header>{notice}<main>{content}</main></body></html>'''


class Handler(BaseHTTPRequestHandler):
    server_version = "DREPostcardReceiver/1.0"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/health":
            self.send_text(HTTPStatus.OK, "ok")
            return
        if path == "/review" and self.is_local_request():
            message = parse_qs(parsed.query).get("message", [""])[-1]
            self.send_html(HTTPStatus.OK, review_page(message))
            return
        if path == "/review/image" and self.is_local_request():
            query = parse_qs(parsed.query)
            try:
                if query.get("kind", [""])[-1] == "pending":
                    image_path, _ = pending_paths(query.get("name", [""])[-1])
                else:
                    identifier = query.get("id", [""])[-1]
                    record = next(entry for entry in review_records() if entry.get("id") == identifier)
                    image_path = (SITE_ROOT / record["image"]).resolve()
                    image_path.relative_to(SITE_ROOT.resolve())
                self.send_file(image_path)
            except (FileNotFoundError, KeyError, StopIteration, ValueError):
                self.send_text(HTTPStatus.NOT_FOUND, "review image not found")
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
        path = urlparse(self.path).path
        if path == "/review/action" and self.is_local_request():
            self.handle_review_action()
            return
        if path != "/upload":
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

    def is_local_request(self) -> bool:
        return self.client_address[0] in {"127.0.0.1", "::1"}

    def handle_review_action(self) -> None:
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 64 * 1024)
            values = {key: items[-1] for key, items in parse_qs(self.rfile.read(length).decode("utf-8")).items()}
            kind = values.get("kind", "")
            action = values.get("action", "")
            item = values.get("item", "")
            if kind == "pending" and action == "approve":
                message = approve_pending(item, values.get("stopName", ""), values.get("locationText", ""), values.get("friendUsername", ""))
            elif kind == "pending" and action == "retry":
                message = retry_pending(item)
            elif kind == "pending" and action == "archive":
                image_path, metadata_path = pending_paths(item)
                archive_files([image_path, metadata_path], "pending")
                message = "Archived pending screenshot"
            elif kind == "quarantine" and action == "restore":
                message = restore_review_record(item, values.get("stopName", ""), values.get("locationText", ""), values.get("friendUsername", ""))
            elif kind == "quarantine" and action == "archive":
                message = archive_review_record(item)
            else:
                raise ValueError("Unknown review action")
            log_event(f"review kind={kind} action={action} item={item} message={message}")
        except Exception as error:
            message = f"Could not complete review: {error}"
            log_event(f"review-error error={error}\n{traceback.format_exc()}")
        self.send_response(HTTPStatus.SEE_OTHER)
        self.send_header("Location", "/review?message=" + quote(message))
        self.end_headers()

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

    def send_html(self, status: HTTPStatus, text: str) -> None:
        body = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
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
    print(f"Open http://127.0.0.1:{PORT}/review for manual review")
    log_event("receiver-started")
    Server((HOST, PORT), Handler, token).serve_forever()


if __name__ == "__main__":
    main()
