/**
 * Mirrors `createWebGpuVideoExportRenderPath` fullscreen WGSL prerequisites (before `webgpuPassPlan`),
 * identical to the still-export gate (`webGpuFullscreenExportCompilationGate.test.ts`).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it } from 'vitest';
import type { AudioSetup } from '../data-model/audioSetupTypes';
import type { NodeGraph } from '../data-model/types';
import {
  assertFullscreenExportWebGpuCompileGate,
  GENERIC_RAYMARCHER_FULLSCREEN_WEBGPU_EXPORT_PRESETS,
} from '../image-export/fullscreenWebGpuExportCompilationGateAssertions';
import { NodeShaderCompiler } from '../shaders/NodeShaderCompiler';
import { nodeSystemSpecs } from '../shaders/nodes';
import type { NodeSpec } from '../types/nodeSpec';

function buildNodeSpecsMap(): Map<string, NodeSpec> {
  return new Map(nodeSystemSpecs.map((s) => [s.id, s]));
}

type PresetBundle = { graph: NodeGraph; audioSetup?: AudioSetup };

describe('WebGPU fullscreen video export compilation gate (generic-raymarcher presets)', () => {
  it.each(GENERIC_RAYMARCHER_FULLSCREEN_WEBGPU_EXPORT_PRESETS)(
    'preset %s matches video export compiler preconditions',
    (file) => {
      const compiler = new NodeShaderCompiler(buildNodeSpecsMap());
      const raw = readFileSync(join(process.cwd(), 'src', 'presets', file), 'utf8');
      const parsed = JSON.parse(raw) as PresetBundle;
      /** Match `runVideoExportFlow`: `createWebGpuVideoExportRenderPath(..., audioSetup, ...)` compiles with the same audio setup when bundled. */
      const compilation = compiler.compile(structuredClone(parsed.graph), parsed.audioSetup ?? null, {
        backend: 'webgpu',
      });
      assertFullscreenExportWebGpuCompileGate(compilation, file);
    }
  );
});
