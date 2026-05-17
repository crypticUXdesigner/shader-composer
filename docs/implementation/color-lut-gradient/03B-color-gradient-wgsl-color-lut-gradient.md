# 03B — Color Gradient — WGSL MVP — color-lut-gradient

## Agent instructions (START HERE)

**Depends on 03A and 01.** WGSL only; match GLSL semantics from 03A.

## Overview

WebGPU parity for **`color-gradient`**: two inputs, 3-stop spatial ramp, value multiply.

## Scope

### In

- Allow-list + `case 'color-gradient':` in `WgslMvpCompiler.ts`.
- Resolve `value` (`f32`), `position` (`vec2<f32>`).
- Helpers: `emitThreeStopWgslFunctions()`, spatial radial/linear (WGSL versions).
- Param wiring for all stop OKLCH + positions + mode + value shaping + intensity.
- Fixture: `fixture-mvp-color-gradient-radial` — `uv-coordinates` → position, `noise` → value, default params → final-output.
- Optional second fixture: linear mode `gradientMode=1`.

### Out

- UI previews (04), documentation (05).

## Dependencies

### Provides

- WebGPU Color Gradient.

### Blocks

- **05**

## Completion

✅ Done when fixtures report supported and visual spot-check matches WebGL for same graph.

### Final steps

- Update `_OVERVIEW.md` row **03B** → ✅ + date.
