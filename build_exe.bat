@echo off
chcp 65001 >nul
echo ===================================================
echo [Cyber-Birthday Engine] СБОРКА WINDOWS EXE
echo ===================================================

echo [1/3] Установка необходимых библиотек Python...
python -m pip install pyinstaller pywebview websockets

echo [2/3] Запуск компиляции (Это может занять 1-2 минуты)...
:: Ключ --noconsole убирает черное окно терминала
:: Ключи --add-data вшивают папки сервера и клиента прямо внутрь EXE
:: Ключ --paths помогает PyInstaller разрешить локальные импорты
python -m PyInstaller --noconfirm --onefile --noconsole --name "CyberBirthday2026" --paths "Server" --add-data "Server;Server" --add-data "Client;Client" desktop_launcher.py

echo ===================================================
echo [3/3] СБОРКА ЗАВЕРШЕНА!
echo Ваш готовый EXE файл находится в папке: dist\CyberBirthday2026.exe
echo ===================================================
pause
