param(
    [ValidateSet('daily', 'pregame', 'offseason')]
    [string]$Mode = 'daily'
)

$ErrorActionPreference = 'Stop'

# This is an isolated companion to RLDB. It never opens or modifies rldb.sqlite.
# Its only remote write is a validated team-list snapshot upload to the Elo
# API's separate prospective table; it cannot invoke model recalculation.
$python = 'C:\Users\d2rei\AppData\Local\Programs\Python\Python311\python.exe'
$collector = 'C:\Users\d2rei\My_Site\ELO\offline\prospective_signal_collector.py'
$archiveRoot = 'C:\Users\d2rei\My_Site\ELO\offline\experiments\EXP-2026-021-prospective-signal-archive\data'
$serviceState = Join-Path $archiveRoot 'service'
$heartbeat = Join-Path $serviceState 'heartbeat.json'
$logPath = Join-Path $serviceState 'service.log'
$scheduleState = Join-Path $serviceState 'schedule_state.json'
$teamListApiUrl = 'https://nrl-elo-api.d2-rein.workers.dev'
$teamListTokenFile = Join-Path $serviceState 'team_list_upload_token.txt'
$mutex = [Threading.Mutex]::new($false, 'Local\NRLEloProspectiveSignals')
$hasMutex = $false

function Write-JsonAtomic([string]$Path, [object]$Value) {
    $temporary = "$Path.tmp"
    $Value | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $temporary -Encoding UTF8
    Move-Item -LiteralPath $temporary -Destination $Path -Force
}

function Write-Heartbeat([string]$Status, [string]$EffectiveMode, [int]$ExitCode, [string]$Message) {
    Write-JsonAtomic $heartbeat ([ordered]@{
        observed_at_utc = [datetime]::UtcNow.ToString('o')
        requested_mode = $Mode
        effective_mode = $EffectiveMode
        status = $Status
        exit_code = $ExitCode
        message = $Message
        machine = $env:COMPUTERNAME
        account = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    })
}

try {
    New-Item -ItemType Directory -Path $serviceState -Force | Out-Null
    $hasMutex = $mutex.WaitOne(0)
    if (-not $hasMutex) {
        Write-Heartbeat 'skipped_overlap' $Mode 0 'Another collector process holds the mutex.'
        exit 0
    }

    $today = (Get-Date).Date
    $grandFinal2026 = [datetime]'2026-10-04'
    $isOffseason = ($today -gt $grandFinal2026 -and $today -lt [datetime]'2027-03-01') -or
                   ($today.Year -gt 2026 -and ($today.Month -in @(11, 12, 1, 2)))
    $effectiveMode = $Mode

    if ($isOffseason) {
        if ($Mode -eq 'pregame') {
            Write-Heartbeat 'skipped_offseason' 'pregame' 0 'Pregame collection is disabled in the offseason.'
            exit 0
        }
        if ($Mode -eq 'daily' -and $today.DayOfWeek -ne [DayOfWeek]::Monday) {
            Write-Heartbeat 'skipped_offseason' 'offseason' 0 'Weekly offseason collection runs on Monday.'
            exit 0
        }
        $effectiveMode = 'offseason'
    }

    # A boot catch-up and the scheduled daily trigger can occur on the same
    # date. Run at most one daily/offseason collection per Brisbane date.
    $state = @{}
    if (Test-Path -LiteralPath $scheduleState) {
        try {
            $parsedState = Get-Content -LiteralPath $scheduleState -Raw | ConvertFrom-Json
            foreach ($property in $parsedState.PSObject.Properties) {
                $state[$property.Name] = $property.Value
            }
        }
        catch { $state = @{} }
    }
    $dateKey = $today.ToString('yyyy-MM-dd')
    $stateKey = if ($effectiveMode -eq 'offseason') { 'last_offseason_date' } else { 'last_daily_date' }
    if ($effectiveMode -ne 'pregame' -and $state[$stateKey] -eq $dateKey) {
        Write-Heartbeat 'skipped_already_collected' $effectiveMode 0 "A successful $effectiveMode run is already recorded for $dateKey."
        exit 0
    }

    $season = $today.Year
    $rounds = if ($season -eq 2026) { '28,29,30,31' } else { (1..31) -join ',' }
    $started = [datetime]::UtcNow.ToString('o')
    $collectorArgs = @('--archive-dir', $archiveRoot, '--mode', $effectiveMode, '--season', $season, '--rounds', $rounds)
    if (Test-Path -LiteralPath $teamListTokenFile) {
        $collectorArgs += @('--team-list-api-url', $teamListApiUrl,
                            '--team-list-api-token-file', $teamListTokenFile)
    }
    $output = & $python $collector @collectorArgs 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
    Add-Content -LiteralPath $logPath -Encoding UTF8 -Value ("[{0}] requested={1} effective={2} exit={3}`r`n{4}" -f $started,$Mode,$effectiveMode,$exitCode,$output.Trim())

    if ($exitCode -ne 0) {
        Write-Heartbeat 'failed' $effectiveMode $exitCode 'Collector returned a non-zero exit code.'
        exit $exitCode
    }
    if ($effectiveMode -ne 'pregame') {
        $state[$stateKey] = $dateKey
        Write-JsonAtomic $scheduleState $state
    }
    Write-Heartbeat 'success' $effectiveMode 0 'Collector completed.'
    exit 0
}
catch {
    try {
        New-Item -ItemType Directory -Path $serviceState -Force | Out-Null
        Add-Content -LiteralPath $logPath -Encoding UTF8 -Value ("[{0}] wrapper failure: {1}" -f [datetime]::UtcNow.ToString('o'), $_.Exception.ToString())
        Write-Heartbeat 'wrapper_failed' $Mode 1 $_.Exception.Message
    } catch {}
    exit 1
}
finally {
    if ($hasMutex) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
