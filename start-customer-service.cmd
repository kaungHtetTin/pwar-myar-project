@echo off
pushd "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-customer-service-worker.ps1"
set "supportWorkerExitCode=%ERRORLEVEL%"
popd
exit /b %supportWorkerExitCode%
