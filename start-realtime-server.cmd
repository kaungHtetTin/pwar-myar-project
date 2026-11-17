@echo off
cd /d "%~dp0realtime-server" || exit /b 1
if not exist ".env" (
  echo Create realtime-server\.env using .env.example and match CHAT_SECRET with Laravel SHOP_CHAT_APP_SECRET.
  pause
  exit /b 1
)
if not exist "node_modules\socket.io\package.json" (
  call npm.cmd ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Starting the PwarMyar Socket.IO realtime server. Keep this window open.
call npm.cmd start
set "MKPOS_REALTIME_EXIT=%ERRORLEVEL%"
pause
exit /b %MKPOS_REALTIME_EXIT%
