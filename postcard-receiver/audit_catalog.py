from __future__ import annotations

import json
from pathlib import Path
import re
from datetime import datetime


ROOT = Path(__file__).resolve().parent
CATALOG_PATH = ROOT.parent / "postcards" / "data" / "postcards.json"
REVIEW_PATH = ROOT / "data" / "review-records.json"

REVIEW_IDS = {
    "20261008120951-00a57a7a",
    "20261008120957-d80f2fa4",
    "20261006144358-9af481b0",
    "20261006144409-18dcf3e4",
    "20261006144450-ff87cbc6",
    "20261005211256-69706b62",
    "20261005211407-272f4d93",
    "20261005211529-4f4b382e",
    "20261005211631-83d83ba4",
    "20261005211903-1f5969a3",
    "20261005211925-82650ffd",
    "20261005211942-d797f461",
    "20261005212459-a07b16d8",
    "20261005212546-e9745980",
    "20261005212610-1e50211d",
    "20261005212725-e41c21ae",
    "20261005212740-9ad071fd",
    "20261005212828-3d0a1950",
    "20261005212836-5414ec4d",
    "20261005212845-2bffc890",
    "20261005212921-8422f2cc",
    "20261005212931-ab634279",
    "20261005213102-b6d63bfe",
    "20261005213139-141ac7bd",
    "20261005213310-213901be",
    "20261005213847-5f5087d7",
    "20261005213921-1c4e410e",
}

MOJIBAKE_MARKERS = "ÃÂâæåäëðï¿½"


def mojibake_score(value: str) -> int:
    return sum(value.count(marker) for marker in MOJIBAKE_MARKERS) + value.count("�") * 4


def repair_text(value: str) -> str:
    current = value
    for _ in range(3):
        candidates = [current]
        for encoding in ("cp1252", "latin1"):
            try:
                candidates.append(current.encode(encoding).decode("utf-8"))
            except (UnicodeEncodeError, UnicodeDecodeError):
                pass
        best = min(candidates, key=lambda item: (mojibake_score(item), len(item)))
        if mojibake_score(best) >= mojibake_score(current):
            break
        current = best
    return current


def repair_value(value):
    if isinstance(value, str):
        return repair_text(value)
    if isinstance(value, list):
        return [repair_value(item) for item in value]
    if isinstance(value, dict):
        return {key: repair_value(item) for key, item in value.items()}
    return value


def compact(value: str) -> str:
    return "".join(character.lower() for character in value if character.isalnum())


def friend_is_location(record: dict) -> bool:
    friend = compact(record.get("friendUsername", ""))
    if not friend:
        return False
    values = re.split(r"[,/]", record.get("locationText", ""))
    values.extend([record.get("country", ""), record.get("state", "")])
    forbidden = {compact(value) for value in values if len(compact(value)) >= 3}
    forbidden.update({"unitedstates", "states", "australia", "canada"})
    return friend in forbidden


def main() -> None:
    catalog = repair_value(json.loads(CATALOG_PATH.read_text(encoding="utf-8")))
    review = json.loads(REVIEW_PATH.read_text(encoding="utf-8")) if REVIEW_PATH.exists() else {"records": []}
    existing_review_ids = {record.get("id") for record in review.get("records", [])}
    retained = []
    quarantined = []
    cleared_friends = 0

    for record in catalog.get("postcards", []):
        if friend_is_location(record):
            record["friendUsername"] = ""
            cleared_friends += 1
        if record.get("id") in REVIEW_IDS:
            record["reviewReason"] = "Unreliable OCR; manual title review required"
            quarantined.append(record)
        else:
            retained.append(record)

    for record in quarantined:
        if record.get("id") not in existing_review_ids:
            review.setdefault("records", []).append(record)
    timestamp = datetime.now().astimezone().isoformat(timespec="seconds")
    catalog["postcards"] = retained
    catalog["updatedAt"] = timestamp
    review["updatedAt"] = timestamp
    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    REVIEW_PATH.write_text(json.dumps(review, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Retained {len(retained)} records; quarantined {len(quarantined)}; cleared {cleared_friends} false friend names")


if __name__ == "__main__":
    main()
