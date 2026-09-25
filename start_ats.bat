@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
echo ========================================================
echo   AutoApply ATS - Automated Job Discovery & Resume Tailorer
echo   Candidate: Aksam Akbar
echo ========================================================
cd /d "%~dp0"
python ats\run.py
pause
