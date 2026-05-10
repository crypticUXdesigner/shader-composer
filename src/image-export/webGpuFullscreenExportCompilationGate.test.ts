/**
 * Ensures bundled presets that rely on bounded `generic-raymarcher` satisfy the same compiler gates
 * as `renderWebGpuExportRgba8` before any GPU work (see early returns around compile errors /
 * backend / supported in `WebGpuExportRenderPath.ts`).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it } from 'vitest';
import type { AudioSetup } from '../data-model/audioSetupTypes';
import type { NodeGraph } from '../data-model/types';
import {
  assertFullscreenExportWebGpuCompileGate,
  GENERIC_RAYMARCHER_FULLSCREEN_WEBGPU_EXPORT_PRESETS,
} from './fullscreenWebGpuExportCompilationGateAssertions';
import { NodeShaderCompiler } from '../shaders/NodeShaderCompiler';
import { nodeSystemSpecs } from '../shaders/nodes';
import type { NodeSpec } from '../types/nodeSpec';

function buildNodeSpecsMap(): Map<string, NodeSpec> {
  return new Map(nodeSystemSpecs.map((s) => [s.id, s]));
}

type PresetBundle = { graph: NodeGraph; audioSetup?: AudioSetup };

describe('WebGPU fullscreen image export compilation gate (generic-raymarcher presets)', () => {
  it.each(GENERIC_RAYMARCHER_FULLSCREEN_WEBGPU_EXPORT_PRESETS)('preset %s matches export compiler preconditions', (file) => {
    const compiler = new NodeShaderCompiler(buildNodeSpecsMap());
    const raw = readFileSync(join(process.cwd(), 'src', 'presets', file), 'utf8');
    const parsed = JSON.parse(raw) as PresetBundle;
    /** Match `runImageExportFlow`: compiler receives panel `audioSetup` when the preset bundles it. */
    const compilation = compiler.compile(structuredClone(parsed.graph), parsed.audioSetup ?? null, {
      backend: 'webgpu',
    });
    assertFullscreenExportWebGpuCompileGate(compilation, file);
  });
});
