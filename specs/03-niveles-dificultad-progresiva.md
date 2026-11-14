# SPEC 03 — Niveles infinitos con dificultad progresiva

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-11-14
> **Objective:** Añadir niveles sucesivos sin final (5 layouts fijos y luego generación procedural) cuya dificultad sube con el número de nivel mediante bola más rápida, bloques grises de varios golpes y más filas/densidad.

---

## Alcance

**Dentro:**

- Progresión de niveles sin límite: al romper todos los bloques se pasa al nivel siguiente, conservando puntaje y vidas.
- Los niveles 1 a 5 usan patrones fijos diseñados a mano; el nivel 1 es el layout actual (6 filas x 10 columnas completas, solo colores, 1 golpe).
- A partir del nivel 6 el layout se genera por código con un generador pseudoaleatorio sembrado con el número de nivel (el mismo nivel produce siempre el mismo layout).
- Palancas de dificultad que crecen con el nivel:
  - Velocidad de la bola (`BALL.speed` × factor, con tope).
  - Bloques grises de varios golpes (2 golpes; 3 desde el nivel 10), con proporción creciente.
  - Más filas de bloques y mayor densidad (menos huecos) en los niveles procedurales.
- Nuevo estado `levelup`: pantalla "Nivel N" entre niveles; se continúa con Espacio, click o tap.
- Mostrar el nivel actual en el HUD.
- El estado `won` desaparece (ya no hay victoria final). `gameover` reinicia desde el nivel 1.
- Los bloques de varios golpes dibujan el sprite `block_gray`; tras un golpe no letal se atenúan (`globalAlpha` 0.6) para indicar daño.
- Todos los cambios viven en `game.js`.

**Fuera de alcance (para specs futuras):**

- Persistencia del mejor nivel o récord (localStorage).
- Bloques indestructibles.
- Power-ups, vidas extra por nivel, multi-bola.
- Sonido (`ball-bounce.mp3` y `break-sound.mp3` siguen sin usarse).
- Reducir el tamaño de la pala por nivel.
- Menú de inicio, pausa, selección de nivel.
- Cambios en `assets/spritesheet.js` o en los efectos de la SPEC 02.

## Modelo de datos

```js
// Constantes nuevas (game.js)
const SPEED_PER_LEVEL = 0.05;       // +5% de BALL.speed por nivel
const MAX_SPEED_FACTOR = 1.6;       // tope: 1.6 × BALL.speed (≈ nivel 13)
const MAX_ROWS = 10;                // filas máximas (offsetY 80 + 10×20 = 280 px)
const PROC_START_LEVEL = 6;         // primer nivel procedural
const GRAY_HITS = { base: 2, level3Hits: 10 };  // 2 golpes; 3 desde el nivel 10
const DAMAGED_ALPHA = 0.6;

// Patrones fijos (niveles 1-5): una cadena por fila, 10 caracteres por fila
//   '.' = hueco · '0'-'5' = índice en ROW_COLORS · 'G' = bloque gris
const LEVEL_PATTERNS = [ /* 5 patrones: array de strings de 10 caracteres */ ];

// Dificultad derivada del nivel (funciones puras)
function levelSpeed(level)    // BALL.speed × min(1 + SPEED_PER_LEVEL*(level-1), MAX_SPEED_FACTOR)
function levelParams(level)   // { rows, density, grayChance } para niveles >= PROC_START_LEVEL
function buildLevel(level)    // devuelve la lista de bloques del nivel (patrón fijo o procedural)
function mulberry32(seed)     // PRNG determinista, sembrado con `level`

// Campos nuevos / modificados
state.level = 1;                // nivel actual
state.status                    // 'ready' | 'playing' | 'levelup' | 'gameover'  ('won' se elimina)
// cada bloque: { x, y, color, alive, explosionT, hits, maxHits }  (hits = golpes restantes)
```

Convenciones:

- `levelParams(level)` para `level >= 6`: `rows = min(6 + floor((level - 6) / 2), MAX_ROWS)`, `density = min(0.70 + 0.03*(level - 6), 1)`, `grayChance = min(0.10 + 0.04*(level - 6), 0.5)`. Los valores exactos son constantes ajustables.
- Cada celda procedural se llena si `rng() < density`; si se llena, es gris con probabilidad `grayChance`, y si no, toma el color de su fila (`ROW_COLORS[fila % 6]`). Un nivel generado debe tener al menos 1 bloque; si queda vacío se fuerza uno.
- Los patrones 4 y 5 incluyen bloques `G`; los patrones 1 a 3 no.
- Un bloque gris con `hits > 1` que recibe un golpe: `hits -= 1`, la bola rebota como siempre, no se suma puntaje y no explota. Con `hits === 0` pasa por `breakBlock(blk)` (SPEC 02) y suma `POINTS_PER_BLOCK`. La explosión de gris usa `EXPLOSION_FRAMES.gray` (frames rojos).
- `breakBlock(blk)` sigue siendo el único lugar que pone `explosionT = 0`, suma puntaje y genera efectos, y sigue siendo idempotente.
- El nivel se supera cuando todos los bloques tienen `alive === false` (misma condición actual, que incluye los grises ya rotos).
- La velocidad de la bola se aplica al lanzarla (`launchBall`) con `levelSpeed(state.level)`; la rapidez sigue constante durante el nivel.
- Al pasar de nivel: `state.level += 1`, `state.blocks = buildLevel(state.level)`, la bola vuelve a `stuck`, `status = 'ready'`. Puntaje y vidas se conservan; los efectos de la SPEC 02 en curso terminan de animarse.
- `resetGame()` (desde `gameover`) vuelve a `level = 1`, puntaje 0 y vidas 3.

## Plan de implementación

1. Añadir `state.level`, las constantes nuevas y `levelSpeed(level)`; aplicar `levelSpeed` en `launchBall`. Mostrar "Nivel N" en `drawHud`. Prueba: el juego se comporta igual que antes (nivel 1, velocidad 320) y el HUD muestra "Nivel 1".
2. Añadir los campos `hits`/`maxHits` a los bloques y la lógica de golpes en `collideBlocks()`: golpe no letal descuenta `hits` y rebota sin puntaje; golpe letal llama a `breakBlock`. Dibujar los bloques dañados con `DAMAGED_ALPHA` (restaurando `globalAlpha` a 1). Prueba: forzando desde la consola un bloque gris con `hits = 2`, tarda dos golpes en romperse y solo suma 10 una vez.
3. Implementar `LEVEL_PATTERNS` (5 patrones) y `buildLevel(level)` para niveles 1-5, sustituyendo a `createBlocks()` (el nivel 1 reproduce exactamente el layout actual). Prueba: `buildLevel(n)` devuelve los bloques esperados para `n = 1..5` y el nivel 1 se ve igual que en la SPEC 01.
4. Implementar `mulberry32`, `levelParams(level)` y la rama procedural de `buildLevel` para `level >= 6`. Prueba: `buildLevel(8)` produce siempre el mismo layout, con más filas y grises que `buildLevel(6)`, y nunca más de `MAX_ROWS` filas.
5. Reemplazar el estado `won` por `levelup`: al despejar el nivel mostrar la pantalla "Nivel N+1" y, con Espacio/click/tap, cargar el nivel siguiente (bola `stuck`, `status = 'ready'`, puntaje y vidas intactos). `resetGame()` vuelve al nivel 1. Prueba: despejar el nivel 1 lleva al nivel 2 con la bola más rápida; perder las 3 vidas y reiniciar vuelve al nivel 1.

## Criterios de aceptación

- [ ] El juego carga sin errores en la consola y el nivel 1 se ve y se juega igual que en la SPEC 01 (60 bloques de 1 golpe, bola a 320 px/s).
- [ ] El HUD muestra el nivel actual durante la partida.
- [ ] Al romper el último bloque aparece una pantalla "Nivel 2" y no aparece "¡Ganaste!" en ningún caso.
- [ ] Desde la pantalla de nivel, Espacio, click o tap cargan el nivel siguiente con la bola pegada a la pala, y el puntaje y las vidas no cambian.
- [ ] Los niveles 1 a 5 muestran cinco layouts distintos entre sí.
- [ ] A partir del nivel 6 los layouts se generan por código y el mismo nivel produce siempre el mismo layout.
- [ ] La velocidad de la bola en el nivel N es `320 × min(1 + 0.05×(N-1), 1.6)` px/s y no cambia durante el nivel.
- [ ] La velocidad de la bola no supera 512 px/s en ningún nivel.
- [ ] Un bloque gris con 2 golpes necesita 2 golpes para romperse, se atenúa tras el primero, suma 10 puntos una sola vez y la bola rebota en ambos golpes.
- [ ] Desde el nivel 10 los bloques grises necesitan 3 golpes.
- [ ] Ningún nivel generado tiene más de 10 filas ni 0 bloques, y todos son superables (no existen bloques indestructibles).
- [ ] Con niveles altos (≥ 20) la dificultad se estabiliza en los topes definidos y el juego sigue funcionando sin errores.
- [ ] Al perder la tercera vida aparece "Game Over"; reiniciar devuelve a nivel 1, puntaje 0, vidas 3 y velocidad base.
- [ ] Los efectos de la SPEC 02 (fade, `+10`, shake) siguen funcionando y terminan de animarse bajo la pantalla de nivel sin errores.
- [ ] Un bloque en explosión sigue sin cambiar la trayectoria de la bola.

## Decisiones

- **Sí:** 5 patrones fijos y luego generación procedural. Da variedad curada al inicio y permite niveles infinitos sin repetir layouts.
- **No:** solo procedural o solo patrones que ciclan. Lo primero pierde diseño a mano; lo segundo no es infinito de verdad.
- **Sí:** PRNG sembrado con el número de nivel. Hace los niveles reproducibles y facilita probarlos.
- **Sí:** tres palancas (velocidad, bloques de varios golpes, filas/densidad). Elegidas por el usuario.
- **No:** pala más pequeña por nivel. El usuario no la eligió; puede ir en otra spec.
- **Sí:** velocidad +5% por nivel con tope 1.6×. Con `MAX_DT = 0.05` s, a 512 px/s la bola avanza ≤ 25.6 px por paso, que sigue siendo menor que dos tamaños de bola; sin tope habría túnel a través de bloques y pala.
- **Sí:** conservar puntaje y vidas entre niveles. Elegido por el usuario; mantiene la tensión de la partida.
- **No:** vidas extra por nivel. Fuera de alcance; es una decisión de balance para otra spec.
- **Sí:** pantalla "Nivel N" con espera de acción. Da respiro entre niveles y reutiliza la acción Espacio/click/tap existente.
- **Sí:** eliminar el estado `won`. Sin final, "¡Ganaste!" no tiene sentido; el único final es `gameover`.
- **Sí:** bloques grises de 2 golpes (3 desde el nivel 10), atenuados tras el primer golpe. El spritesheet solo tiene un sprite gris, así que el daño se indica con alfa.
- **Sí:** golpes no letales no suman puntaje; solo la rotura suma `POINTS_PER_BLOCK`. Mantiene el puntaje por bloque de las SPEC 01 y 02.
- **No:** bloques indestructibles. Podrían dejar niveles irresolubles.
- **Sí:** nivel visible en el HUD y sin persistencia. Persistir el mejor nivel va con la spec de récord.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| La bola atraviesa bloques o la pala a velocidad alta | Tope de 1.6× (512 px/s) y `MAX_DT = 0.05` s; revisar a 30 fps durante las pruebas. |
| Un nivel procedural queda vacío o con bloques inalcanzables | Forzar al menos 1 bloque; todos los bloques son destructibles y las filas se limitan a `MAX_ROWS`. |
| Los patrones fijos 4 y 5 resultan demasiado fáciles o difíciles | Son datos en `LEVEL_PATTERNS` y los parámetros son constantes; se ajustan sin tocar la lógica. |
| Un bloque gris con golpes pendientes se confunde con uno que ya está roto | Atenuar con alfa tras cada golpe no letal y restaurar `globalAlpha` a 1 después. |
| Bloques grises rebotan la bola sin avanzar y el nivel se estanca | Rebote normal en cada golpe; `hits` baja siempre, así que cada bloque se rompe en un número finito de golpes. |
| La pantalla de nivel interfiere con efectos en curso | Los efectos usan `dt` y se siguen actualizando bajo la pantalla, como en SPEC 02. |

## Qué **no** está en esta spec

- Persistencia del mejor nivel o récord.
- Bloques indestructibles.
- Power-ups, vidas extra y multi-bola.
- Sonido.
- Pala más pequeña por nivel.
- Menú de inicio, pausa o selección de nivel.
- Cambios en `assets/spritesheet.js` o en los efectos de la SPEC 02.

Cada uno de estos, si se hace, va en su propia spec.
