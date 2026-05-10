Title: WebGPU — preview hangs or never finishes loading when **Bokeh** feeds **Blend Color** (blend chain)

Status: **Open** (partial mitigation attempted; reporter confirms issue persists)

## Symptom

- **Product surface**: ShaderNoice’s main **shader preview** (the central canvas). The app may show a compile/loading state that **never completes**, or the **browser tab (or whole browser) stops responding** until the user forcibly closes it.
- **Scope**: Observed when using the **WebGPU** rendering path with a graph where the fullscreen **Bokeh** post node’s output is wired into **Blend Color**’s **Blend** input (and the chain reaches **Final output**). **Blend Color** is the per-channel blend node (`blend-color`); its inputs are labeled **Background** (base) and **Blend** in the node body.
- **Expected**: After wiring, the graph recompiles and the preview shows a new image within a short time; the UI stays responsive.
- **Actual**: Preview does not stabilize; the session may **freeze** or require killing the browser process.

**Evidence to collect** (for anyone reproducing without repo access): whether the **DevTools console** shows WebGPU pipeline/shader errors, repeated `WEBGL_PROGRAM_PENDING`–style behavior, or a stuck compile toast; whether **Task Manager** shows the **GPU** or **renderer** process pegged; approximate **Chrome/Edge version** and **OS** (e.g. Windows 11).

## Terms

- **Node graph**: Nodes (blocks) and **wires** between **ports**; **Final output** is the sink node whose color is shown on the preview.
- **WebGPU path**: Preview uses the browser’s **WebGPU** API and **WGSL** shaders when the app’s backend selection is WebGPU-capable (as opposed to the legacy **WebGL2** / GLSL path).
- **Bokeh (fullscreen)**: Node id `bokeh`, palette label **Bokeh** — a **vec4**-in / **vec4**-out effect. On WebGPU, when wired **directly** into **Final output**, the compiler can emit a **multipass “pass plan”** (`pass.bokeh.v1`). When wired **upstream** (e.g. into **Blend Color**), the compiler is intended to use a **single-pass WGSL stub** inlined into one fragment shader (parity with the WebGL GLSL stub).
- **Blend Color**: Node id `blend-color`, palette label **Blend Color** — blends two **RGBA** inputs (**Background** + **Blend**) with a mode and opacity.

## Repro (minimal)

1. Use ShaderNoice with **WebGPU** available (browser with WebGPU enabled; app backend not forced to WebGL-only).
2. Build a small graph: a color source into **Bokeh**’s color input; **Bokeh** **out** → **Blend Color** **Blend**; another color (or chain) into **Blend Color** **Background**; **Blend Color** **out** → **Final output** **in**.
3. Ensure the app is trying to compile/preview on **WebGPU** (not silently falling back to WebGL — dev overlay or settings may show effective backend).
4. Observe whether preview settles or the tab locks up.

*(Exact preset file not required for external triage — any graph matching the topology above is enough.)*

## Root cause

**Not fully confirmed.** Investigation so far points to **lifecycle bugs between multipass WebGPU pass plans and single-pass WGSL pipelines**, plus a **compile-apply retry** path when the WebGPU backend cannot install a program immediately.

### What is known in-repo

1. **`CompilationManager`** (`src/runtime/CompilationManager.ts`): If `setWebGpuProgram(...)` returns **falsy** while the compile result is still WebGPU, the manager throws **`WEBGL_PROGRAM_PENDING`** and **retries on the next animation frame** until a program installs. A condition that **always** returns null can cause **per-frame retries** and a **stuck “compiling”** experience.
2. **`WebGpuRenderBackend.setWebGpuProgram`** (`src/runtime/renderBackends/WebGpuRenderBackend.ts`): Installs either a **pass-plan** program (blur / glow-bloom / bokeh / crepuscular multipass) or a **cached single-pass** WGSL `fs` pipeline. **`createShaderModule` / `createRenderPipeline` are synchronous** on the main thread; a **pathological or driver-problematic** WGSL string can **block or hang** the tab during compilation.
3. **Stale pass-plan state**: Previously, if the user switched from **Bokeh → Final output** (multipass) to **Bokeh → Blend Color → …** (inline WGSL), failure **before** the successful single-pass branch could leave **`activePassPlan`** still indicating **`pass.bokeh.v1`**, so **`render()`** could keep **encoding the old multipass bokeh path** with mismatched resources — a plausible trigger for **GPU hangs**. A mitigation **`clearWebGpuPassPlanRuntimeState()`** was added to run **at the start of the single-pass install path** (before reading `result.code` / building the pipeline). **Reporter states the problem persists**, so either the hang/retry is driven by **another factor**, or the failure mode is **not** only stale `activePassPlan`.

### Hypotheses worth validating next

- **A.** `setWebGpuProgram` still returns **null** repeatedly (WebGPU not “ready”, pipeline creation throws, or another guard).
- **B.** **Tint / GPU** blocks or faults on the **specific combined WGSL** (Bokeh stub + Blend Color helpers).
- **C.** **Unbounded `requestAnimationFrame` retries** without a cap or fallback to WebGL after N failures.
- **D.** A **different** code path (export, worker compile, or parameter flush) runs heavy work **synchronously** on the main thread for this graph shape.

## Failed / partial attempts (chronological)

1. **Inline WGSL for `bokeh`** when it is not `… → Bokeh → Final output` — added in `src/shaders/compilation/WgslMvpCompiler.ts` so WebGPU compilation is **supported** for mid-graph Bokeh (avoids “unsupported node” WebGL fallback).
2. **Clear multipass pass-plan GPU state** before building a single-pass pipeline in `setWebGpuProgram` — reduces risk of encoding **stale `pass.bokeh.v1`** after topology changes.

Neither resolved the reporter’s **freeze / never loads** behavior.

## Debug recipe (for developers)

1. Repro with **DevTools → Performance** sampling and **console** open; note whether **`WEBGL_PROGRAM_PENDING`** or WebGPU errors repeat.
2. Log **`setWebGpuProgram` return value** and **`webgpu.status`** on each apply attempt.
3. Capture **`result.code` length** and optionally run **WGSL validation** outside the browser if a hang localizes to **`createShaderModule`**.
4. Try the **same graph** with backend forced to **WebGL**: if stable, suspicion stays on **WebGPU install / pass-plan / WGSL**; if also bad, broaden to **compiler output or graph execution**.

## Key files

| File | Role |
| --- | --- |
| `src/runtime/renderBackends/WebGpuRenderBackend.ts` | Owns **`setWebGpuProgram`**, pass-plan vs single-pass **`render()`** branches, and **`clearWebGpuPassPlanRuntimeState`** — the seam where multipass and single-pass preview state meet. |
| `src/runtime/CompilationManager.ts` | Applies compile results; **`WEBGL_PROGRAM_PENDING`** retry loop when WebGPU program install is deferred or returns null. |
| `src/shaders/compilation/WgslMvpCompiler.ts` | WGSL MVP compiler; **`case 'bokeh'`** inline stub and **`tryCompileBokehPassPlan`** for `pass.bokeh.v1` when Bokeh feeds **Final output** directly. |
| `src/shaders/nodes/bokeh.ts` | GLSL node spec and single-pass **GLSL** math the WGSL stub is meant to mirror. |
| `src/shaders/nodes/blending-nodes.ts` | **Blend Color** node spec: ports **base** / **blend**, parameters **mode** / **opacity**. |

## Architecture slice (narrow)

- **Compile** produces a `CompilationResult` with either **`webgpuPassPlan`** (multipass metadata + upstream WGSL) or a **single `code` string** (full-screen fragment WGSL).
- **Preview** `render()` prefers **pass-plan** encoders when **`activePassPlan`** matches; otherwise draws the **single-pass** pipeline if **`pipeline`** is valid; else falls back to **WebGL** `super.render()`.
