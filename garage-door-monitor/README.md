# Garage door monitor

A local, lightweight RTSP monitor for a Tapo C210. It classifies a fixed camera view as `OPEN`, `CLOSED`, or `UNKNOWN` using contrast-normalized edge structure inside selected regions. It does not use cloud services, a browser process, or an ML model.

Sampling is adaptive: 60 seconds while CLOSED, then 10 seconds from the first possible transition until CLOSED is confidently restored. Camera/feed ambiguity does not cancel the faster mode after an OPEN observation.

## Run

The existing `.env` contains the local camera credentials and is excluded from git.

```powershell
cd C:\Users\d2rei\My_Site\garage-door-monitor
.\run.ps1
```

Then visit `http://127.0.0.1:8765/setup` when calibration is needed. The service itself does not launch a browser.

Endpoints:

- `GET /status` returns the debounced state and diagnostics.
- `GET /snapshot` returns the latest annotated frame.
- `GET /snapshot?raw=1` returns the raw frame used by the setup page.
- `GET /setup` provides ROI and reference capture controls.
- `POST /api/sample` requests an immediate sample.
- `POST /api/confirm` automatically takes up to three fresh samples to satisfy hysteresis during manual setup.

## Calibration

Both reference classes are required before the monitor will report OPEN or CLOSED. Capture several examples of each state, ideally in daylight, garage lighting, darkness, and IR night mode. A result remains UNKNOWN unless the winning class clears the configured similarity and margin thresholds and the selected regions agree.

The setup page's **Confirm current state** button performs the required consecutive captures automatically. Normal unattended transitions still require three minute-by-minute observations.

After moving the camera, clear the old references, redraw the regions, and capture both classes again. Keep the C210's motion tracking disabled once calibration is complete.

## Background startup

Install the included per-user Windows sign-in task:

```powershell
.\install-startup.ps1
```

Remove it with `./uninstall-startup.ps1`. The task uses `pythonw.exe`, so it does not open a console or browser window, and restarts the monitor if it exits unexpectedly. Binding defaults to `127.0.0.1`; set `MONITOR_HOST=0.0.0.0` when the phone client needs LAN access. When LAN-bound, only bearer-token-authenticated `/status` and `/health` requests accept non-loopback clients; setup controls and camera snapshots remain PC-only. The PC-only `/api/client-config` endpoint provides the phone address and token during setup.

The administrator-run `enable-lan-access.ps1` creates a Private-profile, LocalSubnet-only firewall rule for TCP 8765 and `pythonw.exe`. `disable-lan-access.ps1` removes that rule.

## Tests and one-shot diagnosis

```powershell
python -m unittest discover -s tests -v
python garage_monitor.py --once
```

Logs rotate at 512 KB and retain two backups under `logs/`.

## Phone push notifications

The monitor sends high-priority Firebase data pushes after confirmed OPEN/CLOSED transitions and repeats OPEN reminders every ten minutes. Phones register through the bearer-token-protected `/api/push/register` endpoint. The PC-only `/api/push/status` and `/api/push/test` endpoints report configuration and queue a safe test notification.

Place exactly one Firebase service-account JSON in `%LOCALAPPDATA%\GarageDoorMonitor`. The credential never needs to be copied into this project. The local `vendor` directory must contain `google-auth` and its dependencies; restore them with:

```powershell
python -m pip install --target vendor google-auth==2.41.1
```

Confirmed OPEN/CLOSED transitions are also appended indefinitely to `data/state-history.csv`. This history is separate from rotating diagnostic logs, ignores UNKNOWN results, suppresses duplicates across restarts, and is shown newest-first on the PC-only setup page. `GET /api/history?limit=100` is available only from the monitor PC.

The monitor can additionally publish those confirmed transitions to the generic Drein Alerts broker. Set these values in the ignored `.env` file:

```text
ALERT_BROKER_URL=https://personal-alerts.d2-rein.workers.dev
ALERT_GARAGE_KEY=<the garage-only producer key>
```

The broker path retries a failed state on later observations. OPEN creates the persistent `garage:main` alert and CLOSED resolves it. The original direct-Firebase path remains available as a migration fallback.

## Motion recordings

The monitor also runs a local motion recorder and saves high-quality video directly
from the C210 without re-encoding the saved footage. FFmpeg decodes a small,
320 x 180 grayscale feed at three frames per second for motion detection.
The camera must remain in a fixed position; lighting changes can trigger clips.

Open `http://127.0.0.1:8765/setup` on the PC and find **Motion recordings**.
Each completed clip has **Play**, **Keep**, and **Download** controls.
Clips are PC-only; the Android status overlay does not display recordings.

Default storage is `D:\GarageRecordings`:

- `temporary`: motion clips; automatic expiry after three days, with a 20 GiB cap.
- `kept`: clips protected using Keep; excluded from expiry and the temporary cap.
- `buffer`: short rolling scratch footage used to include the beginning of movement.

The recorder includes approximately five seconds before motion and fifteen seconds
after it ends, with a few extra seconds possible at camera keyframe boundaries.
Long events are split at approximately five minutes. Audio is not recorded.
The short buffer is continuously written even when no motion clips are saved.

The PC must remain awake and the recording drive must remain connected.
Below 512 MiB of free space, recording pauses. Camera/storage failures are shown
on the page and retried every fifteen seconds. Keep clips can fill the drive;
they are never removed automatically. `RECORDING_DIRECTORY` in `.env` can override
the destination. The recorder starts with the existing sign-in task.

FFmpeg is provided by the local `vendor/imageio_ffmpeg` dependency. To restore it:

```powershell
python -m pip install --target vendor imageio-ffmpeg==0.6.0
```
