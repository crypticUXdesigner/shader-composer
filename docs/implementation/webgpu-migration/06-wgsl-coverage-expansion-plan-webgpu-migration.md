# 06 — WGSL coverage expansion plan + tracking — webgpu-migration

## Agent instructions (START HERE)

**Status:** Done (2026-05-07). Deliverables live in `wgsl-coverage-ledger.md` and are regenerated with `npx tsx scripts/generate-wgsl-coverage-ledger-table.ts --write-doc` after node/MVP changes.

You are extending the migration **after the prototype foundation (01–05)**. This task is about **planning + tracking + rules**, not converting dozens of nodes in one PR.

Non‑negotiables:

- Keep the editor functional: unsupported graphs must continue to render via WebGL fallback.
- Do not change the graph/data-model schema.
- Do not alter export behavior in this task.

## Overview

Create a concrete, maintainable strategy for scaling WGSL support from MVP subset to all nodes, without letting the project drift into “two backends, two sets of bugs”.

Deliverables are:

- a **coverage ledger** (which nodes are WGSL-supported, which aren’t, and why),
- conversion guidelines (Do/Don’t) that keep parity and performance predictable,
- a small set of “next conversion batches” sized for one-session tasks.

## Scope

### In

- A single source of truth coverage doc under this package (see Implementation tasks).
- Categorization of nodes into “inline shader”, “render pass”, “compute pass”, and “needs research”.
- A template for subsequent node-conversion tasks (06A/06B/… created later).

### Out

- Converting more than a handful of nodes.
- Implementing frame graph / compute infrastructure (tasks 09–10).
- Export integration work (tasks 07–08).

## Dependencies

### Requires

- Tasks 01–05 complete (WebGPU preview path exists and at least one graph renders on WebGPU).

### Provides

- A “roadmap that compiles”: clear batches, acceptance criteria, and fallback rules that other agents can execute without guessing.

## Implementation tasks

1. Add a coverage ledger doc:
   - Maintain `docs/implementation/webgpu-migration/wgsl-coverage-ledger.md` (full node table + guidelines + batches).
   - Regenerate the **Node coverage** table from `nodeSystemSpecs` via `scripts/generate-wgsl-coverage-ledger-table.ts` so the list cannot drift from `src/shaders/nodes/index.ts`.
   - Per row: WGSL status `supported | unsupported | planned`, class `inline | render-pass | compute-pass | research`, notes (MVP sync, blockers).
2. Define conversion guidelines:
   - “Inline nodes” should compile to WGSL expressions/functions without requiring new passes.
   - “Heavy nodes” should be explicitly tagged as future pass/compute candidates; do not hack them into inline WGSL if it’s unstable.
3. Define fallback rules:
   - What counts as “unsupported graph” and how that is surfaced (reasons must be explicit).
4. Propose the next 3–5 conversion batches (names + node lists), each sized for a single task session.

## Acceptance (observable)

- A new contributor can open the ledger and answer:
  - “Why does this graph fall back?”
  - “What should we convert next?”
  - “Which nodes require compute/multi-pass later?”
- No runtime behavior changes in preview/export from this task alone.

### Final steps

- Update `_OVERVIEW.md` status for task 06 (done).

