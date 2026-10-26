$ErrorActionPreference = 'Stop'
$ruleName = 'Garage Door Monitor LAN Status'
if (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue) {
    Remove-NetFirewallRule -DisplayName $ruleName
    Write-Output "Disabled private-LAN garage status access."
} else {
    Write-Output "Private-LAN garage status rule is not installed."
}

