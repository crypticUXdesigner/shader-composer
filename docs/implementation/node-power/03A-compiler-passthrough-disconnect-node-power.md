# 03A — Compiler: passthrough + disconnect — node-power

## Agent instructions (START HERE)

Follow sections in order. This is the **central correctness task** of the package. The graph remains immutable; all behavior happens in the compile pipeline at `src/shaders/NodeShaderCompiler.ts` and its `compilation/` modules.

Non-negotiables:

- **Read the architecture docs first**: `docs/architecture/preview-and-recompilation.md`, `docs/architecture/compilation-worker.md`, `docs/architecture/graph-and-platform-boundaries.md`.
- The compiler **must not mutate the input `NodeGraph`**. Any "compile-graph view" you build is a derived structure used internally; do not write it back. (`.cursor/rules/runtime/compilation.mdc`.)
- **Both backends** must observe Power: GLSL/WebGL (`MainCodeGenerator`) and the WGSL MVP path (`compilation/WgslMvpCompiler.ts`). If the WGSL path doesn't yet support a given graph, that's fine — it already falls back to WebGL via the existing `metadata.errors` path; bypass behavior only needs to be correct for whichever path actually compiles.
- Toggling `bypassed` is a **structural change** and should trigger full recompile (it already will via the change-detection path; do not add a uniform-only fast path here).

## Overview

Make the compiler honor `NodeInstance.bypassed` according to the two global rules from `_OVERVIEW.md`:

- **Rule A (passthrough):** rewrite the node's emitted main code to `out = promote(in)` using the existing `generatePromotionCode` helper.
- **Rule B (disconnect):** drop the bypassed node's outgoing connections from the compile-graph view so consumers fall back to their existing `fallbackParameter` / `fallbackExpression` / port defaults. Drop the bypassed node from `executionOrder` so it emits no code.

Use `nodePowerRule(spec)` from task 02 to decide.

## Scope

### In

- A "compile-graph view" computed once per compile that:
  - Removes any connection whose **source** node is bypassed AND its rule is `'B'`.
  - Removes any connection whose **source** node is bypassed AND its rule is `'A'` *only if* its `sourcePort` isn't the rewritten primary output (in practice this case shouldn't arise — secondary outputs aren't part of the eligible set today; just guard against it).
  - Drops bypassed nodes from `executionOrder` (after topo sort) so no main-code is emitted.
- For each Rule-A bypassed node that *would* still appear (only relevant if it has fan-out from its primary output), emit `out = promote(in, sourceType=inputs[0].type, targetType=outputs[0].type)` instead of running its `mainCode`. **Self-evaluation:** if you choose to drop Rule-A bypassed nodes from execution order entirely and instead **rewrite their consumers' source references** to point at the upstream node, that is also acceptable and may be cleaner — pick whichever fits the existing seam better. Document the choice in the PR description.
- Both Rule A and Rule B implementations must reuse existing helpers:
  - `generatePromotionCode` from `src/shaders/compilation/MainCodeGeneratorNodeCode.ts` for type fixups.
  - The existing input fallback resolution path (`getInputFallbackValue`, `fallbackExpression` substitution, port defaults) — that's the entire point of Rule B.
- Tests:
  - Unit tests on a small synthetic graph for both rules. At minimum: Rule A on a `vec2 in → vec2 out` chain (`uv → rotate(bypassed) → noise → color-map → final-output`); Rule B on a generator (`orbit-camera(bypassed) → generic-raymarcher.ro` falls back to the raymarcher's `cameraRoX,cameraRoY,cameraRoZ` parameters); Rule B on a pattern (`uv → noise(bypassed) → color-map → final-output` should compile and the color-map should see its fallback for `in`).
  - Snapshot test extension: add at least one bypassed-node case to `src/shaders/__snapshots__/wgslMvpCompileSnapshots.test.ts.snap` (or the GLSL equivalent) for both Rule A and Rule B. Choose nodes already in the WGSL MVP support list to avoid mixing concerns.
  - Regression: re-run all existing compile snapshots — they must be byte-identical when no node is bypassed.
  - Execution-order test: bypassed nodes are absent from the compiled execution order.
- An invariant test: a graph that becomes a **trivial passthrough** because every effect node is bypassed must still compile and produce a valid program (e.g. `uv → rotate(bypassed) → noise(bypassed) → color-map(bypassed) → final-output` — final-output's input falls back to its own default `vec3` color).

### Out

- UI for toggling (task 03B).
- Visual feedback (task 04).
- Documentation updates (task 05).
- Export-pipeline tests (task 06).
- Per-node opt-in eligibility — eligibility comes from `nodeSupportsPower` only.
- Animating bypass via timeline.
- Optimizing the WebGPU pass plan path. If a graph has a bypassed node that's only handled inside a pass plan (e.g. `blur` bypassed on the WebGPU blur pass plan path), the simplest correct behavior is to fall back to WebGL for that graph via the existing unsupported-coverage path. Add a TODO comment, no new infrastructure.

## Dependencies

### Provides

- End-to-end correct compile output when nodes are bypassed.

### Blocks

- 04 (visual state) — needs compile to actually do something so manual QA is meaningful.
- 05 (documentation) — needs the behavior nailed down.
- 06 (export parity) — verifies this through the export path.

### Prerequisites

- 01 (`bypassed` field exists)
- 02 (`nodePowerRule` decision available)

## Implementation tasks

1. **Wire eligibility-aware compile-graph view.** In `NodeShaderCompiler.compile` (and `compileIncremental` if reachable), before calling `topologicalSort` / `computeEffectiveNodeSpecs`, build a derived `{ nodes, connections }` view:
   - `bypassedB = new Set(graph.nodes.filter(n => n.bypassed && nodePowerRule(spec(n)) === 'B').map(n => n.id))`
   - `bypassedA = new Set(graph.nodes.filter(n => n.bypassed && nodePowerRule(spec(n)) === 'A').map(n => n.id))`
   - `compileConnections = graph.connections.filter(c => !bypassedB.has(c.sourceNodeId))` — Rule B drops outgoing wires.
   - For Rule A: choose **one** of:
     - **(a)** Rewrite each consumer wire `c` with `c.sourceNodeId` in `bypassedA` to the bypassed node's primary upstream (the connection whose `targetNodeId === c.sourceNodeId` and `targetPort === inputs[0].name`). If no such upstream exists (primary input unconnected), drop the wire (Rule A degenerates to Rule B).
     - **(b)** Keep the wire and rewrite the bypassed node's `mainCode` to `out = promote(in, ...)`; leave the node in execution order.
   - Both are correct. **(a)** is preferred because it removes work from the GPU.
2. **Drop bypassed nodes from execution order.** After topo sort, filter out `bypassedA ∪ bypassedB`. The pipeline already tolerates fewer nodes than the graph contains (virtual audio nodes aren't in `graph.nodes`), so this should be a one-line change in the slice that materializes execution order.
3. **Plumb the compile-graph view** through `MainCodeGenerator.generateMainCode` and `UniformGenerator.generate*` so they iterate the filtered execution order and resolve connections via `compileConnections` instead of `graph.connections`. **Keep the original `graph` argument intact** so other consumers (parameter resolution, automation, audio uniforms) that intentionally read the full graph keep working — only swap the connection list where it's used to find sources for input ports.
4. **WGSL MVP path.** Apply the same compile-graph view inside `compileWgslMvp`. If the path doesn't currently know about Power, add it minimally — same drop-from-execution-order, same connection filter. Re-run `wgslMvpCompileSnapshots.test.ts` to confirm no diff for non-bypassed graphs.
5. **Tests** (mix of new and extended):
   - New `src/shaders/nodePower.compile.test.ts` (or co-locate in existing `NodeShaderCompiler.test.ts`) with the scenarios listed under "In".
   - Extend `src/shaders/__snapshots__/wgslMvpCompileSnapshots.test.ts.snap` with one Rule A and one Rule B fixture.
   - Confirm `npx vitest run` passes and pre-existing snapshots are unchanged.

## Technical notes

- **Why filter rather than mutate:** the graph is the SSOT; the compiler is read-only against it. The compile-graph view is a transient internal structure scoped to a single `compile()` call.
- **Rule B + parameter wires.** A bypassed Rule B node's outputs may also drive `targetParameter` connections (e.g. a bypassed `noise` driving `color-map`'s threshold). Filtering by `sourceNodeId` correctly drops those too — the consumer falls back to its parameter's default value (or its own `inputMode`-respecting parameter pipeline).
- **Fallback semantics already exist.** The "as if unconnected" behavior comes for free from `generateNodeCode` in `MainCodeGeneratorNodeCode.ts`: when an input has no matching entry in `inputVars`, it walks `fallbackExpression`, then `fallbackParameter`, then port-type defaults. Don't reimplement; just stop populating `inputVars` for the bypassed-source case (which the connection-filter above already does).
- **Promotion edge cases for Rule A.** Rule A's eligibility test (`inputs[0].type === outputs[0].type`) means promotion is identity in 100% of current eligible nodes. The `generatePromotionCode` call in approach (b) is therefore defensive only. Approach (a) doesn't even need it, since the upstream type is what flows downstream.
- **Multiple wires on the same input port** are already disallowed by validation (`one connection per port`), so Rule A's "primary upstream" lookup is unambiguous.
- **Multi-output nodes** (e.g. `generic-raymarcher` with `out` + `color`): these are all Rule B today (type-changing), so they cleanly fall under "drop all outgoing". If a future Rule A eligible node grows a second output, this code path won't bridge that second output — that's correct, because the convention "first input → first output" is the contract. Add a code comment noting this.

## Completion

✅ Done when:

- `nodePowerRule` from task 02 is the only decision source for what bypass means.
- The compile-graph view drops Rule B outgoing wires and bridges (or rewrites) Rule A wires.
- Bypassed nodes do not appear in the compiled execution order or in the compiled GLSL/WGSL.
- All pre-existing compile snapshot tests are byte-identical with no node bypassed.
- New snapshots / unit tests cover at least one Rule A and one Rule B node end-to-end on both backends that compile them.
- `npm run build`, `npx vitest run`, and `npm run type-check` are clean.

### Acceptance (observable)

- A graph `uv → rotate(bypassed) → noise → color-map → final-output` compiles to GLSL where the rotated UV is replaced by the upstream UV (verifiable in the snapshot).
- A graph `orbit-camera(bypassed) → generic-raymarcher.ro` compiles such that the raymarcher uses its own `cameraRoX,cameraRoY,cameraRoZ` parameters as the ray origin (verifiable by inspecting emitted GLSL for the raymarcher's `ro` resolution path).
- Toggling `bypassed` from `false → true → false` produces the same compiled output as not toggling at all (idempotency).
- An all-bypassed graph still compiles and produces a non-erroring (likely default-color) shader.

### Final steps

- Update `_OVERVIEW.md` task 03A status with date and a one-line note on which approach (a) or (b) you picked for Rule A.
- Run the validation batch: `npx vitest run`, `npm run type-check`, and (if convenient) `npx tsx scripts/scan-webgpu-presets.ts` to confirm the existing 25/25 preset support is unchanged.
- Confirm no `Renderer.ts`, `RuntimeManager.ts`, or DOM/Svelte file was edited — this task is pure compiler.
