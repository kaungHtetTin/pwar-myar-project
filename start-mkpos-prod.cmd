@echo off
cd /d "%~dp0"

if not exist "laravel\vendor\autoload.php" (
  echo Installing Laravel dependencies...
  cd /d "%~dp0laravel"
  call composer install --no-interaction
  if errorlevel 1 (
    pause
    exit /b 1
  )
  cd /d "%~dp0"
)

if not exist "laravel\.env" (
  echo Laravel .env was not found. Copy laravel\.env.example to laravel\.env and configure MySQL.
  pause
  exit /b 1
)

if not exist "frontend\node_modules" (
  echo Installing frontend dependencies...
  cd /d "%~dp0frontend"
  call npm.cmd install
  if errorlevel 1 (
    pause
    exit /b 1
  )
  cd /d "%~dp0"
)

if not exist "office\node_modules" (
  echo Installing Office dependencies...
  cd /d "%~dp0office"
  call npm.cmd install
  if errorlevel 1 (
    pause
    exit /b 1
  )
  cd /d "%~dp0"
)

echo Building PwarMyar frontend...
cd /d "%~dp0frontend"
call npm.cmd run build:laravel
if errorlevel 1 (
  pause
  exit /b 1
)

echo Building PwarMyar Office...
cd /d "%~dp0office"
call npm.cmd run build:laravel
if errorlevel 1 (
  pause
  exit /b 1
)

cd /d "%~dp0"
echo Applying MySQL migrations...
cd /d "%~dp0laravel"
php artisan migrate --force
if errorlevel 1 (
  pause
  exit /b 1
)

echo Starting PwarMyar production mode...
call "%~dp0start-wyne-wyne.cmd"
if errorlevel 1 exit /b 1
call "%~dp0start-sales-ai.cmd"
if errorlevel 1 exit /b 1
call "%~dp0start-customer-service.cmd"
if errorlevel 1 exit /b 1
echo Open: http://127.0.0.1:8000
start "" "http://127.0.0.1:8000"
php artisan serve --host=127.0.0.1 --port=8000
if errorlevel 1 pause
