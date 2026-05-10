# WebGPU migration (WebGPU-first, WebGL fallback)

## Mission

Make **WebGPU the default rendering backend** for preview + export, while keeping a **WebGL2 fallback** for unsupported browsers/devices and for incremental node coverage.

## Why this work package exists

- The preview renderer is currently **WebGL2** and compiles a graph into **one fullscreen fragment shader (GLSL)**, executed by `Renderer` + `ShaderInstance` (`src/runtime/Renderer.ts`, `src/runtime/ShaderInstance.ts`).
- Compilation can run in a worker, but **GPU object creation and drawing are main-thread only** (contract in `docs/architecture/compilation-worker.md`).
- Export is already a separate render path that compiles once and renders deterministic frames, with WebCodecs encoding (`src/video-export/*`, `src/image-export/*`).

This work package makes WebGPU a first-class backend without breaking the existing product while node/WGSL coverage grows.

## Goals

- **WebGPU-first**: when supported, preview uses WebGPU by default; WebGL remains a fallback (policy documented + implemented).
- **Parity**: for supported node subset initially, WebGPU output matches WebGL within a defined tolerance.
- **Incremental rollout**: feature flags, per-graph fallback, and a clear “coverage” signal keep the app usable throughout.
- **Export safety**: keep export semantics aligned with `docs/user-goals/09-export.md` and current offline rendering model.

## Non-goals (in this initial package)

- Building the full multi-pass/compute frame graph (tracked as later phases).
- Deleting WebGL support.
- Rewriting all node specs in one go.

## Work items

| ID | Task | Status | Provides | Blocks |
| --- | --- | --- | --- | --- |
| 01 | Backend selection + renderer seam | ✅ (2026-05-06) | `IRenderBackend` + selection policy scaffold (no behavior changes) | 02A, 02B, 03 |
| 02A | WebGPU device + canvas context (preview) | ✅ (2026-05-06) | Stable WebGPU context lifecycle + device-lost handling | 03, 04 |
| 02B | Compiler “backend result” + param layout contract | ✅ (2026-05-06) | Worker-safe compile output that can drive either backend | 03, 04, 05 |
| 03 | WebGPU fullscreen renderer (parity path) | ✅ (2026-05-06) | WebGPU preview draws fullscreen pipeline from compiled WGSL | 04, 05 |
| 04 | WGSL MVP: minimal node subset + fallback-by-coverage | ✅ (2026-05-06) | First working WebGPU graphs + per-graph WebGL fallback | 05 |
| 05 | Validation harness: compilation snapshots + golden images | ✅ (2026-05-07) | `wgslMvpCompileSnapshots.test.ts` + opt-in `npm run test:webgpu-golden`; RMS parity + perf smoke in harness | — |

## After 05: Phase 2–6 work (full migration)

Tasks below assume **01–05 are done** (prototype foundation). They describe the remaining work to reach “WebGPU-first” across preview + export, and then to unlock multi-pass/compute and performance targets.

| ID | Task | Status | Provides | Blocks |
| --- | --- | --- | --- | --- |
| 06 | WGSL coverage expansion plan + tracking | ✅ (2026-05-07) | `wgsl-coverage-ledger.md` (+ generator `scripts/generate-wgsl-coverage-ledger-table.ts`) + batches + fallback rules | 07, 08, 09 |
| 07 | WebGPU export (image) parity | ✅ (2026-05-07) | Still export rendered via WebGPU with identical UX + correctness | 08, 11 |
| 08 | WebGPU export (video) parity | ✅ (2026-05-07) | Video export rendered via WebGPU with WebCodecs; stable sync + no black frames | 11 |
| 09 | WebGPU resource model + frame graph MVP | ✅ (2026-05-07) | Resource pooling + pass graph representation + ping-pong support | 10, 12 |
| 10 | Compute/multi-pass heavy nodes rollout | 🟨 (in progress; RD compute + blur/bloom/bokeh/crep multipass landed; particles still fullscreen MVP) | Reaction-diffusion/particles/blur/bloom as compute/render passes | 12 |
| 11 | WebGPU-first rollout + fallback policy hardening | ✅ (2026-05-09) | `auto`→WebGPU when `navigator.gpu`; init/device-lost/compiler-driven WebGL fallback; URL override; QA matrix | 13 |
| 12 | Performance + stability hardening | ✅ MVP slice (2026-05-09) | Shader+pairs cache LRU cap (`WEBGPU_PREVIEW_CACHE_MAX_MODULES`); soak checklist doc; counters on dev overlay — iterate as needed | 13 |
| 13 | Optional: WebGL support reduction plan | ✅ policy (2026-05-09) | Maintainer policy in task **13** — keep WebGL fallback; deprecation criteria documented but inactive | — |

## Success criteria (target)

These bullets describe **where the migration lands** after Phase 2+ tasks (**06–13** / default policy in task **11**), not necessarily behavior today:

- With `gpu.backend=auto`, supported environments pick **WebGPU by default**, but automatically fall back to WebGL when unavailable or when a graph is unsupported.
- Representative graphs render with WebGPU and match WebGL within tolerance (golden-style diff).
- CI runs deterministic compile snapshots continuously; broader GPU visuals stay opt-in/nightly unless/until runners are dependable.

### Current vs target

| Area | Today (after tasks 01–05, **06**) | Target (see Success criteria above) |
| --- | --- | --- |
| Default preview/export backend | **`auto`** prefers WebGPU with reliable fallback (task **11** ✅). | Same; monitor fallback rate qualitatively in QA. |
| Node coverage | WGSL **MVP** subset only; **ledger** tracks all node ids + routing class. | Broad coverage; heavy nodes on frame graph/compute (**09–10**). |
| Visual regression | Compile snapshots in CI (**05**); golden harness **opt-in** (`npm run test:webgpu-golden`). | Same + optional stricter GPU gates when infrastructure allows. |

### How to read “Blocks”

**Blocks** is **release / safety gating** (what should be true before calling a slice “shipped”), not a ban on **speculative implementation** in parallel. Example: task **07** does not *require* an exhaustive ledger to prototype still export for MVP-only graphs, but **11** should not ship as default until **07–08** (if export is in scope) and coverage confidence are in place.

## Notes

This package is intentionally incremental. Each task is written to be “one-session implementable” and to avoid accidental scope creep:

- No unrelated doc cleanup.
- No preview performance tuning (e.g. `preserveDrawingBuffer`) unless a task explicitly says so.
- Backend seam tasks must preserve existing WebGL behavior by default.

- **2026-05-06 (Task 01)**: Added backend seam + selection scaffold (`src/runtime/renderBackends/*`), wired via `src/runtime/factories.ts`, and exposed selection in the preview scheduler debug overlay (`src/runtime/PreviewScheduler.ts`).
- **2026-05-06 (Task 02A)**: Implemented WebGPU device + `GPUCanvasContext` lifecycle behind `mode='webgpu'` (`src/runtime/renderBackends/WebGpuContext.ts`, `src/runtime/renderBackends/WebGpuRenderBackend.ts`, wired in `src/runtime/renderBackends/selectRenderBackend.ts`). Device-lost is surfaced via `ErrorHandler`; preview continues rendering via WebGL until task 03.
- **2026-05-06 (Task 02B)**: Extended `CompilationResult` to carry backend/coverage metadata + deterministic `paramLayout`, returned through the worker unchanged (`src/runtime/types.ts`, `src/shaders/NodeShaderCompiler.ts`). Added unit coverage for deterministic layouts (`src/shaders/NodeShaderCompiler.test.ts`).
- **2026-05-06 (Task 03)**: Implemented a WebGPU fullscreen-triangle render path with globals + params buffers and minimal pipeline caching, while preserving WebGL preview fallback (`src/runtime/renderBackends/WebGpuRenderBackend.ts`, `src/runtime/renderBackends/IRenderBackend.ts`, `src/runtime/CompilationManager.ts`, `src/runtime/types.ts`). Includes perf marks compatible with existing preview timing marks and a built-in WGSL test program until task 04 emits WGSL from graphs.
- **2026-05-06 (Task 04)**: Added WGSL MVP emission for a small node subset and deterministic fallback-by-coverage (compiler reports `supported:false` + reasons) so forced WebGPU mode transparently recompiles to WebGL when unsupported (`src/shaders/compilation/WgslMvpCompiler.ts`, `src/shaders/NodeShaderCompiler.ts`, `src/runtime/CompilationManager.ts`, `src/runtime/compilation/workerMessages.ts`, `src/runtime/compilation/compilationWorker.ts`). Added unit tests for WGSL subset and fallback wiring (`src/shaders/NodeShaderCompiler.test.ts`, `src/runtime/CompilationManager.test.ts`).
- **2026-05-07 (Task 05)**: WGSL MVP compile snapshots (`src/shaders/wgslMvpCompileSnapshots.test.ts`, `src/validation/webgpuMvpFixtures.ts`); browser parity + perf API (`src/validation/webgpuGoldenHarnessMain.ts`, `webgpu-golden-harness.html`); opt-in Playwright runner `npm run test:webgpu-golden` (`scripts/webgpu-golden-parity.ts`); WGSL preview dependency mask (`computePreviewDependencyMaskForWgslMvp` in `previewDependencyMask.ts`).
- **2026-05-07 (Task 06)**: Populated `wgsl-coverage-ledger.md` from `nodeSystemSpecs` with maintenance generator `scripts/generate-wgsl-coverage-ledger-table.ts` (`--write-doc`); conversion guidelines, fallback rules aligned with `WgslMvpCompiler`, and suggested conversion batches 06A–06E.
- **2026-05-07 (Task 07)**: Added WebGPU still export readback path (`src/image-export/WebGpuExportRenderPath.ts`) and wired `runImageExportFlow` to prefer WebGPU for WGSL-supported graphs with WebGL fallback + warning (`src/image-export/imageExportOrchestrator.ts`). Extended golden harness with export parity entrypoint (`exportOne`) to compare WebGL export vs WebGPU export bytes (`src/validation/webgpuGoldenHarnessMain.ts`). Verified `npm run build` and `npm test`.
- **2026-05-07 (Task 08)**: Added WebGPU video export render path (`src/video-export/WebGpuVideoExportRenderPath.ts`) and wired `runVideoExportFlow` to prefer WebGPU with safe fallback (`src/video-export/videoExportOrchestrator.ts`). Extended the opt-in golden harness with a short multi-frame “video render smoke” check (non-blank frames + RMS tolerance vs WebGL export path).
- **2026-05-07 (Task 10 groundwork)**: Added `src/runtime/webgpuFrameGraph/*` (resource pool + minimal frame graph + ping-pong helpers) and a dev-only multi-pass smoke path in `WebGpuRenderBackend`. Started a compiler-driven WebGPU pass plan for reaction-diffusion and routed it to a compute-based preview path; behavior is tracked as tasks **10A–10C**.
- **2026-05-07 (Task 09)**: Landed the minimal resource model + frame graph primitives (`FrameGraph`, `ResourcePool`, `pingPong`) with unit tests (`src/runtime/webgpuFrameGraph/FrameGraph.test.ts`) and a dev-only smoke path in `WebGpuRenderBackend` to exercise multi-pass execution.
- **2026-05-07 (Tasks 10A–10C)**: Defined a stable, cloneable compiler→runtime pass-plan contract for reaction-diffusion (`compute.reaction-diffusion.grayscott.v1`), implemented true WebGPU compute ping-pong with N steps/frame + deterministic init/reset, and extended the opt-in golden harness with a reaction-diffusion “intended look” signature check (updateable via `UPDATE_RD_GOLDEN=1`).
- **2026-05-08 (Task 10B blur pilot)**: Added a second pass-plan kind, `pass.blur.gaussian-separable.v1`, for the `blur` node (`src/runtime/types.ts`, `src/shaders/compilation/blurGaussianSeparableV1Wgsl.ts`). Compiler detects `... → blur → final-output` and recursively compiles the upstream subgraph as the input WGSL fragment program (`src/shaders/compilation/WgslMvpCompiler.ts`). Runtime encoder + dispatch in `src/runtime/renderBackends/blurGaussianSeparablePassPlanRuntime.ts`, wired into preview (`WebGpuRenderBackend`), still export (`src/image-export/WebGpuExportRenderPath.ts`), and video export (`src/video-export/WebGpuVideoExportRenderPath.ts`). Export paths now surface unknown pass-plan kinds via stable `compile.passplan.unsupported.<kind>` reasons. Compiler + runtime unit tests added; ledger generator updated to mark `blur` as `supported (pass plan)`.
- **2026-05-09 (Fullscreen WGSL)**: Procedural `particle-system`, bounded `volume-rays`, and `glass-shell` (two-shell refract + bounded marches) compile in fullscreen WGSL MVP (`WGSL_SUPPORTED_NODE_TYPES` + `WgslMvpCompiler` cases). Particles remain fragment-shader procedural (not GPU buffers); task **10** still owns compute/multipass rollouts (`wgsl-coverage-ledger.md` regenerated).
- **2026-05-09 (Task 06 SDF allow-list status)**: `GENERIC_RAYMARCHER_WEBGPU_MVP_SDF_TYPES` in `src/shaders/compilation/WgslMvpCompiler.ts` tracks the bounded `generic-raymarcher.sdf` pilot alongside `WGSL_SUPPORTED_NODE_TYPES` (`wgsl-coverage-ledger.md` + `scripts/generate-wgsl-coverage-ledger-table.ts`). The `SDF` palette’s fractal sdf types are covered end-to-end; `box-torus-sdf` (catalogued under **Shapes**/Primitives but sharing the `*-sdf` slug) **is included** via `boxTorusSceneSdf_distance` for the sdf port pilot. **`sphere-raymarch`** wires in as sdf input using `sphereRaymarch_implicit_distance_for_grm` (adapter: same spatial field as standalone’s marching step with prior `d` fixed to **1**, not a strict global distance). **`glass-shell`** is implemented for fullscreen WGSL MVP (bounded two-stage ray march; ledger calls out no golden-vs-WebGL yet). Prefer regen ledger after allow-list tweaks (`npx tsx scripts/generate-wgsl-coverage-ledger-table.ts --write-doc`).
- **Verification batch (maintainer)**: `npx vitest run`; `npm run type-check`; `npx tsx scripts/scan-webgpu-presets.ts` (preset scan must remain **25/25** supported).
- **Export compile gate (generic-raymarcher presets)**: `src/image-export/webGpuFullscreenExportCompilationGate.test.ts` and `src/video-export/webGpuFullscreenVideoExportCompilationGate.test.ts` mirror the early `CompilationResult` checks in `renderWebGpuExportRgba8` / `createWebGpuVideoExportRenderPath` fullscreen path (no metadata errors, `backend==='webgpu'`, `supported`, fullscreen WGSL-only — no `webgpuPassPlan`) for every bundled preset that uses bounded `generic-raymarcher`, so export wiring stays aligned with the shader compiler without requiring a GPU in CI. Shared assertions: `src/image-export/fullscreenWebGpuExportCompilationGateAssertions.ts`. Presets that ship `audioSetup` (e.g. sdf-raymarcher audio demos) pass the same `audioSetup` into `compile` as the export orchestrators do.
- **Export compile gate (audio pass-plan fixtures)**: `src/image-export/webGpuPassPlanAudioBokehCrepuscularExportCompilationGate.test.ts` + `src/video-export/webGpuPassPlanAudioBokehCrepuscularVideoExportCompilationGate.test.ts` assert bokeh + crepuscular-rays graphs with `mvpGenericRaymarcherSierpinskiTetraScaleAudioSetup`. **`src/image-export/webGpuPassPlanAudioBlurGlowBloomExportCompilationGate.test.ts`** + **`src/video-export/webGpuPassPlanAudioBlurGlowBloomVideoExportCompilationGate.test.ts`** cover **`mvpAudioBlurPassPlan`**, **`mvpAudioBlurPassPlanNonzeroBlur`**, and **`mvpAudioGlowBloomPassPlan`** with the same orchestrator-aligned compile contract plus structural checks on `webgpuPassPlan` (`pass.blur.gaussian-separable.v1` / `pass.glow-bloom.v1`) and `paramLayout` in `src/image-export/passPlanWebGpuExportCompilationGateAssertions.ts`. Reaction-diffusion + audio is deferred until a dedicated fixture is added.
- **Preset scan semantics**: `scripts/scan-webgpu-presets.ts` forwards optional `audioSetup` from each JSON file and counts a preset as supported only when the WebGPU compile is actually clean (`backend==='webgpu'`, `supported`, **no** `metadata.errors`) — not merely `supported: true` on an early validation-stub result.
- **2026-05-09 (Parameter-wire resolution in fullscreen WGSL)**: `WgslMvpCompiler` now resolves `targetParameter` connections at every parameter slot read (`paramSlotExprWired` in `compileWgslMvp`, `src/shaders/compilation/WgslMvpCompiler.ts`). Wires from regular nodes (e.g. `constant-float -> sierpinski-tetra-sdf.scale`) substitute the source's emitted scalar expression; wires from virtual audio sources (`audio-signal:remap-{id}` and `band-{id}-(raw|remap)`) substitute the audio uniform's `params[i].x` slot from the existing layout. Fixes inline WGSL parity for `mvpGenericRaymarcherSierpinskiTetraScaleWire`, `mvpGenericRaymarcherDisplacement`, and `mvpGenericRaymarcherJuliaSlab` (snapshots updated; previously emitted `0.0` for connected params). Adds bounded MVP fixture `mvpGenericRaymarcherSierpinskiTetraScaleAudio` (+ `mvpGenericRaymarcherSierpinskiTetraScaleAudioSetup`) and a paired `getWebgpuMvpFixtureAudioSetup` accessor in `src/validation/webgpuMvpFixtures.ts`; the snapshot test now forwards optional audio setup so audio-driven WGSL graphs can ship with deterministic compile snapshots. `WGSL_SUPPORTED_NODE_TYPES.size` unchanged at **147**; preset scan stays **25/25**.
- **2026-05-09 (Task 11 — WebGPU compile errors → WebGL preview)**: When the WGSL compile path returns `metadata.errors` while WebGPU is requested, `CompilationManager` now mirrors the unsupported-coverage path and recompiles for WebGL (worker + main thread), surfacing combined reasons via `captureWebgpuFallbackReasons` / dev overlay instead of stopping at a failed compile with no program. Documented selection vs `effectiveBackend` on `PreviewScheduler`. Tests: `src/runtime/CompilationManager.test.ts`.
- **2026-05-09 (Tasks 11–13 doc + stability close-out)**:
  - **11**: Task doc lists all fallback triggers (init, device lost, unsupported WGSL, `metadata.errors`, URL hatch); **`_OVERVIEW` rows 11–13** flipped to ✅ / policy-complete.
  - **12**: `WEBGPU_PREVIEW_CACHE_MAX_MODULES` + LRU eviction paired on `shaderModuleCache`/`renderPipelineCache` (`previewPerformanceMarks.ts`, `WebGpuRenderBackend.ts`); dev overlay **`wgpu cache evict`** counter; soak checklist added to task **12** markdown.
  - **13**: Written maintainer backend policy (**keep WebGL fallback**); exit criteria for any future deprecation listed but **inactive**.

### Task 10 — next milestone (particle-system compute + draw)

The smallest **next vertical slice** after blur/bloom/bokeh/crepuscular pass plans is **`particle-system` as real GPU work**, not the current fullscreen procedural MVP in `WGSL_SUPPORTED_NODE_TYPES`:

1. **Compiler**: introduce a new `WebGpuPassPlan` kind (e.g. `pass.particles.*.v1` per `docs/implementation/webgpu-migration/10-compute-multipass-heavy-nodes-rollout-webgpu-migration.md`) with WGSL for **compute update** + **draw/raster** (or documented staged stub + fail-closed tests until wiring lands).
2. **Runtime**: allocate particle storage buffers, dispatch compute, then render (preview + reuse patterns from `blurGaussianSeparablePassPlanRuntime.ts` / `WebGpuExportRenderPath.ts` for export).
3. **Safety**: preserve WebGL fallback when the plan is unsupported; extend CI with compile/export gates and optional harness signatures—not vapor interfaces.

Audio-driven reaction-diffusion export gates remain optional until an MVP graph fixture exists.


