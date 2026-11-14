// Constantes
const W = 480, H = 640;
const PADDLE = { w: 96, h: 12, y: 600, speed: 420 };   // px/s
const BALL = { size: 16, speed: 320, maxAngle: 60 };   // px/s, grados desde la vertical
const MAX_DT = 0.05;                                   // s, límite del delta time
const BLOCK = { w: 40, h: 20, cols: 10, rows: 6, offsetX: 40, offsetY: 80 };
const ROW_COLORS = ['red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green'];
const POINTS_PER_BLOCK = 10;

// Estado del juego
const state = {
  status: 'ready',
  score: 0,
  paddle: { x: (W - PADDLE.w) / 2 },
  ball: { x: 0, y: 0, vx: 0, vy: 0, stuck: true },
  blocks: [],   // { x, y, color, alive, explosionT }
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

function launchBall() {
  const b = state.ball;
  if (!b.stuck) return;
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
    launchBall();
  }
});
canvas.addEventListener('pointerdown', launchBall);

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
    if (!blk.alive) continue;
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
    blk.alive = false;
    state.score += POINTS_PER_BLOCK;
    return;
  }
}

function updateBall(dt) {
  const b = state.ball;
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

  // Provisional hasta el paso 8 (vidas): si cae por abajo vuelve pegada a la pala
  if (b.y > H) stickBall();
}

function update(dt) {
  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (dir !== 0) {
    state.paddle.x += dir * PADDLE.speed * dt;
    clampPaddle();
  }
  updateBall(dt);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  for (const blk of state.blocks) {
    if (blk.alive) drawSprite(ctx, 'block_' + blk.color, blk.x, blk.y, BLOCK.w, BLOCK.h);
  }
  drawSprite(ctx, 'paddle', state.paddle.x, PADDLE.y, PADDLE.w, PADDLE.h);
  drawSprite(ctx, 'ball', state.ball.x, state.ball.y, BALL.size, BALL.size);
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
