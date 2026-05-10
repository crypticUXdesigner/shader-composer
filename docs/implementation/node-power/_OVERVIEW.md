# Node Power (per-node bypass / power button)

## Mission

Add a per-node **Power** toggle — a serialized node setting that, when off, removes the node's contribution from the compiled shader. Two **global, deterministic rules** decide what "off" means based on the node's spec — no per-node behavior annotation needed.

## Why this work package exists

Users want fast **A/B comparison** of effects in their pipeline ("what does this look like without this node?") without losing the node, its parameters, its connections, or its position. Today the only options are *delete and recreate*, *disconnect by hand*, or *zero out a key parameter* — all destructive or fragile.

This is the same affordance every DAW provides as a per-plugin **bypass / power** button. The shader graph is heterogeneous so the affordance can't be universal, but the architecture (immutable graph, single compile pass, deterministic spec → GLSL) makes a clean implementation cheap.

## Product goals

- **A/B in one click.** Click Power on any eligible node → preview updates as if that node's effect were absent. Click again → restored. State is visible on the node and survives reload.
- **Predictable rules, no hidden per-node behavior.** Two global rules cover every eligible node. No per-node "bypass quirk" knowledge required from the user.
- **Reuse existing fallback semantics.** When a node is "off" but isn't a passthrough, the consumer's existing fallback (the same defaults used when nothing is wired) takes over. Bypass is therefore *compositional*: powering off a node looks identical to never having connected it.
- **Survives presets, copy/paste, undo, export.** Power is a serialized node setting like `label` or `position`.

## Non-goals (initial package)

- Powering off **subgraphs** (groups), **connections**, or **parameters** — node-only.
- A keyboard shortcut to toggle power on the selection — defer to follow-up if the icon button proves the UX.
- Animating bypass via the timeline — defer.
- Per-node opt-in annotations on `NodeSpec` (e.g. explicit `bypassPrimaryInput`) — out of scope; **convention is "first input is main, first output is main"** (matches every node we surveyed).
- Visual ghost-wire reroute on the canvas with full pathfinding — task 04 ships *minimum viable visual feedback*; richer visualization is a follow-up.

## The two rules

These rules are evaluated **only at compile time**. Power is purely declarative on `NodeInstance`; the graph topology is unchanged on toggle.

**Rule A — Passthrough.** Node has at least one input AND `inputs[0].type === outputs[0].type` → bypassed node emits `out = in` (with type-identity since types match). Secondary inputs (and their upstream subgraphs, *for this consumer's path*) are ignored.

**Rule B — Disconnect.** Node has no inputs OR `inputs[0].type !== outputs[0].type` → bypassed node behaves as if **none of its outgoing wires existed**. Each consumer falls back to its own existing `fallbackParameter` / `fallbackExpression` / port default — the same code path that runs when nothing is wired today.

In both cases, bypassed nodes contribute **no GPU code** (dropped from `executionOrder`).

## Eligibility (categories that get the Power button)

Determined by `NodeSpec.category`:

| Eligible | Excluded |
| --- | --- |
| **Distort** (rotate, scale, vortex, ripple, mirror‑flip, kaleidoscope, polar, vector‑field, turbulence, twist, displace, quad‑warp, brick‑tiling, infinite‑zoom, radial‑uv‑warp) | **Math** (add, subtract, multiply, divide, power, sqrt, abs, sine, cos, length, …) |
| **Effects / Post-Processing** (blur, glow‑bloom, bokeh, edge‑detection, chromatic‑aberration, rgb‑separation, scanlines, color‑grading, normal‑mapping, lighting‑shading, tone‑mapping, blending‑modes) | **Utility** (one‑minus, negate, reciprocal, saturate, sign, swizzle, split‑vector, combine‑vector, hash32, lerp) |
| **Blend** (`blend-mode`) | **Masking / Control** (compare, select, mask‑composite‑\*) — semantics of bypass on `select` are ambiguous; defer |
| **Inputs** (UV, Time, Resolution, Constant\*, OrbitCamera, LookAtCamera, Mixed‑Wave, 2D‑Oscillator, Bezier, OKLCH color) | **Output** (`final-output`) |
| **Patterns** (noise, voronoi, rings, gradient, stripes, dots, hex‑grid, triangle‑grid, particle, rain‑drops, radial‑pulse, flow‑field, warp‑terrain, cubic‑curl, disco, streak, radial‑rays, crepuscular‑rays, volume‑rays) | |
| **Shapes / SDF** (sphere, hex‑prism, box‑torus, kifs, mandelbox, menger, sierpinski, julia‑slab, mandelbulb, etc.) | |
| **Color System** (color‑map, oklch‑color‑map‑bezier, oklch‑color‑map‑threshold, bayer‑dither) | |

The implementation must derive eligibility from `category` (an allowlist), not by enumerating node ids.

## Work items

| ID | Task | Status | Provides | Blocks |
| --- | --- | --- | --- | --- |
| 01 | [Data model + serialization](./01-data-model-node-power.md) | ✅ 2026-05-10 — `bypassed` on `NodeInstance`, `setNodeBypassed` + `graphStore.setNodeBypassed`, tests in `nodePower.test.ts` | `bypassed?: boolean` on `NodeInstance`, `setNodeBypassed` immutable update, store action, undo-safe round-trip | 02 |
| 02 | [Eligibility policy](./02-eligibility-policy-node-power.md) | ✅ 2026-05-10 — `src/shaders/nodePower.ts` + `nodePower.test.ts` (inline-snapshot of eligible ids; allowlist aligned to actual category strings — color-system nodes already live under `Inputs`/`Effects`/`Blend`, so no separate `Color` category was needed) | `nodeSupportsPower(spec)` shared helper + `nodePowerRule(spec): 'A' \| 'B' \| 'none'` | 03A, 03B |
| 03A | [Compiler: passthrough + disconnect](./03A-compiler-passthrough-disconnect-node-power.md) | ✅ 2026-05-10 — `src/shaders/compilation/CompileGraphView.ts` (Rule A approach (a): rewrite consumer wires to upstream source, walk Rule-A chains with guard, drop Rule-B sources; both rules drop bypassed nodes from `executionOrder`); plumbed through `NodeShaderCompiler` (GLSL + WGSL MVP), `MainCodeGenerator(Declarations)`, `FunctionGenerator`, `previewDependencyMask`; structural recompile triggered via `GraphChangeDetector` + `hashGraph`; tests `nodePower.compile.test.ts` (Rule A passthrough, Rule B generator + pattern, idempotency, all-bypassed chain) and bypass fixtures in `wgslMvpCompileSnapshots` (`mvpBypassRuleARotate`, `mvpBypassRuleBNoise`); pre-existing snapshots byte-identical for non-bypassed graphs | Bypassed nodes affect compiled GLSL/WGSL output per the two rules; bypassed nodes drop out of execution order | 04, 05, 06 |
| 03B | [UI: Power button on NodeHeader](./03B-power-button-ui-node-power.md) | ✅ 2026-05-10 — `NodeHeader.svelte` (`power` icon, `nodeSupportsPower`, `onPowerToggle` → `graphStore.setNodeBypassed`), wired via `DomNodeLayer` / `NodeEditorCanvasWrapper`; `NodeHeader.stories.ts` args | Phosphor `power` icon button on eligible nodes; click toggles via store action | 04, 05 |
| 04 | [UI: bypassed visual state](./04-bypassed-visual-state-node-power.md) | ✅ 2026-05-10 — `.is-bypassed` dims `.node-body`; outgoing wires from bypassed sources dimmed in `ConnectionLayerRenderer` + `ParameterConnectionLayerRenderer` (slice **a** — opacity × `--opacity-disabled`) | Dimmed node + minimal signal-path hint; eligible-but-disabled affordances are calm | 05 |
| 05 | [Documentation](./05-documentation-node-power.md) | ✅ 2026-05-10 — `docs/user-goals/04-nodes-and-parameters.md`, `preview-and-recompilation.md`, `graph-and-platform-boundaries.md`; skipped `node-documentation.json` (node-only entries; feature described in user-goals) | `docs/user-goals/04-nodes-and-parameters.md` updated; `docs/architecture/preview-and-recompilation.md` mentions structural recompile on toggle | — |
| 06 | [Export parity](./06-export-parity-node-power.md) | ✅ 2026-05-10 — `nodePowerBypassExportCompilationGate*.test.ts` (image + video) + `nodePowerBypassExportCompilationGateAssertions.ts`; Rule B fixture uses WGSL-MVP `noise` bypass chain (not raymarcher) so `supported: true` in CI; mirrors `webGpuFullscreenExportCompilationGate.test.ts` / `webGpuFullscreenVideoExportCompilationGate.test.ts` style | Bypass survives still + video export (same compile path); compile gate test confirms | — |

**Export parity / Vitest note:** `src/utils/phosphor-icons-loader.ts` now imports `public/phosphor-*.json` via **project-relative** paths so Vitest can resolve bundled presets without root-URL `file:///…` failures.

## Success criteria

- Toggling Power on an eligible node visibly removes/restores its contribution to the preview.
- Saving and reloading a preset preserves Power state for every node.
- Undo/redo restores Power state.
- Image and video export honor Power state identically to the preview.
- The Power button appears **only** on nodes whose category is in the eligibility allowlist; non-eligible nodes have no UI affordance.
- No regressions in the existing compile snapshot tests for non-bypassed graphs.
- Compile snapshot coverage exists for at least one Rule A node (e.g. `rotate` or `blur`) and one Rule B node (e.g. `noise` or `orbit-camera`) bypassed.

## How to read "Blocks"

**Blocks** is *release / safety gating*, not a ban on speculative parallel work. 03A and 03B can be developed in parallel after 02 lands; 04 needs 03B's button to exist before it ships polish; 05 and 06 only need 03A's behavior to exist.

## Notes

- **Vitest + Svelte `mount`:** `vite.config.ts` sets `resolve.conditions` so `svelte` resolves to the **client** entry during tests; otherwise `mount`/`unmount` throw `lifecycle_function_unavailable` in Vitest. UI coverage: `src/lib/components/node/NodeHeader.power.test.ts`, `Node.bypass-visual.test.ts` (happy-dom).
- Power is **declarative on `NodeInstance`**, not a graph mutation. Toggling it is a structural change → triggers **full recompile** (same path as adding/removing a wire), not a uniform-only update. This is intentional and documented in task 05.
- Wire fan-out is fine: a Rule B bypassed node may have many consumers; each falls back independently using its own port defaults.
- Parameter-target wires *into* a bypassed node still cause their source nodes to be evaluated/uniformed if other consumers need them; the bypassed node simply doesn't read them. The compiler's existing topo + uniform layout handles this with no special case.
