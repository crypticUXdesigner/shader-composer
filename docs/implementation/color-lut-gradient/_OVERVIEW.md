# Color LUT & Color Gradient nodes

## Mission

Add two focused coloring nodes for everyday graphs: **`color-lut`** (scalar → RGB from curated 1D presets, minimal knobs) and **`color-gradient`** (3-stop OKLCH ramp **in space**, modulated by a float so dark data stays **black**). Both ship with strong defaults, polished panel layout, distinct icons, WebGL + WebGPU parity, and help/preset coverage—without replacing **`oklch-color-map`** (power-user Bézier) or **`gradient`** (float mask only).

## Execution order (for agents)

1. **01** — shared ramp/LUT module + tests (blocks all node work).
2. **02A ∥ 03A** — GLSL `NodeSpec` + registration for **Color LUT** and **Color Gradient** (coordinate on `src/shaders/nodes/color-system-*.ts` if splitting).
3. **02B ∥ 03B** — WGSL MVP cases + golden/fixture entries (high conflict on `WgslMvpCompiler.ts` — rebase or serialize if needed).
4. **04** — UI: previews, enum labels, icons, search tags, layout polish (`NodeBody` + `NodeBodyLayoutItem` in sync).
5. **05** — `node-documentation.json`, demo preset(s), compiler tests, README link — package closeout.

## Locked product semantics

### Color LUT (`color-lut`)

| Topic | Decision |
| --- | --- |
| **Input** | `float` **Value** (0–1, clamped in shader) |
| **Output** | `vec3` **Color** (sRGB-ish 0–1) |
| **Core UX** | **Preset** enum drives a baked **256×RGB** (or OKLCH→RGB) table; user rarely touches curves |
| **Globals** | **Reverse**, **Gamma** (on t before sample), **Contrast** (pivot 0.5), **Intensity** (scale RGB, clamp) |
| **Dark end** | Preset-defined (Viridis-like blues)—**not** forced black (differs from Color Gradient) |
| **Icon** | `color-palette` (Phosphor palette — distinct from Color Map swatch) |
| **Category** | `Blend` (same neighborhood as Color Map) |

### Color Gradient (`color-gradient`)

| Topic | Decision |
| --- | --- |
| **Inputs** | `float` **Value** (strength), `vec2` **Position** (UV / screen / custom; label **Position**) |
| **Output** | `vec3` **Color** |
| **Spatial ramp** | **3 OKLCH stops** with positions `stop0T ≤ stop1T ≤ stop2T` along linear or radial axis |
| **Modes** | **Linear** (angle + scale + optional center), **Radial** (center, radius, falloff) — reuse math from `gradient.ts` for `tSpatial` |
| **Value application** | `out = gradientRgb(tSpatial) * applyValue(value)` — **no** additive base; `value≈0` → **black** |
| **Value shaping** | **Gain**, **Softness** (smoothstep edge), **Power** (optional contrast on value before multiply) |
| **Hue path** | Shortest-path hue between stops in OKLCH (same spirit as `oklch-color-map` `interpolateHue`) |
| **Icon** | `color-wheel` (spatial hue wheel metaphor; avoids clashing with Patterns **`gradient`**) |
| **Category** | `Blend` |

## Non-goals (this package)

- Removing or merging **`oklch-color-map`**, **`gradient`**, or **`oklch-color`**.
- User-authored LUT import, texture uploads, or >3 gradient stops.
- Bézier curve editors on these nodes (defer to Color Map).
- Mask port on Color Gradient (compose with **`mask-composite-vec3`**).
- Fixing unrelated WebGPU warning-merge bugs (unless blocking compile warnings for fallbacks).

## Coordinator checklist

- **`displayName` === help `title`:** `Color LUT`, `Color Gradient` — `node-standards.mdc`.
- **Parameter labels:** short (node body grid); detail in `node-documentation.json`.
- **Enum UI:** `parameterEnumMappings.ts` for `preset`, `gradientMode`.
- **Previews:** extend **`ColorMapPreview.svelte`** (or sibling) for LUT strip + 3-stop spatial strip; keep canvas metrics in **`ColorMapPreviewElement.ts`**.
- **Defaults:** each preset / default 3-stop must look good on **Final Output** at 1080p without wiring tweaks.
- **Tests:** `npm run type-check`, `npm test`, `npm run lint`, `npm run build`; add `NodeShaderCompiler` cases + WebGPU MVP fixtures for one preset + one gradient mode each.
- **Registry:** `src/shaders/nodes/index.ts`, `color-system-nodes.ts`, `nodeSearchTags.ts` / `generate-node-search-tags.mjs`, `WGSL_SUPPORTED_NODE_TYPES` + cases.

## High-touch files

| Area | Files |
| --- | --- |
| Shared logic | `src/shaders/colorRamps/**` (new — task 01) |
| Node specs | `src/shaders/nodes/color-lut.ts`, `color-gradient.ts` |
| GLSL | Spec `functions` / `mainCode`; `NodeShaderCompiler.test.ts` |
| WGSL | `WgslMvpCompiler.ts` cases + helpers |
| UI | `ColorMapPreview.svelte`, `NodeBody.svelte`, `NodeBodyLayoutItem.svelte`, `parameterEnumMappings.ts`, `canvas-icons.ts` |
| Docs | `src/data/node-documentation.json` |

## Work items

| ID | Task | Status | Provides | Blocks |
| --- | --- | --- | --- | --- |
| 01 | [Shared LUT & 3-stop ramp module](./01-shared-lut-ramp-module-color-lut-gradient.md) | ✅ | Tables, samplers, Vitest | 02A–04 |
| 02A | [Color LUT — GLSL NodeSpec](./02A-color-lut-glsl-color-lut-gradient.md) | ✅ | `color-lut` spec + GLSL | 02B, 04, 05 |
| 02B | [Color LUT — WGSL MVP](./02B-color-lut-wgsl-color-lut-gradient.md) | ✅ | WebGPU parity + fixture | 05 |
| 03A | [Color Gradient — GLSL NodeSpec](./03A-color-gradient-glsl-color-lut-gradient.md) | ✅ | `color-gradient` spec + GLSL | 03B, 04, 05 |
| 03B | [Color Gradient — WGSL MVP](./03B-color-gradient-wgsl-color-lut-gradient.md) | ✅ | WebGPU parity + fixture | 05 |
| 04 | [UI layout, previews, icons](./04-ui-layout-previews-color-lut-gradient.md) | ✅ | Panel UX | 05 |
| 05 | [Docs, presets, closeout](./05-docs-presets-closeout-color-lut-gradient.md) | ✅ | Help + demo + ✅ package | — |

## Progress tracker

- **Overall:** 100% (shipped 2026-05-17).
- **Last reviewed:** 2026-05-17.
- **Notes (01):** `src/shaders/colorRamps/` — 12 LUT presets (`lutPresetData.generated.ts` via `scripts/generate-lut-presets.ts`), `applyLutT` / `sampleLut` / `sampleThreeStopOklch`, `emitLutGlslFunctions` + WGSL twins; Vitest `colorRamps.test.ts` green.
- **Notes (02A):** `src/shaders/nodes/color-lut.ts` — `emitLutGlslFunctions()`, contrast UI 0 = identity via `contrast + 1.0` in shader; `NodeShaderCompiler` LUT test; search tags + power snapshot.
- **Notes (02B):** `WgslMvpCompiler.ts` — `color-lut` allow-list + `emitLutWgslFunctions()` case; fixture `mvpColorLutViridis` / `fixture-mvp-color-lut-viridis`; WebGPU compile test in `NodeShaderCompiler.test.ts`.
- **Notes (03A):** `src/shaders/nodes/color-gradient.ts` — radial/linear spatial + `cr_sample_three_stop_oklch` × value mask; preview modes `lut`/`three-stop` stub in `ColorMapPreview.svelte` (task 04 polish).
- **Notes (03B):** `WgslMvpCompiler.ts` — `color-gradient` allow-list + `emitThreeStopWgslFunctions()` + shared `gradientRadial`/`gradientLinear`; fixtures `mvpColorGradientRadial` / `mvpColorGradientLinear`; WebGPU compile test + WGSL snapshots.
- **Notes (04):** `parameterEnumMappings.ts` — LUT preset labels from `LUT_PRESET_META`, `gradientMode` Radial/Linear; `ColorMapPreview` 256-sample `lut`/`three-stop` strips; `color-gradient` three stacked color pickers; search tags via `generate-node-search-tags.mjs`; Storybook `lut` + `three-stop` stories.
- **Notes (05):** `node-documentation.json` — `node:color-lut`, `node:color-gradient`; presets `color-lut-demo.json` (Turbo), `color-gradient-demo.json` (radial sky × noise); package closeout.

## Success criteria

- New graphs can colorize noise/SDF with **Color LUT** (preset change visibly alters output) and stylize with **Color Gradient** (position changes hue path; value→0 yields black).
- WebGL preview and WebGPU MVP compile paths succeed for demo preset graphs.
- `npm run type-check && npm run test && npm run lint && npm run build` green.
- `node:color-lut` and `node:color-gradient` in `node-documentation.json` with setup examples.
