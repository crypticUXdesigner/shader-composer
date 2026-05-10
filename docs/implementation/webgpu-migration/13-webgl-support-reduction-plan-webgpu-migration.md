# 13 — Optional: WebGL support reduction plan — webgpu-migration

## Agent instructions (START HERE)

This task is product/policy heavy. Do not remove WebGL in code as part of this task unless explicitly requested and backed by telemetry/QA evidence.

## Overview

Decide whether WebGL fallback remains long-term, and if not, define conditions and a timeline for reducing support safely.

## Scope

### In

- Documented policy:
  - which browsers/OSes are supported for WebGPU
  - when fallback is used
  - what user messaging looks like (if any)
- A deprecation plan (if desired):
  - milestones and exit criteria
  - what must be true to remove WebGL code paths

### Out

- Implementing the deprecation (code deletion) in this task.

## Dependencies

### Requires

- WebGPU-first rollout (task 11) complete and stable.
- Export parity complete (tasks 07–08) and stable.
- Soak/perf hardening complete (task 12) to reduce false “fallback needed” cases.

## Implementation tasks

1. Inventory who still needs WebGL fallback:
   - unsupported devices/browsers
   - known WebGPU failure classes (device lost, driver issues)
2. Define exit criteria for reducing WebGL support:
   - low fallback rate over time (if telemetry exists)
   - no export regressions
   - support burden acceptable
3. Propose the least risky end state:
   - keep WebGL forever as fallback, or
   - keep WebGL only for preview (export WebGPU-only), or
   - remove WebGL after a deprecation window

## Maintainer policy — backend support (2026-05-09)

### Default stance

Ship **WebGPU-first with WebGL2 fallback** until product + telemetry justify any change; **do not delete WebGL** as part of this migration task.

### Environment intent

| Surface | Guidance |
| --- | --- |
| Chrome / Edge (recent), Win/macOS, WebGPU usable | Prefer WebGPU preview + WGSL-covered export; fallback only on init/device-lost/graph/compile |
| Older Chromium / flaky GPU | Stable WebGL2 path |
| Firefox / Safari | WebGPU readiness varies — `auto` may stay on WebGL2; `?renderBackend=webgpu` for experimentation |
| CI | Deterministic WGSL snapshots; GPU golden **`npm run test:webgpu-golden`** stays opt-in |

### Fallback inventory

1. `?renderBackend=webgl` — `src/lib/App.svelte` (`parseUrlRenderBackendOverride`)
2. `navigator.gpu` missing — `src/runtime/renderBackends/selectRenderBackend.ts`
3. WebGPU adapter/device/request failure — `WebGpuRenderBackend.initWebGpu` continues via WebGL + warning
4. Device lost — `device.lost` handler clears caches, flips effective path
5. WGSL unsupported or `metadata.errors` on compile — `CompilationManager` recompiles preview for WebGL (deduped info notice)

### User-facing messaging

- No modal spam; **ErrorHandler** warnings/errors for hard GPU failures; one **deduped info** toast for editorial/coverage fallback.

### If reducing WebGL is reconsidered — exit criteria (**not activated**)

- Months of soak with no unresolved **P0** device-lost / black-preview on WebGPU path
- `scripts/scan-webgpu-presets.ts` stable full support; export compile gates green
- Optional telemetry: fallback ratio — **telemetry not wired today**
- Maintainer sign-off

**Recommendation:** prefer **keep WebGL forever** or **WebGPU-centric export with preview fallback** before any full WebGL removal.

Rollback for experiments: restore current defaults + document `?renderBackend=webgl`.

## Acceptance (observable)

- Clear written policy exists in-repo (section above).
- Full WebGL removal is **explicitly deferred**; rollback path remains **`?renderBackend=webgl`**.

### Final steps

- `_OVERVIEW.md` task **13** row updated ✅ (policy only; no code deletion).

