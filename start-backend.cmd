@echo off
cd /d "%~dp0laravel"
php artisan serve --host=127.0.0.1 --port=8000
if errorlevel 1 pause
