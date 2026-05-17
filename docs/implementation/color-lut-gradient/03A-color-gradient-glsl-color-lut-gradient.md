# 03A — Color Gradient — GLSL NodeSpec — color-lut-gradient

## Agent instructions (START HERE)

**Depends on 01.** GLSL only; WGSL in **03B**. Semantics per **`_OVERVIEW.md`**.

## Overview

Ship **`color-gradient`**: spatial **3-stop OKLCH** ramp × **value mask** (black when value is 0).

## Scope

### In

- **Files:** `src/shaders/nodes/color-gradient.ts`; register like 02A.

- **NodeSpec:**

  | Field | Value |
  | --- | --- |
  | `id` | `color-gradient` |
  | `displayName` | `Color Gradient` |
  | `category` | `Blend` |
  | `icon` | `color-wheel` |
  | `description` | 3-stop OKLCH gradient in space; Value controls how much color (0 = black) |

- **Ports:**
  - `value` float — **Value**
  - `position` vec2 — **Position** (`fallbackParameter` optional: none; wire UV/screen explicitly in docs)
  - `out` vec3 — **Color**

- **Parameters:**

  **Mode**

  | Param | Type | Default | Label |
  | --- | --- | --- | --- |
  | `gradientMode` | int | 0 | **Mode** (0 Radial, 1 Linear) |

  **Linear** (`visibleWhen gradientMode === 1`)

  | Param | Default | Label |
  | --- | --- | --- |
  | `angle` | 90 | **Angle** |
  | `linearScale` | 1.0 | **Scale** |
  | `centerX` | 0 | **Center X** |
  | `centerY` | 0 | **Center Y** |

  **Radial** (`visibleWhen gradientMode === 0`)

  | Param | Default | Label |
  | --- | --- | --- |
  | `centerX` | 0 | **Center X** |
  | `centerY` | 0 | **Center Y** |
  | `radius` | 0.7 | **Radius** |
  | `falloff` | 0.25 | **Falloff** |

  **Stops (OKLCH)** — defaults = pleasant sky-like ramp:

  | Stop | L | C | H | Position `stopNT` |
  | --- | --- | --- | --- | --- |
  | 0 | 0.15 | 0.08 | 260 | `stop0T` = 0.0 |
  | 1 | 0.55 | 0.12 | 220 | `stop1T` = 0.5 |
  | 2 | 0.92 | 0.10 | 50 | `stop2T` = 1.0 |

  Param names: `stop0L/C/H`, `stop1L/C/H`, `stop2L/C/H`, `stop0T`, `stop1T`, `stop2T` (clamp/order in shader: sort or clamp `stop1T` between 0 and 1, enforce `stop0T <= stop1T <= stop2T`).

  **Value shaping**

  | Param | Default | Range | Label |
  | --- | --- | --- | --- |
  | `valueGain` | 1.0 | 0..4 | **Gain** |
  | `valuePower` | 1.0 | 0.2..4 | **Power** |
  | `valueSoftness` | 0.02 | 0..0.5 | **Softness** |
  | `intensity` | 1.0 | 0..2 | **Intensity** |

- **`parameterLayout`:**

  1. Grid — `gradientMode` enum, label **Mode**
  2. `color-map-preview` — `mode: 'three-stop'` (task 04); shows stop colors at `stopNT` along strip
  3. `parameterGroups` / grids — **Radial** vs **Linear** blocks (`visibleWhen`), mirror `gradient.ts` structure
  4. `color-picker-row` ×3 — labels **Stop 1**, **Stop 2**, **Stop 3** (short), pickers `[stop0L,stop0C,stop0H]` etc.
  5. Grid — `stop0T`, `stop1T`, `stop2T` (3 columns), label **Positions**
  6. Grid — `valueGain`, `valuePower`, `valueSoftness`, `intensity` — label **Value**

- **Shader logic:**

  ```glsl
  float tSpatial = /* linear or radial from $input.position, params */;
  tSpatial = clamp(tSpatial, 0.0, 1.0);
  vec3 oklch = sampleThreeStopOklch(tSpatial, stops...);
  vec3 gradRgb = oklchToRgb(oklch);

  float v = clamp($input.value, 0.0, 1.0);
  v = pow(v * $param.valueGain, $param.valuePower);
  v = smoothstep(0.0, $param.valueSoftness, v); // or equivalent edge softening
  $output.out = gradRgb * v * $param.intensity;
  ```

  **No** `mix(vec3(0.0), gradRgb, v)` with gray lift — true multiply so RGB → black.

- Reuse / share spatial functions with `gradient.ts` (`gradientRadial`, `gradientLinear`) — extract to `colorRamps/spatial.ts` in 01 if needed.

- **Compiler test:** UV → position, noise → value, color-gradient → output compiles.

### Out

- WGSL, previews, docs.

## Dependencies

### Provides

- `color-gradient` WebGL node.

### Blocks

- **03B, 04, 05**

## Completion

✅ Done when default node on Final Output shows vertical sky-like ramp modulated by a test float (manual or preset in 05).

### Final steps

- Update `_OVERVIEW.md` row **03A** → ✅ + date.
