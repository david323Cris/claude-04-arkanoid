# SPEC 01 — MVP jugable de Arkanoid

> **Status:** Approved
> **Depends on:** Ninguna
> **Date:** 2026-11-14
> **Objective:** Crear un Arkanoid jugable en HTML, CSS y JavaScript sin dependencias, con un nivel fijo, vidas, puntaje, victoria/derrota y controles de teclado, mouse y táctil.

---

## Alcance

**Dentro:**

- `index.html` en la raíz del repo, con un `<canvas>` y la carga de `assets/spritesheet.js` y `game.js` como scripts clásicos.
- Canvas con resolución lógica fija de 480x640, escalado con CSS para ajustarse al viewport manteniendo la proporción.
- Un único nivel con layout fijo: 6 filas x 10 columnas de bloques de colores (red, yellow, cyan, magenta, hotpink, green), 1 golpe por bloque.
- Animación de explosión al romper un bloque (4 frames, `EXPLOSION_DURATION = 150` ms) usando `EXPLOSION_FRAMES`.
- Pala controlable por teclado (← → o A D), mouse (sigue el cursor) y táctil (arrastrar).
- Bola con velocidad constante; el ángulo de rebote en la pala depende del punto de impacto.
- La bola espera pegada a la pala hasta lanzarla (Espacio, click o tap), al inicio y tras perder una vida.
- 3 vidas, puntaje (+10 por bloque), HUD dibujado en el canvas.
- Estados: `ready`, `playing`, `won`, `gameover`, con reinicio desde las pantallas finales.

**Fuera de alcance (para specs futuras):**

- Sonidos (`ball-bounce.mp3`, `break-sound.mp3` quedan sin usar).
- Power-ups (pala grande, multi-bola, láser, etc.).
- Persistencia de récord (localStorage).
- Menú de inicio, pausa y mute.
- Varios niveles, bloques de varios golpes (el gris no se usa) y layouts aleatorios.
- Aceleración progresiva de la bola.

## Modelo de datos

```js
// Constantes (game.js)
const W = 480, H = 640;
const PADDLE = { w: 96, h: 12, y: 600, speed: 420 };   // px/s
const BALL = { size: 16, speed: 320, maxAngle: 60 };   // px/s, grados desde la vertical
const BLOCK = { w: 40, h: 20, cols: 10, rows: 6, offsetX: 40, offsetY: 80 };
const ROW_COLORS = ['red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green'];
const POINTS_PER_BLOCK = 10;
const INITIAL_LIVES = 3;

// Estado del juego
const state = {
  status: 'ready',      // 'ready' | 'playing' | 'won' | 'gameover'
  score: 0,
  lives: INITIAL_LIVES,
  paddle: { x: 0 },     // x de la esquina izquierda
  ball: { x: 0, y: 0, vx: 0, vy: 0, stuck: true },
  blocks: [/* { x, y, color, alive, explosionT } */],
};
```

Convenciones:

- Origen en la esquina superior izquierda del canvas lógico; las coordenadas de entrada (mouse/táctil) se convierten del tamaño CSS al lógico.
- Velocidades en px/s, con delta time por frame (`requestAnimationFrame`).
- `explosionT` es `null` mientras el bloque está intacto, o los ms transcurridos de la explosión; el bloque se elimina al llegar a `EXPLOSION_DURATION`. Un bloque en explosión ya no colisiona.
- Los tamaños de dibujo (pala 96x12, bola 16x16, bloque 40x20) escalan los sprites del spritesheet.

## Plan de implementación

1. Crear `index.html` y `style.css` con el canvas 480x640 centrado y escalado por CSS; crear `game.js` vacío. Prueba: abrir `index.html` y ver el canvas sin errores en consola.
2. En `game.js`, llamar a `loadSpritesheet` y arrancar un bucle con `requestAnimationFrame` y delta time; dibujar fondo, pala y bola estáticas con `drawSprite`.
3. Implementar los controles de la pala: teclado (← → / A D), mouse y táctil, con conversión de coordenadas CSS a lógicas y límites en los bordes.
4. Implementar la bola pegada a la pala y el lanzamiento (Espacio, click o tap) con velocidad constante y rebote en paredes laterales y techo.
5. Implementar el rebote en la pala con ángulo según el punto de impacto (máximo 60° desde la vertical, velocidad constante).
6. Generar el layout de bloques y dibujarlos; implementar la colisión bola-bloque (invertir el eje con menor penetración) y el puntaje +10.
7. Implementar la animación de explosión de los bloques con `EXPLOSION_FRAMES` y su eliminación tras 150 ms.
8. Implementar vidas: si la bola cae por abajo se pierde una vida y la bola vuelve a `stuck`; dibujar HUD de puntaje y vidas.
9. Implementar los estados `won` y `gameover` con mensaje en el canvas y reinicio con Espacio, click o tap.
## Criterios de aceptación

- [ ] Abrir `index.html` directamente en un navegador carga el juego sin errores en la consola.
- [ ] La página muestra pala, bola y 60 bloques (6 filas x 10 columnas) con los sprites del spritesheet.
- [ ] La pala se mueve con ← → y con A D, y no sale de los límites 0 a 480.
- [ ] La pala sigue el cursor del mouse y el dedo al arrastrar en pantalla táctil.
- [ ] Al inicio la bola está pegada a la pala y se lanza con Espacio, click o tap.
- [ ] La bola rebota en las paredes laterales y el techo.
- [ ] Golpear la pala por el borde desvía la bola más que por el centro, y la rapidez de la bola no cambia.
- [ ] Al golpear un bloque, este desaparece tras la animación de explosión y el puntaje sube exactamente 10.
- [ ] Un bloque en explosión no cambia la trayectoria de la bola.
- [ ] Si la bola cae por abajo, las vidas bajan en 1, la bola vuelve pegada a la pala y la partida continúa.
- [ ] Al perder la tercera vida aparece "Game Over" y el juego se detiene.
- [ ] Al romper los 60 bloques aparece "¡Ganaste!" y el juego se detiene.
- [ ] Desde "Game Over" o "¡Ganaste!", Espacio, click o tap reinician puntaje (0), vidas (3) y bloques (60).
- [ ] El canvas se ajusta a una ventana de 360x640 sin scroll horizontal y manteniendo la proporción.
- [ ] El puntaje y las vidas restantes son visibles en el canvas durante la partida.
## Decisiones

- **Sí:** tres archivos en la raíz (`index.html`, `style.css`, `game.js`). `assets/spritesheet.js` exige el HTML en la raíz y un MVP no necesita más módulos.
- **No:** todo en un solo HTML ni varios JS. Lo primero mezcla responsabilidades y lo segundo es sobreestructura para este tamaño.
- **Sí:** resolución lógica fija 480x640 escalada con CSS. Mantiene simple el layout de bloques y sirve en móvil y escritorio.
- **No:** canvas a pantalla completa ni tamaño fijo sin escalado. Complican el layout o fallan en pantallas pequeñas.
- **Sí:** rebote en la pala según el punto de impacto con velocidad constante. Da control al jugador, como el Arkanoid clásico.
- **No:** aceleración progresiva. Añade balanceo que no hace falta para un MVP.
- **Sí:** delta time en px/s. La velocidad no depende de la frecuencia de refresco del monitor.
- **Sí:** un nivel con layout fijo y bloques de 1 golpe. Es lo mínimo para que haya victoria y derrota.
- **Sí:** teclado, mouse y táctil desde el MVP, por decisión del usuario.
- **No:** sonidos. El usuario los dejó fuera; los MP3 existentes quedan para otra spec.
- **Sí:** la explosión de bloques entra, porque los frames ya existen en `spritesheet.js`.
- **No:** power-ups, persistencia de récord, menú/pausa/mute, varios niveles. Cada uno va en su propia spec.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| La bola atraviesa un bloque o la pala a velocidad alta | Con 320 px/s y 60 fps la bola avanza ~5 px por frame, menos que su tamaño (16); limitar el delta time a un máximo de 50 ms. |
| Rebotes dobles al tocar dos bloques a la vez | Resolver como máximo una colisión de bloque por frame. |
| La bola queda atrapada dentro de la pala | Reposicionar la bola justo encima de la pala al detectar el rebote y forzar `vy` negativo. |
| El spritesheet no ha cargado al primer frame | `drawSprite` no hace nada hasta que carga; arrancar el bucle desde el callback de `loadSpritesheet`. |
| Scroll o zoom de la página al arrastrar en táctil | `touch-action: none` en el canvas y `preventDefault` en los eventos táctiles. |
## Qué **no** está en esta spec

- Sonidos.
- Power-ups.
- Persistencia de récord.
- Menú de inicio, pausa y mute.
- Varios niveles, bloques de varios golpes o layouts aleatorios.
- Aceleración progresiva de la bola.

Cada uno de estos, si se hace, va en su propia spec.
