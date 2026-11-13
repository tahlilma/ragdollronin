@echo off
title Ragdoll Ronin - npx serve + duel relay
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get it from https://nodejs.org and run this again.
  pause
  exit /b 1
)
node start.js
pause
