@echo off
title Vaultr LAN Distribution Server
echo ===================================================
echo   Vaultr LAN Server - Mobile Sideload Service
echo ===================================================
echo.
for /f "tokens=4" %%a in ('route print ^| findstr 0.0.0.0.*0.0.0.0') do (
    set "LOCAL_IP=%%a"
    goto :found
)
:found
echo Local Device IP: %LOCAL_IP%
echo.
echo Phone Download URL: http://%LOCAL_IP%:8888/Vaultr.apk
echo.
echo Starting Python HTTP file server on port 8888...
echo Press Ctrl+C to stop the server.
echo.
python -m http.server 8888
pause
