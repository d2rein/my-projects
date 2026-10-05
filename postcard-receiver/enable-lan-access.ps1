$ErrorActionPreference = 'Stop'
$isAdministrator = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $isAdministrator) {
    Start-Process powershell.exe -Verb RunAs -ArgumentList @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', ('"' + $MyInvocation.MyCommand.Path + '"')
    ) -Wait
    exit
}
$ruleName = 'Pokemon Postcard Receiver LAN Upload'
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) { Remove-NetFirewallRule -DisplayName $ruleName }
New-NetFirewallRule -DisplayName $ruleName -Description 'Token-authenticated postcard uploads from the private local subnet.' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8766 -Profile Private -RemoteAddress LocalSubnet | Out-Null
Write-Output 'Enabled private-LAN postcard uploads on TCP 8766.'
