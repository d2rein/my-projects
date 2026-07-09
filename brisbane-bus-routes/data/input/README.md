# GTFS Input

Place the latest Translink GTFS zip in this folder as either:

- `SEQ_GTFS.zip`
- or the original `mdb-*.zip` filename

The build script will prefer:

1. `data/input/SEQ_GTFS/`
2. `data/input/SEQ_GTFS.zip`
3. the newest `data/input/mdb-*` folder
4. the newest `data/input/mdb-*.zip`

Updating to a new feed is as simple as replacing `SEQ_GTFS.zip` or dropping in the latest `mdb-*.zip`, then running:

```bash
python scripts/build_bus_data.py
```
