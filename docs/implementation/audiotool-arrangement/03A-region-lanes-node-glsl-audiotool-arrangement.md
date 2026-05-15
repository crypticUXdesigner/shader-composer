# 03A — Region lanes node (GLSL) — audiotool-arrangement

## Agent instructions (START HERE)

Depends on **02** persisted snapshot. Follow **`add-shader-node`** skill + `node-standards.mdc`. Node reads snapshot via compile-time bake or runtime uniform upload—**not** Nexus.

## Overview

**Pillar 1:** Shader node renders **region rectangles** per track row, moving/windowed with **`uTimelineTime`**.

## Scope

### In

- New node e.g. **`arrangement-lanes`** (id TBD, register in `nodes/index.ts`):
  - Parameters: viewport mode (follow playhead vs fixed), window seconds, track filter (all / list), colors (palette vs DAW `colorIndex`), lane height/spacing, optional fade at edges.
  - Inputs: UV (or position); optional float overrides.
  - Output: `vec4` mask or color suitable for compositing.
- **Snapshot binding:** At compile, read `audioSetup.arrangementSnapshot`; pack up to **`MAX_REGIONS`** into data texture or uniform struct; document cap in `node-documentation.json`.
- GLSL: for each fragment, test overlap with regions active at `uTimelineTime` (outer span); Y from `orderAmongTracks`.
- `node-documentation.json` + short help aligned with `displayName`.

### Out

- WGSL (03B); notes node (04); automation (05).

## Dependencies

### Prerequisites

- **02**.

### Provides

- Working pillar-1 node on WebGL preview/export.

### Blocks

- **03B** may proceed in parallel.

## Implementation tasks

1. `NodeSpec` + codegen path (texture upload hook if needed).
2. Implement region packing from snapshot.
3. GLSL + compile tests / snapshot test graph.
4. Demo preset optional (can defer to 04 if timeboxed).

## Completion

- Graph with playlist snapshot + node shows scrolling/fixed region lanes synced to playhead on WebGL.
- `npm run type-check && npm test && npm run lint && npm run build` pass.

**Final steps:** `_OVERVIEW.md` 03A ✅.
