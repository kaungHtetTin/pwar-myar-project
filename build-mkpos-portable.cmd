@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "NO_PAUSE="
if /I "%~1"=="--no-pause" set "NO_PAUSE=1"
if /I "%~1"=="--help" goto :usage

echo ============================================================
echo  PwarMyar Desktop - Windows Portable Build
echo ============================================================
echo.

where node.exe >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found in PATH.
  echo Install the current Node.js LTS release and run this file again.
  goto :failed
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm was not found in PATH.
  echo Reinstall Node.js with npm enabled and run this file again.
  goto :failed
)

if not exist "frontend\package.json" (
  echo ERROR: frontend\package.json was not found.
  echo Run this script from the PwarMyar project folder.
  goto :failed
)

if not exist "desktop\package.json" (
  echo ERROR: desktop\package.json was not found.
  echo Run this script from the PwarMyar project folder.
  goto :failed
)

echo [1/4] Preparing frontend dependencies...
if not exist "frontend\node_modules" (
  pushd "frontend"
  call npm.cmd install --no-audit --no-fund
  if errorlevel 1 goto :failed_from_subdirectory
  popd
) else (
  echo       Frontend dependencies are already installed.
)

echo.
echo [2/4] Preparing Electron build dependencies...
pushd "desktop"
call npm.cmd install --no-audit --no-fund
if errorlevel 1 goto :dependency_failed

echo.
echo [3/4] Running desktop tests...
call npm.cmd test
if errorlevel 1 goto :failed_from_subdirectory

echo.
echo [4/4] Building renderer and portable Windows application...
call npm.cmd run dist:portable
if errorlevel 1 goto :failed_from_subdirectory
popd

if not exist "release\electron\PwarMyar-*-Portable-x64.exe" (
  echo ERROR: The packaging command finished but no x64 portable executable was found.
  goto :failed
)

if not exist "release\electron\PwarMyar-*-Portable-ia32.exe" (
  echo ERROR: The packaging command finished but no 32-bit portable executable was found.
  goto :failed
)

echo.
echo ============================================================
echo  PwarMyar Desktop build completed successfully.
echo  Output folder: %~dp0release\electron
echo ============================================================
echo.
dir /b /o-d "release\electron\PwarMyar-*-Portable-x64.exe" 2>nul
dir /b /o-d "release\electron\PwarMyar-*-Portable-ia32.exe" 2>nul
if not defined NO_PAUSE pause
exit /b 0

:usage
echo Usage: build-mkpos-portable.cmd [--no-pause]
echo.
echo Installs required dependencies, runs desktop tests, builds the
echo offline renderer, and creates the PwarMyar Windows portable executable.
exit /b 0

:dependency_failed
popd
echo.
echo ERROR: Electron dependencies could not be installed.
echo If npm reports a certificate error, configure npm to use your
echo network or organization CA certificate, then run this file again.
goto :failed

:failed_from_subdirectory
popd

:failed
echo.
echo ============================================================
echo  PwarMyar Desktop build failed. Review the error above.
echo ============================================================
if not defined NO_PAUSE pause
exit /b 1
