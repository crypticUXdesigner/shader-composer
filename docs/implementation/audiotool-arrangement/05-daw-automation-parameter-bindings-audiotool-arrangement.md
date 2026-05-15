# 05 — DAW automation → shader parameter — audiotool-arrangement

## Agent instructions (START HERE)

Depends on **02** snapshot with **automation tracks/events** in importer. Study `automationEvaluator.ts` and float param compile path; do not break existing graph automation lanes.

## Overview

**Pillar 3:** User links a **DAW automation collection** (or track) to a **shader node parameter** with **remap** so 0–1 DAW values map to useful shader ranges.

## Scope

### In

- Extend snapshot: `automationLanes[]` with stable ids, target parameter path in DAW (display only), **events** `{ timeSeconds, value, interpolation }` sampled at import.
- New data on `audioSetup` or graph:
  - **`dawAutomationBindings[]`**: `{ id, automationId, nodeId, paramName, inMin, inMax, outMin, outMax }`.
- Runtime + compile: at `uTimelineTime`, evaluate DAW curve (linear between events v1; respect `isEnabled` regions).
- Combine with existing automation: document precedence (**graph automation wins** vs **DAW wins**—recommend: graph lane overrides DAW when both target same param).
- UI: minimal list in audio panel or parameter context — add/remove binding, pick automation from snapshot list, edit remap (reuse **ValueInput** / remapper patterns from audio bands where possible).

### Out

- Tempo automation driving BPM; bidirectional DAW sync; auto-discovery of all automations.

## Dependencies

### Prerequisites

- **02**; importer extended for automation entities.

### Provides

- Pillar 3 control path.

## Completion

- User can bind one DAW automation to one float parameter; preview follows DAW curve with remap while playing.
- Vitest for evaluator + compile expression includes DAW term.
- Build green; user-goals audio doc updated for binding UX.

**Final steps:** `_OVERVIEW.md` 05 ✅; milestone C complete.
