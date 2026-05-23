@echo off
REM ============================================================
REM   Alpha Dashboard — Auto-start script
REM ============================================================
REM   - Builds the app (only if .next folder is missing)
REM   - Starts production server on port 3000
REM   - Auto-restarts if it crashes
REM
REM   Usage:
REM     - Double-click to run manually
REM     - Or add to Windows Task Scheduler "At log on"
REM ============================================================

cd /d "%~dp0"

REM Ensure Node.js is on PATH (winget install path)
set "PATH=%LOCALAPPDATA%\Microsoft\WinGet\Packages;%ProgramFiles%\nodejs;%PATH%"

REM Detect missing build and run npm install + build first time
if not exist "node_modules\" (
    echo [Alpha] node_modules not found - running npm install...
    call npm install
)

if not exist ".next\" (
    echo [Alpha] No production build found - building...
    call npm run build
)

REM Loop: restart on crash
:start_loop
echo.
echo ============================================================
echo  Alpha Dashboard starting on http://localhost:3000
echo  Press Ctrl+C to stop
echo ============================================================
echo.

call npm start

echo.
echo [Alpha] Server stopped (exit code %errorlevel%) - restarting in 5s...
timeout /t 5 /nobreak >nul
goto start_loop
