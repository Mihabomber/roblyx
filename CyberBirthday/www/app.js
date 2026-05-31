// === НАСТРОЙКА THREE.JS С ПОВЫШЕННЫМ КАЧЕСТВОМ ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050409);
scene.fog = new THREE.FogExp2(0x0a0815, 0.012); // Атмосферный глубокий туман

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Включаем реалистичные мягкие тени
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

document.getElementById('game-container').appendChild(renderer.domElement);

// === УЛУЧШЕННОЕ СВЕТОВОЕ ОФОРМЛЕНИЕ (ТЕНИ И ГРАДИЕНТЫ) ===
const ambientLight = new THREE.HemisphereLight(0x0a0820, 0x050510, 0.4); // Заполняющий космический свет
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(40, 100, 40);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 250;
const d = 100;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

// Дополнительный неоновый прожектор для подсветки торта
const spotLight = new THREE.SpotLight(0xff00ff, 4, 80, Math.PI / 4, 0.5, 1);
spotLight.position.set(0, 30, -15);
spotLight.target.position.set(0, 0, -15);
spotLight.castShadow = true;
scene.add(spotLight);
scene.add(spotLight.target);

// === ЗВУКИ ===
const oofSound = new Audio('https://www.myinstants.com/media/sounds/roblox-death-sound_1.mp3');
const starSound = new Audio('https://www.myinstants.com/media/sounds/mario-coin.mp3');

// === СЕТЬ И ПОДКЛЮЧЕНИЕ ===
let ws = null;
let myUid = null;
const players = {};
const parts = {};
let interactionTarget = null;
let isAuthenticated = false;

// Подгружаем сохраненный IP из localStorage или берем текущий хост
let savedIp = localStorage.getItem("cyber_server_ip") || window.location.hostname || "localhost";
document.getElementById("server-ip-input").value = savedIp;

function connectToServer(ip) {
    const statusDiv = document.getElementById("connection-status");
    statusDiv.className = "status-indicator";
    statusDiv.innerText = "Подключение...";
    
    const wsUrl = `ws://${ip}:12345`;
    
    if (ws) {
        ws.close();
    }
    
    try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log(`Подключено к серверу: ${wsUrl}`);
            statusDiv.className = "status-indicator connected";
            statusDiv.innerText = "Подключено";
            localStorage.setItem("cyber_server_ip", ip);
        };
        
        ws.onerror = (e) => {
            console.error("Ошибка сети: ", e);
            statusDiv.className = "status-indicator";
            statusDiv.innerText = "Ошибка подключения";
        };
        
        ws.onclose = () => {
            console.warn("Связь с сервером потеряна.");
            statusDiv.className = "status-indicator";
            statusDiv.innerText = "Соединение разорвано";
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === "init") {
                myUid = data.uid;
                initWorld(data.world.parts);
            } else if (data.type === "auth_success") {
                document.getElementById('auth-screen').classList.add('hidden');
                document.getElementById('core-gui').classList.remove('hidden');
                isAuthenticated = true;
                addChatMessage("Система", `Добро пожаловать, ${data.name}! У вас ${data.points} Meme Points.`);
            } else if (data.type === "auth_error") {
                const errDiv = currentAuthTab === 'login' ? document.getElementById('login-error') : document.getElementById('reg-error');
                errDiv.innerText = data.msg;
            } else if (data.type === "update") {
                updatePlayers(data.state.players);
                if (data.state.parts) updateParts(data.state.parts);
            } else if (data.type === "chat") {
                addChatMessage(data.sender, data.msg);
            } else if (data.type === "sound") {
                if(data.sound === "star") {
                    starSound.currentTime = 0;
                    starSound.play().catch(e=>console.log(e));
                }
            }
        };
    } catch (err) {
        statusDiv.className = "status-indicator";
        statusDiv.innerText = "Невалидный адрес";
    }
}

// Первоначальное подключение
connectToServer(savedIp);

window.saveServerIp = function() {
    const ip = document.getElementById("server-ip-input").value.trim();
    if(ip) {
        connectToServer(ip);
    }
};

// === ИНТЕРАКТИВНАЯ ТРЕТЬЯ-ПЕРСОНА КАМЕРА (ОРБИТАЛЬНАЯ) ===
let cameraYaw = 0; // Вращение вокруг игрока (мышь по горизонтали)
let cameraPitch = 0.45; // Угол высоты (мышь по вертикали)
let cameraDistance = 22; // Расстояние до игрока
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

const gameContainer = document.getElementById("game-container");

gameContainer.addEventListener("mousedown", (e) => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
});

gameContainer.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;
    
    cameraYaw -= deltaX * 0.005;
    cameraPitch = Math.max(0.08, Math.min(Math.PI / 2 - 0.08, cameraPitch - deltaY * 0.005));
    
    previousMousePosition = { x: e.clientX, y: e.clientY };
});

window.addEventListener("mouseup", () => isDragging = false);

// Управление масштабированием камеры через колесико мыши
window.addEventListener("wheel", (e) => {
    cameraDistance = Math.max(8, Math.min(60, cameraDistance + e.deltaY * 0.02));
}, { passive: true });

// Сенсорный ввод для мобильных устройств
gameContainer.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
        isDragging = true;
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
}, { passive: true });

gameContainer.addEventListener("touchmove", (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - previousMousePosition.x;
    const deltaY = e.touches[0].clientY - previousMousePosition.y;
    
    cameraYaw -= deltaX * 0.006;
    cameraPitch = Math.max(0.08, Math.min(Math.PI / 2 - 0.08, cameraPitch - deltaY * 0.006));
    
    previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });

window.addEventListener("touchend", () => isDragging = false);


// === АУТЕНТИФИКАЦИЯ ===
let currentAuthTab = 'login';
window.switchAuthTab = function(tab) {
    currentAuthTab = tab;
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
    document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
    document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
};

window.submitAuth = function(action) {
    if(!ws || ws.readyState !== WebSocket.OPEN) {
        const errDiv = action === 'login' ? document.getElementById('login-error') : document.getElementById('reg-error');
        errDiv.innerText = "Сервер недоступен! Проверьте IP.";
        return;
    }
    const nameInput = action === 'login' ? document.getElementById('login-name') : document.getElementById('reg-name');
    const pwdInput = action === 'login' ? document.getElementById('login-pwd') : document.getElementById('reg-pwd');
    const errDiv = action === 'login' ? document.getElementById('login-error') : document.getElementById('reg-error');
    
    const name = nameInput.value.trim();
    const pwd = pwdInput.value.trim();
    errDiv.innerText = "";
    
    if(!name || !pwd) {
        errDiv.innerText = "Заполните все поля!";
        return;
    }
    if(action === 'register') {
        const pwd2 = document.getElementById('reg-pwd2').value.trim();
        if(pwd !== pwd2) {
            errDiv.innerText = "Пароли не совпадают!";
            return;
        }
    }
    ws.send(JSON.stringify({ type: "auth", action: action, name: name, password: pwd }));
};


// === МАТЕРИАЛЫ И ИНИЦИАЛИЗАЦИЯ МИРА ===
function createPBRMaterial(color, matType) {
    if (matType === "neon") {
        return new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 1.5, roughness: 0.1, metalness: 0.2 });
    }
    return new THREE.MeshStandardMaterial({ color: color, roughness: 0.6, metalness: 0.35 });
}

// === ФУНКЦИИ ГЕНЕРАЦИИ УЛУЧШЕННЫХ 3D МОДЕЛЕЙ ДЛЯ КАРТЫ ===

function createBeautifulCake() {
    const cakeGroup = new THREE.Group();
    
    // Слой 1 (Нижний)
    const t1Geo = new THREE.CylinderGeometry(2.5, 2.5, 1.6, 32);
    const t1Mat = new THREE.MeshStandardMaterial({ color: 0xff69b4, roughness: 0.5, metalness: 0.1 });
    const t1 = new THREE.Mesh(t1Geo, t1Mat);
    t1.position.y = -1.7;
    t1.castShadow = true;
    t1.receiveShadow = true;
    cakeGroup.add(t1);
    
    // Слой 2 (Средний)
    const t2Geo = new THREE.CylinderGeometry(1.8, 1.8, 1.4, 32);
    const t2Mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 });
    const t2 = new THREE.Mesh(t2Geo, t2Mat);
    t2.position.y = -0.2;
    t2.castShadow = true;
    t2.receiveShadow = true;
    cakeGroup.add(t2);
    
    // Слой 3 (Верхний)
    const t3Geo = new THREE.CylinderGeometry(1.1, 1.1, 1.2, 32);
    const t3Mat = new THREE.MeshStandardMaterial({ color: 0xff007f, roughness: 0.5, metalness: 0.1 });
    const t3 = new THREE.Mesh(t3Geo, t3Mat);
    t3.position.y = 1.1;
    t3.castShadow = true;
    t3.receiveShadow = true;
    cakeGroup.add(t3);
    
    // Свечка
    const candleGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 12);
    const candleMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.3, metalness: 0.7 });
    const candle = new THREE.Mesh(candleGeo, candleMat);
    candle.position.set(0, 2.2, 0);
    candle.castShadow = true;
    cakeGroup.add(candle);
    
    // Огонёк свечи
    const flameGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(0, 2.9, 0);
    flame.scale.set(1, 1.8, 1);
    cakeGroup.add(flame);
    
    // Свет от огонька свечи
    const candleLight = new THREE.PointLight(0xffaa00, 2, 8);
    candleLight.position.set(0, 3.2, 0);
    cakeGroup.add(candleLight);
    
    return cakeGroup;
}

function createBeautifulTank(color) {
    const tankGroup = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: color || 0x4b5320, roughness: 0.7, metalness: 0.5 });
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, metalness: 0.2 });
    
    // Корпус танка
    const base = new THREE.Mesh(new THREE.BoxGeometry(6, 1.5, 8), mat);
    base.position.y = 0.75;
    base.castShadow = true;
    base.receiveShadow = true;
    tankGroup.add(base);
    
    // Гусеницы левые
    const trackL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 9.2), trackMat);
    trackL.position.set(-3.4, 0.9, 0);
    trackL.castShadow = true;
    tankGroup.add(trackL);
    
    // Гусеницы правые
    const trackR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 9.2), trackMat);
    trackR.position.set(3.4, 0.9, 0);
    trackR.castShadow = true;
    tankGroup.add(trackR);
    
    // Башня
    const turret = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.2, 4.5), mat);
    turret.position.set(0, 2.1, -0.5);
    turret.castShadow = true;
    tankGroup.add(turret);
    
    // Дуло орудия
    const barrelGeo = new THREE.CylinderGeometry(0.3, 0.3, 5, 16);
    const barrel = new THREE.Mesh(barrelGeo, mat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 2.1, 3.2);
    barrel.castShadow = true;
    tankGroup.add(barrel);
    
    return tankGroup;
}

function createBeautifulCat(color) {
    const catGroup = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: color || 0x111111, roughness: 0.8, metalness: 0.1 });
    
    // Тело котика
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 2.0), mat);
    body.position.y = 0.4;
    body.castShadow = true;
    body.receiveShadow = true;
    catGroup.add(body);
    
    // Голова котика
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.8), mat);
    head.position.set(0, 0.9, 0.9);
    head.castShadow = true;
    catGroup.add(head);
    
    // Ушки левое и правое
    const earL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), mat);
    earL.position.set(-0.35, 1.45, 0.9);
    catGroup.add(earL);
    
    const earR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), mat);
    earR.position.set(0.35, 1.45, 0.9);
    catGroup.add(earR);
    
    // Хвост
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.15), mat);
    tail.rotation.x = -Math.PI / 4;
    tail.position.set(0, 0.9, -1.2);
    tail.castShadow = true;
    catGroup.add(tail);
    
    // Светящиеся зеленые глаза кота Кузи
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), eyeMat);
    eyeL.position.set(-0.25, 1.0, 1.3);
    catGroup.add(eyeL);
    
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), eyeMat);
    eyeR.position.set(0.25, 1.0, 1.3);
    catGroup.add(eyeR);
    
    return catGroup;
}

function createCyberSoccerBall() {
    const ballGroup = new THREE.Group();
    
    // Внутренняя блестящая сфера
    const sphereGeo = new THREE.SphereGeometry(1.5, 32, 32);
    const sphereMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.8 });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    ballGroup.add(sphere);
    
    // Светящаяся кибер-сетка на мяче
    const wireframeGeo = new THREE.SphereGeometry(1.52, 12, 12);
    const wireframeMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, wireframe: true, transparent: true, opacity: 0.65 });
    const wireframe = new THREE.Mesh(wireframeGeo, wireframeMat);
    ballGroup.add(wireframe);
    
    return ballGroup;
}

function createCyberChest() {
    const chestGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2c11, roughness: 0.8, metalness: 0.1 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.1, metalness: 0.9 });
    
    // Нижняя часть сундука
    const base = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 2.5), woodMat);
    base.position.y = -0.25;
    base.castShadow = true;
    base.receiveShadow = true;
    chestGroup.add(base);
    
    // Крышка сундука
    const lid = new THREE.Mesh(new THREE.BoxGeometry(4, 1.0, 2.5), woodMat);
    lid.position.y = 1.0;
    lid.castShadow = true;
    chestGroup.add(lid);
    
    // Золотая кайма
    const trim = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.2, 2.7), goldMat);
    trim.position.y = 0.5;
    chestGroup.add(trim);
    
    // Золотой замок
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.4), goldMat);
    lock.position.set(0, 0.3, 1.35);
    chestGroup.add(lock);
    
    return chestGroup;
}

function createMapPart(p) {
    let mesh;
    if (p.id === "cake") {
        mesh = createBeautifulCake();
    } else if (p.id === "tank" || p.id.startsWith("tank_")) {
        mesh = createBeautifulTank(p.color);
    } else if (p.id === "cat_kuzya" || p.id.startsWith("cat_")) {
        mesh = createBeautifulCat(p.color);
    } else if (p.id === "soccer_ball") {
        mesh = createCyberSoccerBall();
    } else if (p.id === "obby_chest") {
        mesh = createCyberChest();
    } else {
        let geometry;
        if(p.type === "sphere") geometry = new THREE.SphereGeometry(p.sx/2, 32, 32);
        else if (p.type === "star") geometry = new THREE.OctahedronGeometry(p.sx/2, 0);
        else geometry = new THREE.BoxGeometry(p.sx, p.sy, p.sz);
        
        const material = createPBRMaterial(p.color, p.material);
        mesh = new THREE.Mesh(geometry, material);
    }
    return mesh;
}

function initWorld(serverParts) {
    serverParts.forEach(p => {
        const mesh = createMapPart(p);
        mesh.position.set(p.x, p.y, p.z);
        mesh.castShadow = (p.id !== "ground");
        mesh.receiveShadow = true;
        scene.add(mesh);
        parts[p.id] = mesh;
    });

    addGridFloor();
    addStarrySky();
    addCyberDecorations();
}

function updateParts(serverParts) {
    const serverPartIds = new Set(serverParts.map(p => p.id));
    
    // Удаляем пропавшие части
    Object.keys(parts).forEach(id => {
        if(!serverPartIds.has(id)) {
            scene.remove(parts[id]);
            delete parts[id];
        }
    });

    serverParts.forEach(p => {
        if(!parts[p.id]) {
            const mesh = createMapPart(p);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            parts[p.id] = mesh;
        }
        parts[p.id].position.set(p.x, p.y, p.z);
        if(p.sy !== undefined && p.type === "star" && parts[p.id].scale) {
            parts[p.id].scale.set(1, p.sy, 1);
        }
    });
}

// === УЛУЧШЕНИЯ КАРТЫ: СЕТКА, ЗВЕЗДНОЕ НЕБО, КИБЕР-ЭЛЕМЕНТЫ ===
function addGridFloor() {
    // Цифровая светящаяся сетка пола
    const gridHelper = new THREE.GridHelper(300, 60, 0x00f3ff, 0x1d143a);
    gridHelper.position.y = 0.02; // слегка приподнимаем над грунтом
    scene.add(gridHelper);
}

function addStarrySky() {
    const starsGeometry = new THREE.BufferGeometry();
    const starCount = 1200;
    const positions = new Float32Array(starCount * 3);
    
    for (let i = 0; i < starCount * 3; i += 3) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        const radius = 250 + Math.random() * 50;
        
        positions[i] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i+1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i+2] = radius * Math.cos(phi);
    }
    
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const starTexture = new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/sprites/snowflake1.png', undefined, undefined, () => {});
    const starsMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.5,
        map: starTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    const starfield = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starfield);
}

function addCyberDecorations() {
    // 1. Светящиеся кибер-стены (границы карты 300x300)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xff007f, emissive: 0xff007f, emissiveIntensity: 0.6, roughness: 0.1, transparent: true, opacity: 0.35 });
    const wallGeo = new THREE.BoxGeometry(300, 12, 1);
    
    const northWall = new THREE.Mesh(wallGeo, wallMat);
    northWall.position.set(0, 6, -150);
    scene.add(northWall);
    
    const southWall = new THREE.Mesh(wallGeo, wallMat);
    southWall.position.set(0, 6, 150);
    scene.add(southWall);
    
    const eastWall = new THREE.Mesh(new THREE.BoxGeometry(1, 12, 300), wallMat);
    eastWall.position.set(150, 6, 0);
    scene.add(eastWall);
    
    const westWall = new THREE.Mesh(new THREE.BoxGeometry(1, 12, 300), wallMat);
    westWall.position.set(-150, 6, 0);
    scene.add(westWall);
    
    // 2. Кибер-деревья
    const treePositions = [
        {x: -40, z: -40}, {x: 40, z: -40}, {x: -40, z: 40}, {x: 40, z: 40},
        {x: -80, z: 20}, {x: 80, z: -20}, {x: 10, z: -90}, {x: -10, z: 90}
    ];
    
    treePositions.forEach(pos => {
        const treeGroup = new THREE.Group();
        treeGroup.position.set(pos.x, 0, pos.z);
        
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 7, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x1f1a30, roughness: 0.8, metalness: 0.2 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 3.5;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        treeGroup.add(trunk);
        
        const leafGeo = new THREE.OctahedronGeometry(2.2, 0);
        const leafColor = Math.random() > 0.5 ? 0x00f3ff : 0xff007f;
        const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, emissive: leafColor, emissiveIntensity: 1.1, roughness: 0.1, metalness: 0.9 });
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.y = 7.0;
        leaf.castShadow = true;
        treeGroup.add(leaf);
        
        scene.add(treeGroup);
    });
    
    // 3. Ворота для футбольного поля
    createSoccerGoal(50, 0, -80, 0);
    createSoccerGoal(50, 0, -20, Math.PI);
    
    // 4. Сцена с голограммой (x: 0, z: -40)
    const stageGeo = new THREE.BoxGeometry(22, 1.6, 12);
    const stageMat = new THREE.MeshStandardMaterial({ color: 0x0c0b18, roughness: 0.5, metalness: 0.8 });
    const stage = new THREE.Mesh(stageGeo, stageMat);
    stage.position.set(0, 0.8, -40);
    stage.receiveShadow = true;
    scene.add(stage);
    
    const holoGeo = new THREE.BoxGeometry(18, 9, 0.1);
    const holoMat = new THREE.MeshStandardMaterial({ color: 0x00f3ff, emissive: 0x00f3ff, emissiveIntensity: 0.8, transparent: true, opacity: 0.2, depthWrite: false });
    const hologram = new THREE.Mesh(holoGeo, holoMat);
    hologram.position.set(0, 6.0, -40);
    scene.add(hologram);
}

function createSoccerGoal(x, y, z, rotation) {
    const goalGroup = new THREE.Group();
    goalGroup.position.set(x, y, z);
    goalGroup.rotation.y = rotation;
    
    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.8 });
    
    const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4), postMat);
    leftPost.position.set(-6, 2, 0);
    leftPost.castShadow = true;
    goalGroup.add(leftPost);
    
    const rightPost = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4), postMat);
    rightPost.position.set(6, 2, 0);
    rightPost.castShadow = true;
    goalGroup.add(rightPost);
    
    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 12.3), postMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, 4, 0);
    crossbar.castShadow = true;
    goalGroup.add(crossbar);
    
    scene.add(goalGroup);
}


// === ЗАГРУЗКА И АНИМАЦИЯ АВАТАРОВ (СМЕШЕНИЕ АНИМАЦИЙ) ===
const gltfLoader = new THREE.GLTFLoader();
const mixers = [];
const clock = new THREE.Clock();

function loadPlayerMesh(color, callback) {
    const group = new THREE.Group();
    
    // Кэш-бастер (?v=Date.now()) предотвращает кэширование браузером старой/сломанной версии 3D-модели
    gltfLoader.load('roblox-bacon-hair.glb?v=' + Date.now(), (gltf) => {
        const model = gltf.scene;
        model.scale.set(2, 2, 2);
        
        model.traverse(node => {
            if(node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });
        
        let idleClip = null;
        let walkClip = null;
        
        if (gltf.animations && gltf.animations.length > 0) {
            gltf.animations.forEach(anim => {
                const name = anim.name.toLowerCase();
                if (name.includes('idle')) idleClip = anim;
                else if (name.includes('walk') || name.includes('run')) walkClip = anim;
            });
            
            if (!idleClip) idleClip = gltf.animations[0];
            if (!walkClip) walkClip = gltf.animations[1] || idleClip;
            
            const mixer = new THREE.AnimationMixer(model);
            mixers.push(mixer);
            
            const actions = {
                idle: mixer.clipAction(idleClip),
                walk: mixer.clipAction(walkClip)
            };
            
            actions.idle.play();
            
            group.userData.actions = actions;
            group.userData.currentAction = 'idle';
            group.userData.mixer = mixer;
        }
        
        model.position.y = -3;
        group.add(model);
        callback(group);
    }, undefined, (error) => {
        console.error("Ошибка загрузки GLTF модели:", error);
        
        // Fallback: Блочный персонаж (классический R6)
        const mat = createPBRMaterial(color, "pbr");
        const torso = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 1), mat);
        torso.position.y = 0; 
        torso.castShadow = true;
        torso.receiveShadow = true;
        
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), createPBRMaterial(0xffccaa, "pbr"));
        head.position.y = 2.25;
        head.castShadow = true;
        
        group.add(torso);
        group.add(head);
        
        group.userData.ragdollParts = [torso, head];
        callback(group);
    });
    
    return group;
}

function triggerRagdoll(player) {
    if(player.isRagdoll) return;
    player.isRagdoll = true;
    oofSound.currentTime = 0;
    oofSound.play().catch(e=>console.log(e));
    
    if(player.mesh.children[0] && player.mesh.children[0].userData.ragdollParts) {
        player.mesh.children[0].userData.ragdollParts.forEach(part => {
            part.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 15, 
                Math.random() * 15 + 10, 
                (Math.random() - 0.5) * 15
            );
        });
    } else {
        player.mesh.rotation.x = -Math.PI / 2;
    }
}

function updatePlayers(serverPlayers) {
    Object.keys(players).forEach(uid => {
        if (!serverPlayers[uid]) {
            scene.remove(players[uid].mesh);
            delete players[uid];
        }
    });

    let leaderboardHtml = "";
    Object.values(serverPlayers).forEach(p => {
        if (!players[p.id]) {
            const color = p.id === myUid ? 0x00f3ff : 0xff007f;
            const meshGroup = new THREE.Group();
            scene.add(meshGroup);
            
            players[p.id] = { mesh: meshGroup, data: p, isRagdoll: false };
            loadPlayerMesh(color, (loadedGroup) => {
                players[p.id].mesh.add(loadedGroup);
                players[p.id].loadedModel = loadedGroup;
            });
        }
        
        const plr = players[p.id];
        const isMoving = (p.x !== plr.data.x || p.z !== plr.data.z);
        
        // Управление смешиванием анимаций (Walk <-> Idle)
        if (plr.loadedModel && plr.loadedModel.userData.actions) {
            const actions = plr.loadedModel.userData.actions;
            const targetAction = isMoving ? 'walk' : 'idle';
            const currentAction = plr.loadedModel.userData.currentAction;
            
            if (targetAction !== currentAction && actions[targetAction]) {
                const curAct = actions[currentAction];
                const nextAct = actions[targetAction];
                
                if (curAct) curAct.fadeOut(0.25);
                nextAct.reset().fadeIn(0.25).play();
                
                plr.loadedModel.userData.currentAction = targetAction;
            }
        }
        
        if (p.is_dead) {
            triggerRagdoll(plr);
            if (plr.mesh.children[0] && plr.mesh.children[0].userData.ragdollParts) {
                plr.mesh.children[0].userData.ragdollParts.forEach(part => {
                    part.position.addScaledVector(part.userData.velocity, 0.016);
                    part.userData.velocity.y -= 196.2 * 0.016; 
                    if(part.position.y < -1.5) part.position.y = -1.5;
                });
            }
        } else {
            if(plr.isRagdoll) {
                plr.isRagdoll = false;
                plr.mesh.rotation.x = 0;
                if(plr.mesh.children[0] && plr.mesh.children[0].userData.ragdollParts) {
                    plr.mesh.children[0].userData.ragdollParts[0].position.set(0,0,0);
                    plr.mesh.children[0].userData.ragdollParts[1].position.set(0,2.25,0);
                }
            }
            plr.mesh.position.set(p.x, p.y, p.z);
            
            // Плавное вращение по курсу движения
            if (isMoving) {
                const dx = p.x - plr.data.x;
                const dz = p.z - plr.data.z;
                if(dx !== 0 || dz !== 0) {
                    const targetAngle = Math.atan2(dx, dz);
                    let diff = targetAngle - plr.mesh.rotation.y;
                    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                    plr.mesh.rotation.y += diff * 0.25;
                }
            }
        }
        plr.data = p;
        
        leaderboardHtml += `<tr><td>${p.name}</td><td>${p.points || 0}</td></tr>`;
        
        // Камера следует за локальным игроком
        if (p.id === myUid && !p.is_dead) {
            const offset = new THREE.Vector3(0, 0, cameraDistance);
            offset.applyAxisAngle(new THREE.Vector3(1, 0, 0), cameraPitch);
            offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
            
            camera.position.copy(plr.mesh.position).add(offset);
            camera.lookAt(plr.mesh.position.x, plr.mesh.position.y + 0.5, plr.mesh.position.z);
            
            // Обнаружение интерактивов в зоне видимости
            const checks = [
                {id: "cake", dist: 10, label: "E (Съесть)"},
                {id: "tank", dist: 15, label: "E (Покататься)"},
                {id: "cat_kuzya", dist: 5, label: "E (Погладить)"},
                {id: "obby_chest", dist: 10, label: "E (Забрать приз)"}
            ];
            
            let newTarget = null;
            let label = "E";
            for(let check of checks) {
                const part = parts[check.id];
                if (part && Math.hypot(p.x - part.position.x, p.z - part.position.z) < check.dist) {
                    newTarget = check.id;
                    label = check.label;
                    break;
                }
            }

            if (newTarget !== interactionTarget) {
                interactionTarget = newTarget;
                const btnInteract = document.getElementById("btn-interact");
                if (interactionTarget) {
                    btnInteract.classList.remove("hidden");
                    btnInteract.innerText = label;
                } else {
                    btnInteract.classList.add("hidden");
                }
            }
        }
    });
    
    document.getElementById("leaderboard-body").innerHTML = leaderboardHtml;
}

window.resetCharacter = function() {
    if(ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "reset" }));
    }
}

// === ЧАТ И АДМИН ПАНЕЛЬ ===
function addChatMessage(sender, msg) {
    const ul = document.getElementById("chat-messages");
    const li = document.createElement("li");
    li.innerHTML = `<strong>[${sender}]:</strong> ${msg}`;
    ul.appendChild(li);
    ul.scrollTop = ul.scrollHeight;
}

const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");

function sendChat() {
    const text = chatInput.value.trim();
    if (text && ws && ws.readyState === WebSocket.OPEN) {
        if (text.toLowerCase() === "привет") {
            document.getElementById("admin-panel").classList.remove("hidden");
        } else {
            ws.send(JSON.stringify({ type: "chat", msg: text }));
        }
        chatInput.value = "";
    }
}

chatSend.addEventListener("click", sendChat);
chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendChat();
});

window.adminCmd = function(cmd) {
    if(ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "admin_cmd", cmd: cmd }));
    }
};

// Генерация кнопок админ панели
const adminContainer = document.getElementById("admin-buttons-container");
if(adminContainer) {
    const categories = {
        "Хаос на сервере": [
            {id: "低_gravity", name: "Низкая гравитация"}, 
            {id: "high_gravity", name: "Высокая гравитация"}, {id: "zero_gravity", name: "Невесомость"},
            {id: "disco_mode", name: "Диско-мод (Свет)"}, {id: "meteor_shower", name: "Метеоритный дождь"},
            {id: "nuke", name: "Ядерный взрыв (Всем смерть)"}
        ],
        "Читы для игроков": [
            {id: "give_points", name: "+9999 Points"},
            {id: "god_mode", name: "Режим Бога (Тогл)"}, {id: "speed_boost", name: "Супер Скорость (160)"}
        ],
        "Спавн безумия": [
            {id: "spawn_tank", name: "Заспавнить Танк"}, {id: "spawn_cats", name: "Спавн x5 Котов"}
        ],
        "ДР Приколы": [
            {id: "cake_explosion", name: "Взрыв Торта"},
            {id: "confetti_rain", name: "Дождь Конфетти"}, {id: "disco_mode", name: "Цветомузыка"}
        ]
    };
    
    let html = "";
    for(const [cat, btns] of Object.entries(categories)) {
        html += `<div class="admin-category">${cat}</div>`;
        btns.forEach(b => {
            html += `<button class="admin-btn" onclick="adminCmd('${b.id}')">${b.name}</button>`;
        });
    }
    adminContainer.innerHTML = html;
}

window.buyShopItem = function(item) {
    if(ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "shop_buy", item: item }));
    }
}

// === КЛАВИАТУРНОЕ УПРАВЛЕНИЕ (ПОДДЕРЖКА ENG/RUS РАСКЛАДОК) ===
const inputState = { x: 0, y: 0, jump: false };
const keys = { 
    w: false, a: false, s: false, d: false, " ": false,
    ц: false, ф: false, ы: false, в: false 
};

document.addEventListener("keydown", (e) => {
    if(!isAuthenticated) return;
    if(e.target.tagName === 'INPUT') return;
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
    if ((key === "e" || key === "у") && interactionTarget && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "interact", target: interactionTarget }));
    }
});

document.addEventListener("keyup", (e) => {
    if(!isAuthenticated) return;
    if(e.target.tagName === 'INPUT') return;
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
});

const joystick = nipplejs.create({
    zone: document.getElementById('joystick-zone'),
    mode: 'static',
    position: { left: '50%', top: '50%' },
    color: 'white',
    size: 90
});

joystick.on('move', (evt, data) => {
    if(!isAuthenticated) return;
    if(data && data.vector) {
        const force = Math.min(data.force, 1);
        inputState.x = data.vector.x * force;
        inputState.y = -data.vector.y * force;
    }
});

joystick.on('end', () => {
    inputState.x = 0;
    inputState.y = 0;
});

const btnJump = document.getElementById("btn-jump");
btnJump.addEventListener("touchstart", (e) => { e.preventDefault(); if(isAuthenticated) inputState.jump = true; }, { passive: false });
btnJump.addEventListener("touchend", (e) => { e.preventDefault(); inputState.jump = false; }, { passive: false });
btnJump.addEventListener("mousedown", () => { if(isAuthenticated) inputState.jump = true; });
btnJump.addEventListener("mouseup", () => inputState.jump = false);

const btnInteract = document.getElementById("btn-interact");
const triggerInteract = (e) => {
    if(e) e.preventDefault();
    if (isAuthenticated && interactionTarget && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "interact", target: interactionTarget }));
    }
};
btnInteract.addEventListener("touchstart", triggerInteract, { passive: false });
btnInteract.addEventListener("mousedown", triggerInteract);

// Синхронизация ввода с частотой 60Гц
setInterval(() => {
    if (!isAuthenticated || !myUid || !ws || ws.readyState !== WebSocket.OPEN) return;
    
    let keyboardX = 0;
    let keyboardY = 0;
    
    if (keys.w || keys.ц) keyboardY -= 1;
    if (keys.s || keys.ы) keyboardY += 1;
    if (keys.a || keys.ф) keyboardX -= 1;
    if (keys.d || keys.в) keyboardX += 1;
    
    // Нормализуем клавиатурный ввод
    if(keyboardX !== 0 && keyboardY !== 0) {
        const len = Math.sqrt(keyboardX*keyboardX + keyboardY*keyboardY);
        keyboardX /= len;
        keyboardY /= len;
    }
    
    // Смешиваем сенсорный и клавиатурный джойстики
    let finalX = inputState.x !== 0 ? inputState.x : keyboardX;
    let finalY = inputState.y !== 0 ? inputState.y : keyboardY;
    let finalJump = inputState.jump || keys[" "];
    
    // Поворачиваем ввод в зависимости от направления взгляда камеры (рыскания Yaw)
    if (finalX !== 0 || finalY !== 0) {
        const cos = Math.cos(-cameraYaw);
        const sin = Math.sin(-cameraYaw);
        
        const rotatedX = finalX * cos - finalY * sin;
        const rotatedY = finalX * sin + finalY * cos;
        
        finalX = rotatedX;
        finalY = rotatedY;
    }

    ws.send(JSON.stringify({
        type: "input",
        data: { x: finalX, y: finalY, jump: finalJump }
    }));
}, 1000 / 60);

// === РЕНДЕР ЦИКЛ ===
function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    
    // Обновляем миксеры анимаций
    mixers.forEach(mixer => mixer.update(delta));
    
    // Анимируем вращение звезд и пульсацию некоторых элементов
    Object.values(parts).forEach(mesh => {
        if(mesh.geometry.type === "OctahedronGeometry") {
            mesh.rotation.y += 1.8 * delta;
            mesh.rotation.x += 0.5 * delta;
        }
    });
    
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});
