// --- CONSTANTES E VARIÁVEIS GLOBAIS ---
const NUM_LEVELS = 20;
let currentLevel = 1;
let gameIsRunning = false;
let gameLoopId;
let player = { x: 50, y: 300, width: 20, height: 20, velY: 0, onGround: false, speed: 4, jumpPower: -8 };
const gravity = 0.3;

// Objeto para rastrear o progresso (inicializa com 20 níveis como não-completados)
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
// x, y, w, h
const levelsData = {
    1: [
        { type: 'platform', x: 0, y: 350, w: 600, h: 50 }, // Chão principal
        { type: 'goal', x: 550, y: 310, w: 30, h: 40 }, // Meta
        // Level Devil Trick 1: O bloco de pulo é uma armadilha
        { type: 'trap_fake_platform', x: 250, y: 250, w: 50, h: 20, initialY: 250 },
        { type: 'platform', x: 100, y: 300, w: 50, h: 50 }, // Plataforma normal
    ],
    2: [
        { type: 'platform', x: 0, y: 350, w: 200, h: 50 },
        { type: 'platform', x: 400, y: 350, w: 200, h: 50 },
        { type: 'goal', x: 50, y: 310, w: 30, h: 40, reversed: true }, // Level Devil Trick 2: A meta está no início!
        { type: 'danger_invisible', x: 200, y: 340, w: 200, h: 10, visible: false }, // Buraco com armadilha invisível
        { type: 'platform_moving', x: 100, y: 250, w: 50, h: 20, speed: 1, range: 100 }, // Plataforma móvel
    ],
    3: [
        { type: 'platform', x: 0, y: 350, w: 600, h: 50 },
        { type: 'goal', x: 550, y: 310, w: 30, h: 40 },
        { type: 'platform', x: 150, y: 250, w: 50, h: 20 },
        // Level Devil Trick 3: O bloco antes da meta desaparece ao pular
        { type: 'platform_disappearing', x: 400, y: 300, w: 50, h: 20, triggered: false },
        { type: 'danger', x: 100, y: 330, w: 50, h: 20 }
    ],
    // Níveis 4 a 20: Usarão o nível 3 como placeholder para garantir a progressão de 20 níveis.
    // O desenvolvimento completo exigiria a criação de 17 níveis únicos.
};
// Preenche os níveis restantes com o Level 3 placeholder
for (let i = 4; i <= NUM_LEVELS; i++) {
    levelsData[i] = JSON.parse(JSON.stringify(levelsData[3])); // Deep copy
}
let currentLevelData = levelsData[currentLevel];


// --- FUNÇÕES DE NAVEGAÇÃO E UX ---

/**
 * Alterna a tela visível e controla o áudio.
 * @param {string} screenName - O nome da tela (chave no objeto 'screens').
 */
function navigateTo(screenName) {
    // 1. Esconde todas as telas
    Object.values(screens).forEach(screen => screen.classList.remove('active'));

    // 2. Exibe a tela desejada
    const nextScreen = screens[screenName];
    if (nextScreen) {
        nextScreen.classList.add('active');
    }

    // 3. Controle do Áudio e Loop do Jogo
    gameIsRunning = (screenName === 'game');
    if (gameIsRunning) {
        if (audioTrack.paused) {
            audioTrack.play().catch(e => console.log("Áudio não pôde iniciar automaticamente."));
        }
        startGameLoop();
    } else {
        cancelAnimationFrame(gameLoopId);
        // Pausa a música nos menus intermediários (Seleção e Créditos), mas não no Menu Principal
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

// --- CONFIGURAÇÃO E EVENT LISTENERS ---

// 1. Menu Principal
document.getElementById('btn-play').onclick = () => {
    // Tenta iniciar o áudio aqui.
    audioTrack.play().catch(e => console.log("Áudio não pôde iniciar automaticamente."));
    updateLevelSelect();
    navigateTo('levelSelect');
};
document.getElementById('btn-credits').onclick = () => navigateTo('credits');
document.getElementById('btn-exit').onclick = () => {
    // Comportamento do botão Sair em um contexto web:
    navigateTo('exit');
    audioTrack.pause();
    // window.close() é geralmente bloqueado por navegadores, então uma mensagem de despedida é a melhor alternativa.
};

// 2. Telas Intermediárias
document.getElementById('btn-back-to-main').onclick = () => navigateTo('mainMenu');
document.getElementById('btn-back-from-credits').onclick = () => navigateTo('mainMenu');
document.getElementById('btn-pause-game').onclick = () => navigateTo('levelSelect');


// --- LÓGICA DE JOGABILIDADE ---

/**
 * Carrega os dados de um nível e redefine o estado do jogador.
 * @param {number} levelNum - O número do nível a carregar.
 */
function loadLevel(levelNum) {
    currentLevel = levelNum;
    currentLevelData = JSON.parse(JSON.stringify(levelsData[currentLevel])); // Garante uma cópia limpa
    levelDisplay.textContent = `Nível: ${currentLevel}`;

    // Resetar a posição do jogador para o início
    player.x = 50;
    player.y = 300;
    player.velY = 0;
    player.onGround = false;
    
    // Resetar quaisquer estados de truques
    currentLevelData.forEach(obj => {
        if (obj.type === 'platform_disappearing') obj.triggered = false;
        if (obj.type === 'trap_fake_platform') obj.y = obj.initialY;
    });
}

/**
 * Lida com o evento de perda (tocar em armadilha/cair).
 * Reinicia o nível atual.
 */
function gameOver() {
    console.log(`Jogador perdeu no Nível ${currentLevel}. Reiniciando.`);
    loadLevel(currentLevel); // Volta ao início do nível
}

/**
 * Lida com a vitória do jogador.
 * Avança ou marca o nível como completo.
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

    // 1. Limpar e Movimentar
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Gravidade
    player.velY += gravity;
    player.y += player.velY;
    player.onGround = false;

    // 2. Movimento do Jogador (Lógica de Colisão)
    let isDead = false;

    currentLevelData.forEach(obj => {

        // LEVEL DEVIL LOGIC - Armadilhas e Movimento
        if (obj.type === 'platform_moving') {
            obj.x += obj.speed;
            if (obj.x > 500 || obj.x < 100) obj.speed *= -1;
        }

        if (obj.type === 'trap_fake_platform' && obj.y > 600) {
            // Se a plataforma falsa cair muito, ela reinicia
            obj.y = obj.initialY;
        }

        if (obj.type === 'platform_disappearing' && obj.triggered) {
             // A plataforma desaparece (move para fora da tela)
             obj.w = 0;
             obj.h = 0;
        }

        // Colisão com o mundo
        if (checkCollision(player, { x: obj.x, y: obj.y, w: obj.w, h: obj.h })) {
            if (obj.type === 'goal' && !obj.reversed) {
                levelComplete();
                return;
            }
            if (obj.type === 'goal' && obj.reversed) {
                // Truque Level Devil: Se a meta for no início, pular por cima dela é o que completa!
                // O jogador precisa evitar o bloco GOAL (pular por cima sem colidir)
                // Usaremos a colisão como a forma normal de vitória e o 'reversed' como a armadilha.
                // A colisão com um "reversed goal" mata o jogador no Level Devil real, mas aqui vamos
                // usar o ponto de partida do nível como a verdadeira meta.
                // Mas, seguindo a mecânica Level Devil: Colidiu com a meta no Level 2 = MORTE/RESTART
                gameOver();
                return;
            }

            if (obj.type === 'danger' || obj.type === 'danger_invisible') {
                isDead = true;
            }

            // Colisão Vertical (Piso)
            if (player.velY > 0) {
                // Se a colisão vier de cima (caindo)
                player.y = obj.y - player.height; // Ajusta a posição
                player.velY = 0; // Zera a velocidade vertical
                player.onGround = true;

                // Level Devil Trick 1 - O chão é uma armadilha!
                if (obj.type === 'trap_fake_platform' && !obj.triggered) {
                    obj.triggered = true;
                    obj.velY = 1; // Começa a cair
                }

                // Level Devil Trick 3 - Pular faz o bloco desaparecer
                if (obj.type === 'platform_disappearing' && !obj.triggered) {
                    // Se o jogador parar sobre ele, ele dispara
                    obj.triggered = true;
                }
            } else if (player.velY < 0) {
                // Colisão Vertical (Teto)
                player.y = obj.y + obj.h;
                player.velY = 0;

                // Level Devil Trick 3 - Bater no teto faz o bloco desaparecer
                if (obj.type === 'platform_disappearing' && !obj.triggered) {
                    obj.triggered = true;
                }
            }
        }

        // Movimento da Plataforma Falsa (Caindo)
        if (obj.type === 'trap_fake_platform' && obj.triggered) {
            obj.y += 3;
        }

        // 3. Desenhar o Mundo
        drawObject(obj);
    });

    if (isDead || player.y > canvas.height) {
        gameOver();
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
    if (obj.visible === false) return; // Não desenha objetos invisíveis

    ctx.fillStyle = '#444'; // Padrão
    if (obj.type.includes('platform')) ctx.fillStyle = '#2ecc71';
    if (obj.type.includes('danger')) ctx.fillStyle = '#e74c3c';
    if (obj.type.includes('trap')) ctx.fillStyle = '#f1c40f'; // Amarelo para armadilhas
    if (obj.type === 'goal') ctx.fillStyle = '#f39c12';

    ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
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
    // Esquerda e Direita
    if (keys['ArrowLeft'] || keys['a']) {
        player.x -= player.speed;
    }
    if (keys['ArrowRight'] || keys['d']) {
        player.x += player.speed;
    }

    // Pulo
    if ((keys['ArrowUp'] || keys['w'] || keys[' ']) && player.onGround) {
        player.velY = player.jumpPower;
        player.onGround = false;
    }

    // Limites da tela
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
}

// --- INICIALIZAÇÃO ---
function startGameLoop() {
    if (gameIsRunning) {
        gameLoop();
    }
}

// Inicializa a primeira tela
updateLevelSelect();
loadLevel(currentLevel);
navigateTo('mainMenu');