$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonw = 'C:\Users\d2rei\AppData\Local\Programs\Python\Python311\pythonw.exe'
$taskName = 'Pokemon Postcard Receiver'
$scriptPath = Join-Path $projectDirectory 'postcard_receiver.py'
$action = New-ScheduledTaskAction -Execute $pythonw -Argument ('"' + $scriptPath + '"') -WorkingDirectory $projectDirectory
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Receives manually captured Pokemon GO postcards over the private LAN.' -Force | Out-Null
Write-Output "Installed scheduled task: $taskName"
