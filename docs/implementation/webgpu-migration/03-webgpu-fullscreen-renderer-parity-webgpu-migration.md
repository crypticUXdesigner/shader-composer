# 03 — WebGPU fullscreen renderer (parity path) — webgpu-migration

## Agent instructions (START HERE)

Follow sections in order. Keep the editor functional: behind feature flags, with safe fallback to WebGL. Do not change user-facing export behavior in this task.

Guardrails:

- No export code changes.
- No multi-pass/frame-graph work.
- If WebGPU fails at runtime (device lost, init fail), fall back to WebGL and surface a dismissible error.

## Overview

Implement the Phase A parity renderer for WebGPU: a single fullscreen render pipeline that evaluates a compiled WGSL fragment-stage equivalent to today’s GLSL fullscreen shader.

## Scope

### In

- A WebGPU render backend that can:
  - accept a compiled WGSL “program”
  - bind global + parameter buffers
  - draw a fullscreen primitive each frame
- Time/timeline/audio parameter updates mapped into WebGPU buffers.
- Minimal pipeline caching so recompiles don’t stutter excessively.

### Out

- Multi-pass / compute / resource pooling (Phase 4+).
- Full node coverage (task 04).
- Export integration (Phase 3).

## Dependencies

### Requires

- Task 01 backend seam + selection
- Task 02A WebGPU context lifecycle
- Task 02B compile backend result + param layout

### Provides

- WebGPU preview can render at least a trivial shader.

### Blocks

- Task 04 WGSL MVP subset
- Task 05 golden images for parity

## Implementation tasks

1. Create a `WebGpuRenderBackend` that implements the shared render backend interface.
2. Define buffer layout:
   - globals uniform buffer (time, timelineTime, resolution, flags)
   - params buffer (`array<vec4<f32>>`) populated from `paramLayout`
3. Implement “set program”:
   - create `GPUShaderModule` from WGSL
   - create `GPURenderPipeline` targeting the canvas format
   - create a bind group that wires globals + params (+ placeholders for future resources)
4. Implement render:
   - update buffers for time/timelineTime and any changed params
   - begin render pass, draw fullscreen triangle/quad
5. Implement resize:
   - reconfigure canvas context if required, ensure viewport matches backing store
6. Add minimal perf marks (similar to existing preview marks) so we can compare to WebGL.

## Technical notes

- Prefer a fullscreen triangle (no vertex buffer) unless project standards require quad reuse.
- Parameter uploads should be batched; avoid per-parameter bind group re-creation.

## Completion

✅ Done when WebGPU can render a simple compiled shader in the preview canvas under a flag, with stable resize behavior and without breaking the existing WebGL preview path.

Minimum manual verification:

- Start app, force `renderBackend=webgpu` (whatever dev surface exists), confirm no crash (even if shader support is limited).
- Switch back to WebGL and verify preview still renders and feels unchanged.

### Final steps

- Update `_OVERVIEW.md` status for task 03.
- Run build/check and add a minimal manual verification note in the PR description when implemented.

