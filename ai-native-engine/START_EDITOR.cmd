@echo off
rem =============================================================================
rem  AI-Native Engine — one-click editor launch.
rem  Double-click this file. It starts the world server and opens the editor
rem  in your browser. Close this window (or Ctrl-C) to stop the world.
rem
rem  To enable the AI rule-writing pane, set the remote model first (NEVER local):
rem     set MODEL_ENDPOINT=https://...your.endpoint.../v1
rem     set MODEL_NAME=Qwen2.5-Coder-32B-Instruct
rem  then run this script from that same terminal.
rem =============================================================================
setlocal
cd /d "%~dp0"

rem AI pane on by default — YOUR deployed Modal endpoint (remote, $0 idle,
rem cents per propose). Set MODEL_ENDPOINT= (empty) before running to disable.
if not defined MODEL_ENDPOINT set MODEL_ENDPOINT=https://mr-tattershall--editor-llm.modal.run
if not defined MODEL_NAME set MODEL_NAME=Qwen/Qwen2.5-Coder-32B-Instruct
if not defined MODEL_KEY set MODEL_KEY=engine-editor-2026

rem refuse to double-start: an old window still holding the port was the #1 failure.
netstat -ano | findstr /r ":4242 .*LISTENING" >nul 2>&1
if %errorlevel%==0 (
  echo.
  echo  !! A server is ALREADY RUNNING on port 4242.
  echo     Find its window and close it first ^(Ctrl-C^), then run this again.
  echo.
  pause
  exit /b 1
)

rem RD-034: pick a world — START_EDITOR.cmd [farm|pong|shooter|empty]
rem   empty = the GAME-CREATION world: define types, spawn things, give them
rem   behavior — all through the gates, from nothing.
set WORLD=%1
if "%WORLD%"=="" set WORLD=farm

start "" http://127.0.0.1:4243/
echo Starting the %WORLD% world... the editor will open at http://127.0.0.1:4243/
echo (if the page shows an error, wait two seconds and refresh)
node "experiments\036_multiplayer\m1_server.js" 4242 250 %WORLD%
pause
