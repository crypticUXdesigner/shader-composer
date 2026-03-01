# Shader Composer — User Goals

**User-goals documentation** for the Node-Based Shader Composer. Each doc describes what the user can achieve in a given area: goals first, with short topic bullets only when a goal needs more detail.

These goals reflect **current app behavior** as of the codebase and serve as a single reference for product functionality and as a baseline for design and testing.

## Document Index

| Doc | Topic | Goals at a glance |
|-----|--------|-------------------|
| [01-overview-and-app-shell.md](./01-overview-and-app-shell.md) | Overview & App Shell | Preset, layout, zoom, FPS, help, panel, errors, corner widget |
| [02-node-graph-canvas.md](./02-node-graph-canvas.md) | Node Graph Canvas | Pan/zoom, tools, selection, move nodes, add nodes, connections, context menu, preview |
| [03-node-panel.md](./03-node-panel.md) | Node Panel | Search, filter by type, browse by category, list/grid, add at position |
| [04-nodes-and-parameters.md](./04-nodes-and-parameters.md) | Nodes & Parameters | Edit params, fixed vs connection, live values, signal picker, color/enum, file, data model |
| [05-connections.md](./05-connections.md) | Connections | Create, remove, one per port (replace), see topology |
| [06-audio.md](./06-audio.md) | Audio | Files, bands/remappers, playback, scrub, bind to params, persist |
| [07-timeline-and-automation.md](./07-timeline-and-automation.md) | Timeline & Automation | Time/playback, seek, automation lanes/curves, drive params, persist |
| [08-presets-and-data.md](./08-presets-and-data.md) | Presets & Data | Load/switch preset, copy/paste composition, consistent data format |
| [09-export.md](./09-export.md) | Export | Image export, video export (dialog, progress), unsupported message |
| [10-help-and-discovery.md](./10-help-and-discovery.md) | Help & Discovery | Node guide, context menu, compatible types |
| [11-undo-redo-and-keyboard.md](./11-undo-redo-and-keyboard.md) | Undo/Redo & Keyboard | Undo/redo, delete/copy/paste/duplicate, spacebar pan, no shortcuts in dialogs |

## Template

New user-goals docs should follow [\_template.md](./_template.md).

## Scope

- **In scope:** Entire app functionality expressed as user goals and, where needed, short topic lists.
- **Out of scope:** Internal architecture or API design unless they affect UX (e.g. WebGL required for preview).
