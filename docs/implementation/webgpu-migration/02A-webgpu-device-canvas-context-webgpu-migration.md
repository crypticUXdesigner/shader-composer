# 02A — WebGPU device + canvas context (preview) — webgpu-migration

## Agent instructions (START HERE)

Follow sections in order. Do not change user-facing UX beyond dev/debug switches. Preserve the existing runtime scheduling policy (dirty gating, adaptive preview) and keep graph read-only.

Guardrails:

- No node/compiler work in this task (no WGSL yet).
- No export changes.
- No changes to WebGL code paths except wiring needed to coexist with WebGPU selection (keep WebGL defaults unchanged).

### Expected touch points (guidance)

- New WebGPU context code should live in a dedicated module (e.g. under `src/runtime/renderBackends/`).
- Keep edits to existing runtime files minimal and mechanical (wiring only).

## Overview

Add a robust WebGPU context layer for preview rendering: adapter/device request, `GPUCanvasContext` configuration, resize handling, and device-lost recovery hooks.

## Scope

### In

- Capability probe and adapter/device creation.
- `GPUCanvasContext` configure with a chosen presentation format.
- Handling **device lost**: a clear signal to higher layers to recreate pipelines/program state.
- Minimal resize + DPR integration hook (no need to implement adaptive quality beyond matching current behavior).

### Out

- Fullscreen renderer implementation (task 03).
- Frame graph / resource pooling (Phase 4+).
- Export use of WebGPU.

## Dependencies

### Requires

- Task 01 seam and backend selection.

### Provides

- A `WebGpuContext` (or similar) that can be used by a renderer to create pipelines and submit work.

### Blocks

- Task 03 WebGPU fullscreen renderer

## Implementation tasks

1. Create a WebGPU context module/class that owns:
   - `adapter`, `device`
   - `canvasContext`
   - `presentationFormat`
2. Decide and document (in code and this task) the chosen presentation format and alpha mode.
3. Implement a `device.lost` handler:
   - Surface loss reason
   - Allow re-init attempt or request fallback to WebGL (explicit, debuggable)
4. Provide a minimal API for:
   - `getDevice()`, `getQueue()`
   - `getCurrentTextureView()` (or equivalent accessor for render pass)
   - `configure(width,height)` (called on resize)
5. Ensure backend selection uses this module only when WebGPU is chosen (no eager device creation in WebGL path).

Acceptance checklist (explicit):

- Selecting WebGPU creates a device/context and records selection metadata.
- Device lost is handled (no infinite loops; a clear error and/or fallback happens).
- Selecting WebGL still creates the same WebGL context attributes as before task 01.

## Technical notes

- Keep this module free of graph knowledge and compilation details.
- Prefer explicit error messages so `ErrorHandler` can surface them cleanly.

## Completion

✅ Done when WebGPU can be selected (even if it renders nothing yet) and the app can:

- initialize the WebGPU device/canvas context reliably,
- handle device lost by surfacing an actionable error and/or falling back to WebGL safely,
- resize without throwing.

### Notes (implementation decisions)

- **presentation format**: `navigator.gpu.getPreferredCanvasFormat()` (UA/device-chosen best match).
- **alpha mode**: `'premultiplied'` (matches default Canvas compositing expectations; revisit when we implement the actual WebGPU render pass in task 03).

### Final steps

- Update `_OVERVIEW.md` status for task 02A.
- Run build/check.

