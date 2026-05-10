# 07 — WebGPU export (image) parity — webgpu-migration

## Agent instructions (START HERE)

This task moves **still image export** to a WebGPU render path while keeping UX identical to `docs/user-goals/09-export.md`.

Non‑negotiables:

- UX must remain the same (dialog, formats, sizing rules, download).
- Graph remains read-only; no data-model changes.
- If WebGPU export is not supported or fails, fall back to the existing WebGL export path with a clear error.

## Overview

Today image export uses `createExportRenderPath(...)` (WebGL2) then `canvas.toBlob(...)` (`src/image-export/imageExportOrchestrator.ts`).

Add a WebGPU export render path that:

- renders a deterministic frame at an exact time,
- produces bytes suitable for PNG/JPEG/WebP download,
- matches WebGL output within tolerance (golden image harness from task 05).

## Scope

### In

- A dedicated WebGPU export render path (do not reuse preview canvas).
- Readback strategy for RGBA8 pixels and conversion to a downloadable image.
- Capability probe + fallback to existing WebGL export path.
- Prefer **explicit color space assumptions** documented in code/comments (sRGB expectations and readback layout) so PNG/JPEG/WebP pipelines do not regress.

### Out

- Video export (task 08).
- Frame graph / compute (tasks 09–10).

## Touch points (expect conflicts if parallelized)

- `src/image-export/imageExportOrchestrator.ts` and `createExportRenderPath` call sites.
- Shared compile/runtime types (`CompilationResult`, coverage flags in `src/runtime/types.ts`) and compilation (`src/runtime/CompilationManager.ts`, worker messages).
- New module(s) beside existing WebGL export path (`src/image-export/`); reuse patterns from preview `src/runtime/renderBackends/WebGpuRenderBackend.ts` only where duplication is justified.

## Dependencies

### Requires

- Task 05 validation harness exists (at least locally) so we can compare outputs.

### Provides

- Still export correctness on WebGPU, which is prerequisite confidence for WebGPU-first rollout.

## Implementation tasks

1. Add a `WebGpuExportRenderPath` (new module) that can:
   - create a `GPUTexture` render target at export resolution,
   - render one frame for given `timeSeconds` and `timelineTime`,
   - copy to a mapped buffer and return RGBA8 bytes.
2. Wire image export orchestrator:
   - Prefer WebGPU when available and when the graph is WGSL-supported.
   - Otherwise use the current WebGL export path unchanged.
3. Convert bytes to downloadable image:
   - Use a safe browser-supported approach (e.g. `ImageData` → canvas → `toBlob`) unless the project already has a direct PNG encoder.
4. Add at least one golden parity check case for image export (small graph, fixed time).

## Acceptance (observable)

- Exporting an image on a WebGPU-capable browser produces a correct file at the chosen resolution/format.
- When WebGPU is unavailable or graph unsupported, export still works via WebGL (no regressions).
- No intermittent blank/black exports.

### Final steps

- Update `_OVERVIEW.md` status for task 07.

