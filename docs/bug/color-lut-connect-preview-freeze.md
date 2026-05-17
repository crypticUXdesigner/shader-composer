# Color LUT / Color Gradient — preview stuck on “Updating preview…” then tab freeze

**Status:** Open (investigated 2026-05-17; emitter/type fixes landed in code, preview hang may persist)

## Background

**ShaderNoice** is a node-based shader editor: users wire **nodes** on a canvas; a **preview** panel shows the live image driven by a compiled GPU program (**shader**). **Color LUT** and **Color Gradient** are new **Blend** nodes (package `color-lut-gradient`) that colorize a scalar or a spatial ramp. Connecting a wire between nodes changes the graph and triggers a **preview recompile**.

## Symptom

1. Add or select a **Color LUT** (or **Color Gradient**) node on the canvas.
2. Connect an upstream node (typical: **UV Coordinates** → **Noise** → **Color LUT** **Value**, or UV → **Position** + noise → **Value** for Color Gradient).
3. Bottom toast shows **“Updating preview…”** (indeterminate) and does not clear.
4. After a while the browser tab becomes unresponsive (**freeze**). **No errors** in the console (in the freeze case; a separate compile-error path can log `[FRAGMENT Shader] compile error` when GLSL is invalid).

**Expected:** Preview updates within a few seconds and the toast clears.

**Actual:** Toast stays up; UI locks up; no surfaced error dialog.

**Environment:** Reproduced in investigation on Windows dev builds; likely any Chromium browser. Affects **WebGL preview** path (default `?renderBackend=auto|webgl`). WebGPU-only sessions follow a different apply path but still embed the same large LUT helper blob in WGSL.

## Root cause

Multiple layers stack; all are relevant to the “connect → stuck toast → freeze” report.

### 1. Broken LUT shader emission (shipped, partially fixed)

The **Color LUT** node spec called `emitLutGlslFunctions()` with **no preset index**. That passed `undefined` into the emitter, which produced:

- An **empty** lookup table: `cr_lut_tables_pNaN[0]`
- A sampler named `cr_sample_lut_pNaN(float t)` instead of the dispatcher the node’s `mainCode` calls: `cr_sample_lut($param.preset, t)`

Effects:

- **Compile error** path: GLSL ES reports `cr_sample_lut : no matching overloaded function` and `cannot convert … float` to `vec3` (preset is an **`int` uniform**, while the emitter briefly used `float preset` — a second mismatch).
- **Hang path:** Drivers may **block or fault** on `compileShader` / `linkProgram` when sampling an empty const array with out-of-bounds indices—often **no JS log**, matching “freeze, no logs.”

**Fixes already applied in tree (verify on your branch):**

- Merged **12-preset atlas** + `cr_sample_lut(int preset, float t)` when no bake index is passed (`emitGlsl.ts` / `emitWgsl.ts`).
- `int` preset signature to match the node’s **Preset** enum uniform.

### 2. Large inlined LUT atlas on every compile

Even with a correct emitter, the WebGL fragment shader gains **~96k characters** of LUT helpers alone; a minimal **UV → noise → Color LUT → Final Output** graph compiles to **~104k characters** total (measured in Vitest, ~8 ms CPU compile). The table is:

- `12 presets × 256 samples × 3 RGB floats = 9 216` literals in a `const float cr_lut_tables[9216]` array
- Per-pixel **dynamic indexing** into that array

CPU-side graph compilation is fast; **GPU `compileShader` / `linkProgram` on the main thread** can still take seconds or **appear to hang** the tab, especially on first connect when no program cache exists.

### 3. Preview UX: toast tied to compile completion

On connection, `CompilationManager` shows **“Updating preview…”** via `beginPreviewCompileProgressToast()`. The toast is cleared only when `PreviewScheduler.recordCompileSucceeded()` or `recordCompileFailed()` runs—after worker reply and **main-thread** `applyCompilationResult()` (including WebGL program creation).

If the main thread is blocked inside `gl.compileShader()` (see `ShaderInstance.createShaderAndCaptureError`) or stuck in **`WEBGL_PROGRAM_PENDING`** retry (`scheduleApplyRetry` + `deferPending` link mode), the toast **never clears** and the UI looks “stuck updating” until the GPU returns or the tab dies.

Relevant flow:

```
wire added → onGraphStructureChange → recompile()
  → beginPreviewCompileProgressToast("Updating preview…")
  → worker compile (fast) OR main-thread compile
  → applyCompilationResult → new ShaderInstance(gl, …)
       → gl.compileShader(large fragment)  // can block; failures log, hangs may not
  → recordCompileSucceeded() → clear toast   // only if apply finishes
```

### 4. Color Gradient (secondary)

**Color Gradient** does **not** embed the LUT atlas; it only adds OKLCH 3-stop helpers (much smaller). If freeze happens **only** on Color Gradient, suspect the same preview/compile pipeline plus panel **Color map preview** strip (`ColorMapPreview.svelte` builds a 257-stop CSS gradient in `$derived` on each parameter read—not proven as a hang source, but worth profiling).

## Evidence

| Observation | Detail |
| --- | --- |
| Toast copy | `PREVIEW_COMPILE_DEFAULT_LABEL = 'Updating preview…'` in `previewCompileStatusStore.ts` |
| LUT helper size | `emitLutGlslFunctions()` ≈ **96 126** chars; full graph shader ≈ **104 065** chars |
| CPU compile | Vitest bench ≈ **7.8 ms**, **0** compiler metadata errors (valid graph after fixes) |
| Prior GLSL error | `cr_sample_lut : no matching overloaded function` — int uniform vs float parameter / missing dispatcher |
| No console on freeze | Consistent with **synchronous GPU compile blocking** or driver TDR, not a caught `ShaderCompilationError` |

## Key files

| File | Role |
| --- | --- |
| `src/shaders/nodes/color-lut.ts` | Node spec: `functions: emitLutGlslFunctions()`, `mainCode` calls `cr_sample_lut($param.preset, t)` |
| `src/shaders/colorRamps/emitGlsl.ts` | Emits merged `cr_lut_tables[9216]` + `cr_sample_lut(int preset, float t)` (or single-preset bake when index passed) |
| `src/shaders/colorRamps/emitWgsl.ts` | WGSL twin used by `WgslMvpCompiler` for WebGPU preview |
| `src/shaders/compilation/FunctionGenerator.ts` | Collects node `functions` into the fragment shader (includes entire LUT preamble) |
| `src/runtime/CompilationManager.ts` | Connection → debounced `recompile()`; shows/clears preview toast; worker + `applyCompilationResult` |
| `src/runtime/ShaderInstance.ts` | Main-thread `gl.compileShader` / `linkProgram`; logs compile errors; `deferPending` → `WEBGL_PROGRAM_PENDING` retries |
| `src/lib/stores/previewCompileStatusStore.ts` | **“Updating preview…”** toast state |
| `src/lib/components/node/parameters/ColorMapPreview.svelte` | Node panel LUT / 3-stop strip previews (CPU, not GPU) |

## Recommended fixes (priority)

1. **LUT delivery:** Stop inlining all 12 presets in every graph—options: **1D texture** + `texture()` sample; **compile-time bake** of the selected preset only (`emitLutGlslFunctions(presetIndex)` from node parameters); or **atlas + uniform** with documented size budget (see `docs/implementation/color-lut-gradient/01-shared-lut-ramp-module-color-lut-gradient.md`).
2. **Preview compile:** Move WebGL **compile/link** off the critical path or show **timeout / cancel** if apply exceeds N seconds; ensure failures always call `recordCompileFailed()` and surface `ErrorHandler` (user saw no logs on hang).
3. **`WEBGL_PROGRAM_PENDING`:** Cap `scheduleApplyRetry` attempts; clear or update toast on prolonged pending.
4. **Regression tests:** Assert compiled fragment contains `cr_sample_lut(int preset, float t)` and non-zero `cr_lut_tables[9216]`; optional perf budget test for shader char count.

## Repro (minimal)

1. Open ShaderNoice (WebGL preview).
2. Place **UV Coordinates**, **Noise**, **Color LUT**, **Final Output**.
3. Connect: UV → Noise **in**; Noise **out** → Color LUT **Value**; Color LUT **Color** → Final Output **in**.
4. Observe bottom **“Updating preview…”** and tab responsiveness.

Presets: `color-lut-demo.json` (Turbo preset) exercises the same node chain.

## Related

- Implementation package: `docs/implementation/color-lut-gradient/_OVERVIEW.md`
- Prior compile error in chat: GLSL overload / `vec3` assignment on `cr_sample_lut` call
