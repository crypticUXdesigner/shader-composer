# 03 — Tier A remapper patch — audio-incremental-analysis

## Agent instructions (START HERE)

Follow sections in order. Depends on **task 02** merged.

Non-negotiables:

- **Tier A** must **not** call `curveSamplersByFileId.clear()` globally.
- **Never** show “Getting audio ready” / set `building` for Tier A-only edits.
- If band cache / sampler not **ready**, fall back to **existing live analyser path** (today’s behavior)—do not publish a partial canonical cache.
- Commit sampler updates only when digest snapshot matches current target (extend existing `offlineBuildGeneration` pattern where applicable).

## Overview

When only **remapper mapping** (or band-level remap fields classified as Tier A) changes, **patch** remapperOut (and band `.remap`) channels in the published curve cache from **stored per-band smoothed series**—main thread, milliseconds—instead of full worker FFT.

## Scope

### In

- **`AudioManager`**: use **02** classification in `runOfflineProvidersRebuild`:
  - Tier A → `patchRemapperChannelsForFile(fileId)` (new private or module function).
  - Keep full rebuild path for higher tiers (delegate to current logic until **04/05** refine).
- Store **band-level cache** alongside or inside sampler metadata after last full build (e.g. `Map<bandId, Float32Array>` per frameCount)—populated when worker **result** arrives; used only for Tier A patch.
- **`audioAnalysisStatusStore`**: Tier A does not enter `building`.
- Parity test: full worker cache vs Tier A patch at ≥20 random times, ε &lt; 1e-5 (or tight float tolerance).

### Out

- Tier B worker subset (**04**).
- Removing unused `offlineProvidersByFileId` async placeholders (**05** optional).

## Dependencies

### Provides

- Primary UX win: remapper drag without analysis toast.

### Blocks

- **04, 05** (band/structural paths should reuse band cache storage from this task).

## Implementation tasks

1. On worker **result**, extract and retain per-band smoothed series needed for remap (align channel order with worker `buildChannels`).
2. Implement **`patchRemapperChannelsFromBandCache(cache, bandSeries, configs)`** using **`remapValue`** per frame index.
3. Wire Tier A branch in **`runOfflineProvidersRebuild`**; update per-file **ready** digests (remapper map) without clearing other files.
4. Manual: drag remapper in compact + large picker—no toast; preview/export curve sample at playhead matches pre-change full rebuild within ε.
5. Add parity unit test; run full CI commands from **`_OVERVIEW`**.

## Technical notes

- **`RemapRangeEditor`** fires `onChange` every drag step—Tier A must be cheap enough per step (no worker).
- If user edits remapper **before** first full build completes, Tier A is no-op → live path (unchanged).

## Completion

✅ Done when remapper-only edits skip worker + toast, patch matches full build in tests, and no global sampler clear on Tier A.

### Final steps

- Mark task **03** ✅ in **`_OVERVIEW.md`**.
