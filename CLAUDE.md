# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Idioma

Responder siempre en español en este proyecto.

## Project state

Arkanoid game in plain HTML, CSS and JavaScript — **zero dependencies, no build step, no package manager**. The game itself is **not implemented yet**: the repo holds only the README (in Spanish), assets, and spec-workflow skills. There are no build, lint or test commands. Not a git repo yet (the spec workflow below assumes one).

Once an `index.html` exists, it is meant to be opened directly in a browser (or via any static file server).

## Assets (`assets/`)

- `spritesheet-breakout.png` — single spritesheet for paddle, ball, blocks and explosion animations.
- `spritesheet.js` — plain-script (non-module) helper that defines globals; load it with a `<script>` tag before game code. It provides:
  - `SPRITES` (paddle, ball, per-color `blocks`) and `EXPLOSION_FRAMES` (4 frames per color, `EXPLOSION_DURATION = 150` ms) as source-rect tables (`sx, sy, sw, sh`).
  - `loadSpritesheet(cb)` — loads the PNG, copies it to an offscreen canvas, then runs callbacks. **Must complete before drawing**; `drawSprite`/`drawFrame` silently no-op until loaded.
  - `drawSprite(ctx, name, x, y, w, h)` — `name` is `'paddle'`, `'ball'`, or `'block_<color>'`; `drawFrame(ctx, frame, x, y, w, h)` for explosion frames.
  - The PNG path is hardcoded as `assets/spritesheet-breakout.png`, relative to the HTML page, so the page must live at the repo root.
  - Colors: gray, red, yellow, cyan, magenta, hotpink, green. Note `EXPLOSION_FRAMES.gray` reuses the red frames.
- `sounds/ball-bounce.mp3`, `sounds/break-sound.mp3` — SFX for paddle/wall bounce and block break.

## Spec-driven workflow

Skills in `.agents/skills/` (installed from `Klerith/fernando-skills`, tracked in `skills-lock.json`) drive feature work; both are manual-only (`disable-model-invocation`):

- `/spec <description>` — asks clarifying questions, then writes `specs/NN-slug.md` (state `Draft`, from `template.md`). It writes no code, and creates `specs/.spec-config.yml` if absent.
- `/spec-impl <NN-slug>` — only runs if the spec's state is "Approved" (the human changes it from Draft). Creates/switches to git branch `spec-NN-slug`, then implements the plan one step at a time, pausing for review. Config flags in `specs/.spec-config.yml`: `AutoCreateBranch` (default true), `AutoCommitSteps` (default false; commits as `spec-NN-step-MM`).
- Implement exactly what the spec says; spec changes go in the spec, not in the code.

`.claude/skills/neko` is an unrelated persona skill (cat-style replies).
