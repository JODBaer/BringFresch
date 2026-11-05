@echo off
title BringFrisch Server
cd /d "%~dp0"
echo ========================================================
echo   BringFrisch - Schweizer Saisongemuese ^& WG-Planer
echo ========================================================
echo.
echo Starte Browser...
start http://localhost:8080
echo.
echo Server laeuft auf:
echo   - PC Browser:   http://localhost:8080
echo.
echo Druecke Ctrl+C zum Beenden.
echo.
python -m bringfrisch.server
pause
