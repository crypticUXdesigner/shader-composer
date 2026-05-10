# 08 — WebGPU export (video) parity — webgpu-migration

## Agent instructions (START HERE)

This task moves **video export rendering** to WebGPU while keeping the WebCodecs pipeline and user-facing UX aligned with `docs/user-goals/09-export.md`.

Non‑negotiables:

- UX and constraints remain the same (dialog, progress “Frame N/M”, cancel, errors).
- Audio semantics remain the same (offline provider → uniform updates).
- If WebGPU export fails or graph unsupported, fall back to existing WebGL export path.

## Overview

Today video export:

- runs an offline loop in `src/video-export/videoExportOrchestrator.ts`,
- renders frames via `src/video-export/ExportRenderPath.ts` (WebGL2),
- encodes via WebCodecs/Mediabunny (`src/video-export/WebCodecsVideoExporter.ts`).

Add a WebGPU render path that can render frames deterministically for the offline loop.

## Scope

### In

- WebGPU export render path with deterministic per-frame rendering and reliable synchronization (no black frames).
- Integration into orchestrator selection logic (prefer WebGPU when supported and graph WGSL-supported).
- Parity validation cases using task 05 harness.

### Out

- Changing the WebCodecs exporter library or output format.
- Frame graph / compute (tasks 09–10), except as required for a minimal export render target.

## Dependencies

### Requires

- Task 07 still export path decisions (shared readback/sync patterns).
- Task 05 validation harness.

## Implementation tasks

1. Implement `WebGpuVideoExportRenderPath` (new module):
   - create a render target at export resolution
   - render one frame for `frameIndex` with `FrameAudioState.uniformUpdates`
   - provide a canvas-like source for Mediabunny if needed, or an explicit `VideoFrame` path
2. Synchronization:
   - ensure GPU work is complete before handing the frame to the encoder (`queue.onSubmittedWorkDone()` or staging-buffer completion).
3. Wire into `videoExportOrchestrator`:
   - prefer WebGPU when available and graph supported
   - otherwise fall back to existing `ExportRenderPath` unchanged
4. Add a short golden run (e.g. 2s @ 30fps) for one stable graph:
   - validate “no blank/black frames”
   - validate consistent first/last frames across reruns

## Acceptance (observable)

- Video export works on WebGPU-capable browsers with the same UX and produces a playable file.
- Export is stable (no intermittent black frames, correct frame count, cancel works).
- Unsupported graphs still export via WebGL with no regressions.

### Final steps

- Update `_OVERVIEW.md` status for task 08.

