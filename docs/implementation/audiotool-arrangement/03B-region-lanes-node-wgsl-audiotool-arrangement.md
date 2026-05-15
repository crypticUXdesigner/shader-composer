# 03B — Region lanes node (WGSL MVP) — audiotool-arrangement

## Agent instructions (START HERE)

Depends on **03A** node spec and region packing logic. Reuse same snapshot packing; add WGSL path or document explicit WebGPU gap.

## Overview

WebGPU preview/export support for **`arrangement-lanes`** (or equivalent id from 03A).

## Scope

### In

- Add node to **`WGSL_SUPPORTED_NODE_TYPES`** if feasible.
- WGSL shader sampling arrangement data texture / uniforms with same semantics as GLSL.
- If MVP cannot bind arrangement texture yet: return clear compile metadata (`unsupported` / warning) per `webgl-webgpu-preview-export.md` policy—**do not** silent fallback to wrong visuals.

### Out

- Notes node; automation bindings.

## Dependencies

### Prerequisites

- **03A** merged (shared packing API).

### Provides

- WebGPU parity or documented unsupported state for pillar 1.

## Completion

- WebGPU graphs using only MVP-supported nodes + arrangement-lanes either render correctly or fail with explicit user-visible message.
- Tests updated; build green.

**Final steps:** `_OVERVIEW.md` 03B ✅.
