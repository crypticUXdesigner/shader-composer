Title: Inflated Icosahedron — node renders almost entirely black when used as documented

Status: **Fixed**

## Symptom

- **Surface**: ShaderNoice main preview canvas (the central rendered area), and the bundled **Inflated Icosahedron** preset in the Load dialog.
- **Node**: A 3D raymarched shape node called **Inflated Icosahedron** (id `inflated-icosahedron`, palette label "Icosahedron"). It is the node spec defined in `src/shaders/nodes/inflated-icosahedron.ts`; the equivalent WebGPU helper lives in `src/shaders/compilation/inflatedIcosahedronMvpWgsl.ts`.
- **Repro** ("as intended" usage matching the in-app help text):
  1. Open ShaderNoice in either backend (WebGL/GLSL or WebGPU/WGSL).
  2. Add a **UV Coords** node and an **Icosahedron** node and a **Final Output** node to the graph.
  3. Wire **UV Coords.UV → Icosahedron.Screen position**, then **Icosahedron.Color → Final Output.Color**. Leave **Ray origin** and **Ray direction** unconnected (this is the documented default — the node has built-in fallback orbit camera).
  4. Press Play.
- **Expected**: A blue-grey background gradient with the rotating raymarched icosahedron centered in the frame (matching the Shadertoy reference `ltfXzj`).
- **Actual**: The frame is essentially black on WebGL. On WebGPU the corners are pitch black and only a tiny visible bubble of the gradient/shape can appear far off-center near the upper‑right of the image.

No console errors are emitted; the shader compiles cleanly. The output is just (mostly) black pixels.

## Terms (for readers outside the repo)

- **NDC (normalized device coordinates)**: This project's `UV Coords` node does **not** emit `[0, 1]` UVs in either backend. The base GLSL fragment template defines `vec2 p = (uv * 2.0 - 1.0) * vec2(aspect, 1.0)` and that `p` is what `UV Coords` outputs (range `[-aspect, aspect] × [-1, 1]`). The WGSL backend builds the identical aspect-corrected NDC value for the same node.
- **Screen position port**: A `vec2` port whose project-wide convention is "fullscreen / camera-plane coords for projections and ray-entry setups", i.e. the NDC value above (per `.cursor/rules/shaders/node-standards.mdc` → Port label rules).

## Root cause

The node was ported from a Shadertoy that assumes `fragCoord/iResolution.xy` (i.e. `[0, 1]` UVs) and was never adapted to ShaderNoice's NDC convention. Both the GLSL node spec and the WGSL helper apply an extra `2 * x − 1` remap to the incoming `Screen position`, double-normalizing it.

Two compounding effects fall out of that single mistake:

1. **The background gradient produces NaN / clamped-to-black pixels.** The mainCode computes `vec2 pp = 2.0 * $input.in - 1.0` and then `mix(vec3(0.8, 0.8, 0.9), vec3(0.35, 0.5, 0.65), length(pp)/1.5)`. With `$input.in` already in NDC (e.g. `[-1.78, 1.78] × [-1, 1]` at 16:9), `pp` reaches values like `(-4.56, -3)` at the bottom-left. `length(pp)/1.5 ≈ 3.6`, which extrapolates `mix()` to **negative** RGB. The GLSL post-processing then does `pow(linearRGB, 1/2.2)` on negative values, which is undefined (NaN). Most drivers display NaN as 0 → black pixels covering most of the screen. (The WGSL helper happened to clamp with `max(...,0)` before `pow`, so corners just go dark instead of NaN, but the same root cause applies.)
2. **The default ray direction is shoved off-axis by ~35°.** The `rd` fallback expression and the WGSL `infl_ic_default_rd` helper compute `2*forward + (2x − 1)*right + (2y − 1)*up` (still assuming `[0, 1]` input). With `$input.in.x = 0` at screen center, `2x − 1 = -1` → ray points 1 unit off-axis in both `right` and `up`, an ~35° offset, so the camera basically points away from the icosahedron. The shape only renders in a small region around `uv ≈ (0.64, 0.75)` (for 16:9), if at all.

A separate, smaller bug found while tracing this: the WGSL `infl_ic_p_r` rotation has a sign typo on the y component vs the GLSL original (`s*x − c*y` instead of `c*y − s*x`). It only manifests when `seamlessLoop = 1` (the default), and produces a different mod-polar layout from the GLSL/Shadertoy reference. Same node, same fix scope, so it's bundled in.

## Fix

All in three files; no graph data-model changes needed.

| File | Change |
| --- | --- |
| `src/shaders/nodes/inflated-icosahedron.ts` | (a) `rd` `fallbackExpression`: drop the `(2.0 * $input.in.x - 1.0)` / `(2.0 * $input.in.y - 1.0)` remaps and use `$input.in.x` / `$input.in.y` directly. (b) `mainCode`: replace `vec2 pp = 2.0 * $input.in - 1.0` with `vec2 pp = $input.in`. (c) `linearToScreenInflated`: clamp with `max(linearRGB, vec3(0.0))` before `pow` to mirror the WGSL helper and harden against future negatives. (d) `renderInflated`: clamp the gradient `mix()` factor with `clamp(length(pp)/1.5, 0.0, 1.0)` so wide aspect ratios can't extrapolate the color stops. |
| `src/shaders/compilation/inflatedIcosahedronMvpWgsl.ts` | Mirror of the above for WGSL: `infl_ic_default_rd` uses `uv.x`/`uv.y` directly; `inflated_icosahedron_standalone_pixel` sets `let pp = uv_screen`; the `mix()` factor is clamped; and `infl_ic_p_r` y-component is corrected to `c*y - s*x` to match the GLSL original. |
| `src/presets/inflated-icosahedron.json` | Replaced the stale preset (which actually contained a `sphere-raymarch` graph) with a real `uv-coordinates → inflated-icosahedron → final-output` graph using the node's defaults. The preset now both showcases the node and acts as a smoke test. |

## Verification

- `npx vitest run src/shaders/ src/presets/ src/data-model/` — **357 passed**, 1 skipped.
- WGSL MVP snapshot for `mvpInflatedIcosahedron` re-recorded (`src/shaders/__snapshots__/wgslMvpCompileSnapshots.test.ts.snap`); the diff matches the four intended changes above.
- `npm run build` (tsc + vite) — green.
- Manual visual check: loading the **Inflated Icosahedron** preset renders the expected blue-grey gradient with the rotating icosahedron centered in the frame on both backends.

## Key files (for future readers)

| File | Role |
| --- | --- |
| `src/shaders/nodes/inflated-icosahedron.ts` | GLSL node spec; was the canonical site of the double-remap bug. Defines ports, parameters, fallback expressions, and the per-pixel `mainCode` that gets templated into the fragment shader. |
| `src/shaders/compilation/inflatedIcosahedronMvpWgsl.ts` | WGSL standalone helper used by the WebGPU MVP backend. Mirrored the same coord bug plus its own `pR` sign typo. |
| `src/shaders/compilation/MainCodeGeneratorOutput.ts` | Owns the GLSL base template; defines `vec2 p = (uv * 2.0 - 1.0) * vec2(aspect, 1.0)` — i.e. the project-wide NDC convention that `UV Coords` exposes. |
| `src/shaders/compilation/WgslMvpCompiler.ts` | WGSL counterpart; case `'uv-coordinates'` builds the same aspect-corrected NDC, and case `'inflated-icosahedron'` calls `inflated_icosahedron_standalone_pixel` with that NDC `uv_screen`. |
| `src/shaders/nodes/sphere-raymarch.ts`, `src/shaders/nodes/orbit-camera.ts`, `src/shaders/nodes/look-at-camera.ts` | Reference for the convention: every other 3D node uses `$input.in` directly, with no further `2*x − 1` remap. |
| `src/data/node-documentation.json` (`"node:inflated-icosahedron"`) | In-app help that defines "as intended" usage (UV Coords → in, etc.); referenced by the repro above. |
| `src/presets/inflated-icosahedron.json` | The bundled preset; previously named for the icosahedron but actually using `sphere-raymarch`. |

## Background

ShaderNoice is a node-based shader editor with parallel WebGL (GLSL) and WebGPU (WGSL) compilation backends. Each shader node ships once as a TypeScript spec and once as a WGSL helper; both must agree on the meaning of the project's input ports. The `UV Coords` (a.k.a. `Screen position`) port is the most common ray-entry input and is the place where backend conventions are easiest to get wrong when porting external shader code.
