# Implementation specs

Focused engineering notes for behavior that is **partially implemented**, **not yet wired to UX**, or **easy to drift** across files. They complement **`docs/user-goals/`** (what users should get). Multi-step work lives here too: optional **`docs/implementation/<slug>/_OVERVIEW.md`** plus numbered task markdown files in the same folder (see **`workpkg-hygiene.mdc`**, **`define-project` / `define-tasks`** skills).

| Document | Topic |
|----------|--------|
| [graph-undo-redo.md](./graph-undo-redo.md) | Wire `UndoRedoManager` to keyboard/UI so undo/redo matches user goals |
| [node-panel-category-order.md](./node-panel-category-order.md) | Keep browse category order consistent between node panel and add picker |
| [a11y-baseline.md](./a11y-baseline.md) | Accessibility baseline / scripted checks |
| [node-port-labels-in-out-analysis.md](./node-port-labels-in-out-analysis.md) | Port labels: extended reference + audit tables (**canonical rules:** `shaders/node-standards.mdc` § port labels) |
| [`webgpu-migration/_OVERVIEW.md`](./webgpu-migration/_OVERVIEW.md) | WebGPU-first preview + export, WGSL coverage ledger, WebGL fallback policy |
| [`node-power/_OVERVIEW.md`](./node-power/_OVERVIEW.md) | Per-node Power (bypass) toggle: serialized node setting + two global compile rules + UI affordance |
| [`expression-node/_OVERVIEW.md`](./expression-node/_OVERVIEW.md) | **Expression** node: sandboxed math DSL (`a`–`d`), dual GLSL/WGSL emit, CodeMirror UI, demo preset |

New multi-step packages: add `docs/implementation/<slug>/_OVERVIEW.md` first, then link it here (see **`workpkg-hygiene.mdc`**).

When a spec is fully delivered, update or archive it and align **`docs/user-goals/`** if behavior changed.
