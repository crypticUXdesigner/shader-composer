# 02 — Eligibility policy — node-power

## Agent instructions (START HERE)

Follow sections in order. This task is **a small shared module + tests**. No UI, no compiler, no data-model changes.

Non-negotiables:

- Eligibility is derived **entirely from `NodeSpec`** (no `NodeInstance` lookup, no graph state). It must be safe to call from both UI rendering and worker-side compilation.
- The decision is a pure function of `spec.category`, `spec.inputs[0].type`, and `spec.outputs[0].type`. Do **not** introduce per-node opt-in flags on `NodeSpec` in this task.

## Overview

Add a tiny shared policy module that answers two questions for any `NodeSpec`:

- `nodeSupportsPower(spec): boolean` — should the UI offer a Power button for this node?
- `nodePowerRule(spec): 'A' | 'B' | 'none'` — if powered off, which rule applies?

Both UI (task 03B) and compiler (task 03A) consume the same module so eligibility never drifts between layers.

## Scope

### In

- New module `src/shaders/nodePower.ts` (location chosen so worker-side compilation can import it without pulling Svelte / DOM modules).
- `POWER_ELIGIBLE_CATEGORIES: ReadonlySet<string>` — the allowlist documented in `_OVERVIEW.md`.
- `nodeSupportsPower(spec: NodeSpec): boolean` — `true` iff `category` is in the allowlist AND `nodePowerRule(spec) !== 'none'`.
- `nodePowerRule(spec: NodeSpec): 'A' | 'B' | 'none'`:
  - `'none'` if `outputs.length === 0` (e.g. `final-output`).
  - `'A'` if `inputs.length >= 1` AND `inputs[0].type === outputs[0].type`.
  - `'B'` otherwise.
- Unit tests covering: eligible categories with single-output, ineligible categories, `final-output` (`'none'`), generators with no inputs (`'B'`), type-changing nodes (`'B'`), same-type passthrough nodes (`'A'`), multi-input nodes where the first input matches the output type (`'A'`).

### Out

- Per-node behavior overrides (e.g. forcing `select` to be eligible). If we ever need them, that's a follow-up that adds an opt-in `bypassPolicy?: ...` field to `NodeSpec`. Not now.
- Wiring eligibility into UI or compiler — those are tasks 03A and 03B.

## Dependencies

### Provides

- The single source of truth for "can this node be powered off?" used by both UI and compiler.

### Blocks

- 03A (compiler) and 03B (UI) both import from this module.

### Prerequisites

- 01 (data model) — soft. The eligibility helper itself doesn't reference `bypassed`, so this task can technically be authored in parallel with 01. The work package gates the next tasks on both being merged.

## Implementation tasks

1. Create `src/shaders/nodePower.ts` with the API above. Keep it under ~80 lines including comments.
2. Define `POWER_ELIGIBLE_CATEGORIES` exactly as enumerated in the `_OVERVIEW.md` "Eligibility" table:
   - `'Distort'`, `'Effects'`, `'Blend'`, `'Inputs'`, `'Patterns'`, `'Shapes'`, `'SDF'`, `'Color'`
   - **Self-evaluation:** confirm these match the `category` strings actually used in `src/shaders/nodes/**/*.ts`. If you find a category string mismatch (e.g. `'Color System'` vs `'Color'`), prefer to **align the allowlist to the actual strings** rather than rename categories. Document the resolved set in a code comment.
3. Implement `nodePowerRule` with the exact precedence above. Include the "no outputs → `'none'`" guard.
4. Implement `nodeSupportsPower` as `POWER_ELIGIBLE_CATEGORIES.has(spec.category) && nodePowerRule(spec) !== 'none'`. Note that **`'none'`** also disqualifies `final-output` even though the `'Output'` category isn't in the allowlist — defense in depth.
5. Tests at `src/shaders/nodePower.test.ts`:
   - Snapshot the **set of eligible node ids** by importing `nodeSystemSpecs` from `src/shaders/nodes/index.ts` and filtering. This is your regression guard for accidental category renames.
   - Per-rule unit tests with synthetic minimal `NodeSpec` literals (don't pull real specs for these — easier to read).
   - Explicit assertions: `final-output` → `'none'`; `noise` → `'B'`; `rotate` → `'A'`; `add` → not eligible (category Math); `compare` / `select` → not eligible (category Masking/Control).

## Technical notes

- The eligible-set snapshot test is the *real* contract: if a future PR adds a node in an eligible category that surprisingly should *not* be powerable (or adds it in an excluded category that should), the snapshot will diff and force a deliberate decision.
- Do not import this module from `data-model/` — keep dependencies one-way (`shaders/` may depend on `data-model/`, never the reverse).
- This module must remain pure / synchronous / no I/O so worker contexts can call it.

## Completion

✅ Done when:

- `src/shaders/nodePower.ts` exists with the documented API and is well-covered by tests.
- The eligible-id snapshot exists and passes.
- `npm run type-check` and `npx vitest run` are clean.

### Acceptance (observable)

- Calling `nodeSupportsPower(rotateNodeSpec)` returns `true`; `nodePowerRule(rotateNodeSpec)` returns `'A'`.
- Calling `nodeSupportsPower(noiseNodeSpec)` returns `true`; `nodePowerRule(noiseNodeSpec)` returns `'B'`.
- Calling `nodeSupportsPower(addNodeSpec)` returns `false` (category `'Math'`).
- Calling `nodeSupportsPower(finalOutputNodeSpec)` returns `false` (no outputs → `'none'`).
- The eligible-id snapshot includes the categories listed in the `_OVERVIEW.md` table.

### Final steps

- Update `_OVERVIEW.md` task 02 status.
- If category-string drift was detected and the allowlist was adjusted, note it in the `_OVERVIEW.md` task 02 row so reviewers see it.
