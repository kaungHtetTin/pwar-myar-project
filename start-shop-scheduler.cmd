@echo off
cd /d "%~dp0laravel"
echo Running the Laravel scheduler for local shop development. Keep this window open.
echo Production: configure a once-per-minute task running php artisan schedule:run.
php artisan schedule:work
if errorlevel 1 pause
