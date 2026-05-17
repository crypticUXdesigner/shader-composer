# 02 — Invalidation digests + shared remap — audio-incremental-analysis

## Agent instructions (START HERE)

Follow sections in order. **Do not** wire Tier A patch or worker changes yet—**tasks 03–05**.

Non-negotiables:

- **No behavior change** to published preview curves until **03** consumes these helpers (helpers + tests only, or behind unused API).
- **`remapValue`** must be **one** implementation shared by live, worker, and future patch (extract from `audioUniformUpdates.ts`).

## Overview

Introduce **per-file invalidation tiers** (A remapper map, B band analysis, C structural, D file buffer) and extract shared remap math so later tasks can decide **full vs partial** rebuild without copy-paste.

## Scope

### In

- New module e.g. **`src/runtime/audio-analysis/audioAnalysisInvalidation.ts`** (name flexible):
  - `classifyAudioSetupChange(prev, next, fileId)` → `'none' | 'remapper' | 'band' | 'structural' | 'file'`.
  - Per-file digest builders: `fileBufferDigest`, `bandAnalysisDigest`, `remapperMapDigest`, `structuralDigest` (stable serialization; avoid whole-setup `JSON.stringify` for hot path).
- **`src/runtime/audio/remapValue.ts`**: move `remapValue` from `audioUniformUpdates.ts`; re-export or import in worker (worker may need a thin duplicate-free import path—no second formula).
- Unit tests for classification matrix (representative edits).

### Out

- Changing **`AudioManager.runOfflineProvidersRebuild`** scheduling (**03+**).
- Worker new message types (**04**).

## Dependencies

### Provides

- Tier classification + digests for **03, 04, 05**.
- Shared **`remapValue`** for parity.

### Blocks

- **03, 04, 05** until merged.

## Implementation tasks

1. Document tier rules in module header (match **`_OVERVIEW`** locked decisions).
2. Implement digest functions; use sorted keys for stable hashes/strings.
3. Extract **`remapValue`**; update **`audioUniformUpdates.ts`** and **`audioAnalysisWorker.ts`** to import it (worker: ensure bundler allows import from `runtime/audio/`).
4. Add **`audioAnalysisInvalidation.test.ts`** covering: remapper range only → `remapper`; fftSize change → `band`; add remapper → `structural`; buffer length change → `file`.
5. Run **`npm test`** + **`npm run build`**.

## Technical notes

- **`fileIdsWithBands`**: `new Set(setup.bands.map(b => b.sourceFileId))`—classification is per file that has bands.
- Remapper edits for band on file A must not imply invalidation tier for file B.

## Completion

✅ Done when tier classification + digests are tested, **`remapValue`** has a single source, existing audio uniform tests still pass, and **build** is green.

### Final steps

- Mark task **02** ✅ in **`_OVERVIEW.md`**.
