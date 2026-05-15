# 02 — Snapshot adapter, persistence, import UX — audiotool-arrangement

## Agent instructions (START HERE)

Follow sections in order. Depends on **01** types/importer. Immutable graph rules: snapshot is **data**, not graph nodes.

## Overview

Wire snapshot **import**, **storage** with presets, and a minimal **user trigger** when an Audiotool playlist track is primary.

## Scope

### In

- Extend **`AudioSetup`** (or serialized graph file per `_OVERVIEW` decision in 01) with optional **`arrangementSnapshot?: ArrangementSnapshot`** + `importedAt` / `source` metadata.
- **`serialization.ts` / migration:** round-trip snapshot; missing field = no arrangement features.
- Import flow:
  - Resolve `project_name` + `project_commit_index` from **`GetTrack`** for current playlist `trackId`.
  - Call task **01** importer; store result on `audioSetup`.
- UX (minimal): e.g. audio panel or load-track flow — **“Import arrangement from project”** when signed in + playlist primary; show success/error toast; disabled when no `project_name`.
- Clear snapshot when primary switches to upload or different track without project.
- Duration rule: set `graph.automation.durationSeconds` from snapshot **only when user opts in** OR document manual alignment (pick one; default: suggest in UI, do not silently overwrite existing automation).

### Out

- Shader nodes (03+); automation bindings (05).

## Dependencies

### Prerequisites

- **01** merged.

### Provides

- Persisted snapshot for compile/runtime consumers.

### Blocks

- **03A**, **03B**, **04**, **05**.

## Implementation tasks

1. Data-model types + serialize/deserialize + test.
2. `importArrangementForPrimaryTrack(session, audioSetup)` helper integrating existing OAuth client.
3. UI affordance + error handling (`rpc_forbidden`, missing `project_name`).
4. Tests: serialization round-trip; import replaces snapshot; primary change clears snapshot.

## Completion

- User with Audiotool playlist primary can import once and reload preset with snapshot intact.
- `npm run type-check && npm test && npm run lint && npm run build` pass.

**Final steps:** Update `_OVERVIEW.md` task 02 ✅; add one line to `docs/implementation/README.md` table if package linked.
