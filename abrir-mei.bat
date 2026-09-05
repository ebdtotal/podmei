@echo off
cd /d "%~dp0"
echo Instalando dependencias (primeira vez pode demorar)...
call npm install
echo.
echo Abrindo o POD MEI...
echo Landing:   http://localhost:5175
echo Contador:  http://localhost:5175/contador
echo App MEI:   http://localhost:5175/app
echo.
call npm run dev
