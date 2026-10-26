$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = 'C:\Users\d2rei\AppData\Local\Programs\Python\Python311\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
    $python = (Get-Command python -ErrorAction Stop).Source
}
Set-Location -LiteralPath $projectDirectory
& $python '.\garage_monitor.py'

