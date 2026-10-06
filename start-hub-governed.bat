@echo off
REM start-hub-governed.bat - product-path-1 integration launcher (2026-10-06).
REM Same shape as ai-coding-hub\start-hub.bat (title, npm start, browser open), but it launches THIS tree and
REM sets the qualified-path flags the governed contract needs. The user's own start-hub.bat is NOT edited:
REM switching the everyday launcher to this tree is the owner's decision. See ai-coding-hub-phase1\A8_PRODUCT-PATH_RESULT.md.
title AI Coding Hub - governed (product-path-1)  (keep this window open)
cd /d "%~dp0"

REM The owner token. HUB_TOKEN identifies the owner (A-6 F2): only a request carrying it can approve a
REM reconciliation of an unresolved predecessor. Kept OUTSIDE the repo, created once, never printed.
set "TOKEN_FILE=%USERPROFILE%\.ai-hub\owner-token"
if not exist "%TOKEN_FILE%" (
  if not exist "%USERPROFILE%\.ai-hub" mkdir "%USERPROFILE%\.ai-hub"
  node -e "require('fs').writeFileSync(process.argv[1], require('crypto').randomBytes(24).toString('hex'))" "%TOKEN_FILE%"
)
set /p HUB_TOKEN=<"%TOKEN_FILE%"

REM The governed contract's execution path: commands run in the isolated worker, routes are bounded, model
REM writes go through governWrite. Supervision stays OFF unless the owner turns it on in Settings.
set AGENT_WORKER_EXEC=1
set AGENT_BOUND_ROUTES=1
set AGENT_GOVERNED_WRITES=1

echo ==================================================
echo    AI Coding Hub - governed (product-path-1)
echo    Starting server (:3001) + client (:5173)...
echo    Owner token: %%USERPROFILE%%\.ai-hub\owner-token
echo.
echo    KEEP THIS WINDOW OPEN while using the hub.
echo    Close it (or press Ctrl+C) to stop the hub.
echo ==================================================
echo.

REM HUB_NO_BROWSER=1 skips opening a browser tab (set only by the scripted integration runner).
if not defined HUB_NO_BROWSER start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 8; Start-Process 'http://localhost:5173/'"
call npm start

echo.
echo Hub stopped. Press any key to close this window.
pause >nul
