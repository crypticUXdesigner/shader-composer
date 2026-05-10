# 10 — Compute/multi-pass heavy nodes rollout — webgpu-migration

## Agent instructions (START HERE)

This task ports “heavy” nodes to dedicated WebGPU passes using the frame graph from task 09. Keep changes incremental and reviewable.

Non‑negotiables:

- Preserve fallback: if a heavy node is unsupported in WebGPU, the graph must fall back to WebGL (or degrade gracefully if a per-node fallback mechanism exists).
- Keep UX consistent with `docs/user-goals/04-nodes-and-parameters.md` (no new controls unless required).
- Avoid changing node IDs or breaking preset compatibility.

## Overview

Some nodes are naturally multi-pass or iterative (reaction-diffusion, particles, blur/bloom). Implement them as explicit passes instead of forcing everything into a single fullscreen fragment program.

## Scope

### In

- Convert a small set of heavy nodes to pass-based implementations:
  - **reaction-diffusion**: compute + ping-pong
  - **blur/bloom**: separable blur passes + combine
  - **particle-system**: compute update + render
- Provide a clear mapping of node parameters → pass uniforms/buffers.

### Out

- Converting every node in one PR.
- Removing or rewriting existing GLSL node specs.

## Dependencies

### Requires

- Task 09 resource model + frame graph MVP.
- Task 06 ledger classifies heavy nodes and lists conversion batches.

## Implementation tasks

1. Pick one heavy node as the pilot (prefer reaction-diffusion):
   - implement compute pipeline
   - validate ping-pong correctness
2. Add golden images/perf smoke cases for the pilot.
3. Add the next heavy node in the same style (blur/bloom or particles).
4. Update the coverage ledger with the new pass-based support and any limitations.

## Acceptance (observable)

- Pilot heavy node runs on WebGPU without correctness regressions beyond tolerated diffs.
- Performance is at least “not catastrophically worse” than WebGL baseline; if slower, document why and next optimizations.
- Export still works (may still use single-pass path unless tasks 07–08 already migrated export).

### Final steps

- Update `_OVERVIEW.md` status for task 10.

