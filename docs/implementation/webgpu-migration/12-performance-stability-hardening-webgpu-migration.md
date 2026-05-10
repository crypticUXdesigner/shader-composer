# 12 — Performance + stability hardening — webgpu-migration

## Agent instructions (START HERE)

This task is iterative hardening. Keep changes small and benchmarked; prefer measurable wins over speculative refactors.

Non‑negotiables:

- No correctness regressions (golden images stay within tolerance).
- Keep fallback intact.
- Do not change user-facing UX unless required for stability (and then document it).

## Overview

Once WebGPU is used broadly, focus shifts to:

- reducing stutters (pipeline creation, shader module compilation),
- avoiding bind group churn,
- improving long-session stability (device lost, memory growth),
- and meeting interactive FPS targets with adaptive quality.

## Scope

### In

- Pipeline/module caching strategy and keys.
- Buffer update strategy (ring buffers, batching).
- Bind group/layout stability (avoid rebuilding per frame).
- GPU/CPU timing instrumentation (as available).
- Long-session “soak” testing notes and fixes.

### Out

- Implementing frame graph from scratch (should already exist by now if needed).
- Rewriting the compiler architecture.

## Dependencies

### Requires

- WebGPU is active for meaningful graphs (tasks 04/10/11 depending on rollout).
- Validation harness exists (task 05).

## Implementation tasks

1. Identify top stutter sources:
   - pipeline creation on recompile
   - buffer updates per parameter
2. Add cache layers where needed:
   - shader module cache
   - pipeline cache
3. Reduce per-frame work:
   - batch buffer writes
   - reuse bind groups
4. Add a long-session checklist (manual):
   - run 10–30 minutes with frequent edits, export once, verify no memory blowup or device lost loops.

## Current implementation (✅ MVP slice, 2026-05-09)

| Item | Detail |
| --- | --- |
| Shader module + render pipeline cache | `WebGpuRenderBackend` (`shaderModuleCache`, `renderPipelineCache`), keyed by `presentationFormat:${WGSL}`; cleared on device lost |
| Cache bound (long-session stability) | `WEBGPU_PREVIEW_CACHE_MAX_MODULES` (= **64**) in `src/runtime/previewPerformanceMarks.ts`; oldest entries evicted pairwise from both Maps after new inserts |
| Perf counters | `previewPerfCounters`: `webgpuShaderModuleCreates` / `CacheHits`, `webgpuRenderPipelineCreates` / `CacheHits`, `webgpuShaderPipelineCacheEvictions` — surfaced on dev preview scheduler overlay |
| Globals + params buffers | Recreated only when WGSL/paramLayout changes (`setWebGpuProgram`); per-frame uploads only when `globals` or dirty params |
| Stable bind group layouts | Shared `singlePassLayouts` reused across fullscreen recompiles (same bindings) |
| Fallback | Unchanged (`CompilationManager` WebGL fallback; device-lost clears caches)

## Manual soak checklist (maintainer QA)

Repeat on **Windows Chrome** and optionally **macOS Chrome**.

1. **Duration:** 15–30 min active editing.
2. **Actions:** tweak parameters on presets with WGSL fullscreen + presets with blur/bloom/pass plans (RD optional); undo/redo wire changes; resize window (DPR churn).
3. **Watch:** dev overlay line **`wgpu cache evict`** — should creep up only after many distinct WGSL compiles (>64 fullscreen variants in one session); module/pipeline hits should dominate typical preset switching.
4. **Success:** preview stays responsive; no runaway FPS collapse; optional **Memory** profiler: no unexplained cliff (expect bounded shader/pipeline churn).
5. **Export:** still image + ~2s video smoke once mid-session.

## Acceptance (observable)

- Preview remains responsive under typical editing (no multi-second stalls on common recompiles).
- No sustained memory growth across a soak run beyond expected caches.
- Device lost behavior is understood and does not brick the app.

### Final steps

- ✅ `_OVERVIEW.md` task 12 row updated (cache cap + checklist this slice).

