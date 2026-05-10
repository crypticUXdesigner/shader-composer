# WGSL coverage ledger (post-05)

This ledger is the coordination surface for Phase 2+ WGSL coverage work. It answers:

- What node types are WGSL-supported today?
- If a graph falls back to WebGL, why?
- Which nodes should move to multi-pass or compute (frame graph) instead of staying fullscreen inline?

## Maintenance

Rebuild this file whenever `nodeSystemSpecs` or the WGSL MVP allowlist changes:

```
npx tsx scripts/generate-wgsl-coverage-ledger-table.ts --write-doc
```

The **supported / supported (pass plan)** rows derive from `WGSL_SUPPORTED_NODE_TYPES` and `WGSL_WEBGPU_PASS_PLAN_NODE_TYPES` in `src/shaders/compilation/WgslMvpCompiler.ts`. The **Class** column uses the heuristics embedded in `scripts/generate-wgsl-coverage-ledger-table.ts` (adjust there, then regenerate).

## Status legend

- **supported**: node type is in the WGSL MVP allowlist (`WGSL_SUPPORTED_NODE_TYPES`) and participates in WGSL codegen for fullscreen preview.
- **supported (pass plan)**: node type drives `CompilationResult.webgpuPassPlan` (`WGSL_WEBGPU_PASS_PLAN_NODE_TYPES` in `WgslMvpCompiler.ts`); not counted as fullscreen MVP coverage. Today: `pass.blur.gaussian-separable.v1`, `pass.glow-bloom.v1`, `pass.bokeh.v1`, `pass.crepuscular-rays.v1`.
- **planned**: reserved for conversions that are agreed but not landed (prefer updating the MVP set + parity tests first, then rerun `--write-doc`).
- **unsupported**: not in MVP; graph compilation for WebGPU reports failure and runtime falls back to WebGL where configured.

## Classification legend

- **inline**: expected to compile into the single fullscreen WGSL shader (eventually).
- **render-pass**: depends on intermediate surfaces / multipass sampling (blur-like, separation, some convolutions).
- **compute-pass**: history, ping-pong, or workloads better expressed as compute (e.g. particles).
- **research**: needs design or parity investigation before committing to inline vs pass graph (heavy raymarch/SDF, ambiguous derivative behavior, perf).

## Conversion guidelines

- **Do** grow coverage with small batches, each with compile snapshots and at least one golden fixture when behavior is non-trivial.
- **Do** keep fallback reasons explicit and stable (see *Fallback rules*); users and support should not have to guess.
- **Do not** force complex nodes into inline WGSL when the plan is task 09/10 (frame graph / compute); tag them as **render-pass** or **compute-pass** and schedule infrastructure first.
- **Do not** change `src/data-model/` schema for shader coverage; coverage is a compiler/runtime concern.

## Fallback rules (runtime + compiler)

Today, `WgslMvpCompiler` marks a graph unsupported when any reachable node type is outside the MVP allowlist. Reasons look like:

- `unsupported node type: <id>` (one entry per distinct unsupported type, sorted)

Structural failures (also unsupported, no WGSL):

- `missing final-output node`
- `final-output.in is not connected`
- `could not resolve output expression`

Aspirational / future stable codes (use when introducing new failure modes):

- `wgsl.unsupported.node:<id>`
- `wgsl.unsupported.feature:derivatives`
- `wgsl.unsupported.feature:textureSampling`
- `wgsl.unimplemented`

## Next conversion batches (suggested)

Sized for one-session PRs; reorder as product needs.

| Batch | Focus | Initial node targets |
| --- | --- | --- |
| 06A | Core math | `subtract`, `divide`, `sine`, `cosine`, `smoothstep`, `step`, `min`, `max`, `fract`, `absolute` |
| 06B | Utilities | `lerp`, `saturate`, `clamp-01`, `one-minus`, `negate` |
| 06C | Vector basics | `dot-product`, `length`, `normalize`, `distance` |
| 06D | Inputs | `fragment-coordinates`, `oscillator-2d` (confirm uniform/param parity with MVP) |
| 06E | Noise entry | `noise` (expect derivatives/perf review; may stay **research** until rules are clear) |

## Node coverage

| Node id | Status | Class | Notes / blockers |
| --- | --- | --- | --- |
| `absolute` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `add` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `arc-cosine` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `arc-sine` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `arc-tangent` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `arc-tangent-2` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `bayer-dither` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `bezier-curve` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `blend-color` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `blend-mode` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `bloom-sphere` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `blur` | supported (pass plan) | render-pass | WebGPU preview/export via `CompilationResult.webgpuPassPlan` (not in fullscreen MVP allowlist). Today: `pass.blur.gaussian-separable.v1`, `pass.glow-bloom.v1`, `pass.bokeh.v1`, `pass.crepuscular-rays.v1`. |
| `bokeh` | supported (pass plan) | render-pass | WebGPU preview/export via `CompilationResult.webgpuPassPlan` (not in fullscreen MVP allowlist). Today: `pass.blur.gaussian-separable.v1`, `pass.glow-bloom.v1`, `pass.bokeh.v1`, `pass.crepuscular-rays.v1`. |
| `bokeh-point` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `box-torus-sdf` | supported | inline | WGSL MVP: `boxTorusSceneSdf_distance` / `BoxTorusSdfSceneParams` primitives parity with `sceneSDF` in node GLSL; standalone `boxTorusSdf_standalone_pixel` (raymarch + lighting Cook-Torrance path); `generic-raymarcher.sdf` allow-list. |
| `brick-tiling` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `ceil` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `chromatic-aberration` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `clamp` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `clamp-01` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `color-grading` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `color-map` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `combine-vector` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `compare` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `constant-float` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `constant-vec2` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `constant-vec3` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `constant-vec4` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `cosine` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `crepuscular-rays` | supported (pass plan) | render-pass | WebGPU preview/export via `CompilationResult.webgpuPassPlan` (not in fullscreen MVP allowlist). Today: `pass.blur.gaussian-separable.v1`, `pass.glow-bloom.v1`, `pass.bokeh.v1`, `pass.crepuscular-rays.v1`. |
| `cross-product` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `cubic-curl-noise` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `disco-pattern` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `displace` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `displacement-3d` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `distance` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `divide` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `dot-product` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `dots` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `drive-home-lights` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `edge-detection` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `ether-sdf` | supported | inline | WGSL MVP inline distance (`etherSdfMap`); `generic-raymarcher.sdf` pilot allow-list (samples at marching `posDisplaced`). |
| `exponential` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `final-output` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `floor` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `flow-field-pattern` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `fract` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `fractal` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `fragment-coordinates` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `generic-raymarcher` | supported | inline | WGSL MVP pilot: sdf allow-list mandelbulb-sdf + julia-slab-sdf + mandelbox-sdf + menger-sponge-sdf + sierpinski-tetra-sdf + hex-prism-sdf + repeated-hex-prism-sdf + radial-repeat-sdf + ether-sdf + kifs-sdf + metaballs + box-torus-sdf + sphere-raymarch (`GENERIC_RAYMARCHER_WEBGPU_MVP_SDF_TYPES`; sphere-raymarch uses bounded `sphereRaymarch_implicit_distance_for_grm` adapter — spatial terms aligned with standalone loop with frozen prior marching `d=1`). Bounded loop ≤200 steps; optional `displacement-3d` only (samples at marching `pos`, GLSL MVP parity). |
| `glass-shell` | supported | inline | Fullscreen WGSL: two-shell ray march (≤128 × 128 max steps capped by params outerSteps/innerSteps 10–128), Snell refract + inner SDF; Cook-Torrance / Phong paths align with node GLSL. Not formally golden-vs-WebGL parity (research-grade visual fidelity). |
| `glow-bloom` | supported (pass plan) | render-pass | WebGPU preview/export via `CompilationResult.webgpuPassPlan` (not in fullscreen MVP allowlist). Today: `pass.blur.gaussian-separable.v1`, `pass.glow-bloom.v1`, `pass.bokeh.v1`, `pass.crepuscular-rays.v1`. |
| `gradient` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `hash32` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `hex-prism-sdf` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `hexagonal-grid` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `infinite-zoom` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `inflated-icosahedron` | supported | inline | Fullscreen WGSL: `inflated_icosahedron_standalone_pixel` ports `inflated-icosahedron.ts` SDF/folding/twist/lighting path with the same fixed caps as GLSL (primary march loop ≤100 iterations; shadow ≤16; AO ≤5; trace distance 30). User `raymarchSteps` clamps [32,150] but cannot exceed the 100-step loop bound (matches node GLSL). Not golden-tested vs WebGL. |
| `iridescent-tunnel` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `iterated-inversion` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `julia-slab-sdf` | supported | inline | WGSL MVP inline distance (`julia_sl_*` kernels); parity with node GLSL. |
| `kaleidoscope` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `kifs-sdf` | supported | inline | WGSL MVP inline distance (`kifs_sdf_distance`); iterated KIFS parity with node GLSL (`p * rot` → `transpose(rot) * p`); `generic-raymarcher.sdf` pilot allow-list. |
| `length` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `lerp` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `lighting-shading` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `look-at-camera` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `mandelbox-sdf` | supported | inline | WGSL MVP inline distance (`mandelbox_sdf_distance`); row-vector parity via transpose on rotation. |
| `mandelbulb-sdf` | supported | inline | WGSL MVP inline distance (`mandelbulbSdf_distance`); bounded generic-raymarcher sdf pilot. |
| `mask-composite-float` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `mask-composite-vec3` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `max` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `menger-sponge-sdf` | supported | inline | WGSL MVP inline distance (`mer_sponge_distance`). |
| `metaballs` | supported | inline | WGSL MVP: standalone raymarch parity with `metaballs.ts`; implicit field SDF for `generic-raymarcher.sdf` (`metaballsWgsl_implicit_sdf`). |
| `min` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `mirror-flip` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `mix` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `mixed-wave-signal` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `modulo` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `multiply` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `natural-logarithm` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `negate` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `noise` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `normal-mapping` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `normalize` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `oklch-color` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `oklch-color-map-bezier` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `oklch-color-map-threshold` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `one-minus` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `orbit-camera` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `oscillator-2d` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `particle-system` | supported | inline | Fullscreen WGSL: procedural particle field (neighbor grid + hashed cell positions); matches fragment GLSL `particle-system`; not GPU particle buffers (see task 10 for compute-style particles if needed later). |
| `plane-grid` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `polar-coordinates` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `power` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `quad-warp` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `radial-pulse` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `radial-rays` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `radial-repeat-sdf` | supported | inline | WGSL MVP distance (`radialRepeatSdf_distance`); `generic-raymarcher.sdf` pilot allow-list. |
| `radial-uv-warp` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `rain-drops` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `reciprocal` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `reflect` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `refract` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `repeated-hex-prism-sdf` | supported | inline | WGSL MVP distance (`repeatedHexPrismSdf_distance`); `generic-raymarcher.sdf` pilot allow-list. |
| `resolution` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `rgb-separation` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `rings` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `ripple` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `rotate` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `round` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `saturate` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `scale` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `scanlines` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `select` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `shapes-2d` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `sierpinski-tetra-sdf` | supported | inline | WGSL MVP inline distance (`ster_tetra_distance`). |
| `sign` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `sine` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `sky-dome` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `smoothstep` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `sphere-raymarch` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `spherical-fibonacci` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `split-vector` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `square-root` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `star-shape-2d` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `step` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `streak` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `stripes` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `subtract` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `swizzle` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `tangent` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `time` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `tone-mapping` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `triangle-grid` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `truncate` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `turbulence` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `uv-coordinates` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `vector-field` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `volume-rays` | supported | inline | Fullscreen WGSL: bounded ray march (≤128 steps) with cell-noise density; aligns with node GLSL `volume-rays.ts` MVP. |
| `voronoi-noise` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `vortex` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
| `warp-terrain` | supported | inline | WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`. |
