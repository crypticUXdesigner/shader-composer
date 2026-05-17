# Incremental offline audio analysis (preview)

## Mission

Speed up **audio panel** edits (especially **remapper** range tweaks) by avoiding full-track FFT rebuilds when only cheap mapping changes apply—**without** worse preview behavior, **incomplete** curve caches, or preview/export math drift.

Align with **`docs/user-goals/06-audio.md`** (live-driven parameters, export uses primary audio) and **`docs/architecture/audio-reactivity.md`** (per-frame uniforms before shader consume).

## Execution order (for agents)

1. **Task 01** — Stop **shader recompile** on remapper-only `audioSetup` changes (uniform *values* change, not uniform *declarations*).
2. **Task 02** — **Invalidation tiers** (per-file digests) + shared **`remapValue`** used by live path, worker, and future patch.
3. **Task 03** — **Tier A:** main-thread remapper-channel patch; **no toast** on remapper drag; **do not** clear all `curveSamplers` on Tier A.
4. **Task 04** — **Tier B:** single-band worker rebuild + safe per-file **live fallback** while building.
5. **Task 05** — **Tier C/D:** structural add/remove + per-file independence; parity tests + manual QA closeout.

**Branch discipline:** Land **02** before **03–05**. **01** may ship in parallel with **02** (different files) but merge before release if either touches `setAudioSetup` contracts.

## Locked decisions

| Topic | Decision |
| --- | --- |
| Preview canonical curves | Worker-built **`AudioAnalysisCurveSampler`** remains source when **ready** |
| Export | **Out of scope** to cache across jobs—export may keep full **`OfflineAudioProvider`** build per export |
| Incomplete partials | **Never** publish a sampler mixing old FFT with new remapper topology—use **generation + digest snapshot** commit gates |
| Tier A | **No worker**, **no** full `curveSamplers.clear()` |
| Tier B/C/D | May clear **that file’s** sampler; preview uses **live analyser** for that file until ready |
| Worker concurrency | **Serialized** `audioWorkerBuildChain` (do not parallelize per-file worker on one `onmessage`) |
| Parity | Tier A/B outputs must match **full worker build** within ε at sampled times (tests) |
| Warm-up gap | Worker vs **`OfflineAudioProvider`** warm-up mismatch is **known**; do not widen without explicit parity task |

## Non-goals (this package)

- Incremental analysis inside **video export** job (full build per export OK).
- Undo coalescing for audio setup drags (separate product decision).
- Fixing worker vs export warm-up parity (document only unless blocking tests).
- Parallel multi-file worker builds.

## High-touch files

| File / area | Why |
| --- | --- |
| `src/runtime/AudioManager.ts` | Rebuild scheduling, fingerprints, sampler lifecycle |
| `src/runtime/audio-analysis/audioAnalysisWorker.ts` | Full build; Tier B subset messages |
| `src/runtime/audio-analysis/AudioAnalysisCurveSampler.ts` | Published preview cache |
| `src/runtime/audio/audioUniformUpdates.ts` | Live vs curve path |
| `src/runtime/CompilationManager.ts` | Audio compile fingerprint (**task 01**) |
| `src/runtime/RuntimeManager.ts` | `setAudioSetup` → compile kick |
| `src/video-export/OfflineAudioProvider.ts` | `buildOfflineAudioAnalysisConfigs`, export parity reference |
| `src/lib/App.svelte` | `commitAudioSetup` |

## Work items

| ID | Task | Status | Provides | Blocks |
| --- | --- | --- | --- | --- |
| 01 | [Narrow audio compile fingerprint](./01-narrow-audio-compile-fingerprint-audio-incremental-analysis.md) | ✅ | Skip redundant preview compile on remapper-only edits | — |
| 02 | [Invalidation digests + shared remap](./02-invalidation-digests-shared-remap-audio-incremental-analysis.md) | ✅ | Tier helpers + `remapValue` module | 03, 04, 05 |
| 03 | [Tier A remapper patch](./03-tier-a-remapper-patch-audio-incremental-analysis.md) | ✅ | Fast remapper edits, no analysis toast | 04, 05 |
| 04 | [Tier B band rebuild](./04-tier-b-band-rebuild-audio-incremental-analysis.md) | ✅ | Incremental band FFT path | 05 |
| 05 | [Tier C structural + closeout](./05-tier-c-structural-multifile-audio-incremental-analysis.md) | ✅ | Per-file invalidation + test/QA bar | — |

## Progress tracker

- **Overall:** 100% — tasks 01–05 shipped.
- **Last updated:** 2026-05-17 — **05:** Tier C remapper-topology reshape (`audioAnalysisStructuralPatch.ts`); Tier C/D per-file full worker rebuild with debounce + live fallback; no global `curveSamplers.clear()`; removed unused `offlineProvidersByFileId` async cache; integration tests in `audioAnalysisTierCD.integration.test.ts` + `audioAnalysisStructuralPatch.test.ts`. **04:** Tier B band rebuild. **03:** Tier A. **02:** digests + `remapValue`. **01:** compile fingerprint.
- **Known gap (accepted):** worker vs `OfflineAudioProvider` export warm-up mismatch — unchanged; export still full-build per job.

## Success criteria

- Dragging a **remapper** inMin/outMin/outMax: **no** “Getting audio ready” toast; preview stays responsive.
- Changing **band** analysis (Hz, mode, smoothing): may show toast; preview uses **live** path until canonical curves ready—no wrong remapper values from stale cache.
- Rapid edits across **remapper A → band B → remapper C**: final state matches **one** full rebuild of final setup (tests).
- `npm run type-check`, `npm test`, `npm run lint`, `npm run build` green.
