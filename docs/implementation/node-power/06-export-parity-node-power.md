# 06 — Export parity — node-power

## Agent instructions (START HERE)

Follow sections in order. This task is **verification + a small test gate**, not a feature. The export pipelines already use the same compiler that 03A modified; the goal here is to *prove* it and to *lock that proof in CI* so a future export refactor can't silently lose Power semantics.

Non-negotiables:

- No new export pipeline. Use the existing `src/image-export/` and `src/video-export/` orchestrators as-is.
- No new GPU goldens. The compile gate tests are the right tool here — they assert correctness without needing a GPU in CI.

## Overview

Confirm that toggling Power on a node produces the same compiled output for **still image export** and **video export** as it does for the preview, and add a focused compile gate so that property is regression-protected.

## Scope

### In

- A test (or a small extension to an existing test) that:
  - Compiles a tiny graph for the **still image export path** with one Rule A node bypassed and one Rule B node bypassed; asserts the compiled output (uniforms layout / execution order / emitted code substring) matches the preview compile for the same graph.
  - Same for the **video export path**.
- A test fixture preset (inline in the test, no JSON file added) covering both rule cases.
- A short note in `docs/implementation/node-power/_OVERVIEW.md` confirming export parity is now CI-gated.

### Out

- Adding visual goldens (image diff) for bypassed graphs. The compile gate is sufficient to detect divergence between preview and export compilation paths.
- Validating that bypassed nodes save bandwidth or improve export performance — that's a separate concern. Bypass is a correctness feature here.
- Modifying export UI / progress reporting.

## Dependencies

### Provides

- A regression guard preventing future export-path refactors from silently losing Power semantics.

### Blocks

- Nothing — this is a verification task, runnable in parallel with task 05.

### Prerequisites

- 03A (compile actually honors `bypassed`).
- 01 (`bypassed` field exists in the serialized graph).

## Implementation tasks

1. **Survey existing export compile gates.** Read `src/image-export/webGpuFullscreenExportCompilationGate.test.ts` and `src/image-export/passPlanWebGpuExportCompilationGateAssertions.ts` (and the matching `src/video-export/*` if it exists). They test that the compile output the export orchestrator depends on matches what the renderer expects. Mirror their style.
2. **Pick a tiny graph fixture.** Two nodes is enough per rule. Suggested:
   - Rule A: `uv-coordinates → rotate(bypassed) → noise → color-map → final-output`. Snapshot or substring-assert that `rotate`'s effect is gone and the upstream UV reaches noise unchanged.
   - Rule B: `orbit-camera(bypassed) → generic-raymarcher → final-output` (or simpler: `noise(bypassed) → color-map → final-output`). Assert the consumer falls back to its built-in defaults.
3. **Compile via the same path the export orchestrator uses.** That's the existing `compile()` entry point; the gate tests already follow this pattern. Do not call `MainCodeGenerator` directly.
4. **Assert parity.** Compile the same graph twice — once "as preview" and once "as export" using whatever options the export orchestrator passes (`CompileTargetOptions`); the resulting compiled string + uniforms + paramLayout must be byte-identical with respect to the bypass behavior. **Self-evaluation:** the existing gate tests likely already prove that preview and export use the same compile invocation; if so, your test can simply assert "compile(graph_with_bypass).mainCode does not contain `rotate`'s identifier" and "compile(graph_with_bypass).executionOrder does not include the bypassed node id" — that's enough.
5. **Run preset scan if convenient.** `npx tsx scripts/scan-webgpu-presets.ts` should still report 25/25 supported (the existing presets don't use `bypassed: true`, so this is unchanged); if it diverges, that's a real bug in 03A and should be fixed there.

## Technical notes

- The image and video export orchestrators currently call the same `compile()` function as preview, just with potentially different `CompileTargetOptions` (backend selection, etc.). The Power behavior is below that seam, so parity is structurally guaranteed — the test exists to keep it that way.
- Audio uniforms and automation lanes connected to bypassed nodes' parameters: still produced and still uploaded (the bypassed node simply doesn't read them). The existing audio export gate tests (`webGpuPassPlanAudioBokehCrepuscularExportCompilationGate`, `webGpuPassPlanAudioBlurGlowBloomExportCompilationGate`) will tell you immediately if you broke audio uniform layouts; re-run them.
- If you find yourself touching export code, **stop** — the test should be observation-only against existing entry points.

## Completion

✅ Done when:

- The new compile-parity test(s) pass for both Rule A and Rule B fixtures, on both still and video export paths.
- All existing export compile gates remain green.
- `npx vitest run`, `npm run type-check`, and (if convenient) `npx tsx scripts/scan-webgpu-presets.ts` are clean.

### Acceptance (observable)

- The added test(s) fail if a future change makes export's compile output diverge from preview's for a bypassed-node graph.
- No production code in `src/image-export/` or `src/video-export/` modified by this task.

### Final steps

- Update `_OVERVIEW.md` task 06 status.
- Note in the PR description which existing gate test(s) you mirrored — reviewers will use that to evaluate style consistency.
