# 04 — Notes visualization node — audiotool-arrangement

## Agent instructions (START HERE)

Depends on **02** snapshot including **`notes[]`** populated in importer (extend **01** if 01 only stubbed notes). Follow **`add-shader-node`** skill.

## Overview

**Pillar 2:** Visualize **notes** (all or selected tracks) vs **`uTimelineTime`** — pitch → vertical, time → horizontal, velocity → size/brightness.

## Scope

### In

- Extend importer (**01** follow-up in this task if needed): for each selected `noteRegion`, include notes from linked `noteCollection` with absolute timeline seconds (region offset + note `positionTicks`).
- New node e.g. **`arrangement-notes`**:
  - Track filter (all / subset), note styling params, playhead window (reuse patterns from 03A).
  - Pack up to **`MAX_NOTES`** (texture recommended).
- GLSL + WGSL (single task: both backends unless 03B proved WGSL texture hard—then match 03B policy).

### Out

- Automation bindings (05).

## Dependencies

### Prerequisites

- **02**; **03A** packing patterns helpful but not blocking.

### Provides

- Pillar 2 shipped.

## Completion

- Demo graph shows note dots moving with transport for a MIDI-heavy published track.
- Build + tests green.

**Final steps:** `_OVERVIEW.md` 04 ✅.
