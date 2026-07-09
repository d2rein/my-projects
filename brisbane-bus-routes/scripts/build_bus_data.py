from __future__ import annotations

import csv
import json
import math
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from tempfile import TemporaryDirectory


TARGET_ROUTE_NUMBERS = [
    "113",
    "172",
    "174",
    "175",
    "176",
    "177",
    "179",
    "182",
    "183",
    "185",
    "186",
    "598",
    "599",
]

FALLBACK_COLORS = [
    "#007f5f",
    "#c1121f",
    "#005f73",
    "#5a189a",
    "#e36414",
    "#4361ee",
    "#2d6a4f",
    "#9d0208",
    "#6c757d",
    "#ff006e",
    "#355070",
    "#8a5a44",
    "#386641",
]

REQUIRED_FILES = [
    "agency.txt",
    "calendar.txt",
    "calendar_dates.txt",
    "routes.txt",
    "trips.txt",
    "shapes.txt",
    "stops.txt",
    "stop_times.txt",
]


def main() -> int:
    project_root = Path(__file__).resolve().parent.parent
    input_dir = project_root / "data" / "input"
    output_dir = project_root / "data" / "output"
    input_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    source_arg = Path(sys.argv[1]).expanduser().resolve() if len(sys.argv) > 1 else None
    default_sources = discover_default_sources(input_dir)

    gtfs_source = resolve_source(source_arg, default_sources)
    print(f"Using GTFS source: {gtfs_source}")

    if gtfs_source.is_dir():
        build_from_directory(gtfs_source, output_dir)
        return 0

    with TemporaryDirectory() as temp_dir:
        extract_dir = Path(temp_dir) / "gtfs"
        extract_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(gtfs_source) as archive:
            archive.extractall(extract_dir)
        build_from_directory(extract_dir, output_dir)
    return 0


def resolve_source(source_arg: Path | None, default_sources: list[Path]) -> Path:
    candidates = [source_arg] if source_arg else []
    candidates.extend(default_sources)
    for candidate in candidates:
        if candidate and candidate.exists():
            return candidate
    searched = "\n".join(str(path) for path in default_sources)
    raise FileNotFoundError(
        "Could not find GTFS input. Pass a path explicitly or place data in one of:\n" + searched
    )


def discover_default_sources(input_dir: Path) -> list[Path]:
    sources = [
        input_dir / "SEQ_GTFS",
        input_dir / "SEQ_GTFS.zip",
    ]

    mdb_dirs = sorted(input_dir.glob("mdb-*"), key=lambda path: path.stat().st_mtime, reverse=True)
    mdb_zips = sorted(input_dir.glob("mdb-*.zip"), key=lambda path: path.stat().st_mtime, reverse=True)

    sources.extend(mdb_dirs)
    sources.extend(mdb_zips)
    return sources


def build_from_directory(gtfs_dir: Path, output_dir: Path) -> None:
    for filename in REQUIRED_FILES:
        if not (gtfs_dir / filename).exists():
            raise FileNotFoundError(f"Missing required GTFS file: {gtfs_dir / filename}")

    routes = load_routes(gtfs_dir / "routes.txt")
    trips, shape_trip_counts, headsign_counts = load_trips(gtfs_dir / "trips.txt", routes)
    representative_shapes = choose_representative_shapes(gtfs_dir / "shapes.txt", shape_trip_counts)
    stop_map, route_stop_ids, direction_stop_ids = load_stop_relationships(gtfs_dir, trips)
    stops = load_stops(gtfs_dir / "stops.txt", set(stop_map))
    display_colors = assign_display_colors(routes)

    route_features = []
    route_summary_routes = []

    for route_number in sorted(routes):
        route_entry = routes[route_number]
        route_color = display_colors[route_number]
        directions_summary = []

        for direction_id in sorted(representative_shapes[route_number]):
            rep = representative_shapes[route_number][direction_id]
            if not rep["coordinates"]:
                continue

            headsign_summary = summarize_headsigns(headsign_counts[(route_number, direction_id)])
            coords = rep["coordinates"]
            label_point = line_midpoint(coords)
            bounds = shape_bounds(coords)
            directions_summary.append(
                {
                    "direction_id": direction_id,
                    "shape_id": rep["shape_id"],
                    "trip_count": rep["trip_count"],
                    "headsign_summary": headsign_summary,
                    "bounds": bounds,
                    "stop_count": len(direction_stop_ids[(route_number, direction_id)]),
                    "stop_ids": sorted(direction_stop_ids[(route_number, direction_id)]),
                }
            )
            route_features.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": coords},
                    "properties": {
                        "route_short_name": route_number,
                        "route_long_name": route_entry["route_long_name"],
                        "direction_id": direction_id,
                        "shape_id": rep["shape_id"],
                        "trip_count": rep["trip_count"],
                        "headsign_summary": headsign_summary,
                        "display_color": route_color,
                        "text_color": route_entry["text_color"],
                        "label_point": label_point,
                    },
                }
            )

        stop_names_search = " ".join(
            sorted(
                {
                    stops[stop_id]["stop_name"].lower()
                    for stop_id in route_stop_ids[route_number]
                    if stop_id in stops
                }
            )
        )
        route_summary_routes.append(
            {
                "route_short_name": route_number,
                "route_long_name": route_entry["route_long_name"],
                "display_color": route_color,
                "text_color": route_entry["text_color"],
                "direction_count": len(directions_summary),
                "trip_count_total": sum(direction["trip_count"] for direction in directions_summary),
                "direction_summary": " / ".join(
                    direction["headsign_summary"] for direction in directions_summary if direction["headsign_summary"]
                ),
                "stop_ids": sorted(route_stop_ids[route_number]),
                "stop_names_search": stop_names_search,
                "directions": directions_summary,
            }
        )

    stop_features = []
    stop_routes_lookup = {}

    for stop_id in sorted(stop_map):
        if stop_id not in stops:
            continue
        stop_entry = stops[stop_id]
        route_numbers = sorted(stop_map[stop_id])
        stop_routes_lookup[stop_id] = {
            "stop_id": stop_id,
            "stop_code": stop_entry["stop_code"],
            "stop_name": stop_entry["stop_name"],
            "routes": route_numbers,
        }
        stop_features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [stop_entry["stop_lon"], stop_entry["stop_lat"]],
                },
                "properties": {
                    "stop_id": stop_id,
                    "stop_code": stop_entry["stop_code"],
                    "stop_name": stop_entry["stop_name"],
                    "routes": route_numbers,
                    "route_count": len(route_numbers),
                },
            }
        )

    route_summary = {
        "target_route_numbers": TARGET_ROUTE_NUMBERS,
        "available_route_numbers": sorted(routes),
        "missing_target_routes": sorted(set(TARGET_ROUTE_NUMBERS) - set(routes)),
        "routes": route_summary_routes,
    }

    write_json(
        output_dir / "routes.geojson",
        {"type": "FeatureCollection", "features": route_features},
    )
    write_json(
        output_dir / "stops.geojson",
        {"type": "FeatureCollection", "features": stop_features},
    )
    write_json(output_dir / "stop_routes.json", stop_routes_lookup)
    write_json(output_dir / "route_summary.json", route_summary)

    print(
        "Built outputs:",
        f"{len(route_features)} route shape features,",
        f"{len(stop_features)} stop features,",
        f"{len(route_summary['missing_target_routes'])} missing target routes.",
    )


def load_routes(path: Path) -> dict[str, dict[str, object]]:
    route_rows: dict[str, list[dict[str, str]]] = defaultdict(list)
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            route_number = row["route_short_name"].strip()
            if route_number in TARGET_ROUTE_NUMBERS:
                route_rows[route_number].append(row)

    routes = {}
    for route_number, rows in route_rows.items():
        chosen = rows[0]
        routes[route_number] = {
            "route_ids": [row["route_id"].strip() for row in rows],
            "route_long_name": chosen["route_long_name"].strip(),
            "route_color": normalize_color(chosen.get("route_color")),
            "text_color": normalize_color(chosen.get("route_text_color"), "#ffffff"),
        }
    return routes


def load_trips(
    path: Path,
    routes: dict[str, dict[str, object]],
) -> tuple[dict[str, dict[str, object]], dict[tuple[str, int, str], dict[str, int]], dict[tuple[str, int], Counter]]:
    route_id_to_number = {
        route_id: route_number
        for route_number, route_info in routes.items()
        for route_id in route_info["route_ids"]
    }
    trips: dict[str, dict[str, object]] = {}
    shape_trip_counts: dict[tuple[str, int, str], dict[str, int]] = {}
    headsign_counts: dict[tuple[str, int], Counter] = defaultdict(Counter)

    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            route_id = row["route_id"].strip()
            if route_id not in route_id_to_number:
                continue

            route_number = route_id_to_number[route_id]
            trip_id = row["trip_id"].strip()
            direction_id = int(row["direction_id"] or 0)
            shape_id = row["shape_id"].strip()
            headsign = (row.get("trip_headsign") or "").strip()

            trips[trip_id] = {
                "route_short_name": route_number,
                "direction_id": direction_id,
                "shape_id": shape_id,
            }
            group_key = (route_number, direction_id, shape_id)
            shape_trip_counts.setdefault(group_key, {"trip_count": 0})
            shape_trip_counts[group_key]["trip_count"] += 1
            if headsign:
                headsign_counts[(route_number, direction_id)][headsign] += 1

    return trips, shape_trip_counts, headsign_counts


def choose_representative_shapes(
    path: Path,
    shape_trip_counts: dict[tuple[str, int, str], dict[str, int]],
) -> dict[str, dict[int, dict[str, object]]]:
    relevant_shape_ids = {shape_id for _, _, shape_id in shape_trip_counts}
    shape_points: dict[str, list[tuple[int, float, float]]] = defaultdict(list)

    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            shape_id = row["shape_id"].strip()
            if shape_id not in relevant_shape_ids:
                continue
            shape_points[shape_id].append(
                (
                    int(row["shape_pt_sequence"]),
                    float(row["shape_pt_lon"]),
                    float(row["shape_pt_lat"]),
                )
            )

    shape_metrics = {}
    for shape_id, points in shape_points.items():
        sorted_points = sorted(points)
        coords = [[round(lon, 6), round(lat, 6)] for _, lon, lat in sorted_points]
        shape_metrics[shape_id] = {
            "coordinates": coords,
            "point_count": len(coords),
            "length_km": polyline_length_km(coords),
        }

    representatives: dict[str, dict[int, dict[str, object]]] = defaultdict(dict)
    for (route_number, direction_id, shape_id), trip_meta in shape_trip_counts.items():
        metrics = shape_metrics.get(shape_id)
        if not metrics:
            continue
        candidate = {
            "shape_id": shape_id,
            "trip_count": trip_meta["trip_count"],
            "coordinates": metrics["coordinates"],
            "point_count": metrics["point_count"],
            "length_km": metrics["length_km"],
        }
        current = representatives[route_number].get(direction_id)
        if current is None or compare_shape_candidates(candidate, current) > 0:
            representatives[route_number][direction_id] = candidate
    return representatives


def load_stop_relationships(
    gtfs_dir: Path,
    trips: dict[str, dict[str, object]],
) -> tuple[dict[str, set[str]], dict[str, set[str]], dict[tuple[str, int], set[str]]]:
    stop_map: dict[str, set[str]] = defaultdict(set)
    route_stop_ids: dict[str, set[str]] = defaultdict(set)
    direction_stop_ids: dict[tuple[str, int], set[str]] = defaultdict(set)

    stop_times_path = gtfs_dir / "stop_times.txt"
    with stop_times_path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            trip_id = row["trip_id"].strip()
            trip = trips.get(trip_id)
            if trip is None:
                continue

            stop_id = row["stop_id"].strip()
            route_number = str(trip["route_short_name"])
            direction_id = int(trip["direction_id"])
            stop_map[stop_id].add(route_number)
            route_stop_ids[route_number].add(stop_id)
            direction_stop_ids[(route_number, direction_id)].add(stop_id)

    return stop_map, route_stop_ids, direction_stop_ids


def load_stops(path: Path, stop_ids: set[str]) -> dict[str, dict[str, object]]:
    stops = {}
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            stop_id = row["stop_id"].strip()
            if stop_id not in stop_ids:
                continue
            stops[stop_id] = {
                "stop_id": stop_id,
                "stop_code": row.get("stop_code", "").strip(),
                "stop_name": row["stop_name"].strip(),
                "stop_lat": round(float(row["stop_lat"]), 6),
                "stop_lon": round(float(row["stop_lon"]), 6),
            }
    return stops


def assign_display_colors(routes: dict[str, dict[str, object]]) -> dict[str, str]:
    base_colors = [str(routes[route]["route_color"]) for route in sorted(routes)]
    duplicate_base_color = any(base_colors.count(color) > 1 for color in base_colors if color)

    assigned = {}
    for index, route_number in enumerate(sorted(routes)):
        route_color = str(routes[route_number]["route_color"])
        assigned[route_number] = (
            FALLBACK_COLORS[index % len(FALLBACK_COLORS)]
            if duplicate_base_color or not route_color
            else route_color
        )
    return assigned


def summarize_headsigns(counter: Counter) -> str:
    if not counter:
        return ""
    ordered = [headsign for headsign, _ in counter.most_common(2)]
    return " / ".join(ordered)


def line_midpoint(coords: list[list[float]]) -> list[float]:
    if len(coords) == 1:
        return coords[0]

    lengths = []
    total = 0.0
    for start, end in zip(coords, coords[1:]):
        segment = haversine_km(start[1], start[0], end[1], end[0])
        lengths.append(segment)
        total += segment

    halfway = total / 2
    walked = 0.0
    for index, segment in enumerate(lengths):
        if walked + segment >= halfway and segment:
            ratio = (halfway - walked) / segment
            start = coords[index]
            end = coords[index + 1]
            return [
                round(start[0] + (end[0] - start[0]) * ratio, 6),
                round(start[1] + (end[1] - start[1]) * ratio, 6),
            ]
        walked += segment
    return coords[len(coords) // 2]


def shape_bounds(coords: list[list[float]]) -> dict[str, float]:
    lons = [coord[0] for coord in coords]
    lats = [coord[1] for coord in coords]
    return {
        "min_lon": round(min(lons), 6),
        "max_lon": round(max(lons), 6),
        "min_lat": round(min(lats), 6),
        "max_lat": round(max(lats), 6),
    }


def polyline_length_km(coords: list[list[float]]) -> float:
    total = 0.0
    for start, end in zip(coords, coords[1:]):
        total += haversine_km(start[1], start[0], end[1], end[0])
    return total


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius_km * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def compare_shape_candidates(candidate: dict[str, object], current: dict[str, object]) -> int:
    candidate_key = (candidate["trip_count"], candidate["length_km"], candidate["point_count"])
    current_key = (current["trip_count"], current["length_km"], current["point_count"])
    if candidate_key > current_key:
        return 1
    if candidate_key < current_key:
        return -1
    return 0


def normalize_color(value: str | None, fallback: str = "#ffffff") -> str:
    cleaned = (value or "").strip().lstrip("#")
    if len(cleaned) != 6:
        return fallback
    return f"#{cleaned.lower()}"


def write_json(path: Path, payload: object) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, separators=(",", ":"), ensure_ascii=True)


if __name__ == "__main__":
    raise SystemExit(main())
