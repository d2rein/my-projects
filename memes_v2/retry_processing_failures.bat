@echo off
setlocal
cd /d "%~dp0"

python sync_memes_from_immich.py --since 2026-01-01 --skip-caption --exact-name received_2720078301712077.jpg --stop-after-imports 1
if errorlevel 1 exit /b 1

python sync_memes_from_immich.py --since 2026-01-01 --skip-caption --exact-name received_1665554351530142.jpg --stop-after-imports 1
if errorlevel 1 exit /b 1

python sync_memes_from_immich.py --since 2026-01-01 --skip-caption --exact-name received_3211903915647038.jpg --stop-after-imports 1
if errorlevel 1 exit /b 1

python sync_memes_from_immich.py --since 2026-01-01 --skip-caption --exact-name received_26052893961079891.jpg --stop-after-imports 1
if errorlevel 1 exit /b 1

echo Retry run complete.
pause
