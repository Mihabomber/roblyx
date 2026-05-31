import asyncio
import websockets
import json
import time
import math
import random

import os
import socket

registered_users = {}
USERS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "users.json")

def load_users():
    global registered_users
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, "r", encoding="utf-8") as f:
                registered_users = json.load(f)
                print(f"[DATABASE] Загружено пользователей: {len(registered_users)}")
        except Exception as e:
            print(f"[DATABASE] Ошибка загрузки базы: {e}")
            registered_users = {}
    else:
        registered_users = {}

def save_users():
    try:
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(registered_users, f, indent=4, ensure_ascii=False)
            print("[DATABASE] База пользователей сохранена.")
    except Exception as e:
        print(f"[DATABASE] Ошибка сохранения базы: {e}")

def print_ip_addresses():
    print("[NETWORK] Локальные адреса в сети Wi-Fi для телефонов:")
    try:
        hostname = socket.gethostname()
        ips = socket.gethostbyname_ex(hostname)[2]
        for ip in ips:
            if not ip.startswith("127."):
                print(f"  👉 Браузер/APK: http://{ip}:8000")
                print(f"  👉 IP для ввода: {ip}")
    except Exception as e:
        print(f"[NETWORK] Не удалось определить IP: {e}")

world_state = {
    "players": {},
    "parts": [
        {"id": "ground", "x": 0, "y": -2.5, "z": 0, "sx": 300, "sy": 5, "sz": 300, "color": 0x333333, "anchored": True, "material": "pbr"},
        {"id": "cake", "x": 0, "y": 2.5, "z": -15, "sx": 5, "sy": 5, "sz": 5, "color": 0xFF69B4, "anchored": True, "material": "pbr"},
        {"id": "tank", "x": 20, "y": 2, "z": 20, "sx": 8, "sy": 4, "sz": 12, "color": 0x4B5320, "anchored": False, "material": "pbr"},
        {"id": "cat_kuzya", "x": -10, "y": 1, "z": -10, "sx": 1.5, "sy": 1.5, "sz": 1.5, "color": 0x111111, "anchored": False, "material": "pbr"},
        {"id": "printer", "x": -20, "y": 2, "z": 0, "sx": 3, "sy": 4, "sz": 3, "color": 0x888888, "anchored": True, "material": "pbr"},
        {"id": "soccer_field", "x": 50, "y": 0.1, "z": -50, "sx": 40, "sy": 0.1, "sz": 60, "color": 0x228B22, "anchored": True, "material": "pbr"},
        {"id": "soccer_ball", "x": 50, "y": 5, "z": -50, "sx": 3, "sy": 3, "sz": 3, "color": 0xFFFFFF, "anchored": False, "type": "sphere"},
        {"id": "lava_pool", "x": -50, "y": -2.4, "z": -50, "sx": 30, "sy": 5.1, "sz": 60, "color": 0xFF4500, "anchored": True, "material": "neon"},
        {"id": "obby_chest", "x": -50, "y": 2, "z": -75, "sx": 4, "sy": 3, "sz": 4, "color": 0xFFD700, "anchored": True, "material": "pbr"}
    ]
}

# Генерация декораций
for i in range(5):
    world_state["parts"].append({"id": f"obby_plat_{i}", "x": -50, "y": 2 + i*2, "z": -25 - i*10, "sx": 4, "sy": 1, "sz": 4, "color": 0x00FFFF, "anchored": True, "material": "neon"})
for i in range(20):
    world_state["parts"].append({"id": f"star_{i}", "x": random.uniform(-100, 100), "y": random.uniform(2, 15), "z": random.uniform(-100, 100), "sx": 1.5, "sy": 1.5, "sz": 1.5, "color": 0xFFFF00, "anchored": True, "material": "neon", "type": "star"})
for i in range(15):
    world_state["parts"].append({"id": f"balloon_{i}", "x": random.uniform(-40, 40), "y": random.uniform(5, 20), "z": random.uniform(-40, 40), "sx": 2, "sy": 3, "sz": 2, "color": random.choice([0xFF0000, 0x00FF00, 0x0000FF, 0xFF00FF]), "anchored": True, "material": "pbr", "type": "sphere"})

GRAVITY = 196.2
TICK_RATE = 1 / 60.0

class PlayerPhysics:
    def __init__(self, uid):
        self.uid = uid
        self.name = "Guest"
        self.x, self.y, self.z = 0, 10, 0
        self.vy = 0
        self.speed = 16.0
        self.jump_power = 50.0
        self.is_grounded = False
        self.points = 0
        self.god_mode = False
        self.health = 100
        self.is_dead = False
        self.death_time = 0

    def reset_character(self):
        if not self.is_dead:
            self.health = 0
            self.is_dead = True
            self.death_time = time.time()

    def respawn(self):
        self.health = 100
        self.is_dead = False
        self.x, self.y, self.z = 0, 10, 0
        self.vy = 0
        self.speed = 16.0
        self.jump_power = 50.0

    def update(self, dt, inputs):
        if self.is_dead:
            if time.time() - self.death_time >= 3.0:
                self.respawn()
            return

        if not self.is_grounded and not self.god_mode:
            self.vy -= GRAVITY * dt
        else:
            if not self.god_mode: self.vy = 0

        if inputs.get("jump") and self.is_grounded:
            self.vy = self.jump_power
            self.is_grounded = False

        if self.god_mode and inputs.get("jump"):
            self.vy = 50

        dx = inputs.get("x", 0) * self.speed * dt
        dz = inputs.get("y", 0) * self.speed * dt

        self.x += dx
        self.y += self.vy * dt
        self.z += dz

        if self.x > -65 and self.x < -35 and self.z > -80 and self.z < -20:
            if self.y <= 3 and not self.god_mode:
                self.reset_character()

        if self.y <= 3 and not self.god_mode:
            self.y = 3
            self.is_grounded = True
            if self.vy < 0: self.vy = 0

        for p in world_state["parts"]:
            if p["id"] == "soccer_ball":
                dist = math.hypot(self.x - p["x"], self.z - p["z"])
                if dist < 4 and abs(self.y - p["y"]) < 5:
                    p["x"] += dx * 1.5
                    p["z"] += dz * 1.5

    def to_dict(self):
        return {"id": self.uid, "name": self.name, "x": self.x, "y": self.y, "z": self.z, "points": self.points, "health": self.health, "is_dead": self.is_dead}

players = {}
clients = {}

async def ai_loop():
    while True:
        for p in world_state["parts"]:
            if "cat" in p["id"]:
                p["x"] += math.sin(time.time() * 0.5) * 0.1
                p["z"] += math.cos(time.time() * 0.5) * 0.1
            if p.get("type") == "star":
                p["sy"] = math.sin(time.time() * 2) * 0.2 + 1.5
        await asyncio.sleep(1/10)

async def physics_loop():
    last_time = time.time()
    while True:
        current_time = time.time()
        dt = current_time - last_time
        last_time = current_time

        for p in world_state["parts"]:
            if p["id"] == "soccer_ball":
                if p["y"] > 1.5: p["y"] -= GRAVITY * dt * 0.1
                else: p["y"] = 1.5
                
                # Удержание мяча в границах игрового поля
                p["x"] = max(-146, min(146, p["x"]))
                p["z"] = max(-146, min(146, p["z"]))
                
                # Детектор голов на футбольном поле (Ворота на x: 50, z: -80 и z: -20)
                if abs(p["x"] - 50) < 6 and (p["z"] < -79 or p["z"] > -21):
                    p["x"], p["y"], p["z"] = 50, 5, -50 # Респавн мяча в центре
                    
                    # Награждаем ближайшего игрока
                    nearest_plr = None
                    min_dist = 99999
                    for plr_obj in players.values():
                        d_to_ball = math.hypot(plr_obj.x - 50, plr_obj.z - (-50))
                        if d_to_ball < min_dist:
                            min_dist = d_to_ball
                            nearest_plr = plr_obj
                    if nearest_plr:
                        nearest_plr.points += 150
                        websockets.broadcast(clients.keys(), json.dumps({
                            "type": "chat",
                            "sender": "АРЕНА",
                            "msg": f"⚽ ГООООЛ! {nearest_plr.name} забивает мяч в ворота! (+150 Meme Points)"
                        }))

        for p in players.values():
            p.update(dt, p.current_inputs if hasattr(p, 'current_inputs') else {})

            if not p.is_dead:
                for part in world_state["parts"][:]:
                    if part.get("type") == "star":
                        dist = math.hypot(p.x - part["x"], p.z - part["z"])
                        if dist < 3 and abs(p.y - part["y"]) < 5:
                            p.points += 50
                            world_state["parts"].remove(part)
                            msg = json.dumps({"type": "sound", "sound": "star"})
                            for ws, uid in clients.items():
                                if uid == p.uid: asyncio.create_task(ws.send(msg))

        state_to_send = {"players": {uid: p.to_dict() for uid, p in players.items() if p.name != "Guest"}, "parts": world_state["parts"]}
        if clients:
            websockets.broadcast(clients.keys(), json.dumps({"type": "update", "state": state_to_send}))
        await asyncio.sleep(TICK_RATE)

async def handler(websocket):
    uid = str(id(websocket))
    clients[websocket] = uid
    players[uid] = PlayerPhysics(uid)
    await websocket.send(json.dumps({"type": "init", "uid": uid, "world": world_state}))

    try:
        async for message in websocket:
            data = json.loads(message)
            if data["type"] == "auth":
                action, name, pwd = data["action"], data["name"], data["password"]
                if action == "register":
                    if name in registered_users:
                        await websocket.send(json.dumps({"type": "auth_error", "msg": "Этот никнейм занят!"}))
                    else:
                        registered_users[name] = {"password": pwd, "points": 0}
                        players[uid].name = name
                        save_users()
                        await websocket.send(json.dumps({"type": "auth_success", "name": name, "points": 0}))
                elif action == "login":
                    if name in registered_users and registered_users[name]["password"] == pwd:
                        players[uid].name = name
                        players[uid].points = registered_users[name]["points"]
                        await websocket.send(json.dumps({"type": "auth_success", "name": name, "points": players[uid].points}))
                    else:
                        await websocket.send(json.dumps({"type": "auth_error", "msg": "Неверный логин или пароль!"}))
            elif data["type"] == "input":
                players[uid].current_inputs = data["data"]
            elif data["type"] == "chat":
                if data["msg"] == "/reset": players[uid].reset_character()
                else: websockets.broadcast(clients.keys(), json.dumps({"type": "chat", "sender": players[uid].name, "msg": data["msg"]}))
            elif data["type"] == "shop_buy":
                item = data["item"]
                p = players[uid]
                costs = {"speed": 150, "jump": 200, "heal": 50, "god": 1000}
                if p.points >= costs[item]:
                    p.points -= costs[item]
                    if item == "speed": p.speed = 32.0
                    if item == "jump": p.jump_power = 100.0
                    if item == "heal": p.health = 100; p.is_dead = False
                    if item == "god": p.god_mode = True
                    await websocket.send(json.dumps({"type": "chat", "sender": "Shop", "msg": f"Успешная покупка: {item}!"}))
                else:
                    await websocket.send(json.dumps({"type": "chat", "sender": "Shop", "msg": "Недостаточно очков!"}))
            elif data["type"] == "interact":
                target = data['target']
                if target == "cake":
                    players[uid].points += 100
                    websockets.broadcast(clients.keys(), json.dumps({"type": "chat", "sender": "Server", "msg": f"{players[uid].name} съел торт! (+100)"}))
                elif target == "obby_chest":
                    players[uid].points += 500
                    websockets.broadcast(clients.keys(), json.dumps({"type": "chat", "sender": "Server", "msg": f"🏆 {players[uid].name} ПРОШЕЛ ОББИ! (+500)"}))
            elif data["type"] == "admin_cmd":
                cmd = data["cmd"]
                p = players[uid]
                if cmd == "give_points": p.points += 9999
                elif cmd == "god_mode": p.god_mode = not p.god_mode
                elif cmd == "speed_boost": p.speed = 160.0
                elif cmd == "spawn_tank":
                    world_state["parts"].append({"id": f"tank_{time.time()}", "x": p.x, "y": 10, "z": p.z, "sx": 8, "sy": 4, "sz": 12, "color": 0x4B5320, "anchored": False, "material": "pbr"})
                elif cmd == "cake_explosion":
                    websockets.broadcast(clients.keys(), json.dumps({"type": "chat", "sender": "MATRIX", "msg": "ТОРТ ВЗОРВАЛСЯ! С ДНЕМ РОЖДЕНИЯ!"}))
                elif cmd == "disco_mode":
                    for part in world_state["parts"]:
                        if part["material"] == "neon": part["color"] = random.choice([0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00])
                elif cmd == "meteor_shower":
                    for _ in range(10):
                        world_state["parts"].append({"id": f"meteor_{time.time()}_{random.random()}", "x": p.x + random.uniform(-50, 50), "y": 100, "z": p.z + random.uniform(-50, 50), "sx": 5, "sy": 5, "sz": 5, "color": 0xFF4500, "anchored": False, "material": "neon", "type": "sphere"})
                elif cmd == "spawn_cats":
                    for _ in range(5):
                        world_state["parts"].append({"id": f"cat_{time.time()}_{random.random()}", "x": p.x, "y": 5, "z": p.z, "sx": 1.5, "sy": 1.5, "sz": 1.5, "color": random.choice([0x111111, 0xFFFFFF, 0xFFA500]), "anchored": False, "material": "pbr"})
            elif data["type"] == "reset":
                players[uid].reset_character()
    except websockets.exceptions.ConnectionClosed: pass
    finally:
        del clients[websocket]
        if players[uid].name in registered_users:
            registered_users[players[uid].name]["points"] = players[uid].points
            save_users()
        del players[uid]

async def process_request(path, request_headers):
    import mimetypes
    # Разрешаем CORS
    clean_path = path.split("?")[0]
    if clean_path == "/":
        clean_path = "/index.html"
        
    safe_path = clean_path.lstrip("/")
    
    # Ищем файлы в Client
    possible_dirs = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Client"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "Client"),
        "/app/Client",
        "./Client",
        "Client"
    ]
    
    file_path = None
    for d in possible_dirs:
        p = os.path.join(d, safe_path)
        if os.path.exists(p) and os.path.isfile(p):
            file_path = p
            break
            
    if file_path:
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = "application/octet-stream"
        if file_path.endswith(".glb"):
            mime_type = "model/gltf-binary"
            
        try:
            with open(file_path, "rb") as f:
                content = f.read()
            headers = [
                ("Content-Type", mime_type),
                ("Content-Length", str(len(content))),
                ("Access-Control-Allow-Origin", "*"),
                ("Connection", "close"),
            ]
            return websockets.http.HTTPStatus.OK, headers, content
        except Exception as e:
            print(f"[HTTP] Ошибка отдачи {file_path}: {e}")
            
    return None

async def main():
    load_users()
    print("=========================================")
    print("  Cyber-Birthday Cloud Server - v6.0.0  ")
    print("=========================================")
    print_ip_addresses()
    print("=========================================")
    asyncio.create_task(physics_loop())
    asyncio.create_task(ai_loop())
    port = int(os.environ.get("PORT", 12345))
    print(f"[SERVER] Запуск WebSocket + HTTP сервера на порту {port}")
    async with websockets.serve(handler, "0.0.0.0", port, process_request=process_request): await asyncio.Future()

if __name__ == "__main__": asyncio.run(main())
