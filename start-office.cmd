@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-office-dev.ps1"
set "MKPOS_OFFICE_EXIT=%ERRORLEVEL%"
if not "%MKPOS_OFFICE_EXIT%"=="0" pause
exit /b %MKPOS_OFFICE_EXIT%
