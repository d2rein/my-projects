$ErrorActionPreference = 'Stop'
$taskName = 'Garage Door Monitor'
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Output "Removed scheduled task: $taskName"
} else {
    Write-Output "Scheduled task is not installed: $taskName"
}

