# 05 — Documentation — node-power

## Agent instructions (START HERE)

Follow sections in order. This task is **doc-only**; no production code. Read `.cursor/rules/frontend/help-discovery.mdc` and `.cursor/rules/shaders/node-standards.mdc` before editing `node-documentation.json`.

Non-negotiables:

- The user-goals doc owns user-facing behavior. The architecture doc owns implementation-facing invariants. Don't mix them.
- Don't bloat `node-documentation.json` per-node entries with bypass narratives — bypass is a **graph-level affordance**, not per-node behavior.
- No new docs unless one of the existing docs cannot reasonably absorb the content.

## Overview

Document the Power affordance:

- For users, in `docs/user-goals/04-nodes-and-parameters.md`.
- For implementers, in `docs/architecture/preview-and-recompilation.md` (structural recompile on toggle) and `docs/architecture/graph-and-platform-boundaries.md` (Power is a serialized node setting on `NodeInstance`).
- For node-help help text, **only if** the project decides Power deserves a Help Overview entry — otherwise skip.

## Scope

### In

- **`docs/user-goals/04-nodes-and-parameters.md`** — add a short subsection (or extend an existing User Goal bullet) describing:
  - What Power does (one-click A/B for the node's effect).
  - Which nodes have it (categories, in plain language — "transforms, effects, generators, patterns, shapes/SDFs, blend, color"; not the allowlist string).
  - The two behaviors in user terms: "passes input through unchanged" vs "behaves as if not connected — downstream uses its own defaults".
  - That the state is saved with the preset and restored after reload.
  - That Power isn't on Math/Utility/Output nodes, so users don't look for it there.
- **`docs/architecture/preview-and-recompilation.md`** — one paragraph noting:
  - Toggling `NodeInstance.bypassed` is a structural change → triggers full recompile (same path as adding/removing a wire).
  - Bypassed nodes do not appear in the compiled execution order.
- **`docs/architecture/graph-and-platform-boundaries.md`** — one sentence noting `bypassed?: boolean` is part of `NodeInstance` and is honored by the compiler, not the runtime.
- Optional: add a "Power" entry to `src/data/node-documentation.json` only if the project's existing Help model has a "graph affordance" / "feature" entry kind. **Self-evaluation:** if the JSON only documents nodes (`"node:*"`) today, do **not** invent a new entry kind here — leave help discoverability to the user-goals doc and add a TODO in the PR description that a future "feature help" pass could surface this in the help overlay.

### Out

- Per-node copy edits in `node-documentation.json` (e.g. "this node can be powered off"). Bypass is global; per-node strings would just create maintenance burden.
- Updating preset JSONs.
- Updating screenshots in unrelated docs.

## Dependencies

### Provides

- The single user-facing description of the Power affordance.

### Blocks

- Nothing — this is the closing-out task before review.

### Prerequisites

- 03A (compile behavior locked in)
- 03B + 04 (UI affordance + visual state shipped, so docs can describe the actual UX)

## Implementation tasks

1. **User-goals.** Open `docs/user-goals/04-nodes-and-parameters.md`. Add to "User Goals" or as a new short section (your call) a bullet titled e.g. **"Power off a node to A/B its effect"**. Keep it ≤4 sentences. Link to nothing new — let the existing structure work.
2. **Architecture — preview-and-recompilation.** Open `docs/architecture/preview-and-recompilation.md`. Find the section that describes structural-vs-parameter change classification and add Power there. One paragraph at most.
3. **Architecture — graph-and-platform-boundaries.** Open `docs/architecture/graph-and-platform-boundaries.md`. Find the `NodeInstance` description (or the closest existing description of node fields). Add `bypassed?: boolean` to the field list with a one-sentence note pointing readers at `_OVERVIEW.md` for behavior.
4. **Help (optional).** Decide based on the existing JSON shape (see Self-evaluation in Scope). If skipping, leave a one-line PR-description note explaining why.
5. **Cross-check.** Search the repo for any other doc that lists `NodeInstance` fields or describes structural-vs-parameter changes (e.g. `docs/implementation/README.md`, `docs/architecture/README.md`); patch only when the omission would mislead.

## Technical notes

- The user-goals area uses a specific voice (clear, supportive, brief) — match it; don't lapse into spec-language. (`design-system.mdc` — "short, supportive, non-judgmental".)
- `node-documentation.json` is consumed by the in-app help system; any structural change to entry shape is a separate refactor. **Don't** quietly add a new entry kind here.

## Completion

✅ Done when:

- A user reading `docs/user-goals/04-nodes-and-parameters.md` cold can understand what Power does, where it appears, and what it does for both rule cases.
- A new contributor reading the architecture docs can find that `bypassed` is a serialized `NodeInstance` field and that toggling it triggers structural recompile.
- No regressions in unrelated docs; no new orphaned files.

### Acceptance (observable)

- The diff is **strictly markdown + (optionally) JSON**. No `.ts`/`.svelte`/`.css` files modified.
- Each touched doc has a clear, scoped change directly related to Power; no drive-by edits.

### Final steps

- Update `_OVERVIEW.md` task 05 status.
- Run `npm run build` (it will pass — no code changed) and the doc lint / link check the project uses, if any.
