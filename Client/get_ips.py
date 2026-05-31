import socket

try:
    hostname = socket.gethostname()
    ips = socket.gethostbyname_ex(hostname)[2]
    found = False
    for ip in ips:
        if not ip.startswith("127."):
            print(f"   -> http://{ip}:8000")
            found = True
    if not found:
        print("   -> http://localhost:8000")
except Exception:
    print("   -> http://localhost:8000")
