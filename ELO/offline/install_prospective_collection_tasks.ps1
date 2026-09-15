$ErrorActionPreference = 'Stop'

$wrapper = 'C:\Users\d2rei\My_Site\ELO\offline\run_prospective_collection_service.ps1'
$powershell = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
$user = "$env:COMPUTERNAME\d2rei"
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

$dailyAction = New-ScheduledTaskAction -Execute $powershell -Argument (
    "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$wrapper`" -Mode daily"
)
$dailyTriggers = @(
    (New-ScheduledTaskTrigger -Daily -At ([datetime]'09:05')),
    (New-ScheduledTaskTrigger -AtStartup -RandomDelay (New-TimeSpan -Minutes 2))
)
Register-ScheduledTask -TaskName 'NRL ELO Prospective Daily' -Action $dailyAction `
    -Trigger $dailyTriggers -Principal $principal -Settings $settings -Force `
    -Description 'Independent prospective NRL market/tip/futures archive. Daily in-season; wrapper reduces to Monday weekly in the offseason.' | Out-Null

$pregameAction = New-ScheduledTaskAction -Execute $powershell -Argument (
    "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$wrapper`" -Mode pregame"
)
$pregameStart = (Get-Date).AddMinutes(2)
$pregameTriggers = @(
    (New-ScheduledTaskTrigger -Once -At $pregameStart -RepetitionInterval (New-TimeSpan -Minutes 30) -RepetitionDuration (New-TimeSpan -Days 3650)),
    (New-ScheduledTaskTrigger -AtStartup -RandomDelay (New-TimeSpan -Minutes 3))
)
Register-ScheduledTask -TaskName 'NRL ELO Prospective Pregame' -Action $pregameAction `
    -Trigger $pregameTriggers -Principal $principal -Settings $settings -Force `
    -Description 'Independent near-kickoff NRL market archive. Eligibility is checked locally; network is used only 45-75 minutes before an uncaptured match.' | Out-Null

Get-ScheduledTask -TaskName 'NRL ELO Prospective Daily','NRL ELO Prospective Pregame'
