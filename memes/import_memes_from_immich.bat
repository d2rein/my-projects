@echo off
setlocal enabledelayedexpansion

REM === PATHS ===
set IMMICH=C:\Users\d2rei\Documents\immich\library\library\admin
set MEMES=%~dp0
set IMAGES=%MEMES%images
set INCOMING=%MEMES%incoming
set STAMP=%MEMES%.immich_last_run.stamp

if not exist "%INCOMING%" mkdir "%INCOMING%"

REM Create stamp on first run
if not exist "%STAMP%" (
  echo First run detected - importing all files
  echo x>"%STAMP%"
  powershell -Command "(Get-Item '%STAMP%').LastWriteTime = '01/01/2000'"
)

echo.
echo Scanning Immich for files newer than stamp...
echo Stamp: %STAMP%
echo.

for /r "%IMMICH%" %%F in (*.jpg *.jpeg *.png *.webp) do (
  for %%A in ("%%F") do (

    REM only files newer than STAMP
    xcopy /D /L "%%F" "%TEMP%\" >nul 2>&1
    if not errorlevel 1 (

      set NAME=%%~nxF

      REM filters
      if /i not "!NAME:~0,2!"=="20" (
        if /i not "!NAME:~0,10!"=="Screenshot" (
          if /i not "!NAME:~0,4!"=="PXL_" (
            if /i not "!NAME:~0,18!"=="Messenger_creation" (

              REM size filter: < 3MB
              if %%~zA LSS 3000000 (

                if not exist "%IMAGES%\!NAME!" (
                  if not exist "%INCOMING%\!NAME!" (

                    echo Importing !NAME!
                    copy "%%F" "%INCOMING%\!NAME!" >nul

                  )
                )

              )

            )
          )
        )
      )

    )

  )
)

REM update stamp to now
copy /b "%STAMP%" +,, >nul 2>&1

echo.
echo Done.
pause