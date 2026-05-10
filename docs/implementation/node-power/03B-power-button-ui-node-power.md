# 03B — UI: Power button on NodeHeader — node-power

## Agent instructions (START HERE)

Follow sections in order. Svelte 5 runes only. Read `.cursor/rules/frontend/svelte-standards.mdc`, `frontend/css-standards.mdc`, `frontend/design-system.mdc`, and `frontend/feature-requirements.mdc` before writing the component.

Non-negotiables:

- This is a **UI affordance only**. Behavior was already wired by tasks 01 + 03A; this task just exposes the toggle.
- The button must render **only on eligible nodes** (`nodeSupportsPower(spec) === true`). Non-eligible nodes have **no** affordance whatsoever (no greyed-out icon, no tooltip explaining absence — keep the canvas calm).
- Use the existing `power` icon from `iconsUiRegistry.ts`. Do not introduce a new icon registration.
- No new design tokens unless ≥2 uses or a strong semantic argument (`.cursor/rules/frontend/css-standards.mdc`).

## Overview

Add a small icon button to the node header that toggles `bypassed` on the underlying node. It uses the `power` Phosphor icon, sits unobtrusively in the header, and reflects the current `bypassed` state.

## Scope

### In

- A small icon button on `src/lib/components/node/NodeHeader.svelte` (or in a sibling component imported by it — implementer's call) that:
  - Renders only when `nodeSupportsPower(spec)` returns `true`.
  - Shows the `power` icon (Phosphor via the existing icon system).
  - Has `aria-label`/`title` of the form `Power — bypass this node` (powered-on state) / `Power — node is bypassed` (powered-off state). Final wording open for self-evaluation; keep it short, calm, and consistent with the project's tone (`design-system.mdc` — short, supportive, non-judgmental).
  - On click, calls a graph store action (the one introduced in task 01: `setNodeBypassedAction(nodeId, !bypassed)`).
  - Has clear focus, hover, and active states using existing tokens. Disabled state is not relevant (the button is either present or absent).
  - Stops pointer-down propagation so clicking it does not start a node drag.
- Uses an existing UI primitive if one is appropriate (small icon button). If `src/lib/components/ui/button` has a primitive that fits, use it; otherwise inline a minimal element with proper a11y attributes.
- A test (vitest + Svelte testing library, following the patterns of existing node-component tests if any) that confirms:
  - The button is rendered for an eligible node and absent for an ineligible one.
  - Clicking the button invokes the store action (mock the store) with the toggled value.
  - Pressing Enter or Space on the focused button has the same effect (native button semantics — usually free).

### Out

- Visual treatment of the **bypassed node body / wires** beyond the button itself — that is task 04.
- Keyboard shortcut on the canvas (e.g. press `P` with selection) — defer.
- Multi-select bypass — defer (the button toggles only its own node).
- Context-menu integration ("Bypass node") — defer.

## Dependencies

### Provides

- The user-facing entry point to toggle Power.

### Blocks

- 04 (visual state) — needs an actual toggle to QA against.
- 05 (docs) — needs the affordance to exist before writing user-facing copy.

### Prerequisites

- 01 (`setNodeBypassedAction` exists)
- 02 (`nodeSupportsPower` exists)

## Implementation tasks

1. **Locate the right insertion point** in `src/lib/components/node/NodeHeader.svelte`. The header today has icon + label + drag region + ports. The Power button should sit somewhere that:
   - Doesn't shift node width on toggle (button presence is constant for eligible nodes; only the icon's visual state changes).
   - Doesn't conflict with the drag handle hit area or the label edit affordance.
   - Doesn't overlap port chips on the header.
   - **Self-evaluation:** the most natural place is the upper-right corner of the header opposite the icon, or directly adjacent to the node icon. Pick whichever causes less re-layout pain. Prefer **constant footprint** (reserve space whether or not the button is present) **only** if absence-vs-presence variation causes visible shifts in adjacent nodes; otherwise just rely on `nodeSupportsPower`-conditional rendering.
2. **Pull `bypassed` and `nodeSupportsPower(spec)` into the component.** Use `$derived` for both — avoid `$effect` for sync (rules require it). The `bypassed` value comes from the node data already passed to `NodeHeader` (today the node id and label are available; if the full node instance isn't, expand the prop minimally).
3. **Wire click handler** via a callback prop (`onPowerToggle?: (nodeId: string, next: boolean) => void`) following the project's "callback props, not event dispatchers" convention. Wire the actual `setNodeBypassedAction` call at the parent (`Node.svelte` or wherever the existing `onLabelChange` is wired to the store).
4. **Visual.** Use `--opacity-disabled` on the icon or a token-driven dimmer when `bypassed === true` to give immediate per-button feedback (the broader node-body dim is task 04). Hover/focus states from existing button primitives. No new tokens unless tokens are reused.
5. **Tests.** Cover the eligibility branch (rendered/absent), the click → callback wiring, the `aria-label` / `title` reflecting state, and the pointer-down stop-propagation so node drag isn't started. Place at `src/lib/components/node/NodeHeader.power.test.ts` (or co-locate per the existing test pattern in the file).

## Technical notes

- The existing `IconSvg` accepts `name="power"` directly; no registration needed.
- `pointerdown` stop-propagation is essential — the node header is a drag handle. Look at how other in-header click targets (e.g. label-edit) handle this and follow the same pattern.
- If you need to expand `NodeHeader` props to receive the full node instance or just the `bypassed` boolean and `nodeId`, prefer the minimal addition (`nodeId: string` plus `bypassed: boolean`) rather than threading the whole instance.

## Completion

✅ Done when:

- The Power button is visible on every eligible node and absent on every ineligible one (verifiable in dev preview).
- Clicking the button toggles `node.bypassed` via the store action; preview reflects the change (compiler from 03A handles it).
- Reloading the page restores Power state per node (serialization from 01).
- Tests pass; a11y baseline (`scripts/a11y.ts` or whatever the existing run is) is unaffected.
- `npm run build` and `npx vitest run` are clean.

### Acceptance (observable)

- Eligible: a `Rotate` node shows the Power icon button. Click → preview shows the same as deleting the rotate node from the chain.
- Eligible: an `Orbit Camera` node shows the Power icon button. Click → preview shows the raymarcher with its own camera params (Rule B fallback).
- Ineligible: an `Add` node shows **no** Power button.
- Ineligible: the `Output` node shows **no** Power button.
- Clicking the Power button does not start a node drag.
- The button's `aria-label` / `title` reflects the current state.

### Final steps

- Update `_OVERVIEW.md` task 03B status.
- Capture a quick screenshot in the PR description showing one eligible node powered on vs off (button visible, icon state changed), to make the affordance reviewable without running the app.
