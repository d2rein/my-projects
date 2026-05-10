import csv
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from bs4 import BeautifulSoup


SOURCE_CSV = Path(r"C:\Users\d2rei\Downloads\dnd_spell_cards.csv")
OUTPUT_CSV = Path(r"C:\Users\d2rei\My_Site\dnd-bladesinger-pwa\dnd_spell_cards_2014_2024.csv")
SPELL_INDEX_URL = "https://dnd5e.wikidot.com/spells"
USER_AGENT = "Mozilla/5.0 (compatible; Codex spell scraper/1.0)"
REQUEST_HEADERS = {"User-Agent": USER_AGENT}
MAX_WORKERS = 8
RETRIES = 3

BASE_FIELDS = [
    "name",
    "level",
    "ritual",
    "range",
    "components",
    "duration",
    "concentration",
    "casting_time",
    "school",
    "classes",
    "description",
    "double_height",
    "page",
    "column",
    "row_start_y",
]
OUTPUT_FIELDS = BASE_FIELDS + ["edition"]

ORDINAL_LEVELS = {
    "cantrip": 0,
    "1st": 1,
    "2nd": 2,
    "3rd": 3,
    "4th": 4,
    "5th": 5,
    "6th": 6,
    "7th": 7,
    "8th": 8,
    "9th": 9,
}


def fetch_text(url: str) -> str:
    last_error = None
    for attempt in range(1, RETRIES + 1):
        try:
            request = urllib.request.Request(url, headers=REQUEST_HEADERS)
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read().decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
            time.sleep(0.75 * attempt)
    raise RuntimeError(f"Failed to fetch {url}: {last_error}") from last_error


def normalize_whitespace(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def normalize_title_case(text: str) -> str:
    return " ".join(part.capitalize() for part in text.strip().split())


def parse_level_and_school(raw_text: str) -> tuple[int, str, bool]:
    text = normalize_whitespace(raw_text)
    lowered = text.lower()
    ritual = "(ritual)" in lowered
    cleaned = re.sub(r"\s*\([^)]*\)", "", text).strip()

    cantrip_match = re.match(r"^(?P<school>[A-Za-z]+)\s+cantrip$", cleaned, flags=re.IGNORECASE)
    if cantrip_match:
        return 0, normalize_title_case(cantrip_match.group("school")), ritual

    spell_match = re.match(
        r"^(?P<level>\d+(?:st|nd|rd|th))-level\s+(?P<school>[A-Za-z]+)$",
        cleaned,
        flags=re.IGNORECASE,
    )
    if not spell_match:
        raise ValueError(f"Could not parse level/school from: {raw_text!r}")

    level_key = spell_match.group("level").lower()
    if level_key not in ORDINAL_LEVELS:
        raise ValueError(f"Unsupported level marker: {level_key}")
    return ORDINAL_LEVELS[level_key], normalize_title_case(spell_match.group("school")), ritual


def split_duration_and_concentration(raw_duration: str) -> tuple[str, bool]:
    text = normalize_whitespace(raw_duration)
    lowered = text.lower()
    if lowered.startswith("concentration,"):
        return text.split(",", 1)[1].strip().capitalize(), True
    return text, False


def split_components_and_material(raw_components: str) -> tuple[str, str]:
    text = normalize_whitespace(raw_components)
    match = re.match(r"^(?P<components>.*?\bM)\s*\((?P<material>.*)\)$", text)
    if not match:
        return text, ""
    return match.group("components").strip(), match.group("material").strip()


def label_text(strong_tag) -> str:
    label = strong_tag.get_text(" ", strip=True)
    label = re.sub(r"\s+", " ", label)
    return label.rstrip(":").strip().lower()


def extract_meta_from_paragraph(paragraph) -> dict[str, str]:
    meta_values = {}
    strong_tags = paragraph.find_all("strong")
    for strong_tag in strong_tags:
        label = label_text(strong_tag)
        value_parts = []
        for sibling in strong_tag.next_siblings:
            if getattr(sibling, "name", None) == "br":
                break
            if hasattr(sibling, "get_text"):
                value_parts.append(sibling.get_text(" ", strip=True))
            else:
                value_parts.append(str(sibling).strip())
        meta_values[label] = normalize_whitespace(" ".join(part for part in value_parts if part))
    return meta_values


def extract_spell_urls() -> list[tuple[str, str]]:
    html = fetch_text(SPELL_INDEX_URL)
    soup = BeautifulSoup(html, "html.parser")
    page_content = soup.find("div", id="page-content")
    if not page_content:
        raise RuntimeError("Could not find spells page content")

    spell_links = []
    seen = set()
    for anchor in page_content.find_all("a", href=True):
        href = anchor["href"].strip()
        if "/spell:" not in href:
            continue
        name = normalize_whitespace(anchor.get_text(" ", strip=True))
        if not name:
            continue
        url = href.replace("http://", "https://")
        if url.startswith("/"):
            url = f"https://dnd5e.wikidot.com{url}"
        if url in seen:
            continue
        seen.add(url)
        spell_links.append((name, url))
    return spell_links


def description_from_paragraphs(paragraphs) -> str:
    chunks = []
    for paragraph in paragraphs:
        text = normalize_whitespace(paragraph.get_text("\n", strip=True))
        if not text:
            continue
        if text.lower().startswith("spell lists."):
            continue
        chunks.append(text)
    return "\n\n".join(chunks).strip()


def scrape_spell_page(name: str, url: str) -> dict[str, str]:
    html = fetch_text(url)
    soup = BeautifulSoup(html, "html.parser")
    page_content = soup.find("div", id="page-content")
    if not page_content:
        raise RuntimeError(f"Missing page content for {name} ({url})")

    paragraphs = page_content.find_all("p", recursive=False)
    if len(paragraphs) < 3:
        raise RuntimeError(f"Unexpected paragraph layout for {name} ({url})")

    level, school, ritual = parse_level_and_school(paragraphs[1].get_text(" ", strip=True))

    meta_values = {}
    description_start = 2
    while description_start < len(paragraphs):
        paragraph_meta = extract_meta_from_paragraph(paragraphs[description_start])
        if not paragraph_meta:
            break
        meta_values.update(paragraph_meta)
        description_start += 1

    required_meta = {"casting time", "range", "components", "duration"}
    missing_meta = required_meta.difference(meta_values)
    if missing_meta:
        raise RuntimeError(f"Missing meta fields {sorted(missing_meta)} for {name} ({url})")

    duration, concentration = split_duration_and_concentration(meta_values["duration"])
    components, material = split_components_and_material(meta_values["components"])
    description = description_from_paragraphs(paragraphs[description_start:])
    if material and "material:" not in description.lower():
        suffix = material if material.endswith(".") else f"{material}."
        description = f"{description}\n\nMaterial: {suffix}" if description else f"Material: {suffix}"

    classes = ""
    for paragraph in reversed(paragraphs[description_start:]):
        text = normalize_whitespace(paragraph.get_text(" ", strip=True))
        if not text.lower().startswith("spell lists."):
            continue
        links = [normalize_whitespace(anchor.get_text(" ", strip=True)) for anchor in paragraph.find_all("a")]
        classes = ", ".join(link for link in links if link)
        break

    return {
        "name": name,
        "level": str(level),
        "ritual": "TRUE" if ritual else "FALSE",
        "range": meta_values.get("range", ""),
        "components": components,
        "duration": duration,
        "concentration": "TRUE" if concentration else "FALSE",
        "casting_time": meta_values.get("casting time", ""),
        "school": school,
        "classes": classes,
        "description": description,
        "double_height": "FALSE",
        "page": "",
        "column": "",
        "row_start_y": "",
        "edition": "2014",
    }


def load_existing_rows() -> list[dict[str, str]]:
    with SOURCE_CSV.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        rows = []
        for row in reader:
            output_row = {field: row.get(field, "") for field in BASE_FIELDS}
            output_row["edition"] = "2024"
            rows.append(output_row)
        return rows


def write_rows(rows: list[dict[str, str]]) -> None:
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    existing_rows = load_existing_rows()
    spell_links = extract_spell_urls()
    print(f"Loaded {len(existing_rows)} existing 2024 rows.")
    print(f"Discovered {len(spell_links)} Wikidot spell pages to scrape.")

    scraped_rows = []
    failures = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_map = {
            executor.submit(scrape_spell_page, name, url): (name, url)
            for name, url in spell_links
        }
        completed = 0
        total = len(future_map)
        for future in as_completed(future_map):
            name, url = future_map[future]
            try:
                scraped_rows.append(future.result())
            except Exception as exc:  # noqa: BLE001 - we want to keep going and report all failures.
                failures.append((name, url, str(exc)))
            completed += 1
            if completed % 25 == 0 or completed == total:
                print(f"Scraped {completed}/{total} pages...")

    if failures:
        print("Scrape failures detected:", file=sys.stderr)
        for name, url, error in failures[:20]:
            print(f"- {name} | {url} | {error}", file=sys.stderr)
        print(f"Total failures: {len(failures)}", file=sys.stderr)
        return 1

    scraped_rows.sort(key=lambda row: row["name"].lower())
    merged_rows = existing_rows + scraped_rows
    write_rows(merged_rows)

    print(f"Wrote {len(merged_rows)} rows to {OUTPUT_CSV}")
    print(f"2024 rows: {len(existing_rows)}")
    print(f"2014 rows: {len(scraped_rows)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
