# Garage Door Overlay for Android

A small Android app that polls the garage monitor's cached `/status` JSON every 15 seconds. It runs as a user-enabled `specialUse` foreground service and shows a draggable `TYPE_APPLICATION_OVERLAY` bubble while the door is OPEN and the phone is unlocked.

If the local monitor becomes unreachable, a recent signed push state remains authoritative for up to 24 hours. This means a remote CLOSED push can remove the overlay after the phone leaves Wi-Fi. Without a recent remote state, an uncertain result after OPEN still changes the bubble to amber **CHECK** until CLOSED is confirmed.

Long-press the bubble to dismiss it for the current open/check episode. It remains dismissed until the PC monitor confirms CLOSED and a later OPEN begins a new episode. The app's **Stop overlay** and **Start overlay** controls disable or enable floating bubbles independently of background monitoring.

The included compact home-screen status widget can be resized down to one cell. It displays **OPEN** in green, **CLOSED** in red, **CHECK** in amber for an uncertain result, and **OFFLINE** in grey when Android monitoring is stopped or the PC monitor cannot be reached. Tapping it opens the app.

An optional **Wake locked screen when door opens** setting launches a black, burn-in-conscious alert screen with a slowly bouncing DOOR OPEN button when OPEN is detected while the phone is locked or the display is off. It uses a short wake lock and the permitted overlay launch path before immediately removing the ordinary bubble as the black activity starts. If Android delays the first launch, the monitor retries on its next poll until the alert is active. The activity wakes and stays on until CLOSED, Home/Overview dismissal, tapping the moving button, or manually turning the display off. Manual dismissal or screen-off suppresses relaunch for that same OPEN event. Android can show the activity over a secure lock screen but still requires the configured fingerprint, PIN, or pattern before actually unlocking the device.

The separate **Turn screen off when door closes** option requests Android's narrowly scoped device-admin `force-lock` permission. When enabled, the app switches the display off immediately after CLOSED is confirmed, but only if the bouncing alert is still active. It does not lock after the alert was dismissed or the screen was manually switched off. Android may require strong authentication on the next unlock after a device-admin lock. Disable the device administrator in Android settings before uninstalling the app.

## Build

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
.\gradlew.bat test assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`

## First-time Pixel setup

1. Install and open the app while connected to the home Wi-Fi.
2. Confirm the monitor address. It defaults to `http://192.168.1.119:8765` and is editable. Copy the access token from the PC-only setup information.
3. Tap **Allow floating overlay** and enable the permission.
4. Tap **Start monitoring** and allow notifications.
5. Open **Pixel app battery settings**, choose **App battery usage**, enable background usage, and select **Unrestricted**.
6. Turn off **Pause app activity if unused** for this app if that Pixel option is enabled.
7. Optionally add **Garage Door status** from the launcher's widget picker.

The ongoing low-priority notification is required for the foreground service. The service returns `START_STICKY` and registers for boot/package-replaced events, but a force-stop always requires manually opening the app again.

## Drein Alerts pairing

Open `/alerts.html` while signed into the private site, create a one-use pairing, then scan its QR code with the phone or enter the six-digit code in the app. No long secret needs to be typed. The same page controls, independently for every paired phone, whether it receives garage, NRL, NRLW, Pokémon, and system alerts.

The QR token expires after ten minutes and can be claimed only once. On a successful claim the broker issues a separate revocable device credential, stored in Android app-private preferences. Active alerts are restored when the app opens or the phone reboots.

## Push recovery

Firebase Cloud Messaging is the recovery path. The legacy route registers each phone directly with the monitor PC after **Start monitoring**. The generic broker route is paired through the site and provides per-phone category switches, durable retries, persistent alerts with explicit Dismiss actions, and remote CLOSED-state recovery. During migration both routes may be enabled; the generic route uses stable IDs so repeated revisions replace the existing alert.

The Android Firebase config belongs at `app/google-services.json` and is ignored by git. The app must be opened once after installation, notifications must be allowed, and the PC and phone must both have internet access. Android force-stop disables push delivery until the app is opened manually.

The overlay is above ordinary app windows but Android may represent it as a notification while the secure lock screen is active. Notification visibility depends on the phone's lock-screen notification settings.
