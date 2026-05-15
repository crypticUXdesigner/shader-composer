# 01 — Spike + ArrangementSnapshot contract — audiotool-arrangement

## Agent instructions (START HERE)

Follow sections in order. **No shader nodes, no UI polish**—types, one import path, Vitest, and a short spike note in the task completion comment.

Respect **`_OVERVIEW.md`** locked decisions (published commit, outer span, query-once).

## Overview

Prove Nexus can **`open` → `start` → query → `stop`** for a real published track project and freeze the **normalized snapshot shape** all later tasks consume.

## Scope

### In

- Add `src/audiotool/arrangement/` (or `src/utils/audiotoolArrangement/`) with:
  - **`ArrangementSnapshot`** TypeScript types: `tracks[]`, `regions[]`, optional `notes[]` stub, `bpm`, `durationSeconds`, `timeSignature`, `source: { trackName, projectName, commitIndex }`.
  - **`importArrangementSnapshotFromProject(client, projectName, commitIndex?)`** using `@audiotool/nexus` `open` + `queryEntities` for: `config`, `noteTrack`, `audioTrack`, `patternTrack`, `noteRegion`, `audioRegion`, `patternRegion` (automation entities optional stub for task 05).
  - Map each region’s **outer** `positionTicks` / `durationTicks` → seconds via `ticksToSeconds` + `config.tempoBpm`.
  - Track row: `orderAmongTracks`, `kind`, `enabled`, resolved `label` / `colorIndex` where present.
- Vitest with **fixture JSON** (recorded from spike) so CI does not call live API.
- Document in module JSDoc: **max counts** observed in spike (regions, notes, tracks).

### Out

- Persistence, UI, shader nodes, automation bindings.

## Dependencies

### Provides

- Frozen snapshot types + tested importer used by **02**.

### Blocks

- **02** until merged.

## Implementation tasks

1. Spike one real `tracks/…` + `project_name` (manual or skipped in CI); log entity counts.
2. Implement importer; export snapshot JSON shape.
3. Add fixture + tests: tick conversion, track ordering, region outer span, disabled regions omitted or flagged.
4. Note recommended caps (`MAX_REGIONS`, `MAX_NOTES`) in types file for tasks 03–04.

## Completion

- `ArrangementSnapshot` is importable and covered by Vitest without network.
- Spike counts documented in PR or task comment.
- `npm run type-check && npm test && npm run lint && npm run build` pass.

**Final steps:** Update `_OVERVIEW.md` task 01 row to ✅; note caps in Notes section.
