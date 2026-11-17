@echo off
cd /d "%~dp0mobile"
npm.cmd run dev -- --host 127.0.0.1 --port 5176 --strictPort --open
if errorlevel 1 pause
