import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag


BASE_URL = "https://dnd5e.wikidot.com"
HOMEPAGE_URL = f"{BASE_URL}/"
USER_AGENT = "Mozilla/5.0 (compatible; Codex dnd5e scraper/1.0)"
REQUEST_HEADERS = {"User-Agent": USER_AGENT}
RETRIES = 3
REQUEST_DELAY_SECONDS = 0.15

ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / "data" / "dnd5e"

OFFICIAL_CLASSES = {
    "artificer",
    "barbarian",
    "bard",
    "cleric",
    "druid",
    "fighter",
    "monk",
    "paladin",
    "ranger",
    "rogue",
    "sorcerer",
    "warlock",
    "wizard",
}

EXCLUDED_BACKGROUNDS = {
    "background:optional-features",
}

EXCLUDED_SUBCLASSES = {
    "artificer:infusions",
    "fighter:battle-master:maneuvers",
    "monk:four-elements:disciplines",
    "warlock:eldritch-invocations",
}

MECHANICAL_PATTERNS = {
    "ability_score": re.compile(
        r"\b(ability score increase|increase (?:one|two|three|your) ability score|your [A-Za-z]+ score increases)\b",
        re.IGNORECASE,
    ),
    "proficiency": re.compile(r"\b(proficien(?:cy|cies)|expertise|tool proficiencies|skill proficiencies)\b", re.IGNORECASE),
    "roll_modifier": re.compile(r"\b(advantage|disadvantage|bonus to|penalty to|add .* modifier|reroll|treat a d20 roll)\b", re.IGNORECASE),
    "uses": re.compile(
        r"\b(once per (?:short|long) rest|finish a (?:short|long) rest|regain all expended uses|number of times equal to your proficiency bonus|you can use this trait|you can use this feature)\b",
        re.IGNORECASE,
    ),
    "resource": re.compile(r"\b(hit die|temporary hit points|spell slot|sorcery point|ki point|rage|channel divinity)\b", re.IGNORECASE),
    "combat": re.compile(r"\b(action|bonus action|reaction|attack roll|weapon attack|damage|saving throw|save dc|armor class|ac)\b", re.IGNORECASE),
    "movement": re.compile(r"\b(speed|walking speed|flying speed|swimming speed|climbing speed|teleport)\b", re.IGNORECASE),
    "defense": re.compile(r"\b(resistance|immune|immunity|vulnerability|temporary hit points|evasion)\b", re.IGNORECASE),
    "spellcasting": re.compile(r"\b(cantrip|spellcasting|spell save dc|spell attack|learn .* spell|cast it)\b", re.IGNORECASE),
    "multiclass": re.compile(r"\bmulticlass\b", re.IGNORECASE),
}

USAGE_PATTERNS = [
    re.compile(r"\bonce per (short|long) rest\b", re.IGNORECASE),
    re.compile(r"\b(number of times equal to your proficiency bonus)\b", re.IGNORECASE),
    re.compile(r"\bregain all expended uses when you finish a (short|long) rest\b", re.IGNORECASE),
    re.compile(r"\buntil the end of your next turn\b", re.IGNORECASE),
    re.compile(r"\bfor 1 minute\b", re.IGNORECASE),
]


@dataclass(frozen=True)
class LinkEntry:
    name: str
    slug: str
    url: str
    parent_class: str | None = None


def fetch_text(url: str) -> str:
    last_error = None
    for attempt in range(1, RETRIES + 1):
        try:
            request = urllib.request.Request(url, headers=REQUEST_HEADERS)
            with urllib.request.urlopen(request, timeout=45) as response:
                return response.read().decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
            time.sleep(0.7 * attempt)
    raise RuntimeError(f"Failed to fetch {url}: {last_error}") from last_error


def normalize_whitespace(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = text.replace("\u2013", "-").replace("\u2014", "-")
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def absolute_url(href: str) -> str:
    return urllib.parse.urljoin(BASE_URL, href)


def path_slug(url: str) -> str:
    return urllib.parse.urlparse(url).path.strip("/").lower()


def get_page_content(html: str) -> Tag:
    soup = BeautifulSoup(html, "html.parser")
    page_content = soup.find("div", id="page-content")
    if not page_content:
        raise RuntimeError("Could not find #page-content")
    return page_content


def clean_name(text: str) -> str:
    return normalize_whitespace(text).replace("Fold Unfold", "").strip()


def collect_homepage_links() -> dict[str, list[LinkEntry]]:
    page_content = get_page_content(fetch_text(HOMEPAGE_URL))
    results: dict[str, dict[str, LinkEntry]] = {
        "lineages": {},
        "backgrounds": {},
        "feats": {},
        "classes": {},
        "subclasses": {},
    }

    for anchor in page_content.find_all("a", href=True):
        href = absolute_url(anchor["href"].strip())
        slug = path_slug(href)
        name = clean_name(anchor.get_text(" ", strip=True))
        if not slug or not name:
            continue
        if slug.startswith("lineage:"):
            results["lineages"].setdefault(slug, LinkEntry(name=name, slug=slug, url=href))
            continue
        if slug.startswith("background:"):
            if slug in EXCLUDED_BACKGROUNDS:
                continue
            results["backgrounds"].setdefault(slug, LinkEntry(name=name, slug=slug, url=href))
            continue
        if slug.startswith("feat:"):
            results["feats"].setdefault(slug, LinkEntry(name=name, slug=slug, url=href))
            continue
        if slug in OFFICIAL_CLASSES:
            results["classes"].setdefault(slug, LinkEntry(name=name, slug=slug, url=href))
            continue
        if ":" in slug:
            parent_class, _child = slug.split(":", 1)
            if parent_class in OFFICIAL_CLASSES and slug.count(":") == 1 and slug not in EXCLUDED_SUBCLASSES:
                results["subclasses"].setdefault(
                    slug,
                    LinkEntry(name=name, slug=slug, url=href, parent_class=parent_class),
                )

    return {key: sorted(entries.values(), key=lambda item: item.slug) for key, entries in results.items()}


def block_to_text(node: Tag) -> str:
    if node.name in {"ul", "ol"}:
        lines = []
        for item in node.find_all("li", recursive=False):
            text = normalize_whitespace(item.get_text(" ", strip=True))
            if text:
                lines.append(f"* {text}")
        return "\n".join(lines)
    if node.name == "table":
        rows = []
        for row in node.find_all("tr"):
            cells = [normalize_whitespace(cell.get_text(" ", strip=True)) for cell in row.find_all(["th", "td"])]
            if any(cells):
                rows.append(" | ".join(cells))
        return "\n".join(rows)
    return normalize_whitespace(node.get_text("\n", strip=True))


def is_toc_block(tag: Tag) -> bool:
    classes = set(tag.get("class", []))
    if "floatright" in classes:
        return True
    text = clean_name(tag.get_text(" ", strip=True)).lower()
    return "table of contents" in text and "fold unfold" in text


def collect_content_blocks(node: Tag) -> list[Tag]:
    blocks: list[Tag] = []
    for child in node.children:
        if isinstance(child, NavigableString):
            continue
        if not isinstance(child, Tag):
            continue
        if child.name in {"script", "style", "nav"}:
            continue
        if is_toc_block(child):
            continue
        if re.fullmatch(r"h[1-6]", child.name or "") or child.name in {"p", "ul", "ol", "table"}:
            blocks.append(child)
            continue
        nested = collect_content_blocks(child)
        if nested:
            blocks.extend(nested)
            continue
        text = clean_name(child.get_text(" ", strip=True))
        if text:
            blocks.append(child)
    return blocks


def classify_text(text: str) -> list[str]:
    tags = [name for name, pattern in MECHANICAL_PATTERNS.items() if pattern.search(text)]
    return tags


def extract_usage_hints(text: str) -> list[str]:
    hints = []
    for pattern in USAGE_PATTERNS:
        match = pattern.search(text)
        if match:
            hints.append(match.group(0))
    return sorted(set(hints))


def extract_source_and_prereq(text: str) -> tuple[str | None, str | None]:
    source = None
    prerequisite = None
    for line in text.splitlines():
        if line.lower().startswith("source:"):
            source = line.split(":", 1)[1].strip()
        if line.lower().startswith("prerequisite:"):
            prerequisite = line.split(":", 1)[1].strip()
    return source, prerequisite


def extract_sources(text: str) -> list[str]:
    sources = []
    for line in text.splitlines():
        if line.lower().startswith("source:"):
            source = line.split(":", 1)[1].strip()
            if source and source not in sources:
                sources.append(source)
    return sources


def extract_tables(blocks: list[Tag]) -> list[dict]:
    tables = []
    for block in blocks:
        if block.name != "table":
            continue
        rows = []
        for row in block.find_all("tr"):
            cells = [normalize_whitespace(cell.get_text(" ", strip=True)) for cell in row.find_all(["th", "td"])]
            if any(cells):
                rows.append(cells)
        if rows:
            tables.append({"rows": rows})
    return tables


def extract_sections(page_content: Tag) -> tuple[list[dict], list[str], list[str]]:
    blocks = collect_content_blocks(page_content)
    sections: list[dict] = []
    top_level_texts: list[str] = []
    top_level_mechanics: list[str] = []

    current = {
        "heading": "Overview",
        "heading_level": 0,
        "texts": [],
        "mechanical_entries": [],
        "usage_hints": set(),
        "tables": [],
    }

    def flush_current() -> None:
        nonlocal current
        if current["texts"] or current["tables"] or current["mechanical_entries"]:
            sections.append(
                {
                    "heading": current["heading"],
                    "heading_level": current["heading_level"],
                    "text": "\n\n".join(current["texts"]).strip(),
                    "mechanical_entries": current["mechanical_entries"],
                    "usage_hints": sorted(current["usage_hints"]),
                    "tables": current["tables"],
                }
            )
        current = {
            "heading": "Overview",
            "heading_level": 0,
            "texts": [],
            "mechanical_entries": [],
            "usage_hints": set(),
            "tables": [],
        }

    for block in blocks:
        if re.fullmatch(r"h[1-6]", block.name or ""):
            flush_current()
            current["heading"] = clean_name(block.get_text(" ", strip=True))
            current["heading_level"] = int(block.name[1])
            continue

        text = block_to_text(block)
        if block.name == "table":
            table_rows = extract_tables([block])
            if table_rows:
                current["tables"].extend(table_rows)
            if text:
                current["texts"].append(text)
            continue

        if text:
            current["texts"].append(text)
            top_level_texts.append(text)
            tags = classify_text(text)
            if tags:
                entry = {"text": text, "tags": tags}
                current["mechanical_entries"].append(entry)
                top_level_mechanics.append(text)
            for hint in extract_usage_hints(text):
                current["usage_hints"].add(hint)

    flush_current()
    return sections, top_level_texts, sorted(set(top_level_mechanics))


def level_mentions(text: str) -> list[str]:
    matches = re.findall(r"\b(\d+(?:st|nd|rd|th) level)\b", text, flags=re.IGNORECASE)
    return sorted(set(match.lower() for match in matches))


def scrape_entry(kind: str, entry: LinkEntry) -> dict:
    html = fetch_text(entry.url)
    page_content = get_page_content(html)

    sections, raw_blocks, top_level_mechanics = extract_sections(page_content)
    full_text = "\n\n".join(raw_blocks).strip()
    source, prerequisite = extract_source_and_prereq(full_text)
    sources = extract_sources(full_text)

    mechanics = []
    for section in sections:
        for item in section["mechanical_entries"]:
            mechanics.append(
                {
                    "section": section["heading"],
                    "text": item["text"],
                    "tags": item["tags"],
                    "levels": level_mentions(item["text"]),
                    "usage_hints": extract_usage_hints(item["text"]),
                }
            )

    summary = {
        "has_asi": any("ability_score" in item["tags"] for item in mechanics),
        "has_uses": any("uses" in item["tags"] for item in mechanics),
        "has_roll_modifiers": any("roll_modifier" in item["tags"] for item in mechanics),
        "has_spellcasting": any("spellcasting" in item["tags"] for item in mechanics),
    }

    return {
        "kind": kind,
        "name": entry.name,
        "slug": entry.slug,
        "url": entry.url,
        "parent_class": entry.parent_class,
        "source": source,
        "sources": sources,
        "prerequisite": prerequisite,
        "summary_flags": summary,
        "mechanics": mechanics,
        "sections": sections,
        "raw_text": full_text,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
    }


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    links = collect_homepage_links()

    outputs = {}
    for kind, entries in links.items():
        print(f"Scraping {kind}: {len(entries)} pages")
        results = []
        for index, entry in enumerate(entries, start=1):
            print(f"  [{index}/{len(entries)}] {entry.slug}")
            results.append(scrape_entry(kind, entry))
            time.sleep(REQUEST_DELAY_SECONDS)
        outputs[kind] = results
        write_json(OUTPUT_DIR / f"{kind}.json", results)

    index_payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": HOMEPAGE_URL,
        "counts": {kind: len(entries) for kind, entries in outputs.items()},
        "files": {kind: f"{kind}.json" for kind in outputs},
        "official_classes": sorted(OFFICIAL_CLASSES),
    }
    write_json(OUTPUT_DIR / "index.json", index_payload)
    print("Done.")
    print(json.dumps(index_payload, indent=2))


if __name__ == "__main__":
    main()
