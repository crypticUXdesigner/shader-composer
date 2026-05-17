# 04 — Tier B band rebuild — audio-incremental-analysis

## Agent instructions (START HERE)

Follow sections in order. Depends on **02** and **03** merged.

Non-negotiables:

- **Serialize** worker jobs on existing **`audioWorkerBuildChain`**.
- While Tier B building for file F: **do not** sample stale canonical cache for F—use **live analyser** uniforms for F (same as today when samplers cleared).
- Superseded builds: ignore results when `buildGeneration` or digest snapshot mismatches.

## Overview

When **band analysis** config changes (Hz range, `bandMode`, `fftSize`, smoothing, attack/release, band-level remap fields), re-run FFT+smoothing for **that band only**, merge into band cache, then reassemble remapper channels (Tier A assembly). Avoid full-file FFT when other bands unchanged.

## Scope

### In

- Worker: new request type e.g. **`buildBands`** (subset of `analyzerConfigs` + PCM) → returns band cache slice OR full cache with only affected columns updated—pick one design, document in worker types.
- **`AudioManager`**: Tier B branch queues one job with **trailing debounce** (~100–150ms) after last band edit; cancel prior in-flight via existing cancel + generation bump.
- Toast: show **`building`** only if job exceeds ~200ms (optional threshold) or always for Tier B—prefer **short/no toast** if completes fast; never block UI thread.
- Merge band results → run Tier A assembly for all remappers on affected file.
- Tests: change `bandMode` / frequency range → patched cache matches full rebuild.

### Out

- Add/remove band/remapper topology (**05**).
- Export path changes.

## Dependencies

### Provides

- Faster band tuning without full-track rework when multiple bands exist.

### Blocks

- **05** (structural tier builds on B merge path).

## Implementation tasks

1. Extend **`audioAnalysisWorkerTypes.ts`** + worker handler for subset band build (reuse PCM transfer pattern from `build`).
2. Implement Tier B scheduling in **`AudioManager`** with debounce + snapshot commit gate.
3. Per-file state: mark **building**, clear **only that file’s** sampler until commit; other files’ samplers untouched.
4. Parity test: two bands on one file; change band A only—band B channels unchanged vs full rebuild.
5. Run **`npm test`**, **`npm run build`**, manual band slider drag QA.

## Technical notes

- Band smoothing is **temporal**—subset rebuild must start from warm state consistent with full build (match worker’s current cold-start at k=0 or replicate warm-up—document choice; prefer matching existing worker loop for parity).
- Rapid **band then remapper** edit: queued Tier B must complete before Tier A patch uses new band series (serialize on chain).

## Completion

✅ Done when single-band edits avoid full-file worker `build` in the common case, live fallback active during build, parity tests pass.

### Final steps

- Mark task **04** ✅ in **`_OVERVIEW.md`**.
