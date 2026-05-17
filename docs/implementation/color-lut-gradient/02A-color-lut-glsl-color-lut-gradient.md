# 02A — Color LUT — GLSL NodeSpec — color-lut-gradient

## Agent instructions (START HERE)

Follow sections in order. **Depends on task 01.** Implement **WebGL path only** (NodeSpec + GLSL); WGSL is **02B**.

Read **`_OVERVIEW.md`** for ports, parameters, icon, category.

## Overview

Ship **`color-lut`** — preset-driven scalar colormap with global controls and a compact, scannable panel layout.

## Scope

### In

- **Files:** `src/shaders/nodes/color-lut.ts`; export from `color-system-nodes.ts` + `src/shaders/nodes/index.ts`.
- **NodeSpec:**

  | Field | Value |
  | --- | --- |
  | `id` | `color-lut` |
  | `displayName` | `Color LUT` |
  | `category` | `Blend` |
  | `icon` | `color-palette` |
  | `description` | One sentence: preset 1D LUT, globals for reverse/gamma/contrast/intensity |

- **Ports:**
  - In: `in` float, label **Value**
  - Out: `out` vec3, label **Color**

- **Parameters (defaults tuned for instant good look):**

  | Param | Type | Default | Range | Label |
  | --- | --- | --- | --- | --- |
  | `preset` | int | `0` (Viridis) | 0..11 | **Preset** |
  | `reverse` | int | 0 | 0..1 | **Reverse** |
  | `gamma` | float | `1.0` | 0.25..3 | **Gamma** |
  | `contrast` | float | `0.0` | -1..1 | **Contrast** |
  | `intensity` | float | `1.0` | 0..2 | **Intensity** |

- **`parameterLayout` (UX — implement exactly this structure):**

  1. **Grid** — `preset` only, `parameterUI: { preset: 'enum' }`, `layout: { columns: 1 }`, section label **Preset** (via element `label`).
  2. **`color-map-preview`** — `mode: 'lut'` (add mode in task 04 if missing; stub `mode: 'smooth'` only if 04 blocked — prefer coordinating: preview reads `preset` + globals from node params).
  3. **Grid** — `reverse` (toggle UI), `gamma`, `intensity`, `layout: { columns: 3 }`, `parameterSpan: { gamma: 2 }` optional.
  4. **Grid** — `contrast` full width or columns 1.

  Keep **minColumns: 3**; no Bézier rows; no port params on body.

- **`functions` / `mainCode`:** Import/inject emitted helpers from **task 01** (`emitLutGlslFunctions()` pattern or copy generated const arrays once per spec — prefer shared emitter called at spec build time or inline via template string import).

  ```glsl
  float t = clamp($input.in, 0.0, 1.0);
  t = applyLutT(t, $param.reverse, $param.gamma, $param.contrast);
  vec3 rgb = sampleLutPreset($param.preset, t);
  $output.out = applyIntensity(rgb, $param.intensity);
  ```

- **`NodeShaderCompiler.test.ts`:** Minimal graph: `constant-float` → `color-lut` → compile succeeds; snapshot or assert fragment contains `sampleLut` / preset table symbol.

### Out

- WGSL (`02B`), full preview polish (`04`), documentation (`05`).

## Dependencies

### Provides

- Registered `color-lut` on WebGL compile path.

### Blocks

- **02B, 04, 05**

## Completion

✅ Done when node appears in palette, default params compile, test passes, **`npm run type-check && npm test && npm run build`** green.

### Final steps

- Update `_OVERVIEW.md` row **02A** → ✅ + date.
