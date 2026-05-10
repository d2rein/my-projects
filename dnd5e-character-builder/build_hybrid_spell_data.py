import csv
import json
from pathlib import Path


MERGED_CSV = Path(r"C:\Users\d2rei\My_Site\dnd-bladesinger-pwa\dnd_spell_cards_2014_2024.csv")
OUTPUT_JS = Path(r"C:\Users\d2rei\My_Site\dnd-bladesinger-pwa\spell-data.js")

FIELDS = [
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
    "edition",
]


def parse_bool(value: str) -> bool:
    return str(value).strip().upper() == "TRUE"


def parse_int(value: str) -> int:
    return int(str(value).strip() or 0)


def load_rows() -> list[dict]:
    with MERGED_CSV.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        rows = []
        for row in reader:
            if "(UA)" in row["name"]:
                continue
            rows.append(
                {
                    "name": row["name"],
                    "level": parse_int(row["level"]),
                    "ritual": parse_bool(row["ritual"]),
                    "range": row["range"],
                    "components": row["components"],
                    "duration": row["duration"],
                    "concentration": parse_bool(row["concentration"]),
                    "casting_time": row["casting_time"],
                    "school": row["school"],
                    "classes": row["classes"],
                    "description": row["description"],
                    "edition": row["edition"],
                }
            )
        return rows


def build_hybrid(rows: list[dict]) -> list[dict]:
    by_name = {}
    for row in rows:
        current = by_name.get(row["name"])
        if current is None or (current["edition"] != "2024" and row["edition"] == "2024"):
            by_name[row["name"]] = row
    hybrid = list(by_name.values())
    hybrid.sort(key=lambda spell: (spell["level"], spell["name"].lower()))
    return hybrid


def write_output(spells: list[dict]) -> None:
    payload = json.dumps(spells, ensure_ascii=False, separators=(",", ":"))
    OUTPUT_JS.write_text(f"window.SPELL_DATA = {payload};\n", encoding="utf-8")


def main() -> int:
    rows = load_rows()
    spells = build_hybrid(rows)
    write_output(spells)
    chosen_2024 = sum(1 for spell in spells if spell["edition"] == "2024")
    chosen_2014 = sum(1 for spell in spells if spell["edition"] == "2014")
    print(f"Wrote {len(spells)} hybrid spells to {OUTPUT_JS}")
    print(f"2024 preferred rows: {chosen_2024}")
    print(f"2014 fallback rows: {chosen_2014}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
