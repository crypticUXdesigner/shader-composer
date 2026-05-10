/**
 * WGSL coverage ledger generator for `docs/implementation/webgpu-migration/wgsl-coverage-ledger.md`.
 *
 * Usage:
 *   npx tsx scripts/generate-wgsl-coverage-ledger-table.ts              # print table (markdown) to stdout
 *   npx tsx scripts/generate-wgsl-coverage-ledger-table.ts --write-doc  # rewrite full ledger file (UTF-8)
 *
 * Keep `MVP` in sync with `WGSL_SUPPORTED_NODE_TYPES` in `src/shaders/compilation/WgslMvpCompiler.ts`.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nodeSystemSpecs } from '../src/shaders/nodes/index';
import {
  WGSL_SUPPORTED_NODE_TYPES,
  WGSL_WEBGPU_PASS_PLAN_NODE_TYPES
} from '../src/shaders/compilation/WgslMvpCompiler';

const MVP = WGSL_SUPPORTED_NODE_TYPES;
const PASS_PLAN = WGSL_WEBGPU_PASS_PLAN_NODE_TYPES;

const COMPUTE_PASS = new Set<string>([]);
const RENDER_PASS = new Set([
  'blur',
  'glow-bloom',
  'bokeh',
  'edge-detection',
  'chromatic-aberration',
  'rgb-separation',
  'crepuscular-rays',
]);
const RESEARCH = new Set([
  'ether-sdf',
  'hex-prism-sdf',
  'radial-repeat-sdf',
  'repeated-hex-prism-sdf',
  'displacement-3d',
]);

/** Notes for fullscreen MVP rows that need more nuance than the default allow-list blurb. */
const MVP_INLINE_NOTE_OVERRIDES: Partial<Record<string, string>> = {
  'generic-raymarcher':
    'WGSL MVP pilot: sdf allow-list mandelbulb-sdf + julia-slab-sdf + mandelbox-sdf + menger-sponge-sdf + sierpinski-tetra-sdf + hex-prism-sdf + repeated-hex-prism-sdf + radial-repeat-sdf + ether-sdf + kifs-sdf + metaballs + box-torus-sdf + sphere-raymarch (`GENERIC_RAYMARCHER_WEBGPU_MVP_SDF_TYPES`; sphere-raymarch uses bounded `sphereRaymarch_implicit_distance_for_grm` adapter — spatial terms aligned with standalone loop with frozen prior marching `d=1`). Bounded loop ≤200 steps; optional `displacement-3d` only (samples at marching `pos`, GLSL MVP parity).',
  'mandelbulb-sdf':
    'WGSL MVP inline distance (`mandelbulbSdf_distance`); bounded generic-raymarcher sdf pilot.',
  'julia-slab-sdf':
    'WGSL MVP inline distance (`julia_sl_*` kernels); parity with node GLSL.',
  'mandelbox-sdf':
    'WGSL MVP inline distance (`mandelbox_sdf_distance`); row-vector parity via transpose on rotation.',
  'menger-sponge-sdf':
    'WGSL MVP inline distance (`mer_sponge_distance`).',
  'sierpinski-tetra-sdf':
    'WGSL MVP inline distance (`ster_tetra_distance`).',
  'metaballs':
    'WGSL MVP: standalone raymarch parity with `metaballs.ts`; implicit field SDF for `generic-raymarcher.sdf` (`metaballsWgsl_implicit_sdf`).',
  'repeated-hex-prism-sdf':
    'WGSL MVP distance (`repeatedHexPrismSdf_distance`); `generic-raymarcher.sdf` pilot allow-list.',
  'radial-repeat-sdf':
    'WGSL MVP distance (`radialRepeatSdf_distance`); `generic-raymarcher.sdf` pilot allow-list.',
  'ether-sdf':
    'WGSL MVP inline distance (`etherSdfMap`); `generic-raymarcher.sdf` pilot allow-list (samples at marching `posDisplaced`).',
  'kifs-sdf':
    'WGSL MVP inline distance (`kifs_sdf_distance`); iterated KIFS parity with node GLSL (`p * rot` → `transpose(rot) * p`); `generic-raymarcher.sdf` pilot allow-list.',
  'box-torus-sdf':
    'WGSL MVP: `boxTorusSceneSdf_distance` / `BoxTorusSdfSceneParams` primitives parity with `sceneSDF` in node GLSL; standalone `boxTorusSdf_standalone_pixel` (raymarch + lighting Cook-Torrance path); `generic-raymarcher.sdf` allow-list.',
  'particle-system':
    'Fullscreen WGSL: procedural particle field (neighbor grid + hashed cell positions); matches fragment GLSL `particle-system`; not GPU particle buffers (see task 10 for compute-style particles if needed later).',
  'volume-rays':
    'Fullscreen WGSL: bounded ray march (≤128 steps) with cell-noise density; aligns with node GLSL `volume-rays.ts` MVP.',
  'glass-shell':
    'Fullscreen WGSL: two-shell ray march (≤128 × 128 max steps capped by params outerSteps/innerSteps 10–128), Snell refract + inner SDF; Cook-Torrance / Phong paths align with node GLSL. Not formally golden-vs-WebGL parity (research-grade visual fidelity).',
  'inflated-icosahedron':
    'Fullscreen WGSL: `inflated_icosahedron_standalone_pixel` ports `inflated-icosahedron.ts` SDF/folding/twist/lighting path with the same fixed caps as GLSL (primary march loop ≤100 iterations; shadow ≤16; AO ≤5; trace distance 30). User `raymarchSteps` clamps [32,150] but cannot exceed the 100-step loop bound (matches node GLSL). Not golden-tested vs WebGL.',
};

const UNSTABLE_RESEARCH_NOTES: Partial<Record<string, string>> = {};

function classify(id: string): string {
  if (RESEARCH.has(id)) return 'research';
  if (COMPUTE_PASS.has(id)) return 'compute-pass';
  if (RENDER_PASS.has(id)) return 'render-pass';
  return 'inline';
}

function buildTable(): string {
  const ids = [...new Set(nodeSystemSpecs.map((s) => s.id))].sort();
  const lines: string[] = [
    '| Node id | Status | Class | Notes / blockers |',
    '| --- | --- | --- | --- |',
  ];
  for (const id of ids) {
    const mvpInline = MVP.has(id);
    const passPlanImplemented = PASS_PLAN.has(id);

    let status: string;
    let cls: string;
    let notes: string;

    if (mvpInline) {
      status = 'supported';
      cls = 'inline';
      notes =
        MVP_INLINE_NOTE_OVERRIDES[id] ??
        'WGSL MVP; keep in sync with `WGSL_SUPPORTED_NODE_TYPES` in `WgslMvpCompiler.ts`.';
    } else if (passPlanImplemented) {
      status = 'supported (pass plan)';
      cls = classify(id);
      notes =
        'WebGPU preview/export via `CompilationResult.webgpuPassPlan` (not in fullscreen MVP allowlist). Today: `pass.blur.gaussian-separable.v1`, `pass.glow-bloom.v1`, `pass.bokeh.v1`, `pass.crepuscular-rays.v1`.';
    } else {
      status = 'unsupported';
      cls = classify(id);
      notes = 'Outside MVP set; WebGL fallback when preview/export uses WebGPU path.';
    }

    if (cls === 'research' && status === 'unsupported') {
      const unstable = UNSTABLE_RESEARCH_NOTES[id];
      if (unstable) {
        status = 'unstable (research)';
        notes = unstable;
      }
    }
    lines.push(`| \`${id}\` | ${status} | ${cls} | ${notes} |`);
  }
  return `${lines.join('\n')}\n`;
}

function buildFullDoc(table: string): string {
  return `# WGSL coverage ledger (post-05)

This ledger is the coordination surface for Phase 2+ WGSL coverage work. It answers:

- What node types are WGSL-supported today?
- If a graph falls back to WebGL, why?
- Which nodes should move to multi-pass or compute (frame graph) instead of staying fullscreen inline?

## Maintenance

Rebuild this file whenever \`nodeSystemSpecs\` or the WGSL MVP allowlist changes:

\`\`\`
npx tsx scripts/generate-wgsl-coverage-ledger-table.ts --write-doc
\`\`\`

The **supported / supported (pass plan)** rows derive from \`WGSL_SUPPORTED_NODE_TYPES\` and \`WGSL_WEBGPU_PASS_PLAN_NODE_TYPES\` in \`src/shaders/compilation/WgslMvpCompiler.ts\`. The **Class** column uses the heuristics embedded in \`scripts/generate-wgsl-coverage-ledger-table.ts\` (adjust there, then regenerate).

## Status legend

- **supported**: node type is in the WGSL MVP allowlist (\`WGSL_SUPPORTED_NODE_TYPES\`) and participates in WGSL codegen for fullscreen preview.
- **supported (pass plan)**: node type drives \`CompilationResult.webgpuPassPlan\` (\`WGSL_WEBGPU_PASS_PLAN_NODE_TYPES\` in \`WgslMvpCompiler.ts\`); not counted as fullscreen MVP coverage. Today: \`pass.blur.gaussian-separable.v1\`, \`pass.glow-bloom.v1\`, \`pass.bokeh.v1\`, \`pass.crepuscular-rays.v1\`.
- **planned**: reserved for conversions that are agreed but not landed (prefer updating the MVP set + parity tests first, then rerun \`--write-doc\`).
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
- **Do not** change \`src/data-model/\` schema for shader coverage; coverage is a compiler/runtime concern.

## Fallback rules (runtime + compiler)

Today, \`WgslMvpCompiler\` marks a graph unsupported when any reachable node type is outside the MVP allowlist. Reasons look like:

- \`unsupported node type: <id>\` (one entry per distinct unsupported type, sorted)

Structural failures (also unsupported, no WGSL):

- \`missing final-output node\`
- \`final-output.in is not connected\`
- \`could not resolve output expression\`

Aspirational / future stable codes (use when introducing new failure modes):

- \`wgsl.unsupported.node:<id>\`
- \`wgsl.unsupported.feature:derivatives\`
- \`wgsl.unsupported.feature:textureSampling\`
- \`wgsl.unimplemented\`

## Next conversion batches (suggested)

Sized for one-session PRs; reorder as product needs.

| Batch | Focus | Initial node targets |
| --- | --- | --- |
| 06A | Core math | \`subtract\`, \`divide\`, \`sine\`, \`cosine\`, \`smoothstep\`, \`step\`, \`min\`, \`max\`, \`fract\`, \`absolute\` |
| 06B | Utilities | \`lerp\`, \`saturate\`, \`clamp-01\`, \`one-minus\`, \`negate\` |
| 06C | Vector basics | \`dot-product\`, \`length\`, \`normalize\`, \`distance\` |
| 06D | Inputs | \`fragment-coordinates\`, \`oscillator-2d\` (confirm uniform/param parity with MVP) |
| 06E | Noise entry | \`noise\` (expect derivatives/perf review; may stay **research** until rules are clear) |

## Node coverage

${table}`;
}

const table = buildTable();
const writeDoc = process.argv.includes('--write-doc');
if (writeDoc) {
  const ledgerPath = join(
    process.cwd(),
    'docs/implementation/webgpu-migration/wgsl-coverage-ledger.md'
  );
  writeFileSync(ledgerPath, buildFullDoc(table), 'utf8');
} else {
  const dest = process.argv[2];
  if (dest) {
    writeFileSync(dest, table, 'utf8');
  } else {
    process.stdout.write(table);
  }
}
