// --- CONSTANTES E VARIÁVEIS GLOBAIS ---
const NUM_LEVELS = 20;
let currentLevel = 1;
let gameIsRunning = false;
let gameLoopId;

// Objeto do Jogador
let player = { x: 50, y: 300, width: 20, height: 20, velY: 0, onGround: false, speed: 4, jumpPower: -8 };
const gravity = 0.3;

// Progresso e Salve
let progress = JSON.parse(localStorage.getItem('levelDevilProgress')) || new Array(NUM_LEVELS).fill(false);

// Referências a elementos do DOM
const screens = {
    mainMenu: document.getElementById('main-menu'),
    levelSelect: document.getElementById('level-select-menu'),
    credits: document.getElementById('credits-screen'),
    game: document.getElementById('game-screen'),
    exit: document.getElementById('exit-message')
};
const audioTrack = document.getElementById('game-soundtrack');
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const levelDisplay = document.getElementById('level-display');


// --- DADOS DOS NÍVEIS (LEVEL DEVIL STYLE) ---
const levelsData = {
    // Nível 1: Plataforma que cai (trap_fake_platform)
    1: [
        { type: 'platform', x: 0, y: 350, w: 600, h: 50 },
        { type: 'goal', x: 550, y: 310, w: 30, h: 40 },
        { type: 'trap_fake_platform', x: 250, y: 250, w: 50, h: 20, initialY: 250, triggered: false },
        { type: 'platform', x: 100, y: 300, w: 50, h: 50 },
    ],
    // Nível 2: Meta Traiçoeira no início e armadilha invisível no chão
    2: [
        { type: 'platform', x: 0, y: 350, w: 200, h: 50 },
        { type: 'platform', x: 400, y: 350, w: 200, h: 50 },
        { type: 'goal', x: 50, y: 310, w: 30, h: 40, reversed: true }, 
        { type: 'danger_invisible', x: 200, y: 340, w: 200, h: 10, visible: false }, 
        { type: 'platform_moving', x: 100, y: 250, w: 50, h: 20, speed: 1, range: 100 },
        { type: 'goal', x: 550, y: 310, w: 30, h: 40, reversed: false, visible: false }, 
    ],
    // Nível 3: Bloco que desaparece (platform_disappearing)
    3: [
        { type: 'platform', x: 0, y: 350, w: 600, h: 50 },
        { type: 'goal', x: 550, y: 310, w: 30, h: 40 },
        { type: 'platform', x: 150, y: 250, w: 50, h: 20 },
        { type: 'platform_disappearing', x: 400, y: 300, w: 50, h: 20, triggered: false, initialW: 50, initialH: 20 },
        { type: 'danger', x: 100, y: 330, w: 50, h: 20 }
    ],
    // Nível 4: O CHÃO É LAVA! (Chão principal é perigoso)
    4: [
        { type: 'danger', x: 0, y: 350, w: 600, h: 50 },
        { type: 'goal', x: 550, y: 310, w: 30, h: 40 },
        { type: 'platform', x: 50, y: 300, w: 50, h: 50 },
        { type: 'platform', x: 250, y: 250, w: 100, h: 20 },
        { type: 'platform', x: 450, y: 300, w: 50, h: 50 },
    ],
    // Nível 5: Teto que Cai (trap_ceiling)
    5: [
        { type: 'platform', x: 0, y: 350, w: 600, h: 50 },
        { type: 'goal', x: 550, y: 310, w: 30, h: 40 },
        { type: 'trap_ceiling', x: 0, y: 0, w: 600, h: 20, triggered: false, velY: 0 },
        { type: 'danger', x: 200, y: 300, w: 20, h: 50 },
    ],
    // Nível 6: Plataforma Falsa antes da meta + buraco invisível (Complexo)
    6: [
        { type: 'platform', x: 0, y: 350, w: 600, h: 50 },
        { type: 'goal', x: 550, y: 310, w: 30, h: 40 },
        { type: 'platform', x: 100, y: 250, w: 50, h: 20 },
        { type: 'trap_fake_platform', x: 450, y: 350, w: 100, h: 50, initialY: 350, triggered: false },
        { type: 'danger_invisible', x: 200, y: 340, w: 100, h: 10, visible: false },
    ]
};

// Preenche os níveis restantes (7 a 20) com o Level 6 placeholder
for (let i = 7; i <= NUM_LEVELS; i++) {
    levelsData[i] = JSON.parse(JSON.stringify(levelsData[6]));
}
let currentLevelData = levelsData[currentLevel];


// --- FUNÇÕES DE NAVEGAÇÃO E UX ---

/**
 * Alterna a tela visível e controla o áudio.
 */
function navigateTo(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    const nextScreen = screens[screenName];
    if (nextScreen) {
        nextScreen.classList.add('active');
    }

    gameIsRunning = (screenName === 'game');
    if (gameIsRunning) {
        if (audioTrack.paused) {
            audioTrack.play().catch(e => console.log("Áudio não pôde iniciar automaticamente."));
        }
        startGameLoop();
    } else {
        cancelAnimationFrame(gameLoopId);
        if (screenName !== 'mainMenu' && !audioTrack.paused) {
             audioTrack.pause();
        }
    }
}

/**
 * Salva o progresso e recria o grid de seleção de nível.
 */
function updateLevelSelect() {
    localStorage.setItem('levelDevilProgress', JSON.stringify(progress));

    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';

    for (let i = 1; i <= NUM_LEVELS; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.classList.add('level-button');
        if (progress[i - 1]) {
            btn.classList.add('completed');
        }
        btn.onclick = () => {
            currentLevel = i;
            loadLevel(currentLevel);
            navigateTo('game');
        };
        grid.appendChild(btn);
    }
}

// --- CONFIGURAÇÃO E EVENT LISTENERS DE NAVEGAÇÃO ---

document.getElementById('btn-play').onclick = () => {
    audioTrack.play().catch(e => console.log("Áudio não pôde iniciar automaticamente."));
    updateLevelSelect();
    navigateTo('levelSelect');
};
document.getElementById('btn-credits').onclick = () => navigateTo('credits');
document.getElementById('btn-exit').onclick = () => {
    navigateTo('exit');
    audioTrack.pause();
};

document.getElementById('btn-back-to-main').onclick = () => navigateTo('mainMenu');
document.getElementById('btn-back-from-credits').onclick = () => navigateTo('mainMenu');
document.getElementById('btn-pause-game').onclick = () => navigateTo('levelSelect');


// --- LÓGICA DE JOGABILIDADE ---

/**
 * Carrega os dados de um nível e redefine o estado do jogador e dos objetos.
 */
function loadLevel(levelNum) {
    currentLevel = levelNum;
    currentLevelData = JSON.parse(JSON.stringify(levelsData[currentLevel]));
    levelDisplay.textContent = `Nível: ${currentLevel}`;

    // Resetar a posição do jogador
    player.x = 50;
    player.y = 300;
    player.velY = 0;
    player.onGround = false;
    
    // Resetar estados de truques nos objetos
    currentLevelData.forEach(obj => {
        if (obj.type.includes('disappearing')) {
            obj.triggered = false;
            obj.w = obj.initialW;
            obj.h = obj.initialH;
        }
        if (obj.type.includes('trap_fake_platform')) {
            obj.y = obj.initialY;
            obj.triggered = false;
        }
        if (obj.type.includes('trap_ceiling')) {
            obj.y = 0; // Teto volta ao topo
            obj.triggered = false;
            obj.velY = 0;
        }
    });
}

/**
 * Lida com o evento de perda (reinicia o nível atual).
 */
function gameOver() {
    console.log(`Jogador perdeu no Nível ${currentLevel}. Reiniciando.`);
    loadLevel(currentLevel); // Volta ao início do nível
}

/**
 * Lida com a vitória do jogador.
 */
function levelComplete() {
    progress[currentLevel - 1] = true;
    console.log(`Nível ${currentLevel} COMPLETO!`);

    if (currentLevel < NUM_LEVELS) {
        currentLevel++;
        loadLevel(currentLevel);
    } else {
        alert("PARABÉNS! Você completou todos os Níveis!");
        navigateTo('mainMenu');
    }
}


// --- DETECÇÃO DE COLISÃO (AABB) ---
function checkCollision(r1, r2) {
    return r1.x < r2.x + r2.w &&
           r1.x + r1.width > r2.x &&
           r1.y < r2.y + r2.h &&
           r1.y + r1.height > r2.y;
}

// --- LOOP PRINCIPAL DO JOGO ---
function gameLoop() {
    if (!gameIsRunning) return;

    // 1. Limpar, Gravidade e Movimentar
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    player.velY += gravity;
    player.y += player.velY;
    player.onGround = false;

    // 2. Movimento e Colisão
    let isDead = false;

    currentLevelData.forEach(obj => {

        // LEVEL DEVIL LOGIC - Armadilhas e Movimento
        
        // Plataforma Móvel
        if (obj.type === 'platform_moving') {
            obj.x += obj.speed;
            if (obj.x > 500 || obj.x < 100) obj.speed *= -1;
        }

        // Plataforma Falsa Caindo
        if (obj.type === 'trap_fake_platform' && obj.triggered) {
            obj.y += 3; 
            if (obj.y > canvas.height) {
                obj.y = obj.initialY;
                obj.triggered = false;
            }
        }

        // Bloco Desaparecendo
        if (obj.type === 'platform_disappearing' && obj.triggered) {
             obj.w = Math.max(0, obj.w - 2);
             obj.h = Math.max(0, obj.h - 2);
        }
        
        // Teto que Cai (Nível 5)
        if (obj.type === 'trap_ceiling') {
            // Condição de trigger: Pular na área central
            if (!obj.triggered && player.y < 300 && player.x > 100 && player.x < 500 && player.velY < 0) {
                obj.triggered = true;
                obj.velY = 2; // Começa a cair lentamente
            }
            
            if (obj.triggered) {
                obj.y += obj.velY;
                if (obj.y > 100) obj.velY = 4; 
            }
        }


        // --- DETECÇÃO DE COLISÃO ---
        if (checkCollision(player, { x: obj.x, y: obj.y, w: obj.w, h: obj.h })) {
            
            // Vitória/Morte por Meta
            if (obj.type === 'goal') {
                if (!obj.reversed) {
                    levelComplete();
                    return;
                } else {
                    isDead = true; // Meta traiçoeira mata
                }
            }
            
            // Morte por Dano
            if (obj.type.includes('danger') || obj.type.includes('trap_ceiling')) {
                isDead = true;
            }

            // Colisão Vertical (Piso)
            if (obj.type.includes('platform') && player.velY > 0 && player.y + player.height <= obj.y + player.velY) {
                
                player.y = obj.y - player.height; 
                player.velY = 0; 
                player.onGround = true;

                // Lógica de "carregar" para plataforma móvel
                if (obj.type === 'platform_moving') {
                    player.x += obj.speed;
                }
                
                // Triggers de armadilhas ao pisar
                if (obj.type === 'trap_fake_platform') { obj.triggered = true; }
                if (obj.type === 'platform_disappearing') { obj.triggered = true; }
            } 
            
            // Colisão Vertical (Teto)
            else if (obj.type.includes('platform') && player.velY < 0 && player.y >= obj.y + obj.h - player.velY) {
                player.y = obj.y + obj.h;
                player.velY = 0;

                // Triggers de armadilhas ao bater no teto
                if (obj.type === 'platform_disappearing') { obj.triggered = true; }
            }
        }
    });

    // Morte por queda ou armadilha
    if (isDead || player.y > canvas.height) {
        gameOver();
        return;
    }

    // 4. Desenhar o Jogador
    drawPlayer();

    // 5. Controles
    handleMovement();

    // Loop
    gameLoopId = requestAnimationFrame(gameLoop);
}

// --- FUNÇÕES DE DESENHO ---
function drawObject(obj) {
    if (obj.visible === false && !obj.triggered) return; 

    ctx.fillStyle = '#444';
    if (obj.type.includes('platform')) ctx.fillStyle = '#2ecc71';
    if (obj.type.includes('danger')) ctx.fillStyle = '#e74c3c';
    if (obj.type.includes('trap')) ctx.fillStyle = '#f1c40f'; 
    if (obj.type === 'goal') ctx.fillStyle = obj.visible === false ? 'rgba(255, 255, 0, 0)' : '#f39c12';
    
    if (obj.visible !== false || obj.type === 'trap_ceiling' || obj.type === 'trap_fake_platform') {
         ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    }
}

function drawPlayer() {
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(player.x, player.y, player.width, player.height);
}


// --- CONTROLES DE ENTRADA ---
let keys = {};
window.onkeydown = (e) => { keys[e.key] = true; };
window.onkeyup = (e) => { keys[e.key] = false; };

function handleMovement() {
    if (keys['ArrowLeft'] || keys['a']) {
        player.x -= player.speed;
    }
    if (keys['ArrowRight'] || keys['d']) {
        player.x += player.speed;
    }

    if ((keys['ArrowUp'] || keys['w'] || keys[' ']) && player.onGround) {
        player.velY = player.jumpPower;
        player.onGround = false;
    }

    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
}

// --- INICIALIZAÇÃO ---
function startGameLoop() {
    if (gameIsRunning) {
        gameLoop();
    }
}

// Inicializa o jogo ao carregar a página
updateLevelSelect();
loadLevel(currentLevel);
navigateTo('mainMenu');