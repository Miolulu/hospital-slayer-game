@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  npm.cmd install
  if errorlevel 1 exit /b %errorlevel%
)

echo Starting the game...
npm.cmd start
