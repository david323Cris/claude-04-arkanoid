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

// Estado del juego
const state = {
  status: 'ready',
  score: 0,
  lives: INITIAL_LIVES,
  paddle: { x: (W - PADDLE.w) / 2 },
  ball: { x: 0, y: 0, vx: 0, vy: 0, stuck: true },
  blocks: [],   // { x, y, color, alive, explosionT }
  floatTexts: [],   // { x, y, text, t }  (t = ms transcurridos)
  shakeT: null,     // null = sin sacudida, o ms transcurridos
};

function createBlocks() {
  const blocks = [];
  for (let r = 0; r < BLOCK.rows; r++) {
    for (let c = 0; c < BLOCK.cols; c++) {
      blocks.push({
        x: BLOCK.offsetX + c * BLOCK.w,
        y: BLOCK.offsetY + r * BLOCK.h,
        color: ROW_COLORS[r],
        alive: true,
        explosionT: null,
      });
    }
  }
  return blocks;
}
state.blocks = createBlocks();

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

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
  state.score = 0;
  state.lives = INITIAL_LIVES;
  state.blocks = createBlocks();
  state.floatTexts = [];
  state.shakeT = null;
  state.paddle.x = (W - PADDLE.w) / 2;
  stickBall();
}

// Espacio / click / tap: lanza la bola, o reinicia si la partida terminó
function onAction() {
  if (state.status === 'won' || state.status === 'gameover') resetGame();
  else launchBall();
}

function launchBall() {
  const b = state.ball;
  if (!b.stuck || state.status !== 'ready') return;
  // Hacia arriba con 20° de desvío, a izquierda o derecha al azar
  const angle = (Math.random() < 0.5 ? -1 : 1) * 20 * Math.PI / 180;
  b.vx = BALL.speed * Math.sin(angle);
  b.vy = -BALL.speed * Math.cos(angle);
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
  b.vx = BALL.speed * Math.sin(angle);
  b.vy = -BALL.speed * Math.cos(angle);
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
    breakBlock(blk);
    return;
  }
}

// Rompe un bloque: único lugar que inicia la explosión y suma el puntaje.
// Idempotente por bloque y sin depender de la bola.
function breakBlock(blk) {
  if (blk.explosionT !== null) return;
  blk.explosionT = 0;
  state.score += POINTS_PER_BLOCK;
}

// Avanza los efectos (ms) y elimina los textos vencidos
function updateEffects(dt) {
  const ms = dt * 1000;
  for (const ft of state.floatTexts) ft.t += ms;
  state.floatTexts = state.floatTexts.filter((ft) => ft.t < FLOAT_TEXT.life);
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
  if (state.status === 'won' || state.status === 'gameover') return;
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

  // Victoria: no queda ningún bloque (tras terminar la última explosión)
  if (state.status === 'playing' && state.blocks.every((blk) => !blk.alive)) {
    state.status = 'won';
  }
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  for (const blk of state.blocks) {
    if (!blk.alive) continue;
    if (blk.explosionT === null) {
      drawSprite(ctx, 'block_' + blk.color, blk.x, blk.y, BLOCK.w, BLOCK.h);
    } else {
      const frames = EXPLOSION_FRAMES[blk.color];
      const i = Math.min(frames.length - 1, Math.floor(blk.explosionT / (EXPLOSION_DURATION / frames.length)));
      drawFrame(ctx, frames[i], blk.x, blk.y, BLOCK.w, BLOCK.h);
    }
  }
  drawSprite(ctx, 'paddle', state.paddle.x, PADDLE.y, PADDLE.w, PADDLE.h);
  drawSprite(ctx, 'ball', state.ball.x, state.ball.y, BALL.size, BALL.size);
  drawHud();
  if (state.status === 'won') drawEndScreen('¡Ganaste!');
  else if (state.status === 'gameover') drawEndScreen('Game Over');
}

function drawEndScreen(title) {
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
  ctx.fillText('Espacio, click o tap para reiniciar', W / 2, H / 2 + 50);
}

function drawHud() {
  ctx.fillStyle = '#fff';
  ctx.font = '20px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('Puntaje: ' + state.score, 16, 30);
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
