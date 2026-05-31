@echo off
chcp 65001 >nul
echo ===================================================
echo [Cyber-Birthday Engine] ЛОКАЛЬНЫЙ ЗАПУСК ИГРЫ
echo ===================================================

echo [1/3] Запуск сервера движка (Порт 12345)...
start "Cyber Server" cmd /k "cd Server && python server.py"

echo [2/3] Запуск локального веб-сервера для клиента (Порт 8000)...
:: Это решает проблему CORS при загрузке 3D-моделей!
start "Cyber Client WebServer" cmd /k "cd Client && python -m http.server 8000"

echo [3/3] Открываем игру в браузере...
timeout 3 >nul
start http://localhost:8000

echo Готово! Не закрывайте черные окна консоли, пока играете.
pause
