# Arkanoid

Juego de Arkanoid hecho con HTML, CSS y JavaScript puro: **cero dependencias, sin build, sin gestor de paquetes**. Se desarrolla con un flujo *spec-driven*: cada funcionalidad nace de un spec en `specs/`.

## Cómo jugar

Abre `index.html` directamente en el navegador, o sírvelo con cualquier servidor estático (por ejemplo `python -m http.server`) desde la raíz del repo.

### Controles

| Acción | Teclado | Mouse / táctil |
| ------ | ------- | -------------- |
| Mover la pala | `←` `→` o `A` `D` | Mover el cursor / arrastrar el dedo |
| Iniciar partida / lanzar la bola | `Espacio` (`Enter` en el menú) | Botones y toques en pantalla |
| Pausar / reanudar | `P` o `Esc` | Menú de pausa |
| Subir / bajar volumen | `↑` `↓` o `+` `-` | Controles del menú |
| Silenciar | `M` | — |

## Características

- **Niveles infinitos** con dificultad progresiva: 5 layouts fijos y, desde el nivel 6, niveles procedurales deterministas.
- **Bola cada vez más rápida** con el nivel, hasta un tope de 1.6× la velocidad base.
- **Bloques grises** que requieren 2 golpes (3 desde el nivel 10).
- **Bloques móviles** desde el nivel 3: filas que se deslizan en sentidos alternos u ondas verticales, con intensidad creciente.
- **Efectos de destrucción**: animación de explosión con fade, puntaje flotante (+10) y leve screen shake.
- **Sonido**: rebotes y rotura de bloques, con volumen ajustable y silencio.
- **Pantalla de inicio y menú de pausa**: jugar, reanudar, reiniciar, volver al inicio, ajustar sonido y saltar a cualquier nivel del 1 al 10.
- **Récord de puntaje** guardado en `localStorage` (clave `arkanoid.highscore`).
- 3 vidas, puntaje y pantallas de victoria de nivel y fin de partida.
- Canvas lógico de 480×640 que se escala a la ventana manteniendo la proporción.

## Estructura del proyecto

```
index.html            página con el canvas del juego
style.css             estilos y escalado del canvas
game.js               toda la lógica del juego
assets/
  spritesheet-breakout.png   sprites de pala, bola, bloques y explosiones
  spritesheet.js             helper para cargar y dibujar sprites
  sounds/                    ball-bounce.mp3, break-sound.mp3
specs/                specs del proyecto (01–06) y .spec-config.yml
.agents/skills/       skills spec y spec-impl
CLAUDE.md             guía para Claude Code
```

## Flujo de desarrollo (spec-driven)

1. `/spec <descripción>` genera `specs/NN-slug.md` en estado `Draft`, tras preguntas aclaratorias. No escribe código.
2. Una persona revisa el spec y lo cambia a `Approved`.
3. `/spec-impl <NN-slug>` crea la rama `spec-NN-slug` e implementa el plan paso a paso, pausando para revisión.
4. Al terminar, el spec pasa a `Implemented` y la rama se integra a `main`.

La configuración está en `specs/.spec-config.yml` (`AutoCreateBranch`, `AutoCommitSteps`).

| Spec | Tema | Estado |
| ---- | ---- | ------ |
| 01 | MVP jugable | Implemented |
| 02 | Efectos de destrucción de bloques | Implemented |
| 03 | Niveles infinitos y dificultad progresiva | Implemented |
| 04 | Sonido | Implemented |
| 05 | Bloques móviles | Implemented |
| 06 | Pantalla de inicio y menú de pausa | Implementado |
