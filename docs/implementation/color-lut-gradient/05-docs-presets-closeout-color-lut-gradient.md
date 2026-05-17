# 05 — Docs, presets, closeout — color-lut-gradient

## Agent instructions (START HERE)

**Depends on 02B, 03B, 04.** Finish package per **`_OVERVIEW.md`** success criteria.

## Overview

Help discovery, demo graphs, tests, implementation README link, overview ✅.

## Scope

### In

- **`src/data/node-documentation.json`:**
  - **`node:color-lut`** — title `Color LUT`; tagline; description (preset LUT, globals); inputs/outputs; `relatedItems`: `node:oklch-color-map`, `node:noise`, `type:float`; setup example: noise → color-lut → final-output; examples bullet list.
  - **`node:color-gradient`** — title `Color Gradient`; tagline (spatial 3-stop × value mask); inputs **Value** + **Position**; related: `node:uv-coordinates`, `node:gradient`, `node:oklch-color-map`; setup: uv → position, noise → value, color-gradient → final-output.

- **Demo preset(s)** under `src/presets/`:
  - `color-lut-demo.json` — noise field + Color LUT preset **Neon** or **Turbo** (visually striking).
  - `color-gradient-demo.json` — radial sky ramp × noise strength (shows black shadows).
  - Follow `src/presets/README.md` listing rules; validate loads after build.

- **Tests:**
  - Extend `NodeShaderCompiler.test.ts` if not done in 02A/03A (both node types, stepped params).
  - WebGPU fixtures from 02B/03B included in default `npm test` or documented opt-in — match repo convention.

- **`docs/implementation/README.md`:** Add row linking `color-lut-gradient/_OVERVIEW.md`.

- **`_OVERVIEW.md`:** Mark all tasks ✅; set progress **100%**; note ship date.

### Out

- User-goals doc edits (unless behavior warrants a line in `04-nodes-and-parameters.md` — optional one-liner, not required).

## Dependencies

### Provides

- Shipped package.

### Blocks

- Nothing.

## Completion

✅ Package done when:

- `npm run type-check && npm run test && npm run lint && npm run build` all green.
- Both demo presets load in app without validation errors.
- Help panel shows guides for both nodes.
- `_OVERVIEW.md` success criteria satisfied.

### Final steps

- Update `_OVERVIEW.md` progress tracker and task table (all ✅).
