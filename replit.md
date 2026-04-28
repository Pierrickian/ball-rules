# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

---

## Ball Game 3D (`artifacts/3d-game`)

Top-down 3D ball game built with React Three Fiber.

### Architecture (decoupled logic/graphics)

```
src/
  engine/
    types.ts          — All TypeScript types (BallColor, BallSize enum, BallRule, GameState…)
    Ball.ts           — Ball class: pure data + logic, no Three.js knowledge
    game_engine.ts    — GameEngine: loads config, runs rule handlers, emits events
    useGameEngine.ts  — React hook: loads config, drives game loop, returns GameState
  scenes/
    GameScene.tsx     — Three.js Canvas + OrthographicCamera (graphics only)
    BallMesh.tsx      — 3D sphere renderer for a single ball (graphics only)
  game/
    HUD.tsx           — 2D overlay UI (score, legend, pause/reset)
  App.tsx             — Entry point wiring all layers together

public/
  game_config.json    — THE SINGLE SOURCE OF TRUTH for all game parameters
```

### game_config.json sections

| Section | What it controls |
|---|---|
| `graphics.ball_sizes` | Diameter (small/medium/large) |
| `graphics.arena` | Arena width/height in world units |
| `ball_colors` | RGB + hex for each of the 12 colors |
| `ball_rules` | Which rule applies to each color |
| `rule_parameters` | Fine-tuning each rule (radius, strength, speed…) |
| `gameplay.orange` | Spawn interval, launch color/size/speed |
| `gameplay.<color>` | Spawn/despawn conditions per color |

### Rules for developers

- **All rule changes MUST go through `ball.changeRule()` or `ball.passRuleTo()`** (Ball.ts)
- **All game parameters MUST be read from `game_config.json`** — no hard-coded values
- **To add a new rule:** add to `ball_rules` in JSON → implement handler in `game_engine.ts` → register in `registerAllHandlers()`
- **3D graphics and game logic are fully decoupled** — engine files have zero Three.js imports
- **Ball is a game object** — instantiate with `new Ball(...)`, assign behaviors via the engine
