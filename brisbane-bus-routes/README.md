# Brisbane Bus Routes

Small static Leaflet app for visualising selected Brisbane bus routes from Translink GTFS data.

## Files

- `index.html` - static app shell
- `app.js` - Leaflet map and UI logic
- `styles.css` - responsive layout and route styling
- `scripts/build_bus_data.py` - GTFS preprocessing script
- `data/output/` - generated GeoJSON/JSON consumed by the app

## GTFS Setup

1. Download the latest South East Queensland GTFS zip from Translink.
2. Place it in `data/input/` as `SEQ_GTFS.zip`, or keep the original `mdb-*.zip` filename.
3. You can also extract it to `data/input/SEQ_GTFS/`.
4. The builder also accepts an explicit path to an already extracted GTFS folder:

```bash
python scripts/build_bus_data.py "C:\Users\d2rei\Downloads\mdb-3048-202607060141"
```

## Build Data

From this folder, run:

```bash
python scripts/build_bus_data.py
```

That will create:

- `data/output/routes.geojson`
- `data/output/stops.geojson`
- `data/output/stop_routes.json`
- `data/output/route_summary.json`

The script:

- filters the target routes `113, 172, 174, 175, 176, 177, 179, 182, 183, 185, 186, 598, 599`
- picks one representative shape per route and direction
- exports compact route and stop GeoJSON
- infers direction summaries from `trip_headsign`
- reports target routes missing from the current feed
- reads GTFS from the project-local `data/input/` folder by default

## Run Locally

From the repo root, serve the site with a simple static server:

```bash
python -m http.server
```

Then open:

```text
http://localhost:8000/brisbane-bus-routes/
```

## Notes

- The frontend uses `fetch()` to load local data, so opening `index.html` directly from the filesystem will not work reliably.
- If you instead `cd brisbane-bus-routes` before starting the server, open `http://localhost:8000/`.
- No backend or database is required for this version.
