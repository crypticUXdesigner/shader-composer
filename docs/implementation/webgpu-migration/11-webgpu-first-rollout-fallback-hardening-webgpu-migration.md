# 11 — WebGPU-first rollout + fallback policy hardening — webgpu-migration

## Agent instructions (START HERE)

This task changes the default backend behavior. Be conservative and make rollbacks easy.

Non‑negotiables:

- WebGPU is the default only when it is safe; fallback must be automatic and reliable.
- Errors must be surfaced via the existing `ErrorHandler` path (dismissible).
- Keep UX aligned with `docs/user-goals/01-overview-and-app-shell.md` (no surprising modal spam).

## Overview

After node coverage and export parity are strong enough, switch `auto` to mean “WebGPU first” with clear fallback triggers.

## Scope

### In

- Backend selection policy: prefer WebGPU when available, else WebGL.
- Fallback triggers:
  - WebGPU unavailable
  - adapter/device request fails
  - device lost unrecoverably
  - graph unsupported (coverage signal)
- A user/dev override to force WebGL (escape hatch).

### Out

- Removing WebGL entirely.
- Large UI changes (keep it to a small settings/debug toggle if needed).

## Dependencies

### Requires

- WGSL coverage is **broad enough** (ledger + parity checks). Treat “enough” as measurable by default, not as a vibe check (see **Rollout gates**).
- Export parity exists (tasks 07–08) if you intend WebGPU-first for export too.

## Rollout gates (suggested minimums before flipping default `auto`)

Tune numbers with product/Data; defaults are placeholders to force explicit sign-off:

- **Coverage:** at least **N** curated presets or golden fixtures render on WebGPU without fallback (pick N collaboratively; start small, grow with ledger).
- **Fallback rate:** on a labeled internal graph set (e.g. top presets), unsupported/fallback stays below a agreed threshold **per release**.
- **Export:** if exports must match preview backend, tasks **07–08** are **done** and at least one automated or scripted parity path exists outside “works on my GPU.”
- **Stability:** no known P0 device-lost / black-preview issues on target browsers without recovery or fallback.
- **Escape hatch:** force-WebGL documented for support (URL flag, debug overlay, or settings as appropriate).

## Implementation tasks

1. Update selection logic:
   - `auto` attempts WebGPU first, falls back to WebGL with explicit reason.
2. Add a stable override mechanism:
   - dev-only is acceptable initially; must be discoverable for support/debugging.
3. Add a short QA matrix doc:
   - browsers, OSes, and the expected selection result
   - “what to do when WebGPU fails”

## Current state (✅ shipped, 2026-05-09)

**Selection (`auto` preferred WebGPU)**

- `renderBackend` is parsed from URL in `src/lib/App.svelte` (`parseUrlRenderBackendOverride`; `renderBackend=` query param).
- `selectRenderBackend` (`src/runtime/renderBackends/selectRenderBackend.ts`): `auto` picks WebGPU when `navigator.gpu` exists, otherwise WebGL2.
- Backend choice is reflected on the scheduler debug overlay as `backend: … (reason)`.

**Fallback (automatic)**

| Trigger | Behavior | Surface |
| --- | --- | --- |
| `navigator.gpu` missing | Uses WebGL2 backend | Reason `auto.webgl2.navigator.gpu.absent` |
| Adapter/device/request failure | Backend stays WebGPU selection object but **`WebGpuRenderBackend` sets `selection.selected = 'webgl2'`** and draws via bundled WebGL path | `WebGpuRenderBackend.initWebGpu`; **ErrorHandler** warning |
| Device lost | Same as row above; clears GPU caches (`shaderModuleCache` / `renderPipelineCache` / pipelines) | `device.lost` handler in `WebGpuRenderBackend`; **ErrorHandler** path |
| WGSL compile **unsupported** (coverage / pass-plan) | `CompilationManager` recompiles for WebGL preview with reasons | Deduped **info** via `CompilationManager.notifyWebgpuFallback`; dev overlay **`effective`** line |
| WGSL compile **metadata.errors** while WebGPU was requested | Same recompile/WebGL fallback (Task 11 follow-up parity with unsupported graphs) | `CompilationManager.webGpuCompileUnusable` + `_OVERVIEW` note 2026-05-09 |

**Escape hatch**

- `?renderBackend=webgl` — force WebGL selection for debugging / support reproductions.
- `?renderBackend=webgpu` — force WebGPU path (`adapter`/`device` failures still fall through as above).
- `?renderBackend=auto` — explicit default.

## QA matrix (quick)

- Windows 10/11 + Chrome/Edge:
  - Expected: `auto` selects WebGPU when WebGPU is enabled, otherwise WebGL2.
  - If preview errors/black: retry with `?renderBackend=webgl` and capture the runtime error banner details.
- macOS + Chrome/Edge:
  - Expected: `auto` selects WebGPU on supported versions; otherwise WebGL2.
- Firefox stable:
  - Expected: usually WebGL2 (WebGPU may be behind flags / platform-dependent).

## Acceptance (observable)

- On a WebGPU-capable browser, default preview uses WebGPU for supported graphs.
- On non-WebGPU or unsupported graphs, the app still renders via WebGL without user intervention.
- Device lost does not brick the session; either recovery or fallback occurs with a clear error.

### Final steps

- ✅ `_OVERVIEW.md` task 11 row updated to shipped.
