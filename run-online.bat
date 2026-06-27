@echo off
chcp 65001 >nul
title Firas AI - Online Launcher
cd /d "C:\Users\STRIX\Desktop\FirasAI"

echo ============================================
echo   Firas AI - Putting your site online
echo ============================================
echo.
echo [1/2] Starting the server (auto-restarts if it stops)...
start "Firas AI Server (keep open)" cmd /k "cd /d %~dp0 & :loop & node server.mjs & echo Server stopped - restarting in 3s... & timeout /t 3 >nul & goto loop"

echo [2/2] Waiting for the server, then opening the public tunnel...
timeout /t 4 >nul
start "Cloudflare Tunnel - YOUR PUBLIC LINK" cmd /k "cd /d %~dp0 & :loop & cloudflared.exe tunnel --url http://localhost:3000 --no-autoupdate & echo Tunnel stopped - reconnecting in 3s (the link may change)... & timeout /t 3 >nul & goto loop"

echo.
echo ============================================
echo   DONE. Two windows just opened:
echo     1) Firas AI Server     - keep it open
echo     2) Cloudflare Tunnel   - your PUBLIC LINK is shown there
echo.
echo   In window (2) look for the box with your link:
echo       https://something-random.trycloudflare.com
echo.
echo   Both windows AUTO-RESTART if they stop. If the tunnel
echo   reconnects, the link may change - just copy the new one
echo   from window (2).
echo.
echo   Keep BOTH windows open while you want the site online.
echo ============================================
echo.
pause
