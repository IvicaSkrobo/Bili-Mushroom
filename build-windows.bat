@echo off
REM ============================================================
REM  Bili Mushroom — Windows Installer Builder
REM  Run this on your Windows machine to produce the .exe
REM ============================================================
REM
REM  REQUIREMENTS (first time only):
REM    1. Rust:   https://rustup.rs
REM    2. Node:   https://nodejs.org  (v18 or v20)
REM    3. WebView2 is already on Win10/11 — nothing extra needed
REM
REM  OUTPUT:
REM    src-tauri\target\release\bundle\nsis\
REM      Bili-Mushroom_0.x.x_x64-setup.exe   ← share this file
REM
REM ============================================================

echo.
echo  Bili Mushroom — Building Windows installer...
echo.

REM Install / update frontend dependencies
call npm ci
if %errorlevel% neq 0 (
    echo [ERROR] npm ci failed. Make sure Node.js is installed.
    pause
    exit /b 1
)

REM Build the Tauri app + NSIS installer
call npm run tauri build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed. Check the output above for details.
    echo Common fixes:
    echo   - Make sure Rust is installed: https://rustup.rs
    echo   - Run: rustup update stable
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  BUILD SUCCESSFUL!
echo.
echo  Installer location:
echo  src-tauri\target\release\bundle\nsis\
echo.
echo  Share the file ending in _x64-setup.exe with your users.
echo ============================================================
echo.
pause
