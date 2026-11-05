@echo off
title BringFrisch Server
cd /d "%~dp0"
echo ========================================================
echo   BringFrisch - Schweizer Saisongemuese & WG-Planer
echo ========================================================
echo.
echo Server laeuft auf:
echo   - PC Browser:   http://localhost:8080
echo   - Smartphone:   http://10.67.110.237:8080
echo.
echo Druecke Ctrl+C zum Beenden.
echo.
python -m bringfrisch.server
pause

