# 09 — WebGPU resource model + frame graph MVP — webgpu-migration

## Agent instructions (START HERE)

This task introduces the minimal infrastructure required for **multi-pass and compute** without rewriting the whole renderer.

Non‑negotiables:

- Keep a single-pass compatibility mode working (Phase A renderer must still run).
- Do not change graph/data-model schema.
- Keep fallback to WebGL intact.

## Overview

Add a WebGPU resource model and a small “frame graph” representation so heavy nodes can be implemented as dedicated passes later.

## Scope

### In

- A resource allocator/pool for textures and buffers (keyed by descriptor).
- A pass graph representation (render pass / compute pass / copy).
- Support for **history textures** and **ping‑pong** pairs.
- Resize handling rules (when preview/export size changes).

### Out

- Porting many nodes (task 10).
- Large scheduling/quality system changes (keep it minimal).

## Dependencies

### Requires

- WebGPU renderer exists (task 03) and is stable.

### Provides

- A foundation for compute and multi-pass nodes (reaction-diffusion, blur/bloom, particles).

## Implementation tasks

1. Define resource descriptors:
   - texture format, size, usage, sample count
   - buffer size/usage
2. Implement `ResourcePool`:
   - acquire/release per-frame
   - reuse compatible resources
   - handle resize invalidation
3. Implement a minimal `FrameGraph` API:
   - declare passes with inputs/outputs
   - topologically order passes
   - execute passes into a command encoder
4. Add ping‑pong support:
   - “history” resources that survive across frames
   - explicit swap per frame

## Acceptance (observable)

- A trivial 2-pass graph can run (even if used only by a synthetic test pass initially).
- No memory leaks across many frames (basic instrumentation/logging ok).
- Single-pass renderer remains functional and remains the default path for nodes that don’t require passes.

### Final steps

- Update `_OVERVIEW.md` status for task 09.

