# 05 — Tier C structural + multi-file closeout — audio-incremental-analysis

## Agent instructions (START HERE)

Follow sections in order. Depends on **02, 03, 04** merged.

Non-negotiables:

- **Structural** changes (add/remove band or remapper, change `bandId`, change `sourceFileId`) must produce a **complete** channel layout before sampler is **ready**.
- **Multi-file:** editing file B must not invalidate file A’s ready sampler.
- Run full **`_OVERVIEW`** success criteria + CI commands.

## Overview

Handle **topology** changes and **file buffer** changes with correct per-file invalidation; add integration tests for rapid mixed edits; optional cleanup of dead **`offlineProvidersByFileId`** async cache path if confirmed unused for uniforms.

## Scope

### In

- Tier **C** (structural): rebuild channel list; reuse band cache where ids stable; full worker build when band set or PCM changes.
- Tier **D** (file buffer): full file worker build; update `fileBufferDigest`.
- **`AudioManager`**: per-file `ready` digest tuple; clear **only** affected file’s sampler on C/D.
- Integration test: rapid sequence remapper A → band B → remapper C → final uniforms match single full rebuild of final setup.
- Multi-file test: bands on two loaded files; edit remapper on file 2 only → file 1 sampler unchanged.
- Manual QA checklist (from investigation): playlist track switch mid-edit, add/delete remapper while playing.
- Optional: remove or stop creating unused async **`OfflineAudioProvider`** instances in rebuild if only worker feeds preview (comment why in PR).

### Out

- Export incremental cache.
- Worker warm-up parity with **`OfflineAudioProvider`**.

## Dependencies

### Provides

- Complete incremental analysis package; closes **05** row and overall WP.

### Blocks

- None.

## Implementation tasks

1. Wire Tier C/D in `runOfflineProvidersRebuild` using **02** classification; no global `curveSamplers.clear()`.
2. Implement channel add/remove: atomic new `Float32Array` + `channels[]` swap-in when remapper added/removed.
3. Add integration tests listed above.
4. Execute manual QA; note any remaining toast annoyance on band drag in PR description.
5. Update **`_OVERVIEW.md`** progress to 100%; run `npm run verify:pages` if touching runtime hot paths (recommended before merge).

## Technical notes

- **`commitAudioSetup`** still calls full `setAudioSetup` each edit—invalidation logic must be robust to burst edits, not depend on UI debounce alone (Tier B debounce is in AudioManager only).
- Document in **`_OVERVIEW`** if worker vs export warm-up gap remains accepted.

## Completion

✅ Done — structural/multi-file paths wired; integration tests pass; `npm run type-check` + `npm run build` + `src/runtime/audio-analysis/**` tests green (2026-05-17).

**Manual QA (operator):** playlist track switch mid-edit; add/delete remapper while playing; band drag may still show toast after ~200ms (Tier B by design).

### Final steps

- Mark tasks **04–05** and overall WP ✅ in **`_OVERVIEW.md`**.
- Link package from investigation PR / release notes if shipped.
