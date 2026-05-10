/**
 * Mirrors WebGPU video export: same `compiler.compile(..., { backend: 'webgpu' })` entry as still export
 * (`createWebGpuVideoExportRenderPath`). Duplicates the gate in `nodePowerBypassExportCompilationGate.test.ts`
 * so either orchestrator refactor cannot diverge silently.
 */
import { describe, it } from 'vitest';
import { NodeShaderCompiler } from '../shaders/NodeShaderCompiler';
import { nodeSystemSpecs } from '../shaders/nodes';
import type { NodeSpec } from '../types/nodeSpec';
import {
  assertBypassExportCompileGate,
  bypassRuleAGraph,
  bypassRuleBPatternGraph,
} from '../image-export/nodePowerBypassExportCompilationGateAssertions';

function buildNodeSpecsMap(): Map<string, NodeSpec> {
  return new Map(nodeSystemSpecs.map((s) => [s.id, s]));
}

describe('Node Power bypass — video export compile gate (WebGPU)', () => {
  const compiler = new NodeShaderCompiler(buildNodeSpecsMap());

  it('Rule A (rotate bypassed): deterministic compile; bypassed node out of execution order', () => {
    assertBypassExportCompileGate(compiler, bypassRuleAGraph(), ['n-rotate'], 'rule-a-video');
  });

  it('Rule B (noise bypassed): deterministic compile; bypassed node out of execution order', () => {
    assertBypassExportCompileGate(compiler, bypassRuleBPatternGraph(), ['n-noise'], 'rule-b-video');
  });
});
