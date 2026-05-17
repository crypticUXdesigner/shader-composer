# 01 — Shared LUT & 3-stop ramp module — color-lut-gradient

## Agent instructions (START HERE)

Follow sections in order. **No `NodeSpec`, no compiler hooks, no UI** in this task—only **`src/shaders/colorRamps/**`** + Vitest.

Respect **`_OVERVIEW.md`** locked semantics for LUT vs spatial gradient.

## Overview

Create a **single source of truth** (TypeScript) for:

1. **1D LUT presets** — RGB samples (256 entries) used by **Color LUT**.
2. **3-stop OKLCH ramp** — sampling `t ∈ [0,1]` with stop positions + shortest-path hue — used by **Color Gradient** (and previews in task 04).

Emit **GLSL and WGSL function bodies** (strings) from the same data so 02A/02B/03A/03B do not duplicate tables.

## Scope

### In

- Suggested layout:
  - `src/shaders/colorRamps/lutPresets.ts` — preset metadata + `Float32Array` or `number[]` RGB triplets length `256 * 3`.
  - `src/shaders/colorRamps/threeStopOklch.ts` — stop type `{ l, c, h, t }`, sampler.
  - `src/shaders/colorRamps/oklchToRgb.ts` — shared conversion (match coefficients in `color-system-color-map.ts`).
  - `src/shaders/colorRamps/emitGlsl.ts`, `emitWgsl.ts` — `sampleLut(presetIndex, t)`, `sampleThreeStopOklch(stops, t)`, helpers.
  - `src/shaders/colorRamps/index.ts` — barrel exports.
  - `src/shaders/colorRamps/*.test.ts`

- **Preset list (v1 — ship all, tuned for “great out of the box”):**

  | Index | Id | Display label | Character |
  | ---: | --- | --- | --- |
  | 0 | `viridis` | Viridis | Perceptual scientific default |
  | 1 | `inferno` | Inferno | Warm dark→bright |
  | 2 | `magma` | Magma | Purple fire |
  | 3 | `plasma` | Plasma | Pink/purple electric |
  | 4 | `cividis` | Cividis | Colorblind-safe |
  | 5 | `turbo` | Turbo | High dynamic rainbow |
  | 6 | `cool` | Cool | Blue→cyan highlight |
  | 7 | `warm` | Warm | Deep red→amber |
  | 8 | `neon` | Neon | Saturated cyber |
  | 9 | `film` | Film | Teal shadows, orange highs |
  | 10 | `grayscale` | Grayscale | Neutral diagnostic |
  | 11 | `night` | Night | Blue-black sky ramp |

  Tables may be **generated offline** (script in `scripts/` optional) from published colormap samples; commit **static arrays** so runtime has no fetch.

- **LUT sampling:** `t` clamped 0–1; `idx = floor(t * 255)` or smooth `mix` between `idx` and `idx+1` (prefer **linear interp** between adjacent samples for quality).

- **Global modifiers (TS + emitted GLSL/WGSL helpers):**
  - `applyLutT(t, reverse, gamma, contrast)` → `t'` before sample.
  - `applyIntensity(rgb, intensity)` → clamped scale.

- **3-stop sampler:** given stops at `t0 < t1 < t2`, piecewise lerp L/C; hue via shortest arc (document algorithm; mirror existing `interpolateHue` behavior).

- **Tests:**
  - Every preset array length === `256 * 3`, values in `[0,1]`.
  - `applyLutT(0.5, reverse=1, …)` endpoints behave.
  - 3-stop: `t=t0` → stop0 OKLCH, `t=t2` → stop2, mid at `t1`.
  - Emitted GLSL/WGSL strings contain **distinct** preset branch or table for ≥2 presets (spot-check substring).

### Out

- Node specs, WGSL compiler cases, UI previews (later tasks).

## Technical notes

- **Do not** import `WgslMvpCompiler` from this module (keep dependency direction clean).
- Prefer **const arrays** inlined into shader `functions` blocks via emitter (size budget: 12 × 256 × 3 floats — acceptable for node `functions` once per graph compile).
- Alternative: one merged atlas + `preset` uniform index — only if emitted code size becomes a compile problem (document in task if switching).

## Dependencies

### Provides

- `getLutPresetCount()`, `getLutPresetLabel(id)`, `emitLutGlslFunctions()`, `emitLutWgslFunctions()`, `emitThreeStopGlslFunctions()`, `emitThreeStopWgslFunctions()`, `sampleLut*`, `sampleThreeStop*` helpers for tasks 02–03.

### Blocks

- **02A, 02B, 03A, 03B, 04** (preview can import TS sampler for DOM strip).

## Completion

✅ Done when module + tests land and **`npm run type-check && npm test`** pass for new files.

### Acceptance (observable)

- At least **12** presets registered with stable int ids **0..11**.
- Vitest proves smooth LUT interp does not return NaN for random `t ∈ [0,1]`.
- 3-stop sampler monotonic in `t` for L when stops increase in L (fixture stops).

### Final steps

- Update `_OVERVIEW.md` row **01** → ✅ + date.
