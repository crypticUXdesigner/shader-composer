Title: Triangle Grid — node card keeps tall height after switching Projection to UV

Status: **Open** (Investigating)

## Symptom

- **Surface**: ShaderNoice node graph on the canvas — the **floating card** for a node (header + parameter area), not the side inspector panel unless the same repro appears there too.
- **Node**: Add or select a **Triangle Grid** pattern node (`triangle-grid`).
- **Control**: Under the **Projection** group, the **Projection** control is a dropdown (enum) whose options include **Infinite plane** and **UV** (see `getParameterEnumMappings` for labels).
- **Repro**:
  1. Set Projection to **Infinite plane** so the **Infinite plane** parameter block (plane scale, plane normals, plane height, etc.) is visible.
  2. Change Projection to **UV** so that block should disappear (fewer parameters on the card).
- **Expected**: The node card **shrinks vertically** to fit the remaining controls (Projection, Grid, Output sections only).
- **Actual**: The card **stays as tall as before** — empty space below the visible parameters, as if the layout still reserved space for the hidden block.

No error message or console requirement; this is a **layout / metrics mismatch** class of bug.

## Terms (for readers outside the repo)

- **Graph**: The saved node network (nodes, wires, parameters). In this app it is updated immutably via the data model / `graphStore`; the canvas and DOM layers **read** it.
- **Node metrics**: Precomputed width/height (and port positions) used for hit-testing, connections, and **DOM node card** sizing. Stored in a `Map` on the canvas editor, keyed by node id.
- **`visibleWhen`**: On a parameter layout grid section, a rule like “only show this block when parameter X equals Y.” For Triangle Grid, the Infinite plane block is tied to `triProjection === 0` (see node spec below).

## Root cause

**Unknown.** A plausible class of causes is **the height passed into the DOM node shell (`metrics.height`) not updating when the visible layout shrinks**, while the inner Svelte body already hides rows via `visibleWhen`. That would produce exactly “tall card, short content.”

An **attempted mitigation** (early `canvas.setGraph` after `updateNodeParameter`, before awaiting async `onParameterChanged`) was added in `NodeEditorCanvasWrapper.svelte` so metrics refresh before runtime work finishes. **Reporter confirms the problem persists**, so either:

1. The bug is **not** primarily the async ordering between store update and `setGraph`, or
2. There is an **additional** source of stale height (e.g. CSS `min-height` + flex growth on the node shell vs body, a second code path, or metrics computation not matching DOM for this spec), or
3. Repro differs from the path above (e.g. another surface or build).

Further investigation should verify **actual `metrics.height` in DevTools** after toggling (e.g. log in `DomNodeLayer` or breakpoint `getNodeMetrics`) and compare to **measured DOM height** of `.node` / `.node-body`.

## Hypotheses (not ruled out)

1. **CSS / flex**: Root `.node` uses `min-height: {metrics.height}px` and flex column; `NodeBody` root uses `min-height` for the body and `flex: 1` on inner content — intrinsic or flex behavior could **preserve** height even if `metrics` drops (verify by temporarily forcing `height` instead of `min-height` on the shell).
2. **Reactive ordering**: `DomNodeLayer` reads `canvasApi.getNodeMetrics(nodeId)` while the `graph` prop already reflects the new parameter; if any path skips `updateNodeMetrics`, metrics could still be old (grep all `updateNodeParameter` / parameter UI entry points).
3. **Metrics vs DOM parity**: Canvas-side layout (`GridElementRenderer`, `BodyFlexboxLayout`, `ParameterLayoutManager`) might disagree with `NodeBody.svelte` for collapsed sections (both use `layoutSectionVisible` from `parameterVisibility.ts` — confirm `triProjection` is always a **finite number** in the store when comparing to `visibleWhen.equals`).
4. **ResizeObserver / param grid**: `NodeBody` uses a `paramGridCols` action with `ResizeObserver`; unlikely to *increase* min height after hide, but worth checking if it pins `data-*` attributes that affect layout.

## Attempted fix (did not resolve)

- **File**: `src/lib/components/editor/NodeEditorCanvasWrapper.svelte` — function `handleParameterChange`.
- **Idea**: Call `syncViewStateFromCanvas(canvas)` and `canvas.setGraph(graphStore.graph)` **immediately** after `graphStore.updateNodeParameter(...)`, **before** `await` on `callbacks.onParameterChanged` (which is `async` in `App.svelte` and awaits runtime parameter sync). Then repeat `setGraph` + `requestRender` after the await; call `notifyGraphChanged()` at the end.
- **Outcome**: User reports **issue remains**.

## Key files (each with role for this symptom)

| File | Role |
| --- | --- |
| `src/shaders/nodes/triangle-grid.ts` | **Node spec**: defines `triProjection` (int 0/1), `parameterLayout` with an **Infinite plane** grid and `visibleWhen: { parameter: 'triProjection', equals: 0 }` — when user picks UV (`1`), that section should hide. |
| `src/lib/components/node/Node.svelte` | **DOM shell sizing**: `style="... min-height: {metrics.height}px"` on the root `.node` — if `metrics.height` is too large, the card stays tall. |
| `src/lib/components/node/NodeBody.svelte` | **DOM body**: Renders each layout grid; wraps sections with `{#if layoutSectionVisible(element.visibleWhen, node, spec)}` — content hides when the graph parameter matches. |
| `src/utils/parameterVisibility.ts` | **`layoutSectionVisible`**: returns whether a `visibleWhen` block should show, using stored parameter value or spec default. |
| `src/lib/components/editor/DomNodeLayer.svelte` | **Binds graph to cards**: `{@const metrics = getNodeMetrics(node.id)}` — passes canvas metrics into `Node` as `metrics`. |
| `src/lib/components/editor/NodeEditorCanvasWrapper.svelte` | **Parameter change pipeline**: `handleParameterChange` updates store, syncs canvas graph / metrics, awaits `onParameterChanged`, `notifyGraphChanged`. |
| `src/ui/editor/graphUpdate.ts` | **`applyGraphUpdate`**: on `setGraph`, calls `metricsManager.updateNodeMetrics()` which clears and recomputes metrics for all nodes. |
| `src/ui/editor/canvas/MetricsManager.ts` | **Owns `nodeMetrics` map**: `updateNodeMetrics()` full refresh; used by canvas and `getNodeMetrics`. |
| `src/ui/editor/rendering/NodeMetricsCalculator.ts` | **Height math + cache key**: includes parameters referenced by `visibleWhen` in the layout-affecting cache key (e.g. `triProjection`) so toggling should invalidate per-node cache entries. |
| `src/ui/editor/rendering/layout/elements/GridElement.ts` | **Per-section height for metrics**: returns `height: 0` when `layoutSectionVisible` is false so flex layout collapses the slot. |

### Tiny excerpt (shell sizing)

`Node.svelte` ties card height to metrics (not to measured content):

```svelte
style="... width: {metrics.width}px; min-height: {metrics.height}px;"
```

If `metrics.height` is wrong or `min-height` interacts badly with flex children, the symptom appears.

## Debug recipe (for implementers)

1. Repro on Triangle Grid: Infinite plane → UV.
2. In DevTools, select the node root `[data-node-id=…]` and note computed height vs children sum.
3. Log in `DomNodeLayer` (or temporarily in `getNodeMetrics`) the returned `height` for the node id before/after toggle.
4. If metrics are **correct** but DOM is **tall**, focus on **CSS** (`Node.svelte`, `NodeBody.svelte` `.node-body`, `.content`).
5. If metrics are **wrong**, trace `NodeMetricsCalculator.calculate` → `ParameterLayoutManager` for `triangle-grid` with `triProjection === 1`.

## Background

ShaderNoice is a node-based shader editor: nodes sit on a panned/zoomed canvas; parameters are edited on each node’s card. Triangle Grid offers a **Projection** mode that optionally shows an extra **Infinite plane** block; hiding that block should reduce vertical space on the card.
