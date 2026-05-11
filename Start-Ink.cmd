@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo === ИНК: запуск backend (Express + API + статика) ===
echo Если «на показ» не работал — сначала закройте другие окна, где уже запущен сервер на порту 3000.
echo.

cd backend
if not exist node_modules (
  echo Установка зависимостей...
  call npm install
  if errorlevel 1 exit /b 1
)

if not defined PORT set PORT=3000
echo Откройте в браузере: http://127.0.0.1:%PORT%/
echo Остановка сервера: Ctrl+C
echo.
node src/server.js
pause
