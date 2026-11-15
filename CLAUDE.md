# CLAUDE.md

Este archivo guía a Claude Code (claude.ai/code) cuando trabaja con el código de este repositorio.

## Idioma

Responder siempre en español en este proyecto. Los specs, comentarios del código y la UI del juego también están en español.

## Estado del proyecto

Arkanoid en HTML, CSS y JavaScript plano — **cero dependencias, sin build, sin gestor de paquetes**. El juego **está implementado y es jugable**; evoluciona spec por spec (ver abajo). No hay comandos de build, lint ni tests: se prueba abriendo `index.html` en el navegador (o con cualquier servidor estático) y verificando a mano los criterios de aceptación del spec.

Es un repo git (rama principal `main`, remoto `origin` en GitHub). Cada spec se implementa en su rama `spec-NN-slug` y se integra a `main` con merge/PR.

## Estructura

```
index.html            canvas #game (480×640) + <script> de spritesheet.js y game.js
style.css             fondo oscuro, canvas escalado con aspect-ratio 480/640
game.js               TODA la lógica del juego (script clásico, sin módulos)
assets/               spritesheet, helper de sprites, sonidos
specs/                NN-slug.md + .spec-config.yml
.agents/skills/       skills spec y spec-impl (fuente, ver skills-lock.json)
.claude/skills/       copia de spec/spec-impl + neko (persona gatuna, no relacionada)
```

`index.html` debe estar en la raíz: `spritesheet.js` carga `assets/spritesheet-breakout.png` con ruta relativa a la página. El orden de los `<script>` importa (`spritesheet.js` antes que `game.js`).

## Arquitectura de `game.js`

Un solo archivo, organizado por secciones (de arriba a abajo):

1. **Constantes de configuración** — `W/H`, `PADDLE`, `BALL`, `BLOCK`, `SLIDE`, `WAVE`, `MENU_LAYOUT`, etc. Todos los números "mágicos" (velocidades en px/s, duraciones en ms) viven aquí; ajustar balance = tocar constantes, no lógica.
2. **Funciones de dificultad por nivel** — `levelSpeed`, `levelMotion`, `slideParams`, `waveParams`, `grayHits`, `levelParams`.
3. **Objeto `state`** — único estado mutable. `state.status` es una máquina de estados: `'menu' | 'ready' | 'playing' | 'paused' | 'levelup' | 'gameover'`.
4. **Niveles** — `LEVEL_PATTERNS` (niveles 1-5, strings por fila), `buildProceduralLevel` (nivel ≥ 6, PRNG `mulberry32` con semilla = nivel, determinista) y `buildLevel`.
5. **Sonido, controles (teclado/mouse/táctil), menú** — `playSound`, `setKey`, `pointerToLogical`, botones y `handleMenuClick`, récord en `localStorage` (clave `arkanoid.highscore`).
6. **Transiciones y física** — `startGame`, `pauseGame`, `resumeGame`, `nextLevel`, `launchBall`, `updateBall`, `collideBlocks`, `breakBlock`, `loseLife`, `updateMotion/Wave/Slide`.
7. **`update(dt)` / `draw()`** y funciones `draw*` — el render va por estado.
8. **Bucle** — `requestAnimationFrame` con `dt` acotado por `MAX_DT`; **arranca solo cuando `loadSpritesheet` terminó**.

Convenciones: coordenadas lógicas 480×640 con origen arriba-izquierda (el CSS escala el canvas; los eventos de puntero se convierten con `pointerToLogical`); movimiento basado en delta time; acceso a `localStorage` siempre tolerante a fallos (el juego sigue sin persistir).

## Assets (`assets/`)

- `spritesheet-breakout.png` — spritesheet único: pala, bola, bloques y animaciones de explosión.
- `spritesheet.js` — script clásico que define globals; se carga con `<script>` antes de `game.js`:
  - `SPRITES` (paddle, ball, `blocks` por color) y `EXPLOSION_FRAMES` (4 frames por color, `EXPLOSION_DURATION = 150` ms) como tablas de rectángulos (`sx, sy, sw, sh`).
  - `loadSpritesheet(cb)` — carga el PNG, lo copia a un canvas offscreen y ejecuta los callbacks. **Debe completarse antes de dibujar**; `drawSprite`/`drawFrame` no hacen nada hasta entonces.
  - `drawSprite(ctx, name, x, y, w, h)` — `name` es `'paddle'`, `'ball'` o `'block_<color>'`; `drawFrame(ctx, frame, x, y, w, h)` para frames de explosión.
  - Colores: gray, red, yellow, cyan, magenta, hotpink, green. `EXPLOSION_FRAMES.gray` reutiliza los frames de red.
- `sounds/ball-bounce.mp3`, `sounds/break-sound.mp3` — SFX de rebote (paredes/pala) y rotura de bloque.

## Flujo spec-driven

Toda funcionalidad nueva pasa por un spec en `specs/NN-slug.md` (numeración correlativa, hoy 01–06). Las skills en `.agents/skills/` (instaladas de `Klerith/fernando-skills`, registradas en `skills-lock.json`) son de uso manual (`disable-model-invocation`):

- `/spec <descripción>` — hace preguntas aclaratorias y escribe `specs/NN-slug.md` con estado `Draft`, siguiendo `.agents/skills/spec/template.md`. **No escribe código.** Crea `specs/.spec-config.yml` si falta.
- `/spec-impl <NN-slug>` — solo corre si el estado del spec es "Approved"/"Aprobado" (lo cambia el humano). Crea o cambia a la rama `spec-NN-slug` e implementa el plan **paso a paso, pausando para revisión** tras cada paso.
- Banderas en `specs/.spec-config.yml`: `AutoCreateBranch` (default `true`) y `AutoCommitSteps` (default `false`; si es `true`, commits `spec-NN-step-MM`).

### Anatomía de un spec

Cabecera en blockquote: `Status`, `Depends on`, `Date`, `Objective` (una sola frase). Luego: Alcance (**Dentro** / **Fuera de alcance**, ambos obligatorios), Modelo de datos (código real, o declarar explícitamente que no hay nuevos), Plan de implementación (pasos numerados; cada uno deja el juego ejecutable y es commiteable por sí solo; ~30–50 líneas máx. por paso), Criterios de aceptación (checklist booleano verificable), Decisiones tomadas y descartadas (con motivo), Riesgos (opcional) y cierre "Qué NO entra".

Estados válidos: `Draft`, `In review`, `Approved`, `Implemented`, `Obsolete` (o equivalentes en español: Borrador, En revisión, Aprobado, Implementado, Obsoleto). Los specs existentes mezclan inglés y español; mantener el mismo idioma que usa el spec que se está editando.

### Reglas al trabajar con specs

- Implementar **exactamente** lo que dice el spec. Si algo cambia, se edita el spec, no se desvía el código.
- Lo que está en "Fuera de alcance" no se cuela "ya que estamos".
- Un spec nuevo declara su dependencia de los anteriores en `Depends on`; revisar los specs previos antes de tocar comportamiento existente.
- Al terminar de implementar, el estado del spec pasa a `Implemented`/`Implementado` (en su rama, antes del merge).

### Estado de los specs

| Spec | Tema | Estado |
| ---- | ---- | ------ |
| 01 | MVP jugable (nivel fijo, vidas, puntaje, controles) | Implemented |
| 02 | Efectos de destrucción (fade, +10 flotante, shake) | Implemented |
| 03 | Niveles infinitos y dificultad progresiva | Implemented |
| 04 | Sonido y volumen / mute (M) | Implemented |
| 05 | Bloques móviles (deslizamiento y onda) | Implemented |
| 06 | Pantalla de inicio y menú de pausa | Implementado |
