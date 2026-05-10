# 02B — Compiler backend result + param layout contract — webgpu-migration

## Agent instructions (START HERE)

Follow sections in order. Maintain the existing worker boundary: **graph → codegen can run in worker**, GPU object creation stays main-thread. Do not mutate the graph; results must be structured-cloneable when crossing the worker boundary.

Guardrails:

- Do not “half migrate” the runtime: keep the existing WebGL `CompilationResult` path working until WebGPU render backend consumes the new result.
- Keep the worker payload/result **structured-cloneable** (no Maps/Sets/functions).
- No node-spec rewrites here; focus on contract + plumbing.

### Expected touch points (guidance)

- Worker protocol types live in `src/runtime/compilation/workerMessages.ts` and the worker entry.
- Runtime plumbing belongs in `src/runtime/CompilationManager.ts` (contract only; do not refactor scheduling).
- Prefer to keep shader/compiler changes to the minimum needed to emit the new result shape.

## Overview

Extend the compilation output contract so it can drive both WebGL and WebGPU without duplicating graph analysis. This introduces:

- a backend-tagged compilation result (`glsl` vs `wgsl` initially),
- a stable **parameter layout** (index mapping) suitable for WebGPU buffer packing,
- a “coverage” / support signal so we can fall back per-graph during incremental WGSL adoption.

## Scope

### In

- New compile output types and metadata.
- Worker message schema changes (cloneable).
- Preview dependency mask remains supported (feeds `TimeManager` optimizations).

### Out

- Full WGSL node coverage (task 04).
- Multi-pass/compute IR (Phase 4+).

## Dependencies

### Requires

- Task 01 seam (so runtime can choose a backend).

### Provides

- A single compile API that can produce a “program description” for either backend.

### Blocks

- Task 03 WebGPU fullscreen renderer
- Task 04 WGSL MVP subset + fallback-by-coverage

## Implementation tasks

1. Define a new compilation output shape (suggested):
   - `backend: 'webgl' | 'webgpu'`
   - `supported: boolean` and `unsupportedReasons?: string[]` (cloneable)
   - `code: string` (GLSL or WGSL)
   - `paramLayout`: deterministic mapping `{ key: string -> index: number }` for scalar/vec4 params stored as `array<vec4<f32>>`
   - `resources`: (optional for now) a declared set of textures/samplers required by the shader
   - keep `previewDependencies`, `executionOrder`, warnings/errors
2. Update the worker protocol (`src/runtime/compilation/workerMessages.ts` and `compilationWorker.ts`) to return the new result shape.
3. Update `CompilationManager.applyCompilationResult` to accept the new shape and route it to the selected backend:
   - WebGL path: use GLSL `code` and current `ShaderInstance`.
   - WebGPU path: store the result so the WebGPU renderer can build its pipeline (task 03 will consume it).
4. Add compile snapshot tests for the new metadata:
   - Ensure `paramLayout` stable for the same graph.
5. Add “coverage” flag:
   - If the compiler can’t produce WGSL for a graph, it must say so explicitly, not by throwing.

## Technical notes

- Reuse existing `NodeShaderCompiler` stages for execution order/type checking; avoid duplicating that logic.
- Parameter layout should treat **scalar** params as `.x` of a vec4 slot to keep alignment simple in WGSL.

## Completion

✅ Done when compilation produces a backend-tagged result with a deterministic parameter layout, can be returned from a worker, and the runtime can safely decide “use WebGPU program vs fall back to WebGL” based on the result’s support/coverage signal.

Additional acceptance:

- Existing WebGL preview still passes current shader compilation tests (no regressions).
- Worker compile still works and stale messages are ignored as before.

### Final steps

- Update `_OVERVIEW.md` status for task 02B.
- Run build/check and relevant unit tests.

