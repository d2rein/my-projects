$ErrorActionPreference = 'Stop'
try {
    $addressEntry = Get-NetIPAddress -IPAddress '192.168.1.119' -AddressFamily IPv4 -ErrorAction Stop
    $profile = Get-NetConnectionProfile -InterfaceIndex $addressEntry.InterfaceIndex -ErrorAction Stop
    if ($profile.NetworkCategory -eq 'Private') { exit 0 }
    if ($profile.NetworkCategory -eq 'Public') { exit 20 }
    if ($profile.NetworkCategory -eq 'DomainAuthenticated') { exit 21 }
    exit 22
} catch {
    exit 1
}
