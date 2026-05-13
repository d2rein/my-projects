@echo off
setlocal

cd /d "%~dp0"

echo [1/2] Syncing memes_v2 from Immich...
python -u sync_memes_from_immich.py
if errorlevel 1 (
  echo memes_v2 sync failed.
  pause
  exit /b 1
)

echo [2/2] Pushing site updates...
call "..\push.bat"
