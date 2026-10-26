$ErrorActionPreference = 'Stop'
$addressEntry = Get-NetIPAddress -IPAddress '192.168.1.119' -AddressFamily IPv4 -ErrorAction Stop
$profile = Get-NetConnectionProfile -InterfaceIndex $addressEntry.InterfaceIndex -ErrorAction Stop

if ($profile.NetworkCategory -ne 'Private') {
    Set-NetConnectionProfile -InterfaceIndex $addressEntry.InterfaceIndex -NetworkCategory Private
}

$verified = Get-NetConnectionProfile -InterfaceIndex $addressEntry.InterfaceIndex -ErrorAction Stop
if ($verified.NetworkCategory -ne 'Private') {
    throw "Network profile did not change to Private: $($verified.NetworkCategory)"
}

Write-Output 'Ethernet network profile is Private.'
