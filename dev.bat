@echo off
title Vaultr Native Development Launcher
cd /d "%~dp0"

echo ===================================================
echo           VAULTR NATIVE (v2) LAUNCHER
echo ===================================================
echo [INFO] Launching native Tauri 2.0 desktop window...
echo.

call npx @tauri-apps/cli dev

echo.
pause
