@echo off
title 02. TLC Attendance Architecture Review
cd /d "%~dp0.."
setlocal
echo ===================================================
echo  TLC Attendance SaaS -- Architecture Review
echo ===================================================

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp099.arch_review.ps1"
if %errorlevel% neq 0 (
    pause
    exit /b %errorlevel%
)
