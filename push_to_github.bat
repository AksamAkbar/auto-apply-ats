@echo off
echo ============================================================
echo Pushing ATS Dashboard to GitHub (AksamAkbar/auto-apply-ats)
echo ============================================================
git push -u origin main
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo [SUCCESS] Code successfully pushed to GitHub!
    echo Now open GitHub -> Settings -> Pages -> Source: GitHub Actions
    echo Your site will be live at:
    echo https://aksamakbar.github.io/auto-apply-ats/
    echo ============================================================
) else (
    echo.
    echo [ERROR] Push failed. Make sure you created the empty repository
    echo 'auto-apply-ats' at https://github.com/new first!
)
pause
