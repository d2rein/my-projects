$ErrorActionPreference = 'Stop'
$ruleName = 'Garage Door Monitor LAN Status'
$expectedProgram = 'C:\Users\d2rei\AppData\Local\Programs\Python\Python311\pythonw.exe'

$rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction Stop
$address = $rule | Get-NetFirewallAddressFilter
$port = $rule | Get-NetFirewallPortFilter
$application = $rule | Get-NetFirewallApplicationFilter

if ($rule.Enabled -ne 'True') { throw 'Firewall rule is not enabled.' }
if ($rule.Profile -ne 'Private') { throw "Unexpected profile: $($rule.Profile)" }
if ($rule.Direction -ne 'Inbound' -or $rule.Action -ne 'Allow') { throw 'Unexpected direction or action.' }
if ($address.RemoteAddress -notcontains 'LocalSubnet') { throw 'Remote address is not restricted to LocalSubnet.' }
if ($port.Protocol -ne 'TCP' -or $port.LocalPort -notcontains '8765') { throw 'Unexpected protocol or port.' }
if ($application.Program -ne $expectedProgram) { throw "Unexpected program: $($application.Program)" }

$addressEntry = Get-NetIPAddress -IPAddress '192.168.1.119' -AddressFamily IPv4 -ErrorAction Stop
$profile = Get-NetConnectionProfile -InterfaceIndex $addressEntry.InterfaceIndex -ErrorAction Stop
if ($profile.NetworkCategory -ne 'Private') { throw "Active network is not Private: $($profile.NetworkCategory)" }

Write-Output 'Firewall scope verified.'
