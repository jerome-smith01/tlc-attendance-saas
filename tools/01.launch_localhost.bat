@echo off
title 01. TLC Attendance Localhost
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp099.launch_localhost.ps1"
pause
