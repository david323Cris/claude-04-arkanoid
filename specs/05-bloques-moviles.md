# SPEC 05 — Bloques móviles (deslizamiento y oscilación)

> **Status:** Approved
> **Depends on:** SPEC 03
> **Date:** 2026-11-14
> **Objective:** Desde el nivel 3, hacer que los bloques se muevan dentro del nivel, ya sea deslizando filas enteras en sentidos alternos o con una onda vertical suave, con una intensidad que crece con el nivel hasta un tope.

---

## Alcance

**Dentro:**

- Movimiento de bloques a partir del nivel 3; los niveles 1 y 2 siguen estáticos.
- Dos modos de movimiento, que **no se combinan** en un mismo nivel:
  - **`slide` (deslizamiento lateral):** filas enteras se desplazan horizontalmente como un bloque rígido, de ida y vuelta, rebotando contra los bordes del canvas. Las filas móviles alternan dirección.
  - **`wave` (oscilación vertical suave):** cada columna sube y baja unos píxeles con un desfase por columna, formando una onda.
- Cada nivel tiene un modo definido por su número (`levelMotion(level)`): `static` (niveles 1-2), `wave` si `level % 3 === 2` (niveles 5, 8, 11…) y `slide` en el resto (3, 4, 6, 7, 9…).
- La intensidad escala con el nivel (cantidad de filas que deslizan, velocidad, amplitud de la onda) con topes.
- Los bloques se mueven solo mientras `status === 'playing'`; quedan congelados en `ready`, `levelup` y `gameover`.
- La colisión bola-bloque usa la posición actual del bloque; un bloque en explosión sigue moviéndose con su fila o columna hasta desaparecer.
- Todos los cambios viven en `game.js`.

**Fuera de alcance (para specs futuras):**

- Barajar/intercambiar posiciones de los bloques cada cierto tiempo y formar figuras (SPEC 06).
- Combinar `slide` y `wave` en el mismo nivel.
- Choques o rebotes entre bloques (cada bloque se mueve en su carril fijo).
- Compactar bloques para cerrar huecos al romperse los vecinos.
- Que el movimiento del bloque transfiera velocidad a la bola.
- Indicadores en el HUD del modo de movimiento.
- Sonido asociado al movimiento.
- Cambios en `assets/spritesheet.js`.

## Modelo de datos

```js
// Constantes nuevas (game.js)
const MOTION_START_LEVEL = 3;
const SLIDE = { baseSpeed: 30, speedPerLevel: 6, maxSpeed: 90,        // px/s
                baseRows: 2, maxRows: 8 };                            // filas móviles: 2 + floor((level-3)/2), tope maxRows
const WAVE  = { baseAmp: 6, ampPerLevel: 1, maxAmp: 12,               // px
                basePeriod: 2500, periodPerLevel: 100, minPeriod: 1600, // ms
                phasePerCol: 0.6 };                                   // rad de desfase entre columnas

// Funciones nuevas
function levelMotion(level)   // 'static' | 'slide' | 'wave'
function slideParams(level)   // { speed, movingRows }
function waveParams(level)    // { amp, period }
function updateMotion(dt)     // mueve bloques; llamada desde update(dt) solo con status === 'playing'

// Campos nuevos
// cada bloque: { ..., col, row, baseX, baseY }   (posición de reposo; blk.x / blk.y son las actuales)
state.motion = {
  mode: 'static',               // 'static' | 'slide' | 'wave'
  t: 0,                         // ms de movimiento acumulados (para wave)
  rows: [/* { row, dir, speed, offset } */],   // solo en modo slide; dir = +1 | -1
};
```

Convenciones:

- `blk.x = baseX + offset` en `slide` y `blk.y = baseY + amp * sin(2π * t / period + col * phasePerCol)` en `wave`. Fuera de esos casos `blk.x = baseX` y `blk.y = baseY`.
- `slide`: las filas móviles se eligen en el orden `[0, 2, 4, …, 1, 3, 5, …]` (de arriba hacia abajo, primero las pares), tomando las primeras `movingRows` que existan. La primera elegida avanza hacia la derecha, la segunda hacia la izquierda, y así alternando. Todas empiezan con `offset = 0`.
- Límites de cada fila móvil, calculados cada frame con los bloques vivos de esa fila (`alive === true`, incluyendo los que explotan): `minOffset = -(menor baseX)` y `maxOffset = W - (mayor baseX + BLOCK.w)`. Al alcanzar un límite, `dir` se invierte y `offset` se fija en el límite. Si `minOffset === maxOffset` la fila no se mueve. Si cambia el conjunto de bloques vivos, `offset` se recorta al nuevo rango.
- La fila se mueve rígida: los huecos de bloques rotos se desplazan con ella y no se compactan.
- `wave`: dos bloques de la misma columna comparten fase, así que su separación vertical no cambia y no se solapan; columnas distintas no se solapan en X. Amplitud máxima 12 px.
- Parámetros: `speed = min(baseSpeed + speedPerLevel*(level-3), maxSpeed)`; `amp = min(baseAmp + ampPerLevel*(level-3), maxAmp)`; `period = max(basePeriod - periodPerLevel*(level-3), minPeriod)`. Los valores exactos son constantes ajustables.
- Al cargar un nivel (`buildLevel` de la SPEC 03) se reinicia `state.motion` según `levelMotion(state.level)`; `resetGame()` también. Perder una vida no reinicia las posiciones.
- El texto flotante `+10` y el efecto de explosión (SPEC 02) se posicionan con `blk.x`/`blk.y` actuales en el momento de la rotura.
- El movimiento usa delta time (`dt`) como el resto del juego.

## Plan de implementación

1. Añadir `col`, `row`, `baseX`, `baseY` a los bloques generados por `buildLevel`, `state.motion` (inicializado según `levelMotion`), las constantes nuevas y `levelMotion(level)`, `slideParams`, `waveParams`; crear `updateMotion(dt)` vacía llamada desde `update(dt)` con `status === 'playing'`. Prueba: el juego se comporta igual que antes en todos los niveles (nada se mueve aún) y no hay errores en consola.
2. Implementar el modo `slide` en `updateMotion(dt)`: elegir las filas móviles, mover con `offset`, límites por bloques vivos y rebote en los bordes. Prueba: en el nivel 3, dos filas deslizan en sentidos opuestos, rebotan contra los bordes y se mantienen dentro de 0..480.
3. Implementar el modo `wave`: acumular `state.motion.t` y calcular `blk.y` con la onda. Prueba: en el nivel 5 las columnas suben y bajan con desfase, sin solaparse ni salir del área de juego.
4. Integrar con el resto: reiniciar `state.motion` al cargar nivel y en `resetGame()`, congelar el movimiento fuera de `playing`, comprobar la colisión bola-bloque y los efectos de la SPEC 02 con bloques móviles y verificar los topes en niveles altos. Prueba: recorrer los niveles 1 a 25 (p. ej. forzando `state.level` desde la consola) sin errores.

## Criterios de aceptación

- [ ] El juego carga sin errores en la consola; los niveles 1 y 2 no tienen ningún bloque en movimiento.
- [ ] En el nivel 3 (`slide`) exactamente 2 filas se deslizan, en sentidos opuestos, y rebotan al llegar al borde del canvas.
- [ ] En el modo `slide` ningún bloque queda con `x < 0` ni `x + BLOCK.w > 480` en ningún momento.
- [ ] En el nivel 5 (`wave`) las columnas oscilan verticalmente con desfase entre columnas y ningún bloque queda solapado con otro.
- [ ] Un nivel nunca combina `slide` y `wave`: `levelMotion(level)` devuelve `wave` si `level % 3 === 2` y `slide` para el resto de niveles ≥ 3.
- [ ] La velocidad de deslizamiento no supera 90 px/s, la amplitud de la onda no supera 12 px y el periodo no baja de 1600 ms en ningún nivel.
- [ ] El número de filas móviles en `slide` crece con el nivel y no supera 8.
- [ ] Una fila cuyos bloques extremos se rompen amplía su recorrido sin salirse del canvas; una fila sin recorrido posible permanece quieta.
- [ ] La bola rebota correctamente en un bloque en movimiento (usa su posición actual) y no lo atraviesa durante el juego normal a 60 fps.
- [ ] Un bloque en explosión sigue su fila o columna hasta que desaparece, y el `+10` aparece en su posición al romperse.
- [ ] Los bloques están quietos en `ready` (bola pegada), en la pantalla de nivel y en `gameover`, y reanudan al lanzar la bola.
- [ ] Perder una vida no reinicia las posiciones de los bloques.
- [ ] Pasar de nivel o reiniciar desde `gameover` deja los bloques del nuevo nivel en su posición base (offset 0, `t = 0`).
- [ ] Despejar un nivel con movimiento lleva al siguiente nivel como en la SPEC 03, sin errores.
- [ ] Con niveles altos (≥ 25) el juego sigue funcionando sin errores y los parámetros están en sus topes.

## Decisiones

- **Sí:** SPEC 05 separada de la 03. El movimiento cambia la mecánica de colisión y no cabe en la spec de niveles sin volverla demasiado grande.
- **Sí:** dividir los cuatro tipos de movimiento: esta spec solo incluye deslizamiento y oscilación (movimiento continuo por carril); barajar y formar figuras irán en la SPEC 06 porque comparten otra lógica (transiciones entre posiciones).
- **Sí:** arranque en el nivel 3 con intensidad creciente y topes. Los dos primeros niveles sirven de aprendizaje y la dificultad sube de forma gradual.
- **Sí:** filas enteras rígidas con dirección alterna. Se lee bien, evita solapamientos entre bloques y es predecible.
- **No:** bloques sueltos al azar ni choques entre bloques. Añaden riesgo de solapamientos y casos raros.
- **No:** compactar bloques al romperse los vecinos. Cambia la experiencia y añade lógica; los huecos viajan con la fila.
- **Sí:** un solo modo por nivel (sin combinar). `slide` rompe la noción de "columna" de `wave` y podría solapar bloques de filas distintas.
- **Sí:** el modo se decide por número de nivel (`levelMotion`), no por azar. Es reproducible y fácil de probar, igual que el PRNG sembrado de la SPEC 03.
- **Sí:** el movimiento solo ocurre en `playing`. Con la bola pegada a la pala o en pantallas de transición el jugador no es penalizado.
- **Sí:** límites de recorrido calculados con los bloques vivos. Así, al romper los extremos, la fila gana recorrido sin salirse del canvas.
- **No:** el bloque no transfiere velocidad a la bola. Mantiene la rapidez constante definida en la SPEC 01.
- **Sí:** valores como constantes con nombre. Se ajustan sin tocar la lógica.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| La bola queda dentro de un bloque que se mueve hacia ella | Velocidades bajas (≤ 90 px/s ≈ 1.5 px por frame) y la resolución de colisión por eje de menor penetración de la SPEC 01. |
| Con la velocidad de la bola de la SPEC 03 la bola atraviesa un bloque móvil | Se hereda el tope de 1.6× y `MAX_DT`; probar a 30 fps durante la implementación. |
| Una fila deja de moverse al quedar un solo bloque en el centro | El rango se recalcula con los vivos, así que ganan recorrido; si no hay rango, la fila queda quieta. |
| En `wave` las columnas tapan el camino hacia la pala | Amplitud máxima 12 px; la parte inferior de los bloques queda lejos de `PADDLE.y`. |
| Dos filas deslizando cruzan visualmente a otras estáticas | Las filas mantienen su `y` fija; no hay solapamientos, solo desplazamientos horizontales. |
| `breakBlock` o los efectos usan una posición desfasada | Usar siempre `blk.x`/`blk.y` actuales y actualizar el movimiento antes de la colisión en `update(dt)`. |
| El nivel se vuelve injugable en niveles altos | Topes en velocidad, filas y amplitud; constantes ajustables. |

## Qué **no** está en esta spec

- Barajar posiciones de bloques y formar figuras (SPEC 06).
- Combinar `slide` y `wave` en un mismo nivel.
- Choques o rebotes entre bloques.
- Compactar bloques al romperse los vecinos.
- Transferir la velocidad del bloque a la bola.
- Indicador del modo de movimiento en el HUD.
- Sonido asociado al movimiento.
- Cambios en `assets/spritesheet.js`.

Cada uno de estos, si se hace, va en su propia spec.
