# 04 — UI layout, previews, icons — color-lut-gradient

## Agent instructions (START HERE)

**Depends on 02A and 03A** (specs + params exist). Polish panel UX; keep **`NodeBody.svelte`** and **`NodeBodyLayoutItem.svelte`** in sync.

## Overview

Make both nodes **readable at a glance** on the canvas: preview strips, enum labels, icons, search tags.

## Scope

### In

- **`src/utils/parameterEnumMappings.ts`:**
  - `color-lut` / `preset` → labels from task 01 preset table (Viridis, Inferno, …).
  - `color-gradient` / `gradientMode` → `{ 0: 'Radial', 1: 'Linear' }`.

- **`src/utils/canvas-icons.ts`** (if needed):
  - Confirm `color-palette` and `color-wheel` map to Phosphor icons (add aliases only if missing).

- **`ColorMapPreview.svelte` + `ColorMapPreviewElement.ts`:**
  - Extend `mode` union: `'smooth' | 'stepped' | 'lut' | 'three-stop'`.
  - **`lut`:** sample `getLutPresetRgb(preset, t)` from TS module (01) with live `gamma`/`contrast`/`reverse` for strip accuracy.
  - **`three-stop`:** draw gradient using `sampleThreeStopOklch` at strip width 256; honor `stop0T/1T/2T` positions as gradient stop %.
  - Props: pass `node` + `spec` + element `mode`; read parameters from `node.parameters`.

- **Layout QA checklist (manual):**
  - Color LUT body ≤ ~4 sections; preset strip full width; no label overflow (short labels per `node-standards.mdc`).
  - Color Gradient: mode switch collapses irrelevant radial/linear grids; stop pickers align in 3 rows; position sliders one row.
  - Category CSS: Blend nodes use existing blend category tokens (no new category).

- **`src/utils/nodeSearchTags.ts`** + run or update **`scripts/generate-node-search-tags.mjs`**:
  - `color-lut`: lut, colormap, viridis, turbo, preset, heatmap, scientific
  - `color-gradient`: gradient, spatial, sky, ramp, oklch, position, mask

- **Optional:** `ColorMapPreview.stories.ts` stories for `lut` and `three-stop` modes.

### Out

- `node-documentation.json` (05), WGSL (already 02B/03B).

## Dependencies

### Provides

- Production-ready panel UX for both nodes.

### Blocks

- **05**

## Completion

✅ Done when previews update live on parameter change, enum dropdowns show human preset names, icons render in panel + canvas header.

### Acceptance

- Change **Preset** on Color LUT → strip updates without recompile glitch.
- Drag **Stop 2** hue on Color Gradient → three-stop strip updates.
- `npm run lint` clean on touched Svelte/TS files.

### Final steps

- Update `_OVERVIEW.md` row **04** → ✅ + date.
