# Implementation specs

Focused engineering notes for behavior that is **partially implemented**, **not yet wired to UX**, or **easy to drift** across files. They complement **`docs/user-goals/`** (what users should get). Multi-step work lives here too: optional **`docs/implementation/<slug>/_OVERVIEW.md`** plus numbered task markdown files in the same folder (see **`workpkg-hygiene.mdc`**, **`define-project` / `define-tasks`** skills).

| Document | Topic |
|----------|--------|
| [graph-undo-redo.md](./graph-undo-redo.md) | Wire `UndoRedoManager` to keyboard/UI so undo/redo matches user goals |
| [node-panel-category-order.md](./node-panel-category-order.md) | Keep browse category order consistent between node panel and add picker |
| [`audio-band-modes/_OVERVIEW.md`](./audio-band-modes/_OVERVIEW.md) | Add per-band extraction modes (mean/max/RMS/…) with live+export parity |
| [`parameter-range-clamp/_OVERVIEW.md`](./parameter-range-clamp/_OVERVIEW.md) | Hard-enforce float parameter ranges so shader + live UI values stay in spec |
| [`param-port-driven-state/_OVERVIEW.md`](./param-port-driven-state/_OVERVIEW.md) | Use parameter port as single “driven” cue (graph/audio/automation) |
| [`preview-responsiveness/_OVERVIEW.md`](./preview-responsiveness/_OVERVIEW.md) | Keep editor responsive by skipping idle recompiles, coalescing, and caching programs |
| [`svelte-effect-hygiene/_OVERVIEW.md`](./svelte-effect-hygiene/_OVERVIEW.md) | Svelte 5 `$effect` audit follow-ups: export ETA, picker selection, motion `$derived`, App bridges, patch toast, preview corner layout |
| [`help-overview-guide/_OVERVIEW.md`](./help-overview-guide/_OVERVIEW.md) | Guide callout **overview** (no node selected): wiring, onboarding content, jump/motion, user-goals sync |

When a spec is fully delivered, update or archive it and align **`docs/user-goals/`** if behavior changed.
