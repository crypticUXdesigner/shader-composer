/**
 * Tests for UniformGenerator: uniform name mapping and runtime-only parameter exclusion.
 *
 * Run: npm test (or npx vitest run src/shaders/compilation/UniformGenerator.test.ts)
 */
import { describe, it, expect } from 'vitest';
import { UniformGenerator } from './UniformGenerator';
import { nodeSystemSpecs } from '../nodes/index';
import type { NodeGraph } from '../../data-model/types';
import type { NodeSpec } from '../../types/nodeSpec';

function buildNodeSpecsMap(): Map<string, NodeSpec> {
  return new Map(nodeSystemSpecs.map((s) => [s.id, s]));
}

function getParameterDefaultValue(
  paramSpec: { type: string; default?: unknown },
  _paramName: string
): number | [number, number] | [number, number, number] | [number, number, number, number] {
  if (paramSpec.default !== undefined) {
    if (typeof paramSpec.default === 'number') return paramSpec.default;
    if (Array.isArray(paramSpec.default)) {
      if (paramSpec.default.length === 2) return paramSpec.default as [number, number];
      if (paramSpec.default.length === 3) return paramSpec.default as [number, number, number];
      if (paramSpec.default.length === 4) return paramSpec.default as [number, number, number, number];
    }
  }
  if (paramSpec.type === 'int') return 0;
  if (paramSpec.type === 'vec2') return [0, 0];
  if (paramSpec.type === 'vec3') return [0, 0, 0];
  if (paramSpec.type === 'vec4') return [0, 0, 0, 0];
  return 0.0;
}

/**
 * Minimal graph: hexagonal-grid (float param hexGap), rings (float params ringCenterX, ringCenterY).
 */
function buildMinimalGraph(): NodeGraph {
  const hexId = 'n-hex';
  const ringsId = 'n-rings';

  return {
    id: 'graph-uniform-test',
    name: 'Uniform Test',
    version: '2.0',
    nodes: [
      {
        id: hexId,
        type: 'hexagonal-grid',
        position: { x: 0, y: 0 },
        parameters: { hexGap: 0.1 },
        parameterInputModes: {},
      },
      {
        id: ringsId,
        type: 'rings',
        position: { x: 0, y: 0 },
        parameters: { ringCenterX: 0, ringCenterY: 0 },
        parameterInputModes: {},
      },
    ],
    connections: [],
  };
}

describe('UniformGenerator', () => {
  describe('generateUniformNameMapping', () => {
    it('generates uniforms for float and vec2-like (two float) params', () => {
      const nodeSpecs = buildNodeSpecsMap();
      const generator = new UniformGenerator(
        nodeSpecs,
        (spec) => spec.category === 'Audio',
        getParameterDefaultValue
      );
      const graph = buildMinimalGraph();

      const uniformNames = generator.generateUniformNameMapping(graph);

      // Hexagonal-grid: hexGap is a float param → one uniform
      const hexGapKey = 'n-hex.hexGap';
      expect(uniformNames.has(hexGapKey)).toBe(true);
      const hexGapName = uniformNames.get(hexGapKey);
      expect(hexGapName).toBeDefined();
      expect(hexGapName).toMatch(/^u/);
      expect(typeof hexGapName).toBe('string');

      // Rings: ringCenterX, ringCenterY are float params → two uniforms
      expect(uniformNames.has('n-rings.ringCenterX')).toBe(true);
      expect(uniformNames.has('n-rings.ringCenterY')).toBe(true);
      const ringX = uniformNames.get('n-rings.ringCenterX');
      const ringY = uniformNames.get('n-rings.ringCenterY');
      expect(ringX).toMatch(/^u/);
      expect(ringY).toMatch(/^u/);
    });

    it('uses uniform name format expected by runtime (u + sanitized node id + param)', () => {
      const nodeSpecs = buildNodeSpecsMap();
      const generator = new UniformGenerator(
        nodeSpecs,
        (spec) => spec.category === 'Audio',
        getParameterDefaultValue
      );
      const graph = buildMinimalGraph();

      const uniformNames = generator.generateUniformNameMapping(graph);

      // Name format: u + sanitizedId + Param (first letter of param capitalized, no special chars in param)
      const hexGapName = uniformNames.get('n-hex.hexGap');
      expect(hexGapName).toMatch(/^un_hex\w+$/);
      expect(hexGapName).toContain('HexGap');
    });
  });

  describe('generateUniformMetadata', () => {
    it('includes type and defaultValue for used uniforms', () => {
      const nodeSpecs = buildNodeSpecsMap();
      const generator = new UniformGenerator(
        nodeSpecs,
        (spec) => spec.category === 'Audio',
        getParameterDefaultValue
      );
      const graph = buildMinimalGraph();
      const uniformNames = generator.generateUniformNameMapping(graph);
      // Mark all generated names as used so they appear in metadata
      const usedUniforms = new Set(uniformNames.values());

      const metadata = generator.generateUniformMetadata(graph, uniformNames, usedUniforms);

      const hexGapUniform = metadata.find((u) => u.paramName === 'hexGap' && u.nodeId === 'n-hex');
      expect(hexGapUniform).toBeDefined();
      expect(hexGapUniform?.type).toBe('float');
      expect(hexGapUniform?.defaultValue).toBe(0.1);

      const ringXUniform = metadata.find((u) => u.paramName === 'ringCenterX' && u.nodeId === 'n-rings');
      expect(ringXUniform).toBeDefined();
      expect(ringXUniform?.type).toBe('float');
    });
  });
});
