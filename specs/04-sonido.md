# SPEC 04 — Sonido de rebotes y rotura de bloques

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-11-14
> **Objective:** Añadir sonido al juego: la bola suena al rebotar en paredes, techo y pala, el bloque suena al ser golpeado, y el jugador puede graduar el volumen con el teclado y silenciar todo con la tecla M.

---

## Alcance

**Dentro:**

- Sonido de la bola (`assets/sounds/ball-bounce.mp3`) al rebotar en la pared izquierda, la pared derecha, el techo y la pala.
- Sonido del bloque (`assets/sounds/break-sound.mp3`) al romperse un bloque. Cuando la bola toca un bloque suena solo el bloque, nunca `ball-bounce.mp3`.
- Cada sonido usa un único objeto `Audio`; si se dispara mientras aún suena, se reinicia (`currentTime = 0`) en lugar de clonarse.
- Volumen graduable de 0 a 1 en pasos de 0.1 con las teclas ↑ / + (sube) y ↓ / - (baja), en cualquier estado. Arranca en `SOUND_VOLUME = 0.5` y se aplica a todos los sonidos. Mantener la tecla pulsada repite el cambio.
- Tecla M: alterna silencio en cualquier estado (`ready`, `playing`, `won`, `gameover`). Se ignora `e.repeat`.
- El silencio y el volumen viven solo en memoria: arrancan con sonido y volumen 0.5, sobreviven a `resetGame()` y se pierden al recargar.
- Indicador en el HUD: texto `VOL NN%` siempre visible; mientras el juego esté silenciado se muestra `MUTE` en su lugar (sin shake, como el resto del HUD).
- Los fallos de reproducción (`play()` rechazado, archivo ausente) se ignoran sin errores en la consola ni interrumpir el juego.
- Todos los cambios viven en `game.js`.

**Fuera de alcance (para specs futuras):**

- Sonidos al perder una vida, ganar o hacer game over (no hay archivos de audio para ellos).
- Música de fondo.
- Control de volumen o mute táctil/con mouse (slider, botones) o menú de opciones.
- Volumen independiente por sonido.
- Persistir el silencio o el volumen en `localStorage`.
- Sonido distinto por color de bloque o por tipo de rebote.
- Solapar varias instancias del mismo sonido (`cloneNode`) o usar Web Audio API.
- Cambios en `assets/spritesheet.js`, `index.html` o los efectos visuales de la SPEC 02.

## Modelo de datos

```js
// Constantes nuevas (game.js)
const SOUND_VOLUME = 0.5;        // volumen inicial
const VOLUME_STEP = 0.1;
const SOUND_FILES = {
  bounce: 'assets/sounds/ball-bounce.mp3',
  break: 'assets/sounds/break-sound.mp3',
};

// Estado de audio (fuera de `state`, no se reinicia con resetGame())
const sounds = {/* bounce: Audio, break: Audio */};
let muted = false;
let volume = SOUND_VOLUME;      // 0 a 1
```

Convenciones:

- `playSound(name)`: si `muted` retorna; si no, pone `currentTime = 0`, llama a `play()` y captura el rechazo de la promesa con `.catch(() => {})`.
- Los `Audio` se crean una vez al cargar `game.js`, con `volume = SOUND_VOLUME`. `changeVolume(delta)` suma `delta` a `volume`, lo limita a [0, 1], lo redondea a un decimal (evita errores de coma flotante) y lo asigna a cada `Audio`.
- Teclas de volumen: `ArrowUp`, `+`, `=` y `NumpadAdd` suben; `ArrowDown`, `-` y `NumpadSubtract` bajan. Se llama a `preventDefault()` en las flechas para no desplazar la página. Cambiar el volumen no altera `muted`. La ruta es relativa a `index.html`, igual que el spritesheet.
- Los navegadores bloquean el audio hasta que hay un gesto del usuario; el primer sonido ocurre tras lanzar la bola (Espacio, click o tap), así que no se necesita desbloqueo especial.
- `playSound('bounce')` se llama solo cuando el rebote realmente ocurre (paredes y techo en `updateBall`, pala en `bouncePaddle` tras pasar las guardas). Si en un mismo frame hay dos rebotes (esquina), suena una sola vez por el reinicio.
- `playSound('break')` se llama únicamente desde `breakBlock(blk)`, después de su guarda `explosionT !== null`. Así suena una sola vez por bloque aunque dos bolas lo golpeen (compatible con multi-bola futura, como en la SPEC 02).
- `collideBlocks()` no llama a `playSound('bounce')`.
- `drawHud` dibuja alineado a la derecha en `(W - 16, 56)`, bajo las vidas, el texto `MUTE` si `muted` es `true` o `VOL NN%` (`Math.round(volume * 100)`) en caso contrario.

## Plan de implementación

1. Añadir `SOUND_VOLUME`, `SOUND_FILES`, `sounds`, `muted` y `playSound(name)` en `game.js`, creando los `Audio` al cargar. Prueba: abrir el juego sin errores en consola y ejecutar `playSound('bounce')` y `playSound('break')` desde la consola tras un click en la página; ambos suenan a volumen 0.5.
2. Llamar a `playSound('bounce')` en los rebotes de pared izquierda, pared derecha y techo (`updateBall`) y en el rebote de la pala (`bouncePaddle`). Prueba: la bola suena en las tres paredes y en la pala, y no suena al caer por abajo.
3. Llamar a `playSound('break')` en `breakBlock(blk)`. Prueba: al golpear un bloque suena solo `break-sound.mp3`, sin el sonido de rebote.
4. Añadir la tecla M (alterna `muted`, ignorando `e.repeat`) y el texto `MUTE` en `drawHud` cuando `muted` es `true`. Prueba: M silencia y des-silencia en cualquier estado, `MUTE` aparece y desaparece en el HUD, y reiniciar la partida no cambia el estado de silencio.
5. Añadir `VOLUME_STEP`, `volume` y `changeVolume(delta)`, las teclas ↑ ↓ + -, y el texto `VOL NN%` en `drawHud` (reemplazado por `MUTE` mientras `muted`). Prueba: las teclas suben y bajan el volumen de 0 a 100% en pasos de 10%, el HUD lo refleja y el sonido cambia de intensidad.

## Criterios de aceptación

- [ ] El juego carga sin errores en la consola y se juega igual que con las SPEC 01 y 02.
- [ ] Al rebotar la bola en la pared izquierda, la pared derecha o el techo suena `ball-bounce.mp3`.
- [ ] Al rebotar la bola en la pala suena `ball-bounce.mp3`.
- [ ] Al golpear un bloque suena `break-sound.mp3` y no suena `ball-bounce.mp3` en ese golpe.
- [ ] Llamar dos veces seguidas a `breakBlock(blk)` con el mismo bloque hace sonar `break-sound.mp3` una sola vez.
- [ ] No suena nada al lanzar la bola, al caer por abajo ni en las pantallas `won` y `gameover`.
- [ ] Dos bloques rotos en rápida sucesión reinician el sonido sin errores ni acumular instancias.
- [ ] Al cargar, todos los sonidos tienen volumen 0.5 y el HUD muestra `VOL 50%`.
- [ ] ↑ o + suben el volumen en 0.1 y ↓ o - lo bajan en 0.1, en cualquier estado, y el HUD se actualiza.
- [ ] El volumen no baja de 0% ni sube de 100%, y siempre es múltiplo exacto de 10% (sin valores como 30.000000000000004%).
- [ ] Todos los sonidos usan el mismo volumen tras cambiarlo; el siguiente rebote y la siguiente rotura suenan más fuertes o más bajos.
- [ ] Pulsar ↑ o ↓ no desplaza la página.
- [ ] Cambiar el volumen mientras está silenciado no quita el silencio; al quitarlo suena al nuevo volumen.
- [ ] Reiniciar la partida conserva el volumen elegido; recargar la página vuelve a 50%.
- [ ] M silencia el juego en `ready`, `playing`, `won` y `gameover`; pulsarla de nuevo restaura el sonido.
- [ ] Mantener M pulsada no alterna el silencio repetidamente.
- [ ] Mientras está silenciado, el HUD muestra `MUTE` en lugar de `VOL NN%` sin sacudirse; al restaurar el sonido vuelve `VOL NN%`.
- [ ] Reiniciar desde "Game Over" o "¡Ganaste!" conserva el estado de silencio.
- [ ] Recargar la página arranca con sonido activado.
- [ ] Si un archivo de audio no existe o `play()` falla, el juego sigue funcionando sin excepciones sin capturar.

## Decisiones

- **Sí:** un `Audio` por sonido que se reinicia al dispararse. Es simple, no acumula instancias y el corte del sonido previo es imperceptible con SFX tan cortos.
- **No:** `cloneNode()` por disparo ni Web Audio API. Añaden complejidad que no hace falta para dos efectos.
- **Sí:** `SOUND_VOLUME = 0.5` como volumen inicial con nombre, y `VOLUME_STEP = 0.1`, para ajustarlos sin tocar la lógica.
- **Sí:** volumen graduable con teclado (↑ ↓ + -), por petición del usuario tras revisar la spec. Es coherente con el control de mute y no requiere UI nueva.
- **No:** slider en el canvas. Añade hit-testing y UI desproporcionados para dos sonidos.
- **Sí:** un único volumen global para ambos sonidos. Volumen por sonido no se pidió.
- **Sí:** volumen visible siempre en el HUD como `VOL NN%`, reemplazado por `MUTE` al silenciar.
- **Sí:** el sonido del bloque se dispara en `breakBlock(blk)`. Reutiliza la guarda de idempotencia de la SPEC 02 y no depende de la bola.
- **Sí:** al golpear un bloque suena solo el bloque. Es el requisito del usuario: el bloque es quien suena, no la bola.
- **Sí:** paredes y techo comparten `ball-bounce.mp3` con la pala; el usuario pidió que la bola suene en ambos casos y solo hay un archivo de rebote.
- **No:** sonidos al perder vida, ganar o game over. El usuario limitó el alcance a los tres eventos y no existen archivos para ellos.
- **Sí:** tecla M para silenciar, con indicador `MUTE` en el HUD. Incluido a petición del usuario, aunque la SPEC 01 había dejado mute fuera.
- **Sí:** silencio y volumen solo en memoria. Persistirlos en `localStorage` queda fuera, como en las specs anteriores.
- **Sí:** M funciona en todos los estados y no afecta a la lógica del juego.
- **No:** control táctil de mute ni de volumen. Los dispositivos táctiles quedan sin forma de ajustarlos; va en otra spec si se necesita.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| El navegador bloquea `play()` antes de un gesto del usuario | El primer sonido ocurre tras lanzar la bola con un gesto; además se captura el rechazo de `play()`. |
| `play()` rechaza la promesa y genera errores en consola | `.catch(() => {})` en `playSound`. |
| Archivo de audio ausente o ruta incorrecta | Rutas relativas a `index.html`; un fallo se ignora y el juego sigue sin sonido. |
| Reiniciar un `Audio` en pleno frame produce un pequeño corte | Aceptado: los SFX son cortos y el corte es imperceptible. |
| El texto `VOL NN%` / `MUTE` choca con elementos del HUD que añada la SPEC 03 (nivel) | Se coloca bajo las vidas, en `(W - 16, 56)`; si la SPEC 03 usa esa zona, se reubica al implementar la segunda. |
| Con bloques de varios golpes (SPEC 03) un golpe no letal no suena | Esta spec suena solo al romper; el sonido de golpes no letales se define en la SPEC 03 si se implementa. |

## Qué **no** está en esta spec

- Sonidos al perder vida, ganar o game over.
- Música de fondo.
- Control de volumen o mute táctil/con mouse, slider o menú de opciones.
- Volumen por sonido.
- Persistencia del silencio o del volumen.
- Sonidos distintos por color o tipo de rebote.
- Cambios en `assets/spritesheet.js`, `index.html` o los efectos de la SPEC 02.

Cada uno de estos, si se hace, va en su propia spec.
