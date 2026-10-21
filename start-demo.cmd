@echo off
cd /d "%~dp0"
node scripts\start-demo.js %*
if errorlevel 1 pause
