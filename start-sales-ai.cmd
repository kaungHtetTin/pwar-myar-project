@echo off
pushd "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-sales-ai-worker.ps1"
set "salesWorkerExitCode=%ERRORLEVEL%"
popd
exit /b %salesWorkerExitCode%
