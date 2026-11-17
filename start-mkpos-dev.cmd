@echo off
cd /d "%~dp0"
start "PwarMyar Laravel API" "%~dp0start-backend.cmd"
start "PwarMyar Frontend" "%~dp0start-frontend.cmd"
start "PwarMyar Mobile" "%~dp0start-mobile.cmd"
start "PwarMyar Office" "%~dp0start-office.cmd"
start "PwarMyar Shop" "%~dp0start-shop.cmd"
start "PwarMyar Realtime Socket" "%~dp0start-realtime-server.cmd"
start "PwarMyar Shop Scheduler" "%~dp0start-shop-scheduler.cmd"
call "%~dp0start-wyne-wyne.cmd"
call "%~dp0start-sales-ai.cmd"
call "%~dp0start-customer-service.cmd"
echo PwarMyar dev servers are starting.
echo Backend:  http://127.0.0.1:8000/api/health
echo Frontend: http://127.0.0.1:5174
echo Mobile:   http://127.0.0.1:5176
echo Office:   http://127.0.0.1:5175
echo Shop:     http://127.0.0.1:5177
echo Realtime: uses realtime-server\.env ^(default http://127.0.0.1:8080^)
echo Scheduler: running in its own window.
echo Sales AI: dedicated reply worker runs in the background.
echo Wyne Wyne: dedicated reply worker runs in the background.
