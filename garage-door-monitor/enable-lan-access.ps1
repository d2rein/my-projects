$ErrorActionPreference = 'Stop'
$ruleName = 'Garage Door Monitor LAN Status'
$program = 'C:\Users\d2rei\AppData\Local\Programs\Python\Python311\pythonw.exe'

$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Remove-NetFirewallRule -DisplayName $ruleName
}

New-NetFirewallRule `
    -DisplayName $ruleName `
    -Description 'Bearer-token-authenticated garage status; private local subnet only.' `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort 8765 `
    -Profile Private `
    -RemoteAddress LocalSubnet `
    -Program $program | Out-Null

Write-Output "Enabled private-LAN garage status access."

