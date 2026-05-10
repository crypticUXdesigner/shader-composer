# 01 — Data model + serialization — node-power

## Agent instructions (START HERE)

Follow sections in order. This task is **data model only**. No compiler changes, no UI changes, no runtime changes beyond a single store action.

Non-negotiables:

- Graph remains immutable. Use `src/data-model/immutableUpdates.ts`; never mutate `NodeGraph`, `NodeInstance`, or their nested fields in place. (`.cursor/rules/data-model/graph-updates.mdc`.)
- Serialization stays at `formatVersion: '2.0'` — the field is **additive and optional**, no migration needed.
- Validation tolerates the new field on existing graphs (presence, absence, and old presets without it must all load).

## Overview

Add a `bypassed?: boolean` field to `NodeInstance`, a `setNodeBypassed` immutable update, and a corresponding store action. Confirm round-trip serialization, undo/redo, and validation all behave correctly.

## Scope

### In

- `bypassed?: boolean` on `NodeInstance` (optional; absent === `false`).
- `setNodeBypassed(graph, nodeId, bypassed): NodeGraph` in `src/data-model/immutableUpdates.ts`.
- `setNodeBypassed` action on `graphStore` calling the immutable helper and notifying `graphChangedListener` (mirror the pattern of `updateNodeLabelAction` / `updateNodeParameterAction`).
- Tests:
  - Round-trip: serialize a graph with `bypassed: true` → parse → `bypassed` preserved.
  - Old preset without the field loads unchanged (no validation errors, no warnings).
  - Toggling `bypassed` returns a **new** graph reference and a **new** node instance reference (immutability invariant).
  - `setNodeBypassed` on a non-existent node returns the graph unchanged (mirror `updateNode` behavior).

### Out

- Compiler awareness of `bypassed` (task 03A).
- Eligibility check (task 02). `setNodeBypassed` here is permissive: it sets the field on **any** node id; the eligibility gate lives in the UI / compiler later.
- Any UI affordance.

## Dependencies

### Provides

- The serialized field and the immutable update + store action that everything else builds on.

### Blocks

- 02 (eligibility helper can be developed in parallel but the WP gates on this for end-to-end work).

## Implementation tasks

1. **Type:** Add `bypassed?: boolean` to `NodeInstance` in `src/data-model/types.ts`. Add a one-line JSDoc: *"Optional. When true, the node's effect is removed from the compiled output per the global Power rules. See docs/implementation/node-power/_OVERVIEW.md."*
2. **Immutable update:** Add `setNodeBypassed(graph, nodeId, bypassed): NodeGraph` to `src/data-model/immutableUpdates.ts`. Implement using the existing `updateNode` helper so structural sharing and immutability invariants come for free.
   - When `bypassed === false`, prefer to **delete** the field rather than store `false`, so old saves and toggled-off-then-on saves serialize identically. (Self-evaluation: if this complicates the helper without a clear benefit, it's acceptable to always store the boolean — call the choice out in the PR description.)
3. **Store action:** Add `setNodeBypassedAction(nodeId: string, bypassed: boolean): void` in `src/lib/stores/graphStore.svelte.ts` next to `updateNodeLabelAction`. It must call `graphChangedListener?.(graph)` so the runtime sees a structural change. Export it from the store façade like the other actions.
4. **Validation:** Confirm `validateGraph` / `validateNode` accept the new field. If the existing validators are field-allowlist style, extend them to permit `bypassed`. Otherwise, add a focused test that proves a graph with `bypassed: true` validates clean.
5. **Tests** (colocated; vitest):
   - `src/data-model/data-model.test.ts` (or a new `nodePower.test.ts` in `src/data-model/`) — round-trip serialization, immutability invariants, no-op on missing node, validation pass.
   - One test that copies a representative existing preset JSON inline (no `bypassed`) and confirms it loads + serializes back without introducing the field.

## Technical notes

- The undo/redo system already snapshots whole graph references; no work is needed there beyond confirming a single `setNodeBypassedAction` followed by undo restores the previous `bypassed` state. Add this to the test suite as one assertion.
- `serialization.ts` does not enumerate node fields explicitly (it stores the graph as-is); confirm this by reading it. If it does enumerate fields, add `bypassed` there.
- Keep the `bypassed === false → delete field` decision out of the public store API: the action signature stays `(nodeId, bypassed: boolean)`. The deletion (if any) is an internal implementation detail of `setNodeBypassed`.

## Completion

✅ Done when:

- `bypassed?: boolean` is on `NodeInstance` with the documented optional semantics.
- `setNodeBypassed` exists in `immutableUpdates.ts` and produces new references on change.
- `setNodeBypassedAction` exists on `graphStore` and notifies the change listener.
- All new tests pass; existing tests pass; `npm run build` is clean.
- A graph with `bypassed: true` round-trips through serialize → parse → serialize byte-stably.
- A legacy preset without the field loads with no warnings and no introduced `bypassed` keys.

### Acceptance (observable)

- Calling `setNodeBypassedAction(nodeId, true)` produces a new graph reference; the targeted node instance is a new object; all other nodes are reference-equal to before.
- Undoing the action restores the previous graph reference (or an equivalent graph with `bypassed` absent/false on that node).
- No compiler / runtime / UI behavior changes from this task alone.

### Final steps

- Update `docs/implementation/node-power/_OVERVIEW.md` task 01 status (date + 1-line note).
- Run `npx vitest run` and `npm run type-check`.
- Confirm the diff is data-model + store action + tests only — no compiler, no Svelte UI, no runtime files touched.
