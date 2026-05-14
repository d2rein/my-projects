@echo off
setlocal

cd /d "%~dp0"
set "PY311=%~dp0..\memes_v2_clip311\Scripts\python.exe"

if not exist "%PY311%" (
  echo Python 3.11 test environment not found:
  echo   %PY311%
  pause
  exit /b 1
)

echo [1/2] Catching up memes_v2 from Immich since 2026-01-01...
"%PY311%" -u sync_memes_from_immich.py --since 2026-01-01
if errorlevel 1 (
  echo memes_v2 catch-up failed.
  pause
  exit /b 1
)

echo [2/2] Pushing site updates...
call "..\push.bat"
