# Buddy Excitement Overlay

Standalone Android overlay app for manually tracking Pokemon GO buddy excitement.

## What is included

- draggable collapsed bubble overlay
- expandable compact action grid
- separate cooldown tracking for each battle type
- persistent event log with undo and reset
- Room-backed local storage for events and settings
- reducer-style state reconstruction from absolute timestamps
- debug/preview screen that simulates elapsed time
- gameplay defaults in one file: `app/src/main/java/com/d2rei/buddyoverlay/BuddyGameplayDefaults.kt`

## Setup

1. Open `pogo-buddy-overlay` in Android Studio.
2. Let Gradle sync and install any Android SDK pieces it asks for.
3. Run the app to your phone.
4. Open the app once and grant `Display over other apps`.
5. Tap `Start overlay`.
6. Use `Settings` to tune EP values, cooldowns, decay interval, threshold, opacity, bubble size, vibration, and notifications.

## Postcard capture mode

The camera button in the expanded overlay switches to a red **SNAP** bubble. Tap SNAP over an open Pokemon GO postcard to capture and upload it; long-press SNAP to return to the buddy tracker. Android shows its standard screen-capture confirmation when a capture session begins and keeps a foreground notification visible while that session remains active.

The screenshot is encoded without entering the phone gallery. It is held temporarily in app-private storage until the desktop acknowledges it, then deleted. Failed uploads remain queued and are retried when the capture service next starts or another postcard is captured. SNAP returns as soon as the screenshot is captured; desktop OCR and geocoding continue asynchronously. **Return to buddy layout** in Settings is the recovery control if the SNAP bubble is unavailable.

After the desktop acknowledges a capture, the SNAP label becomes the number of captures received during the last hour. The count is persisted across service restarts, updates immediately after an acknowledgement, and returns to SNAP when no acknowledgements remain in the one-hour window. It confirms receipt and safe queueing only; OCR, duplicate detection, and geocoding may still be running on the desktop.

Desktop setup is documented in `../postcard-receiver/README.md`. Successful captures feed the clustered map in `../postcards/`.

## Notes

- This app does not read Pokemon GO, inject input, or automate gameplay.
- The icon set uses replaceable approximations wired through `BuddyActionVisuals.kt`.
- Replace the action art by swapping the drawable files in `app/src/main/res/drawable/`:
  `ic_buddy_swap.xml`, `ic_buddy_gift.xml`, `ic_buddy_care.xml`, `ic_buddy_route.xml`,
  `ic_buddy_walk.xml`, `ic_buddy_rocket.xml`, `ic_buddy_leader.xml`,
  `ic_buddy_gym_raid.xml`, and `ic_buddy_pvp.xml`.
- The quickest way to replace one is Android Studio: right-click `res/drawable` -> `New` -> `Vector Asset`,
  or just drop in a same-named PNG/XML drawable and overwrite the placeholder wrapper file.
- The default gameplay constants are intentionally configurable because the live buddy rules can change over time.
