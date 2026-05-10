# 05 — Validation harness: compilation snapshots + golden images — webgpu-migration

## Agent instructions (START HERE)

Follow sections in order. Keep tests deterministic and fast; prefer small fixtures. Don’t require GPU availability in CI for the first iteration unless the repo already has a working GPU test setup.

## Overview

Add evidence-backed validation so the migration can ship incrementally:

- deterministic **compile snapshot** tests (WGSL + metadata),
- a **golden image** harness that can compare WebGPU vs WebGL outputs for a small graph set,
- a minimal performance baseline (frame time) for regression detection.

## Scope

### In

- Unit tests that snapshot compilation outputs (text + param layout + dependency masks).
- A runnable harness to render and diff images for a small set of fixture graphs.
- A clear parity threshold (tolerant, because GPUs differ).

### Out

- Full end-to-end UI automation.
- Large-scale preset suite (start tiny).

## Dependencies

### Requires

- Task 01 seam (to select backend)
- Task 04 MVP WGSL graphs (for meaningful WebGPU images)

## Implementation tasks

1. Add compile snapshot tests:
   - For MVP graphs, snapshot the WGSL output + `paramLayout` + `previewDependencies`.
2. Add a golden-image harness (initially local/dev):
   - Render WebGL and WebGPU at fixed resolution/time for the same graph.
   - Compare with a tolerant metric (RMS/SSIM-lite) and emit a diff image on failure.
3. Define parity thresholds:
   - Start with a pragmatic tolerance; tighten later as nodes stabilize.
4. Add a small perf smoke benchmark:
   - Measure average frame time over N frames for one simple graph per backend.
5. CI policy:
   - Compile snapshots must run in CI.
   - Golden images can be opt-in or nightly until GPU runners are reliable.

## Technical notes

- Keep fixtures in code (small graphs) or in a dedicated fixtures folder; avoid depending on user local files.
- Respect export/user-goals semantics when choosing frames (fixed time, no audio required for MVP).

## Completion

✅ Done when compile snapshots run in CI, and maintainers have a documented, repeatable way to generate/verify golden images for a small fixture set (WebGPU vs WebGL parity).

Acceptance constraints:

- Compile snapshot tests must not require WebGPU availability (pure TypeScript).
- Golden-image harness must be optional (separate script/command), not a required CI gate initially.

### Final steps

- Update `_OVERVIEW.md` status for task 05.
- Document how to run the harness in the task PR (short notes only).

### Harness runbook (task 05)

- **Compile snapshots (CI):** `npm test` includes `src/shaders/wgslMvpCompileSnapshots.test.ts` (no GPU).
- **Golden parity + perf (opt-in):** `npm run build` then `npm run test:webgpu-golden` (starts `vite preview`, opens `webgpu-golden-harness.html` under base `/ShaderNoice/`). Or with a server already running: `PREVIEW_URL=http://127.0.0.1:3000/ npx tsx scripts/webgpu-golden-parity.ts`.
- **Manual browser:** After `npm run dev`, open `/ShaderNoice/webgpu-golden-harness.html` and use `window.__webgpuGolden?.runAll()` / `runOne` / `perfSmoke` in DevTools.
- **Failure diffs:** written to `webgpu-golden-diff/` (gitignored) when RMS exceeds `DEFAULT_PARITY_RMS_MAX` in `src/validation/imageParity.ts`.

