# 02B — Color LUT — WGSL MVP — color-lut-gradient

## Agent instructions (START HERE)

**Depends on 02A and 01.** Add WebGPU support only; do not change GLSL semantics.

Coordinate on **`WgslMvpCompiler.ts`** if parallel with **03B**.

## Overview

Wire **`color-lut`** into WGSL MVP: allow-list, `case 'color-lut':`, shared helpers from task 01 emitters.

## Scope

### In

- Add `'color-lut'` to **`WGSL_SUPPORTED_NODE_TYPES`** (or equivalent allow-list in `WgslMvpCompiler.ts`).
- **`case 'color-lut':`** — resolve `in` via `resolveInputF32`; read params `preset`, `reverse`, `gamma`, `contrast`, `intensity`.
- `requireHelper(...)` with **task 01** `emitLutWgslFunctions()` body (oklch not needed for LUT unless presets stored OKLCH — RGB table is fine).
- `setNodeOut(nodeId, 'out', { type: 'vec3<f32>', code: ... })`.
- **`src/validation/webgpuMvpFixtures.ts`:** fixture `fixture-mvp-color-lut-viridis` — noise or UV-derived float → color-lut (preset 0) → final-output; assert `supported: true`.
- Extend **`NodeShaderCompiler.test.ts`** or WGSL harness if project pattern requires dual-backend assertion.

### Out

- Color Gradient WGSL (03B), UI (04).

## Dependencies

### Provides

- WebGPU compile parity for Color LUT.

### Blocks

- **05** (full package sign-off)

## Completion

✅ Done when fixture passes in `npm test` / webgpu golden if applicable, and preview with `?renderBackend=webgpu` colors a scalar field.

### Final steps

- Update `_OVERVIEW.md` row **02B** → ✅ + date.
