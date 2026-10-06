# Pokemon postcard receiver

Local, token-protected receiver for the Buddy Overlay's manually triggered postcard captures.

## Setup

1. Run `run.ps1` once. It creates a four-digit LAN PIN in `data/access-token.txt` and starts the receiver.
2. On the PC, open `http://127.0.0.1:8766/setup` and copy the URL and token into the Android app's Settings screen.
3. Run `enable-lan-access.ps1` as Administrator once to allow private-LAN uploads.
4. Optionally run `install-startup.ps1` in PowerShell to start the receiver at sign-in.

The phone queues each screenshot privately until the receiver accepts it. The receiver archives successful original screenshots under `data/processed`, stores cropped postcard photos under `../postcards/images`, and writes metadata under `../postcards/data/postcards.json`. Failed recognition is retained locally under `data/pending` for review and is excluded from deployment.

Every PIN-authenticated upload is first committed to `data/inbox` and acknowledged immediately. OCR and geocoding then run in the background; an unexpected failure is retained under `data/pending` and recorded in `logs/receiver.log` rather than losing the capture. After eight incorrect PIN attempts from one device, the receiver pauses further attempts from it for five minutes.

Open `http://127.0.0.1:8766/postcards/` on this PC to preview the current local map. The dashboard includes card, country, EU-country, US-state, and continent totals.

Open `http://127.0.0.1:8766/review` on this PC for the local manual-review console. Pending full screenshots can be corrected and approved, retried with the current OCR pipeline, or archived. Previously quarantined postcard crops can be corrected and restored or archived. Archive actions move metadata and originals under `data/discarded`; they do not permanently delete them. The review console is only served to the same PC and is never exposed on the public postcard site.

Tesseract is expected at `C:\Program Files\Tesseract-OCR\tesseract.exe`. OpenStreetMap Nominatim is queried conservatively and cached locally for text-to-coordinate lookup.

## Review and publish

Captures that cannot be confidently recognized or geocoded are written to `data/pending` and do not reach the map. Review them at `http://127.0.0.1:8766/review`. That folder is intentionally ignored by Git.

Successful captures update `../postcards/data/postcards.json` and add a WebP image under `../postcards/images`. Publish accepted batches through the repository's normal workflow: commit the postcard data/images, then run `../deploy_tracked_site.ps1`. This keeps `drein.net/postcards` reproducible rather than deploying an unreviewed OCR result automatically.
