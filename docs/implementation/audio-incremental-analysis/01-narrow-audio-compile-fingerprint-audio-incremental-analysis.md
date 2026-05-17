# 01 — Narrow audio compile fingerprint — audio-incremental-analysis

## Agent instructions (START HERE)

Follow sections in order. **Do not** change offline analysis rebuild logic—**tasks 02–05**.

Non-negotiables:

- **Immutable graph** unchanged; only **`CompilationManager`** audio fingerprint / compile skip behavior.
- **Adding/removing** bands or remappers must still trigger compile (new virtual uniform names).
- Run **`npm run type-check`**, **`npm test`**, **`npm run build`** before marking done.

## Overview

Today any `audioSetup` change sets `computeAudioCompileFingerprint()` to `JSON.stringify(audioSetup)`, so **remapper range** edits schedule a full **shader recompile** even though GLSL uniform **names** are stable. Narrow the fingerprint so **runtime-only** remapper fields do not force compile.

## Scope

### In

- **`CompilationManager.ts`**: split or replace `computeAudioCompileFingerprint()` so it reflects **compile-affecting** audio setup (virtual node ids, band ids, file ids used for uniforms)—not remapper `inMin`/`inMax`/`outMin`/`outMax` or display names.
- **`CompilationManager.test.ts`**: extend “recompiles when audio setup changes” cases—remapper **range** change with same ids → **no** second `compile`; add/remove remapper → **does** compile.
- Confirm **`RuntimeManager.setAudioSetup`** still calls `onGraphStructureChange`—behavior change is **inside** `recompile()` skip logic only.

### Out

- **`AudioManager`** offline curves (**task 02+**).
- Undo/bookmark for audio setup gestures.

## Dependencies

### Provides

- Faster preview when only remapper mapping changes; fewer “Updating preview…” toasts unrelated to audio analysis.

### Blocks

- None (may land before **02**).

## Implementation tasks

1. Inventory which `audioSetup` fields affect **`UniformGenerator`** / virtual node uniform **declaration** vs runtime push only.
2. Implement **`computeAudioCompileFingerprint()`** (or `computeAudioStructureFingerprint()`) from structure-only fields; document in a one-line JSDoc.
3. Ensure `audioNeedsCompile` in `recompile()` uses the narrowed fingerprint; band/remapper **add/remove** still invalidates.
4. Add/adjust unit tests in **`CompilationManager.test.ts`**.
5. Run full test + build commands from **`_OVERVIEW`**.

## Technical notes

- Reference: `src/shaders/compilation/UniformGenerator.ts` remapper virtual nodes `remap-${id}.out`.
- Band-level `remapInMin` on **`AudioBandEntry`** may still affect compiled band virtual outputs—include band analysis/remap fields that are baked into compile if any; exclude panel **remapper** range-only fields.

## Completion

✅ Done when remapper **range-only** edits do not trigger `compiler.compile`, add/remove band or remapper still does, and **type-check + tests + build** pass.

### Final steps

- Mark task **01** ✅ in **`_OVERVIEW.md`**.
- If user-visible compile behavior changed, add one sentence to **`docs/architecture/audio-reactivity.md`** (optional, only if misleading today).
