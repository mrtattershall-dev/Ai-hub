@echo off
title AI Coding Hub  (keep this window open)
cd /d "C:\Users\tatte\Projects\ai-coding-hub"
echo ==================================================
echo    AI Coding Hub
echo    Starting server (:3001) + client (:5173)...
echo    Your browser opens automatically in a few seconds.
echo.
echo    KEEP THIS WINDOW OPEN while using the hub.
echo    Close it (or press Ctrl+C) to stop the hub.
echo ==================================================
echo.

REM open the browser after a short delay, in the background, once Vite is up
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 8; Start-Process 'http://localhost:5173/'"

REM run server + client together (foreground; this window shows their logs)
REM uses "start" (server WITHOUT --watch) so agent file-writes don't restart/kill the server
call npm start

echo.
echo Hub stopped. Press any key to close this window.
pause >nul
