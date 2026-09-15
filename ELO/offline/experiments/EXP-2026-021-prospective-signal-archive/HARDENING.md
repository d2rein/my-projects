# Collector hardening status

Updated: 15 September 2026. This collector is isolated from RLDB's database,
updater, supervisor and health criteria.

## Storage finding

The initial 11.1 MB was not one normal day's steady-state volume. It included
two daily captures, two deliberate offseason test captures and numerous
zero-network pregame checks. HTML accounted for 10.8 MB.

One representative daily raw payload was 2,673,231 bytes. Deterministic gzip
would store it in 394,090 bytes, an 85.3% reduction. Future raw responses are
now stored as `.gz`, retaining hashes of both the original response and stored
gzip member. Existing raw evidence was not rewritten or deleted.

A live-format offseason verification stored its two 1.39 MB Sportsbet pages in
approximately 256 KB each and still parsed all 11 futures observations.

## Active code-level protections

- Shared mutex prevents daily and pregame append operations overlapping.
- Per-run directories preserve raw evidence and normalized outputs.
- Atomic heartbeat and schedule-state writes.
- Service log records wrapper output and exit code.
- Startup catch-up and the ordinary trigger cannot create two successful daily
  collections on the same Brisbane date.
- Pregame captures remain fixture-idempotent and make zero requests outside the
  45-75 minute window.
- Offseason lifecycle is enforced before network access.
- Each remote source fails independently and records its error.
- Official team lists are content-hashed. The local change log and API table
  retain changed lists without duplicating identical daily observations.
- The API rejects unauthenticated writes, validates NRL source URLs and squad
  sizes, caps payloads, and cannot call rating or parameter mutations.

The existing Windows tasks now route through the hardened wrapper and a manual
task invocation was verified under `DESKTOP-ASRAPT8\d2rei` with exit code zero.
Heartbeat: `data/service/heartbeat.json`; log: `data/service/service.log`.

## Windows tasks

The administrator installer was run on 15 September 2026. Both task definitions
now report `Ready`, use the non-interactive S4U principal, include startup
catch-up triggers, and retain retries and overlap protection.

[`../../install_prospective_collection_tasks.ps1`](../../install_prospective_collection_tasks.ps1)
is the idempotent installer. Re-running it from an Administrator PowerShell
keeps both tasks on the same user's non-interactive S4U identity,
adds startup triggers, enables `StartWhenAvailable`, permits battery operation,
sets two five-minute retries, ignores overlapping instances and imposes a
ten-minute execution limit. It does not touch RLDB.

Command from an Administrator PowerShell:

`powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Users\d2rei\My_Site\ELO\offline\install_prospective_collection_tasks.ps1`

After any reinstall, verify that both principals report `S4U` and test the
pregame task. The task's own heartbeat should report account
`DESKTOP-ASRAPT8\d2rei` and status `success`.
