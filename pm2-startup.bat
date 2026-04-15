@echo off
:: PM2 Resurrection Script - Starts PM2 and restores saved processes
cd /d "%~dp0"

:: Wait for network to be available
ping localhost -n 3 > nul

:: Resurrect PM2 with saved processes
pm2 resurrect

:: If resurrect fails, start auto-sync directly
if errorlevel 1 (
    pm2 start auto-sync.js --name auto-sync
)
