# 01 — Backend selection + renderer seam — webgpu-migration

## Agent instructions (START HERE)

Follow sections in order. This task is **seam + selection plumbing only**.

Non‑negotiables:

- **No behavior changes** to the WebGL preview path by default.
- **No performance tuning** (no `preserveDrawingBuffer` toggles, no DPR policy edits, no scheduling changes).
- **No doc cleanup** (do not delete or rewrite `docs/bug/*`, `docs/user-goals/*`, etc.).
- Graph stays immutable: runtime/compilation **must not mutate `NodeGraph`** (see `docs/architecture/graph-and-platform-boundaries.md`).

### “Be specific” constraints (read this twice)

- **Do not add any WebGL context attribute toggles** in this task (no new files like `previewContextOptions.ts`).
- **Do not change** `src/runtime/Renderer.ts`, `src/runtime/ShaderInstance.ts`, `src/runtime/RuntimeManager.ts`, `src/runtime/CompilationManager.ts` *except* for type-wiring needed to accept `IRenderBackend` (no scheduling edits).
- **Do not change** any export modules (`src/video-export/**`, `src/image-export/**`).

## Overview

Introduce a stable **render-backend seam** so the runtime can target either **WebGPU** (new) or **WebGL2** (existing) without duplicating scheduling, parameter, or audio policy.

## Scope

### In

- Define a **minimal** interface that captures what runtime needs from “the renderer backend” (preview only).
- Add a backend selection surface (dev-only acceptable initially): `auto | webgpu | webgl`.
- Wrap existing WebGL preview rendering behind the seam **without changing default behavior**.
- Record a debug-visible “selection result” (selected backend + reason) without changing presentation cadence.

### Out

- Implementing actual WebGPU rendering (tracked by later tasks).
- Changing graph store / data-model behavior.
- Export pipeline changes.
- Any change to WebGL context creation attributes (including `preserveDrawingBuffer`).
- Any change to adaptive preview DPR policy, compile scheduling, or dirty gating semantics.

### Expected touch points (guidance, not a gate)

Prefer to implement this task by introducing a new small folder (e.g. `src/runtime/renderBackends/`) plus a small wiring change in `src/runtime/factories.ts`. If you find yourself editing many existing runtime files, you are probably drifting out of scope—stop and re-check the “Out” list.

## Dependencies

### Provides

- A single entry point for “create renderer backend” used by runtime factories.
- A single capability probe + selection function used by preview + export (export wiring may be later).

### Blocks

- `02A` WebGPU context lifecycle
- `03` WebGPU fullscreen renderer

## Implementation tasks

1. Create `IRenderBackend` with **only** the methods already required by runtime today:
   - `markDirty(reason?)`, `render()`
   - `setShaderInstance(instance)` (keep legacy name to minimize churn)
   - `getCanvas()`, `getGLContext()` (for existing WebGL compilation/apply path)
   - context loss/restored callbacks as already supported by `Renderer`
   - `selection` metadata `{ mode, selected, reason }` for debug/telemetry
2. Implement `WebGlRenderBackend` as a thin adapter over the existing `Renderer`.
3. Implement `selectRenderBackend(canvas, mode, errorHandler?)`:
   - **Task 01 does not create WebGPU objects.**
   - `auto` selects WebGL2 but records whether `navigator.gpu` exists as part of the **reason**.
   - `webgpu` may be accepted as a mode but must still return WebGL2 with reason `forced.webgpu.unimplemented` (explicit).
   - `webgl` returns WebGL2 with reason `forced.webgl`.
4. Wire backend selection into `createRuntimeManager` via an **optional** options bag, defaulting to WebGL behavior identical to current main.
5. Expose selection in a debug-visible place (e.g. `PreviewScheduler` overlay state), but do not change render scheduling.

Guardrails (explicit checks):

- **No changes** to `CompilationManager` scheduling logic.
- **No changes** to `Renderer.setupViewport` DPR logic.
- **No changes** to WebGL context attributes.

## Technical notes

- Keep the “worker compile vs main apply” boundary unchanged (`docs/architecture/compilation-worker.md`).
- Avoid widening the interface too early; start minimal and evolve in `03`/`04`.

## Completion

✅ Done when:

- Default path is still WebGL2 preview and behaves identically (rendering, compile cadence, DPR behavior).
- The runtime can be constructed with `renderBackend: 'auto' | 'webgpu' | 'webgl'` without crashes.
- A debug-visible “selected backend + reason” is available.
- The diff scope is limited to the new backend seam + wiring (no unrelated doc deletions/cleanup).

### Acceptance (observable)

- **No regressions**: existing preview still renders and feels the same by default.
- **Selection works**: `auto|webgpu|webgl` mode is accepted; in Task 01, all modes may still resolve to WebGL2, but the **reason** must be explicit (e.g. forced webgl, webgpu unimplemented, navigator.gpu absent/present).
- **No sneak changes**: no new toggles around WebGL context creation attributes; no scheduling/DPR policy changes.

### Final steps

- Update `docs/implementation/webgpu-migration/_OVERVIEW.md` status for task 01.
- Run TypeScript build/check and ensure no new lints are introduced.
 - Sanity-check that the change set is still “seam + wiring”, not a performance refactor.

