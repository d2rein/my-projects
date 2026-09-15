param(
    [ValidateSet('daily', 'pregame', 'offseason', 'manual')]
    [string]$Mode = 'manual'
)

$ErrorActionPreference = 'Stop'
$offlineRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$archiveRoot = Join-Path $offlineRoot 'experiments\EXP-2026-021-prospective-signal-archive\data'
$collector = Join-Path $offlineRoot 'prospective_signal_collector.py'

# Scheduled modes route through the hardened wrapper immediately, even before
# the Windows task definitions are upgraded to non-interactive S4U operation.
if ($Mode -ne 'manual') {
    $serviceWrapper = Join-Path $offlineRoot 'run_prospective_collection_service.ps1'
    & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $serviceWrapper -Mode $Mode
    exit $LASTEXITCODE
}

# Lifecycle policy:
# - collect daily/pregame through the confirmed 2026 Grand Final (4 October);
# - after the Grand Final, make one weekly offseason capture on Monday;
# - resume daily/pregame collection on 1 March for the new season.
# Future Grand Final cutoffs should be checked when each official draw appears.
$today = (Get-Date).Date
$grandFinal2026 = [datetime]'2026-10-04'
$isOffseason = ($today -gt $grandFinal2026 -and $today -lt [datetime]'2027-03-01') -or
               ($today.Year -gt 2026 -and ($today.Month -in @(11, 12, 1, 2)))

if ($isOffseason) {
    if ($Mode -eq 'pregame') {
        exit 0
    }
    if ($Mode -eq 'daily' -and $today.DayOfWeek -ne [DayOfWeek]::Monday) {
        exit 0
    }
    $Mode = 'offseason'
}

$season = $today.Year
$rounds = if ($season -eq 2026) { '28,29,30,31' } else { (1..31) -join ',' }

& python $collector --archive-dir $archiveRoot --mode $Mode --season $season --rounds $rounds
exit $LASTEXITCODE
