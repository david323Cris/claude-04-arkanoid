# SPEC 02 — Efectos visuales en la destrucción de bloques

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-11-14
> **Objective:** Mejorar la animación de destrucción de bloques, que usa los frames de `EXPLOSION_FRAMES` del spritesheet, añadiendo fade-out, puntaje flotante (+10) y screen shake leve, sin cambiar la colisión, el puntaje ni los 150 ms de la explosión.

---

## Alcance

**Dentro:**

- La animación de destrucción sigue siendo la de los sprites de `assets/spritesheet.js`: los 4 frames de `EXPLOSION_FRAMES[color]` dibujados con `drawFrame`. No se dibuja ninguna animación procedural que sustituya o duplique esos frames.
- Fade-out del último tramo de esa animación: el alfa baja de 1 a 0 durante los últimos 75 ms de `EXPLOSION_DURATION` (frames 3 y 4).
- Puntaje flotante: texto `+10` que sube y se desvanece en la posición del bloque roto.
- Screen shake leve: sacudida corta del área de juego al romper un bloque.
- Los efectos se reinician al llamar a `resetGame()` y siguen animándose bajo la pantalla de `won` o `gameover` hasta terminar.
- Todos los cambios viven en `game.js`.
- Compatibilidad con multi-bola futura: los efectos se disparan desde una única función `breakBlock(blk)` que no recibe ni usa la bola, y solo actúa si el bloque está intacto (`explosionT === null`). Así, si dos bolas golpean el mismo bloque en el mismo frame o durante su explosión, los efectos y el puntaje se generan una sola vez.

**Fuera de alcance (para specs futuras):**

- Partículas o fragmentos dibujados por código: no existen como sprites en los assets.
- Implementar multi-bola (`state.ball` sigue siendo una sola bola en esta spec).
- Sonido (`break-sound.mp3` sigue sin usarse).
- Cambiar `EXPLOSION_DURATION` o editar `assets/spritesheet.js`.
- Cambiar la mecánica de rotura (bloques de varios golpes, reacción en cadena).
- Opción para desactivar efectos o respetar `prefers-reduced-motion`.
- Efectos al perder una vida o al rebotar en la pala.

## Modelo de datos

```js
// Constantes nuevas (game.js)
const FADE_MS = 75;                                    // ms finales de la explosión con fade
const FLOAT_TEXT = { life: 600, riseSpeed: 40 };       // ms, px/s
const SHAKE = { duration: 120, magnitude: 3 };         // ms, px

// Ya existentes en assets/spritesheet.js (no se modifican)
// EXPLOSION_FRAMES[color] -> 4 frames { sx, sy, sw, sh }; EXPLOSION_DURATION = 150 (ms)

// Campos nuevos en state
state.floatTexts = [/* { x, y, text, t } */];          // t = ms transcurridos
state.shakeT = null;                                   // null = sin sacudida, o ms transcurridos
```

Convenciones:

- El frame de la explosión se elige con `explosionT` sobre `EXPLOSION_FRAMES[blk.color]`, como hoy. `EXPLOSION_FRAMES.gray` reutiliza los frames rojos; no se usa porque el gris no está en el nivel.
- Los textos se crean en el centro del bloque roto, en el momento de la colisión (`explosionT = 0`), dentro de `breakBlock(blk)`. Esta función es el único lugar que pone `explosionT = 0`, suma `POINTS_PER_BLOCK` y genera los efectos; retorna sin hacer nada si `blk.explosionT !== null`.
- Ningún efecto guarda referencia a la bola que rompió el bloque: dependen solo del bloque. La colisión bola-bloque sigue ignorando bloques en explosión, por lo que una segunda bola los atraviesa.
- Cada texto se elimina al llegar a su `life`; el alfa baja linealmente de 1 a 0 con `t / life`.
- El shake desplaza el contexto con un offset aleatorio en `[-magnitude, magnitude]` por eje, que decae linealmente a 0 durante `SHAKE.duration`. Si otro bloque se rompe durante la sacudida, `shakeT` vuelve a 0.
- El HUD y la pantalla final (`drawHud`, `drawEndScreen`) se dibujan sin offset de shake.
- Los efectos usan delta time (`dt`) como el resto del juego.

## Plan de implementación

1. Extraer de `collideBlocks()` la función `breakBlock(blk)` (pone `explosionT = 0`, suma el puntaje, con la guarda `explosionT !== null`), añadir las constantes y los campos `floatTexts` y `shakeT` al estado, reiniciarlos en `resetGame()` y crear `updateEffects(dt)` (avanza `t`, elimina los textos vencidos) llamada desde `update(dt)`. Prueba: el juego se comporta igual que antes y no hay errores en consola.
2. Implementar el fade-out en `draw()`: aplicar `ctx.globalAlpha` durante los últimos `FADE_MS` de la explosión y restaurarlo a 1 después. Prueba: romper un bloque y ver que los últimos frames de su animación de sprites se desvanecen.
3. Generar el texto `+10` en `breakBlock(blk)` y dibujarlo en `draw()` subiendo y desvaneciéndose. Prueba: el `+10` aparece donde estaba el bloque y desaparece a los 600 ms.
4. Implementar el screen shake: poner `shakeT = 0` en `breakBlock(blk)`, avanzarlo en `updateEffects(dt)` y aplicar el offset con `ctx.save()`/`ctx.translate()`/`ctx.restore()` alrededor del dibujo del área de juego, dejando HUD y pantalla final fuera. Prueba: la sacudida dura ~120 ms y el HUD no se mueve.

## Criterios de aceptación

- [ ] El juego carga sin errores en la consola y se juega igual que con la SPEC 01.
- [ ] La explosión de cada bloque muestra los 4 frames de `EXPLOSION_FRAMES` de su color, en orden, y no se dibuja ninguna partícula procedural.
- [ ] Al romper un bloque, sus últimos 75 ms de explosión se dibujan con alfa decreciente hasta 0.
- [ ] Aparece un texto `+10` en la posición del bloque, sube y desaparece a los 600 ms.
- [ ] El canvas se sacude visiblemente unos 120 ms al romper un bloque y vuelve a su posición exacta después.
- [ ] El HUD (puntaje y vidas) y las pantallas de `won` y `gameover` no se sacuden.
- [ ] El puntaje sigue subiendo exactamente 10 por bloque y la explosión sigue durando 150 ms.
- [ ] Un bloque en explosión sigue sin cambiar la trayectoria de la bola.
- [ ] Al romper el último bloque, los efectos terminan de animarse bajo el mensaje "¡Ganaste!" sin errores.
- [ ] Al reiniciar desde "Game Over" o "¡Ganaste!" no quedan textos ni sacudida de la partida anterior.
- [ ] Romper bloques en rápida sucesión no deja la sacudida activa más de 120 ms tras el último bloque roto.
- [ ] Llamar dos veces seguidas a `breakBlock(blk)` con el mismo bloque (simulando dos bolas, p. ej. desde la consola del navegador) suma 10 puntos una sola vez y genera un solo `+10`.
- [ ] `breakBlock(blk)` no recibe ni lee la bola; los efectos no dependen de `state.ball`.

## Decisiones

- **Sí:** mantener `EXPLOSION_DURATION = 150`. Es una constante de `assets/spritesheet.js` y los efectos extra tienen su propia duración en `game.js`.
- **No:** alargar la explosión a ~300 ms. El usuario eligió mantener 150 ms.
- **Sí:** los tres efectos (fade, `+10`, shake) en una sola spec. Tocan un único archivo, son aditivos y se implementan en pasos independientes.
- **Sí:** la animación de destrucción sigue saliendo de `EXPLOSION_FRAMES`. El usuario pidió usar las animaciones de sprites que ya están en los assets.
- **No:** partículas dibujadas por código (cuadrados de color u otros). Se descartaron porque no son sprites de los assets; salieron de la spec a petición del usuario.
- **Sí:** fade solo en los últimos 75 ms. Un fade sobre los 150 ms completos oscurece los primeros frames de la explosión.
- **Sí:** shake que se reinicia con cada bloque roto, sin acumularse. Evita sacudidas largas o más fuertes al romper varios bloques seguidos.
- **Sí:** HUD y pantalla final sin shake. Mantienen el texto legible.
- **Sí:** valores de `+10` y shake como constantes con nombre, para ajustarlos sin tocar la lógica.
- **Sí:** una única `breakBlock(blk)` idempotente por bloque, desacoplada de la bola. Se prevé multi-bola en el proyecto y dos bolas pueden golpear el mismo bloque; así se evitan puntaje y efectos duplicados.
- **No:** implementar multi-bola ahora. Va en su propia spec; esta solo deja los efectos listos para ella.
- **No:** sonido en esta spec. El usuario lo dejó fuera; `break-sound.mp3` va en su propia spec.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| `ctx.globalAlpha` queda en un valor distinto de 1 y afecta al resto del dibujo | Restaurar a 1 justo después de cada bloque o texto con alfa. |
| El shake desplaza el contexto y no se restaura | Usar `ctx.save()` y `ctx.restore()` en cada frame, no `translate` acumulativo. |
| Demasiados textos con muchos bloques rotos a la vez | Como máximo se rompe un bloque por frame (SPEC 01) y cada efecto vive menos de 1 s: el número queda acotado. |
| Dos bolas rompen el mismo bloque en el mismo frame y duplican puntaje o efectos | La guarda `explosionT !== null` en `breakBlock(blk)` lo hace idempotente. |
| Con multi-bola se rompen varios bloques en un frame y se acumulan efectos | Cada efecto vive menos de 1 s; el shake se reinicia y no se acumula. El límite de "un bloque por frame" de la SPEC 01 es por bola. |
| Los efectos distraen o dificultan seguir la bola | Valores moderados (shake de 3 px) y constantes ajustables. |

## Qué **no** está en esta spec

- Partículas o fragmentos dibujados por código.
- Implementar multi-bola.
- Sonido.
- Cambios en `EXPLOSION_DURATION` o en `assets/spritesheet.js`.
- Cambios en la mecánica de rotura de bloques.
- Opción para desactivar efectos o `prefers-reduced-motion`.
- Efectos al perder una vida o rebotar en la pala.

Cada uno de estos, si se hace, va en su propia spec.
