# SPEC 06 — Pantalla de inicio y menú de pausa

> **Status:** Aprobado
> **Depends on:** SPEC 01, SPEC 03, SPEC 04, SPEC 05
> **Date:** 2026-11-14
> **Objective:** Añadir una pantalla de inicio y un menú de pausa, operables con mouse o tap, que permitan jugar, reanudar, reiniciar, volver al inicio, ajustar el sonido, saltar a cualquier nivel del 1 al 10 y ver el récord de puntaje guardado.

---

## Alcance

**Dentro:**

- Dos estados nuevos en `state.status`: `menu` (pantalla de inicio, estado inicial al cargar la página) y `paused`.
- **Pantalla de inicio:** título `ARKANOID`, botón `Jugar`, selector de niveles 1–10, línea de ayuda de controles y `Récord: N`.
- **Menú de pausa:** título `PAUSA` y los botones `Continuar`, `Reiniciar partida`, `Volver al inicio`, controles de sonido (`VOL −`, `MUTE`/`VOL NN%`, `VOL +`) y el selector de niveles 1–10.
- **Selector de niveles 1–10** presente en ambas pantallas. Pulsar un nivel inicia una partida nueva en ese nivel, con puntaje y vidas reiniciados. Todos los niveles están disponibles siempre (sin desbloqueo).
- Formas de pausar: tecla `P` o `Esc` (alterna), botón de pausa dibujado en el canvas (visible en `ready` y `playing`) y auto-pausa cuando la pestaña pierde visibilidad o la ventana pierde el foco durante `playing`.
- Navegación solo con **mouse o tap** (pointer events, hit-testing de rectángulos en el canvas) y resaltado al pasar el mouse. Atajos de teclado mínimos: `Espacio`/`Enter` = `Jugar` en la pantalla de inicio; `P`/`Esc` = continuar en pausa.
- Congelado total en `menu` y `paused`: no se mueven bola, pala, bloques móviles (SPEC 05), explosiones, textos flotantes ni sacudida; el juego se dibuja detenido bajo el menú.
- **Récord de puntaje** en `localStorage` (clave `arkanoid.highscore`), mostrado en la pantalla de inicio. Primera persistencia del proyecto.
- Los menús sustituyen el control de mute/volumen táctil que la SPEC 04 dejó fuera: los botones de sonido del menú de pausa usan `muted` y `changeVolume` existentes.
- Todos los cambios viven en `game.js`.

**Fuera de alcance (para specs futuras):**

- Controles táctiles de juego y soporte móvil más allá de lo que ya existe (arrastrar la pala y tocar para lanzar): orientación, escala, botones táctiles, gestos (SPEC 07).
- Navegación de menús con teclado (flechas + Enter). `↑`/`↓` siguen siendo volumen (SPEC 04) en cualquier estado.
- Desbloqueo progresivo de niveles o persistencia del último nivel alcanzado.
- Tabla de récords con varias entradas, nombres o fechas; récord por nivel.
- Mostrar el récord en el HUD o en la pantalla de Game Over; mensaje de "nuevo récord".
- Menú de opciones adicional (dificultad, teclas, pantalla completa).
- Menú desde las pantallas `levelup` y `gameover` (siguen con su pantalla y su acción de la SPEC 03).
- Música, sonidos de menú o animaciones de transición.
- Cambios en `assets/spritesheet.js` o en `index.html`/`style.css`.

## Modelo de datos

```js
// Constantes nuevas (game.js)
const HIGHSCORE_KEY = 'arkanoid.highscore';
const MENU_LEVELS = 10;                                   // niveles seleccionables 1..10
const MENU_LAYOUT = {                                     // coordenadas lógicas (canvas 480×640), ajustables
  button:   { w: 220, h: 44, x: 130 },
  levelBtn: { w: 56, h: 40, gap: 12, cols: 5 },           // cuadrícula 5×2, centrada
  pauseBtn: { x: 12, y: 40, w: 30, h: 26 },               // botón de pausa en el HUD
  start:    { titleY: 120, recordY: 185, playY: 220, levelsLabelY: 300, levelsY: 320, helpY: 470 },
  pause:    { titleY: 90, continueY: 130, restartY: 184, homeY: 238, soundY: 300, levelsLabelY: 372, levelsY: 392 },
};

// Estado nuevo (game.js)
state.status;                    // + 'menu' | 'paused'
state.pausedFrom = null;         // 'ready' | 'playing' mientras status === 'paused'
let highScore = 0;               // en memoria; se carga de localStorage al iniciar
let hoverId = null;              // id del botón bajo el mouse (solo pointerType 'mouse')

// Botones de un menú: se calculan por pantalla, sin estado propio
// { id, x, y, w, h, label, active }   id: 'play' | 'continue' | 'restart' | 'home' |
//                                          'vol-down' | 'mute' | 'vol-up' | 'level-1'..'level-10'

// Funciones nuevas
function menuButtons(screen)       // screen: 'menu' | 'paused' → lista de botones con su rectángulo
function pointerToLogical(e)       // {x, y} en coordenadas lógicas (extrae la conversión de movePaddleToPointer)
function handleMenuClick(x, y)     // ejecuta la acción del botón bajo (x, y), si hay
function pauseGame()               // 'ready'|'playing' → 'paused' (guarda pausedFrom)
function resumeGame()              // 'paused' → pausedFrom
function startGame(level = 1)      // guarda récord, reinicia partida en `level`; sustituye a resetGame()
function goHome()                  // guarda récord, status = 'menu'
function loadHighScore()           // lee localStorage con try/catch → número entero ≥ 0, o 0
function commitHighScore()         // si state.score > highScore: actualiza y persiste con try/catch
```

Convenciones:

- `startGame(level)` hace lo que hacía `resetGame()` (puntaje 0, `INITIAL_LIVES`, `buildLevel(level)`, `makeMotion(level, blocks)`, limpiar `floatTexts` y `shakeT`, centrar la pala, `stickBall()` → `ready`) pero con `state.level = level`. `resetGame()` pasa a ser `startGame(1)`; el reinicio desde Game Over de la SPEC 03 sigue yendo al nivel 1.
- Estado inicial: `state.status = 'menu'`. Al cargar no hay partida construida; `startGame` la construye al elegir `Jugar` o un nivel.
- `pauseGame()` solo actúa si `status` es `ready` o `playing`. `resumeGame()` solo actúa si `status === 'paused'` y restaura exactamente `pausedFrom` (la bola pegada sigue pegada, la bola en juego sigue en juego, mismas posiciones y velocidad).
- Congelado: `update(dt)` retorna de inmediato si `status` es `menu` o `paused`, antes de mover pala, bloques, bola, explosiones y efectos. El bucle `requestAnimationFrame` sigue corriendo; `MAX_DT` evita un salto al reanudar.
- Entradas bloqueadas en `menu` y `paused`: el movimiento de la pala (teclado y `pointermove`/`pointerdown`), `onAction()` (Espacio/click no lanzan ni avanzan de nivel) y el botón de pausa. `M`, `↑`/`↓` y `+`/`-` siguen funcionando.
- `pointerdown` sobre el canvas pasa por un único manejador: en `menu`/`paused` llama a `handleMenuClick` y **no** a `onAction`; en `ready`/`playing`, si el punto cae en `MENU_LAYOUT.pauseBtn` llama a `pauseGame()` y **no** lanza la bola; en cualquier otro caso se comporta como hoy (`onAction`).
- El botón de pausa se dibuja como dos barras verticales en `drawHud`, solo en `ready` y `playing`. Sus límites (y 40–66) no solapan los bloques (que parten de `y = 80` menos hasta 12 px de onda).
- Auto-pausa: `document` `visibilitychange` (con `document.hidden`) y `window` `blur` llaman a `pauseGame()` solo si `status === 'playing'`. Volver a la pestaña no reanuda solo.
- Teclas: `P` y `Esc` (`e.code` `KeyP`/`Escape`, ignorando `e.repeat`) → `pauseGame()` si `ready`/`playing`, `resumeGame()` si `paused`, nada en el resto. `Espacio`/`Enter` en `menu` → `startGame(1)`.
- Acciones de botones: `play` → `startGame(1)`; `level-N` → `startGame(N)` (en ambas pantallas); `continue` → `resumeGame()`; `restart` → `startGame(1)`; `home` → `goHome()`; `vol-down`/`vol-up` → `changeVolume(∓VOLUME_STEP)`; `mute` → alterna `muted`.
- Resaltado del nivel actual (`state.level`) en la cuadrícula de la pausa; en la pantalla de inicio ninguno. El botón `mute` muestra `MUTE` si `muted` y `VOL NN%` si no, igual que el HUD de la SPEC 04.
- El HUD de volumen de la SPEC 04 (`VOL NN%` / `MUTE` en `(W - 16, 56)`) se mantiene tal cual.
- Dibujo: en `paused` se dibuja el juego detenido (bloques, pala, bola, HUD) y encima `rgba(0, 0, 0, 0.7)` + menú. En `menu` se dibuja solo fondo negro + pantalla de inicio. Cursor `pointer` sobre botones (`canvas.style.cursor`).
- Hover: solo con `pointerType === 'mouse'` en `pointermove`; actualiza `hoverId`. Táctil no tiene hover.
- Récord: `highScore` se carga al iniciar con `loadHighScore()`. `commitHighScore()` se llama (a) cuando `lives` llega a 0 (paso a `gameover`), (b) al inicio de `startGame()` (cubre reiniciar y saltar de nivel) y (c) en `goHome()`. Solo escribe si `state.score > highScore`. El valor guardado es el entero en texto; al leer, un valor no numérico, negativo o ausente se trata como 0. Todo acceso a `localStorage` va en `try/catch`; si falla, el récord vive solo en memoria y el juego sigue.
- Cualquier partida cuenta para el récord sin importar el nivel inicial elegido.

## Plan de implementación

1. Refactor de estado sin cambio visible: extraer `pointerToLogical`, convertir `resetGame()` en `startGame(level = 1)`, añadir `pausedFrom`, `pauseGame()`/`resumeGame()` y el congelado en `update(dt)`; teclas `P`/`Esc`; en `paused` dibujar solo el overlay oscuro con el texto `PAUSA`. Prueba: `P` pausa y reanuda sin perder la posición de bola, pala ni bloques; el juego sin pausar se comporta igual que antes (SPEC 05).
2. Botón de pausa en el HUD con el manejador único de `pointerdown` y las entradas bloqueadas en `paused`; auto-pausa por `visibilitychange`/`blur`. Prueba: clic en el botón pausa y no lanza la bola; cambiar de pestaña durante `playing` deja el juego en `paused`.
3. Infraestructura de menú: `MENU_LAYOUT`, `menuButtons`, `handleMenuClick`, hover y dibujo de botones; menú de pausa completo (`Continuar`, `Reiniciar partida`, sonido y selector de niveles; `Volver al inicio` aún deshabilitado). Prueba: cada botón de la pausa hace su acción; saltar al nivel 7 deja `ready` con puntaje 0, 3 vidas y el nivel 7 (con su movimiento de la SPEC 05).
4. Pantalla de inicio: `status` inicial `menu`, `goHome()`, botón `Volver al inicio` activo, título, `Jugar`, selector de niveles, ayuda de controles y atajo `Espacio`/`Enter`. Prueba: al cargar aparece la pantalla de inicio sin errores en consola; `Jugar` empieza en el nivel 1 y el selector en el nivel elegido; `Volver al inicio` regresa a ella.
5. Récord: `loadHighScore`, `commitHighScore`, guardado en `localStorage` y `Récord: N` en la pantalla de inicio. Prueba: tras un Game Over con puntaje 120, recargar muestra `Récord: 120`; con `localStorage` bloqueado el juego funciona sin errores.

## Criterios de aceptación

- [ ] El juego carga sin errores en la consola y muestra la pantalla de inicio (`status === 'menu'`) con `ARKANOID`, `Jugar`, los niveles 1–10, la ayuda de controles y `Récord: N`.
- [ ] En la pantalla de inicio la pala no se mueve con teclado, mouse ni tap; `Espacio` o `Enter` equivalen a `Jugar` y no lanzan la bola.
- [ ] `Jugar` inicia en el nivel 1 con puntaje 0, 3 vidas y la bola pegada (`ready`).
- [ ] Pulsar el botón del nivel N (1–10) en la pantalla de inicio inicia una partida en el nivel N con puntaje 0, 3 vidas y `ready`.
- [ ] `P` o `Esc` en `playing` o `ready` pausan; en `paused` reanudan; en `menu`, `levelup` y `gameover` no hacen nada. Mantener la tecla no alterna repetidamente.
- [ ] El botón de pausa se ve en `ready` y `playing`, no en `menu`, `paused`, `levelup` ni `gameover`; pulsarlo pausa y no lanza la bola.
- [ ] Al pasar a otra pestaña o perder el foco durante `playing` el juego queda en `paused`; al volver no reanuda solo.
- [ ] En `paused` y `menu` no se mueven bola, pala, bloques móviles, explosiones, textos flotantes ni sacudida; no se puede mover la pala con teclado, mouse o tap.
- [ ] `Continuar` (o `P`/`Esc`) reanuda con exactamente el mismo estado: bola, pala, bloques y vidas idénticos, y vuelve a `ready` o `playing` según desde dónde se pausó.
- [ ] `Reiniciar partida` inicia el nivel 1 con puntaje 0 y 3 vidas.
- [ ] `Volver al inicio` muestra la pantalla de inicio; `Jugar` desde ahí empieza una partida limpia.
- [ ] El selector de la pausa salta al nivel pulsado con puntaje 0 y 3 vidas; los niveles 1–10 se pueden elegir sin restricciones y el nivel actual aparece resaltado.
- [ ] `VOL −` y `VOL +` cambian el volumen en 10% (entre 0% y 100%) y `MUTE` alterna el silencio, desde el menú de pausa con mouse o tap; el estado coincide con el HUD y con las teclas `M`/`↑`/`↓`.
- [ ] `Espacio`, click fuera de los botones y tap fuera de los botones no lanzan la bola ni avanzan de nivel mientras `status` es `menu` o `paused`.
- [ ] El botón bajo el mouse se resalta y el cursor es `pointer`; en pantalla táctil no queda resaltado pegado.
- [ ] Los botones responden correctamente con el canvas escalado por CSS (ventana grande y pequeña).
- [ ] Un Game Over con puntaje superior al récord actualiza `arkanoid.highscore` en `localStorage` y la pantalla de inicio muestra el nuevo valor, también tras recargar.
- [ ] Reiniciar, saltar de nivel o volver al inicio con un puntaje superior al récord lo guarda antes de reiniciar el puntaje.
- [ ] Con un puntaje igual o menor al récord, `arkanoid.highscore` no cambia.
- [ ] Si `localStorage` falla o contiene un valor inválido, el juego funciona sin errores no capturados y el récord arranca en 0.
- [ ] Game Over y la pantalla de nivel superado siguen funcionando como en la SPEC 03 (click, tap o Espacio).
- [ ] El HUD de volumen de la SPEC 04 sigue visible y se actualiza en `playing` y `paused`.

## Decisiones

- **Sí:** dividir el pedido original en dos specs. Esta (SPEC 06) cubre estados y menús con mouse/tap; los controles táctiles y el soporte móvil van en la SPEC 07, que además necesita que la pausa exista para ofrecer un botón táctil.
- **Sí:** el selector de niveles 1–10 en inicio **y** pausa, con el mismo componente. Es lo que pidió el usuario y evita duplicar lógica.
- **Sí:** pulsar un nivel inicia la partida de inmediato en ese nivel. Un solo gesto, sin paso intermedio de "seleccionar y confirmar".
- **Sí:** todos los niveles libres desde el principio. El objetivo es poder saltar; no justifica un sistema de desbloqueo.
- **Sí:** saltar de nivel reinicia puntaje y vidas. Evita usar el salto para acumular puntaje y mantiene un solo flujo (`startGame`).
- **Sí:** tres vías de pausa: `P`/`Esc`, botón en pantalla y auto-pausa. El botón sirve a mouse y tap; la auto-pausa evita perder vidas al cambiar de pestaña.
- **Sí:** auto-pausa solo en `playing`. En `ready` la bola está pegada y no hay nada que perder.
- **Sí:** menú de pausa con `Continuar`, `Reiniciar partida`, `Volver al inicio`, sonido y niveles, según lo pedido.
- **Sí:** botones de sonido en la pausa. Cierra la limitación de la SPEC 04 (sin control táctil de volumen) usando las funciones que ya existen.
- **Sí:** récord en `localStorage` (`arkanoid.highscore`), con `try/catch` y fallback a memoria. A petición del usuario; es la primera persistencia del proyecto.
- **Sí:** guardar el récord al terminar la partida y al abandonarla (reiniciar, saltar de nivel, volver al inicio), para no perder un buen puntaje por salir.
- **No:** navegación por teclado en los menús. Las flechas ya cambian el volumen (SPEC 04) y el usuario eligió solo mouse/click.
- **No:** mostrar el récord en el HUD o en Game Over, ni tabla de récords. Solo se pidió verlo en el inicio; el resto queda para otra spec.
- **No:** menú en `levelup` ni `gameover`. Mantienen su pantalla de la SPEC 03 para no ampliar el alcance.
- **No:** clave versionada (`:v1`). El valor es un único entero y su formato es difícil que cambie; si cambia se usa otra clave.
- **Sí:** `Jugar` y `Reiniciar partida` siempre empiezan en el nivel 1; para otro nivel está el selector.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| `pointerdown` de un botón además lanza la bola o avanza de nivel | Un solo manejador que decide: menú, botón de pausa o `onAction`; los listeners actuales se reemplazan. |
| La pala salta a la posición del puntero al tocar un botón del menú | `pointermove`/`pointerdown` no mueven la pala en `menu` ni `paused`. |
| Salto grande de `dt` al reanudar | El bucle sigue corriendo y `update` no avanza en `paused`; `MAX_DT` limita el primer frame. |
| Las coordenadas del click no coinciden con el canvas escalado por CSS | `pointerToLogical` usa `getBoundingClientRect` como `movePaddleToPointer`; criterio de prueba con ventanas de distinto tamaño. |
| `localStorage` bloqueado o con valor corrupto | `try/catch` en lectura y escritura; valores inválidos se leen como 0; el juego sigue sin persistir. |
| `blur` se dispara al hacer click en un iframe o al abrir las herramientas de desarrollo | Solo pausa en `playing`; pausar de más es inocuo. |
| El botón de pausa tapa bloques con la onda de la SPEC 05 | Está en y 40–66; los bloques con onda no suben de y 68. |
| Los atajos (`Espacio`) activan `Jugar` y lanzan la bola a la vez | `startGame` deja `ready`; el lanzamiento requiere otra acción, y `onAction` se ignora en `menu`. |

## Qué **no** está en esta spec

- Controles táctiles de juego y soporte móvil (orientación, escala, botones táctiles): SPEC 07.
- Navegación de menús con teclado.
- Desbloqueo progresivo de niveles o persistencia del nivel alcanzado.
- Tabla de récords, récord por nivel o mensaje de "nuevo récord".
- Récord en el HUD o en la pantalla de Game Over.
- Menú en las pantallas de nivel superado y Game Over.
- Opciones adicionales (dificultad, teclas, pantalla completa), música o sonidos de menú.
- Cambios en `assets/spritesheet.js`, `index.html` o `style.css`.

Cada uno de estos, si se hace, va en su propia spec.
