@echo off
pushd "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-wyne-wyne-worker.ps1"
set "wyneWorkerExitCode=%ERRORLEVEL%"
popd
exit /b %wyneWorkerExitCode%
