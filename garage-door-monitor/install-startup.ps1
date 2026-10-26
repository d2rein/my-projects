$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonw = 'C:\Users\d2rei\AppData\Local\Programs\Python\Python311\pythonw.exe'
if (-not (Test-Path -LiteralPath $pythonw)) {
    throw "pythonw.exe was not found at $pythonw"
}

$taskName = 'Garage Door Monitor'
$scriptPath = Join-Path $projectDirectory 'garage_monitor.py'
$action = New-ScheduledTaskAction -Execute $pythonw -Argument ('"' + $scriptPath + '"') -WorkingDirectory $projectDirectory
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
$description = 'Local Tapo RTSP garage-door status monitor. No browser or cloud service.'

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description $description -Force | Out-Null
Write-Output "Installed scheduled task: $taskName"

