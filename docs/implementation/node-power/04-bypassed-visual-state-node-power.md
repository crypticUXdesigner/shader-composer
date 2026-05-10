# 04 — UI: bypassed visual state — node-power

## Agent instructions (START HERE)

Follow sections in order. Svelte 5 + CSS-tokens-only. This task is **visual feedback** for the Power state introduced by 03B; no behavior changes.

Non-negotiables:

- Tokens only. Use existing `--opacity-disabled` / opacity tokens; no new tokens unless ≥2 uses or strong semantic argument (`.cursor/rules/frontend/css-standards.mdc`).
- Honor `prefers-reduced-motion` for any transition (`design-system.mdc`).
- Do not change selection, hover, or connection-edit behavior of bypassed nodes — they remain fully interactive (you must still be able to select, drag, edit parameters of, and connect/disconnect a bypassed node; you toggling its Power back on must continue to work).
- Stay calm visually. The state should be **unmistakable but quiet** — this is a tool used while focused on the preview, not a notification system.

## Overview

Make it visually clear when a node is bypassed and that its outgoing wires no longer affect downstream nodes. This task ships **minimum viable visual feedback** so the feature is shippable; richer signal-path visualization can come in a follow-up if needed.

## Scope

### In

Pick **one** of the visualization slices below as v1; the other is OUT-of-scope for this task. Decide based on what fits the existing canvas/wire system with the least new infrastructure. Whichever you choose, the **node body dim** below is mandatory.

**Mandatory: bypassed node body dim.**

- Apply `--opacity-disabled` (or equivalent token) to the node body when `node.bypassed === true`. The Power button itself stays at full opacity so users can find it to toggle back on.
- The node remains pointer-interactive at the same opacity boundary used by other "muted but interactive" UI in the project (look at how disabled-input modes or muted UI is styled today and match).
- Smooth transition only if `prefers-reduced-motion` is unset. Duration short (~120–180ms).

**Slice (a) — Wire dimming.** Outgoing wires from a bypassed node render dimmed (same `--opacity-disabled` family). Optionally use a different stroke pattern (dashed) to signal "no signal flowing", but only if the existing wire renderer makes that a one-line change. **Self-evaluation:** if the wire renderer is one centralized component, this slice is trivial; if it's smeared across many places, prefer slice (b).

**Slice (b) — Wire suppression with origin marker.** Outgoing wires from a bypassed node are not drawn at all; instead a small "muted" marker decorates the source port to indicate "wires from here are inactive". This requires touching the wire-render filter; verify the canvas can hide a wire without breaking layout / interaction (you must still be able to delete the connection from the data model — it still exists).

### Out

- Animated "ghost wire" rerouting around bypassed Rule A nodes (showing upstream→downstream flow visually). This is a future enhancement once we know users want it.
- Power state in the bottom bar / inspector panel (the per-node button is enough).
- Bypassed nodes stamped with a "bypassed" badge or banner. The dim + Power icon state is sufficient.
- Multi-select bulk visual treatment.

## Dependencies

### Provides

- Clear at-a-glance reading of which nodes are powered off in the current graph.

### Blocks

- 05 (docs) — easier to capture screenshots once visuals are landed.

### Prerequisites

- 03B (Power button exists; users can produce the bypassed state to QA against).
- 03A (compile actually responds to the toggle).

## Implementation tasks

1. **Survey existing dim affordances.** Read how disabled inputs / unconnected ports / inactive UI are styled today (`src/lib/components/node/`, `src/styles/tokens-node-editor.css`, `src/styles/scales.css`). Match that vocabulary.
2. **Apply node-body dim** in `src/lib/components/node/Node.svelte` (or `NodeBody.svelte`) gated on `node.bypassed`. Use a CSS class toggle (e.g. `.is-bypassed`) and a single style rule using `--opacity-disabled`.
3. **Choose a wire slice (a) or (b)** and implement it in the canvas wire renderer. Touch the **minimum** necessary set of files.
4. **Reduced motion.** Wrap any transition in a media query or use the existing `src/styles/reduced-motion.css` pattern.
5. **A11y.** No new ARIA needed beyond what 03B already added on the button. Confirm `scripts/a11y.ts` is unchanged.
6. **Tests / QA.**
   - A small unit test (or integration via existing snapshot/visual approach) confirming `.is-bypassed` (or equivalent class) is applied when `node.bypassed === true`.
   - Manual QA checklist in the PR description: select bypassed node, edit a parameter (still works), drag (still works), disconnect a wire from a bypassed node (still works), toggle Power off then on (visual state restores cleanly).

## Technical notes

- The canvas wire renderer lives in `src/ui/editor/` per the canvas/lib split (`docs/architecture/editor-ui-canvas-layout.md`). Crossing the `lib/` ↔ `ui/` seam goes through `index.ts` only — do not deep-import.
- Wire rendering must continue to read connections from the immutable graph; do not introduce a parallel "displayed connections" structure. The data model holds the truth; the renderer just decides how to draw what it finds.
- If you choose slice (b), make sure that picking up / dragging a wire endpoint (or removing a wire) still works on bypassed-source wires even when they aren't visually drawn — interaction state is independent of paint.

## Completion

✅ Done when:

- Bypassed nodes are visually distinguishable from active ones at a glance (dimmed body) without obscuring the Power button.
- Outgoing wires from bypassed nodes are visually marked as inactive per the chosen slice.
- All node interactions (select, drag, edit param, connect/disconnect, re-toggle Power) continue to work on bypassed nodes.
- Reduced-motion users see no transitions.
- `npm run build`, `npx vitest run`, and the project's a11y check are clean.

### Acceptance (observable)

- Toggle Power on a node → its body visibly dims; toggle off → it restores.
- Wires originating from a bypassed node are visibly distinct from wires from active nodes.
- A bypassed node can be selected, dragged, edited, and disconnected normally.
- Visual state persists across reload (because `bypassed` is serialized).

### Final steps

- Update `_OVERVIEW.md` task 04 status with which wire slice (a or b) you shipped and why.
- Capture before/after screenshots in the PR (one eligible node powered on, same node powered off, in a small graph) so reviewers can read the affordance without running the app.
