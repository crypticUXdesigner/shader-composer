import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { NodeShaderCompiler } from '../src/shaders/NodeShaderCompiler';
import { nodeSystemSpecs } from '../src/shaders/nodes';
import type { AudioSetup } from '../src/data-model/audioSetupTypes';
import type { NodeGraph } from '../src/data-model/types';
import type { NodeSpec } from '../src/types/nodeSpec';

function buildNodeSpecsMap(): Map<string, NodeSpec> {
  return new Map(nodeSystemSpecs.map((s) => [s.id, s]));
}

type PresetFile = { graph: NodeGraph; audioSetup?: AudioSetup };

const presetsDir = join(process.cwd(), 'src', 'presets');
const files = readdirSync(presetsDir)
  .filter((f) => f.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b));

const compiler = new NodeShaderCompiler(buildNodeSpecsMap());

const results = files.map((file) => {
  const raw = readFileSync(join(presetsDir, file), 'utf8');
  const parsed = JSON.parse(raw) as PresetFile;
  const graph = structuredClone(parsed.graph);
  const audioSetup = parsed.audioSetup ?? null;
  const result = compiler.compile(graph, audioSetup, { backend: 'webgpu' });
  const errors = result.metadata.errors;
  /** True WGSL-supported preset: identical spirit to export’s first-stage gate (`WebGpuExportRenderPath`). */
  const webGpuMvp =
    result.backend === 'webgpu' && result.supported && errors.length === 0;
  return {
    file,
    supported: webGpuMvp,
    errors,
    reasons: result.unsupportedReasons ?? [],
  };
});

for (const r of results) {
  const status = r.supported ? 'OK' : 'FALLBACK';
  const tail =
    r.supported ? '' : ` reasons=${JSON.stringify(r.reasons)} errors=${JSON.stringify(r.errors)}`;
  // eslint-disable-next-line no-console
  console.log(`${status} ${r.file}${tail}`);
}

const ok = results.filter((r) => r.supported).length;
const bad = results.length - ok;
// eslint-disable-next-line no-console
console.log(`\nSummary: ${ok}/${results.length} supported, ${bad} fallback`);
