// Constantes
const W = 480, H = 640;
const PADDLE = { w: 96, h: 12, y: 600, speed: 420 };   // px/s
const BALL = { size: 16, speed: 320, maxAngle: 60 };   // px/s, grados desde la vertical
const MAX_DT = 0.05;                                   // s, límite del delta time
const BLOCK = { w: 40, h: 20, cols: 10, rows: 6, offsetX: 40, offsetY: 80 };
const ROW_COLORS = ['red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green'];
const POINTS_PER_BLOCK = 10;
const INITIAL_LIVES = 3;
const FADE_MS = 75;                                    // ms finales de la explosión con fade
const FLOAT_TEXT = { life: 600, riseSpeed: 40 };       // ms, px/s
const SHAKE = { duration: 120, magnitude: 3 };         // ms, px
const SOUND_VOLUME = 0.5;                              // volumen inicial (0 a 1)
const SOUND_FILES = {
  bounce: 'assets/sounds/ball-bounce.mp3',
  break: 'assets/sounds/break-sound.mp3',
};
const SPEED_PER_LEVEL = 0.05;                          // +5% de BALL.speed por nivel
const MAX_SPEED_FACTOR = 1.6;                          // tope: 1.6 × BALL.speed (≈ nivel 13)
const MAX_ROWS = 10;                                   // filas máximas (offsetY 80 + 10×20 = 280 px)
const PROC_START_LEVEL = 6;                            // primer nivel procedural
const GRAY_HITS = { base: 2, level3Hits: 10 };         // 2 golpes; 3 desde el nivel 10
const DAMAGED_ALPHA = 0.6;

// Rapidez de la bola en un nivel dado
function levelSpeed(level) {
  return BALL.speed * Math.min(1 + SPEED_PER_LEVEL * (level - 1), MAX_SPEED_FACTOR);
}

// Estado del juego
const state = {
  status: 'ready',
  level: 1,
  score: 0,
  lives: INITIAL_LIVES,
  paddle: { x: (W - PADDLE.w) / 2 },
  ball: { x: 0, y: 0, vx: 0, vy: 0, stuck: true },
  blocks: [],   // { x, y, color, alive, explosionT }
  floatTexts: [],   // { x, y, text, t }  (t = ms transcurridos)
  shakeT: null,     // null = sin sacudida, o ms transcurridos
};

// Patrones fijos (niveles 1-5): una cadena por fila, 10 caracteres por fila
//   '.' = hueco · '0'-'5' = índice en ROW_COLORS · 'G' = bloque gris
const LEVEL_PATTERNS = [
  // 1: layout original (6 filas completas)
  [
    '0000000000',
    '1111111111',
    '2222222222',
    '3333333333',
    '4444444444',
    '5555555555',
  ],
  // 2: tablero de ajedrez
  [
    '0.0.0.0.0.',
    '.1.1.1.1.1',
    '2.2.2.2.2.',
    '.3.3.3.3.3',
    '4.4.4.4.4.',
    '.5.5.5.5.5',
  ],
  // 3: pirámide
  [
    '....00....',
    '...1111...',
    '..222222..',
    '.33333333.',
    '4444444444',
  ],
  // 4: marco gris con interior de color
  [
    'GGGGGGGGGG',
    'G11111111G',
    'G22222222G',
    'G33333333G',
    'G44444444G',
    'GGGGGGGGGG',
  ],
  // 5: columnas alternas con grises y huecos
  [
    'G0G0G0G0G0',
    '1.1.1.1.1.',
    'G2G2G2G2G2',
    '.3.3.3.3.3',
    'G4G4G4G4G4',
    '5555555555',
  ],
];

// Golpes que necesita un bloque gris en un nivel dado
function grayHits(level) {
  return level >= GRAY_HITS.level3Hits ? 3 : 2;
}

// PRNG determinista (mulberry32): mismo seed, misma secuencia en [0, 1)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Parámetros de dificultad de los niveles procedurales (level >= PROC_START_LEVEL)
function levelParams(level) {
  const n = level - PROC_START_LEVEL;
  return {
    rows: Math.min(6 + Math.floor(n / 2), MAX_ROWS),
    density: Math.min(0.70 + 0.03 * n, 1),
    grayChance: Math.min(0.10 + 0.04 * n, 0.5),
  };
}

function makeBlock(r, c, color, hits) {
  return {
    x: BLOCK.offsetX + c * BLOCK.w,
    y: BLOCK.offsetY + r * BLOCK.h,
    color,
    alive: true,
    explosionT: null,
    hits,
    maxHits: hits,
  };
}

// Nivel procedural: reproducible porque el PRNG se siembra con el número de nivel
function buildProceduralLevel(level) {
  const { rows, density, grayChance } = levelParams(level);
  const rng = mulberry32(level);
  const blocks = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < BLOCK.cols; c++) {
      if (rng() >= density) continue;
      const gray = rng() < grayChance;
      blocks.push(gray
        ? makeBlock(r, c, 'gray', grayHits(level))
        : makeBlock(r, c, ROW_COLORS[r % ROW_COLORS.length], 1));
    }
  }
  // Un nivel nunca queda vacío: se fuerza un bloque
  if (blocks.length === 0) blocks.push(makeBlock(0, 0, ROW_COLORS[0], 1));
  return blocks;
}

// Devuelve la lista de bloques del nivel (patrón fijo o procedural)
function buildLevel(level) {
  if (level >= PROC_START_LEVEL) return buildProceduralLevel(level);
  const pattern = LEVEL_PATTERNS[level - 1];
  const blocks = [];
  for (let r = 0; r < pattern.length; r++) {
    for (let c = 0; c < BLOCK.cols; c++) {
      const ch = pattern[r][c];
      if (ch === '.') continue;
      blocks.push(ch === 'G'
        ? makeBlock(r, c, 'gray', grayHits(level))
        : makeBlock(r, c, ROW_COLORS[Number(ch)], 1));
    }
  }
  return blocks;
}
state.blocks = buildLevel(state.level);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// --- Sonido ---
// Estado de audio fuera de `state`: no se reinicia con resetGame()
const sounds = {};
let muted = false;
for (const name in SOUND_FILES) {
  sounds[name] = new Audio(SOUND_FILES[name]);
  sounds[name].volume = SOUND_VOLUME;
}

// Un único Audio por sonido: si aún suena, se reinicia en lugar de clonarse
function playSound(name) {
  if (muted) return;
  const s = sounds[name];
  s.currentTime = 0;
  const p = s.play();
  if (p) p.catch(() => {});   // autoplay bloqueado o archivo ausente: se ignora
}

// --- Controles ---
const keys = { left: false, right: false };

function setKey(e, down) {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = down;
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = down;
  else return;
  e.preventDefault();
}
window.addEventListener('keydown', (e) => setKey(e, true));
window.addEventListener('keyup', (e) => setKey(e, false));

function clampPaddle() {
  state.paddle.x = Math.max(0, Math.min(W - PADDLE.w, state.paddle.x));
}

// Convierte la x del puntero (px CSS) a coordenadas lógicas y centra la pala ahí
function movePaddleToPointer(clientX) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * (W / rect.width);
  state.paddle.x = x - PADDLE.w / 2;
  clampPaddle();
}
// Pointer events cubren mouse (sigue el cursor) y táctil (arrastrar)
window.addEventListener('pointermove', (e) => movePaddleToPointer(e.clientX));
canvas.addEventListener('pointerdown', (e) => movePaddleToPointer(e.clientX));

// --- Bola ---
function stickBall() {
  state.ball.stuck = true;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.status = 'ready';
}

function resetGame() {
  state.level = 1;
  state.score = 0;
  state.lives = INITIAL_LIVES;
  state.blocks = buildLevel(state.level);
  state.floatTexts = [];
  state.shakeT = null;
  state.paddle.x = (W - PADDLE.w) / 2;
  stickBall();
}

// Pasa al nivel siguiente: puntaje y vidas se conservan; los efectos en curso siguen
function nextLevel() {
  state.level += 1;
  state.blocks = buildLevel(state.level);
  stickBall();
}

// Espacio / click / tap: lanza la bola, avanza de nivel, o reinicia si la partida terminó
function onAction() {
  if (state.status === 'gameover') resetGame();
  else if (state.status === 'levelup') nextLevel();
  else launchBall();
}

function launchBall() {
  const b = state.ball;
  if (!b.stuck || state.status !== 'ready') return;
  // Hacia arriba con 20° de desvío, a izquierda o derecha al azar
  const angle = (Math.random() < 0.5 ? -1 : 1) * 20 * Math.PI / 180;
  const speed = levelSpeed(state.level);
  b.vx = speed * Math.sin(angle);
  b.vy = -speed * Math.cos(angle);
  b.stuck = false;
  state.status = 'playing';
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat) onAction();
  }
});
canvas.addEventListener('pointerdown', onAction);

// Rebote en la pala: el ángulo depende del punto de impacto (borde = maxAngle),
// la rapidez se mantiene en BALL.speed
function bouncePaddle() {
  const b = state.ball;
  const p = state.paddle;
  if (b.vy <= 0) return;                               // solo si la bola baja
  const overlapsX = b.x + BALL.size > p.x && b.x < p.x + PADDLE.w;
  const overlapsY = b.y + BALL.size >= PADDLE.y && b.y < PADDLE.y + PADDLE.h;
  if (!overlapsX || !overlapsY) return;

  const hit = ((b.x + BALL.size / 2) - (p.x + PADDLE.w / 2)) / (PADDLE.w / 2);
  const angle = Math.max(-1, Math.min(1, hit)) * BALL.maxAngle * Math.PI / 180;
  const speed = levelSpeed(state.level);
  b.vx = speed * Math.sin(angle);
  b.vy = -speed * Math.cos(angle);
  b.y = PADDLE.y - BALL.size;                          // evita quedar dentro de la pala
}

// Colisión bola-bloque: como máximo un bloque por frame; se invierte el eje
// con menor penetración
function collideBlocks() {
  const b = state.ball;
  for (const blk of state.blocks) {
    if (!blk.alive || blk.explosionT !== null) continue;   // en explosión no colisiona
    const overlapX = Math.min(b.x + BALL.size - blk.x, blk.x + BLOCK.w - b.x);
    const overlapY = Math.min(b.y + BALL.size - blk.y, blk.y + BLOCK.h - b.y);
    if (overlapX <= 0 || overlapY <= 0) continue;

    if (overlapX < overlapY) {
      const fromLeft = b.x + BALL.size / 2 < blk.x + BLOCK.w / 2;
      b.x += fromLeft ? -overlapX : overlapX;
      b.vx = fromLeft ? -Math.abs(b.vx) : Math.abs(b.vx);
    } else {
      const fromTop = b.y + BALL.size / 2 < blk.y + BLOCK.h / 2;
      b.y += fromTop ? -overlapY : overlapY;
      b.vy = fromTop ? -Math.abs(b.vy) : Math.abs(b.vy);
    }
    // Golpe no letal: descuenta un golpe y solo rebota; el letal rompe el bloque
    blk.hits -= 1;
    if (blk.hits <= 0) breakBlock(blk);
    return;
  }
}

// Rompe un bloque: único lugar que inicia la explosión y suma el puntaje.
// Idempotente por bloque y sin depender de la bola.
function breakBlock(blk) {
  if (blk.explosionT !== null) return;
  blk.explosionT = 0;
  state.score += POINTS_PER_BLOCK;
  state.floatTexts.push({
    x: blk.x + BLOCK.w / 2,
    y: blk.y + BLOCK.h / 2,
    text: '+' + POINTS_PER_BLOCK,
    t: 0,
  });
  state.shakeT = 0;   // reinicia la sacudida, no se acumula
}

// Avanza los efectos (ms) y elimina los textos vencidos
function updateEffects(dt) {
  const ms = dt * 1000;
  for (const ft of state.floatTexts) ft.t += ms;
  state.floatTexts = state.floatTexts.filter((ft) => ft.t < FLOAT_TEXT.life);
  if (state.shakeT !== null) {
    state.shakeT += ms;
    if (state.shakeT >= SHAKE.duration) state.shakeT = null;
  }
}

// Avanza las explosiones (ms) y elimina el bloque al terminar
function updateExplosions(dt) {
  for (const blk of state.blocks) {
    if (!blk.alive || blk.explosionT === null) continue;
    blk.explosionT += dt * 1000;
    if (blk.explosionT >= EXPLOSION_DURATION) blk.alive = false;
  }
}

function updateBall(dt) {
  const b = state.ball;
  if (state.status === 'levelup' || state.status === 'gameover') return;
  if (b.stuck) {
    // Pegada al centro de la pala
    b.x = state.paddle.x + (PADDLE.w - BALL.size) / 2;
    b.y = PADDLE.y - BALL.size;
    return;
  }

  b.x += b.vx * dt;
  b.y += b.vy * dt;

  // Paredes laterales y techo
  if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); }
  else if (b.x + BALL.size > W) { b.x = W - BALL.size; b.vx = -Math.abs(b.vx); }
  if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); }

  bouncePaddle();
  collideBlocks();

  // Si cae por abajo se pierde una vida y la bola vuelve pegada a la pala
  if (b.y > H) loseLife();
}

function loseLife() {
  state.lives -= 1;
  if (state.lives <= 0) state.status = 'gameover';
  else stickBall();
}

function update(dt) {
  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (dir !== 0) {
    state.paddle.x += dir * PADDLE.speed * dt;
    clampPaddle();
  }
  updateBall(dt);
  updateExplosions(dt);
  updateEffects(dt);

  // Nivel superado: no queda ningún bloque (tras terminar la última explosión)
  if (state.status === 'playing' && state.blocks.every((blk) => !blk.alive)) {
    state.status = 'levelup';
  }
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Área de juego con offset de shake (decae linealmente a 0); HUD y pantalla final quedan fuera
  ctx.save();
  if (state.shakeT !== null) {
    const k = SHAKE.magnitude * (1 - state.shakeT / SHAKE.duration);
    ctx.translate((Math.random() * 2 - 1) * k, (Math.random() * 2 - 1) * k);
  }
  for (const blk of state.blocks) {
    if (!blk.alive) continue;
    if (blk.explosionT === null) {
      // Bloque dañado (le quedan menos golpes que su máximo): atenuado
      if (blk.hits < blk.maxHits) ctx.globalAlpha = DAMAGED_ALPHA;
      drawSprite(ctx, 'block_' + blk.color, blk.x, blk.y, BLOCK.w, BLOCK.h);
      ctx.globalAlpha = 1;
    } else {
      const frames = EXPLOSION_FRAMES[blk.color];
      const i = Math.min(frames.length - 1, Math.floor(blk.explosionT / (EXPLOSION_DURATION / frames.length)));
      // Fade-out lineal de 1 a 0 durante los últimos FADE_MS de la explosión
      const fadeStart = EXPLOSION_DURATION - FADE_MS;
      const alpha = Math.max(0, Math.min(1, 1 - (blk.explosionT - fadeStart) / FADE_MS));
      ctx.globalAlpha = alpha;
      drawFrame(ctx, frames[i], blk.x, blk.y, BLOCK.w, BLOCK.h);
      ctx.globalAlpha = 1;
    }
  }
  drawSprite(ctx, 'paddle', state.paddle.x, PADDLE.y, PADDLE.w, PADDLE.h);
  drawSprite(ctx, 'ball', state.ball.x, state.ball.y, BALL.size, BALL.size);
  drawFloatTexts();
  ctx.restore();
  drawHud();
  if (state.status === 'levelup') drawEndScreen('Nivel ' + (state.level + 1), 'continuar');
  else if (state.status === 'gameover') drawEndScreen('Game Over', 'reiniciar');
}

// Textos flotantes: suben a riseSpeed px/s y su alfa baja de 1 a 0 con t / life
function drawFloatTexts() {
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const ft of state.floatTexts) {
    ctx.globalAlpha = Math.max(0, 1 - ft.t / FLOAT_TEXT.life);
    ctx.fillText(ft.text, ft.x, ft.y - FLOAT_TEXT.riseSpeed * ft.t / 1000);
  }
  ctx.globalAlpha = 1;
}

function drawEndScreen(title, action) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 48px monospace';
  ctx.fillText(title, W / 2, H / 2 - 40);
  ctx.font = '24px monospace';
  ctx.fillText('Puntaje: ' + state.score, W / 2, H / 2 + 10);
  ctx.font = '18px monospace';
  ctx.fillText('Espacio, click o tap para ' + action, W / 2, H / 2 + 50);
}

function drawHud() {
  ctx.fillStyle = '#fff';
  ctx.font = '20px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('Puntaje: ' + state.score, 16, 30);
  ctx.textAlign = 'center';
  ctx.fillText('Nivel ' + state.level, W / 2, 30);
  ctx.textAlign = 'left';
  const icon = 16, gap = 6;
  for (let i = 0; i < state.lives; i++) {
    const x = W - 16 - icon - i * (icon + gap);
    drawSprite(ctx, 'ball', x, 30 - icon / 2, icon, icon);
  }
}

let lastTime = 0;
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, MAX_DT);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// El bucle arranca solo cuando el spritesheet está cargado
loadSpritesheet(() => {
  requestAnimationFrame((now) => {
    lastTime = now;
    loop(now);
  });
});
