@echo off
cd /d "%~dp0shop"
npm.cmd run dev -- --strictPort
if errorlevel 1 pause
