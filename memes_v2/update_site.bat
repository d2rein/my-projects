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

echo [1/2] Syncing memes_v2 from Immich...
"%PY311%" -u sync_memes_from_immich.py
if errorlevel 1 (
  echo memes_v2 sync failed.
  pause
  exit /b 1
)

echo [2/2] Publishing standalone memes_v2 live...
call "%~dp0publish_live.bat"
exit /b %errorlevel%
