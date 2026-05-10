# 04 — WGSL MVP subset + fallback-by-coverage — webgpu-migration

## Agent instructions (START HERE)

Follow sections in order. Keep WebGPU behind a feature flag until coverage is broad enough. Ensure graphs that are not supported still render correctly via WebGL without user intervention.

Guardrails:

- Do not attempt GLSL→WGSL transpilation.
- Keep node changes minimal: MVP subset only; everything else must report unsupported and trigger fallback.
- Preserve parameter semantics (override/add/multiply etc.) as currently defined by the compiler; don’t change the data-model.

## Overview

Deliver the first “real” WebGPU graphs by adding WGSL compilation for a minimal, representative node subset and a robust per-graph fallback mechanism.

## Scope

### In

- WGSL compilation for a minimal node subset (start small, prove end-to-end).
- A coverage report: “this graph is WGSL-supported” vs “fallback to WebGL”.
- Integration with `CompilationManager` so the fallback decision is deterministic and debuggable.

### Out

- Full node coverage (Phase 2).
- Multi-pass/compute (Phase 4+).

## Dependencies

### Requires

- Task 02B compiler backend result + coverage signal
- Task 03 WebGPU renderer parity path

### Provides

- WebGPU preview works for a known subset of nodes.

### Blocks

- Task 05 golden images and parity thresholds

## Implementation tasks

1. Choose an MVP node subset (example target list):
   - `constant-float`, `constant-vec2/3/4`
   - `uv-coordinates`, `time`, `resolution`
   - a small set of math ops (`add`, `multiply`, `mix`, `clamp`)
   - `final-output`
2. Implement WGSL codegen for those nodes:
   - Either add WGSL fields to node specs, or add an adapter layer that can emit WGSL for the subset.
3. Implement “unsupported graph” reporting:
   - compiler returns `{ supported: false, reasons: [...] }` (cloneable) instead of throwing.
4. Wire fallback:
   - If WebGPU is selected but the result is unsupported, automatically compile/render via WebGL for that graph.
5. Add one or two presets/graphs as fixtures for deterministic testing (no UI).

## Technical notes

- Keep parameter semantics consistent with `docs/architecture/parameters-pipeline.md`:
  - scalar + vec4 can be uniform-only updates; everything else triggers recompile.
- Don’t attempt to “transpile” GLSL to WGSL in-browser; start with explicit WGSL emission for the MVP subset.

## Completion

✅ Done when at least one representative graph renders via WebGPU under a flag, and unsupported graphs cleanly fall back to WebGL with a clear debug reason.

Acceptance details:

- “Fallback-by-coverage” must be deterministic (same graph → same decision).
- Fallback must not spam recompile loops; one stable backend per active graph snapshot.

### Final steps

- Update `_OVERVIEW.md` status for task 04.
- Run unit tests + build/check.

