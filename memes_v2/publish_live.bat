@echo off
setlocal

cd /d "%~dp0.."

echo [1/5] Staging memes_v2 changes...
git add -A .gitignore memes memes_v2
if errorlevel 1 (
  echo Failed to stage memes_v2 changes.
  pause
  exit /b 1
)

echo [2/5] Creating commit if needed...
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Update memes_v2"
  if errorlevel 1 (
    echo Commit failed.
    pause
    exit /b 1
  )
) else (
  echo No new memes_v2 changes to commit.
)

echo [3/5] Pushing to origin/main...
git push origin main
if errorlevel 1 (
  echo Push failed.
  pause
  exit /b 1
)

echo [4/5] Deploying Cloudflare Pages...
powershell -ExecutionPolicy Bypass -File "%~dp0publish_live.ps1"
if errorlevel 1 (
  echo Pages deploy failed.
  pause
  exit /b 1
)

echo [5/5] Opening live site...
start "" "https://my-projects-cqs.pages.dev/memes_v2/"

echo Done.
pause
