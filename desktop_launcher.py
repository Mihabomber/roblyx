import webview
import threading
import asyncio
import os
import sys
import time
from http.server import SimpleHTTPRequestHandler
import socketserver

# Получаем абсолютный путь для работы с упакованными файлами PyInstaller
def get_base_path():
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

# Добавляем папку Server в пути, чтобы импортировать бэкенд
sys.path.append(os.path.join(get_base_path(), "Server"))
import server as backend

def start_websocket_server():
    # Запускаем асинхронный сервер в отдельном потоке
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(backend.main())

def start_http_server():
    client_path = os.path.join(get_base_path(), "Client")
    
    # Отключаем логирование HTTP сервера, чтобы не спамить в консоль
    class NoLogHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=client_path, **kwargs)
        def log_message(self, format, *args):
            pass
            
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", 8000), NoLogHandler) as httpd:
        httpd.serve_forever()

if __name__ == '__main__':
    # 1. Запуск WebSocket Сервера для мультиплеера и физики
    threading.Thread(target=start_websocket_server, daemon=True).start()
    
    # 2. Запуск локального HTTP сервера для отдачи 3D моделей и статики
    threading.Thread(target=start_http_server, daemon=True).start()
    
    # Ждем секунду, чтобы сервера успели запустить порты
    time.sleep(1) 
    
    # 3. Открываем нативное окно Windows (через pywebview)
    webview.create_window("Misha's Cyber-Birthday 2026", 'http://127.0.0.1:8000', width=1280, height=720)
    webview.start()
    
    # При закрытии окна жестко завершаем все фоновые процессы серверов
    os._exit(0)
