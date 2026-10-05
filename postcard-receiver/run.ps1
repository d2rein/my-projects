$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = 'C:\Users\d2rei\AppData\Local\Programs\Python\Python311\python.exe'
Set-Location -LiteralPath $projectDirectory
& $python '.\postcard_receiver.py'
