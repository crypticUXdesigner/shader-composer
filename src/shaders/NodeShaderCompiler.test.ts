/**
 * Diagnostic tests for NodeShaderCompiler, including the quad-warp parameter connection bug.
 *
 * Bug: When Intensity (multiply) output is connected to any quad-warp parameter, the shader
 * compiles and runs but shows a solid color. Connecting the upstream multiply to the same
 * parameter works. See docs/quad-warp-parameter-connection-bug.md.
 *
 * Run: npm install -D vitest && npm test (or npx vitest run src/shaders/NodeShaderCompiler.test.ts)
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { NodeShaderCompiler } from './NodeShaderCompiler';
import { nodeSystemSpecs } from './nodes/index';
import { addConnection } from '../data-model/immutableUpdates';
import type { NodeGraph, Connection } from '../data-model/types';
import type { NodeSpec } from '../types/nodeSpec';
import type { AudioSetup } from '../data-model/audioSetupTypes';

const __dirname = dirname(fileURLToPath(import.meta.url));

function buildNodeSpecsMap(): Map<string, NodeSpec> {
  return new Map(nodeSystemSpecs.map((s) => [s.id, s]));
}

/**
 * Minimal graph that reproduces the parameter-connection scenario:
 * - uv-coordinates -> quad-warp (in)
 * - time -> multiply (a), multiply has param b
 * - multiply (Intensity) out -> quad-warp quadCorner0X (parameter connection)
 * - quad-warp out -> final-output in
 *
 * This ensures quad-warp depends on the multiply; execution order must have multiply before quad-warp,
 * and the generated main code must use the multiply's output variable for quadCorner0X.
 */
function buildGraphWithIntensityToQuadWarpParam(): NodeGraph {
  const uvId = 'n-uv';
  const timeId = 'n-time';
  const intensityId = 'n-intensity';
  const quadWarpId = 'n-quadwarp';
  const outputId = 'n-output';

  return {
    id: 'graph-test',
    name: 'Test',
    version: '2.0',
    nodes: [
      { id: uvId, type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
      { id: timeId, type: 'time', position: { x: 0, y: 0 }, parameters: {} },
      {
        id: intensityId,
        type: 'multiply',
        position: { x: 0, y: 0 },
        parameters: { b: 0.1 },
        label: 'Intensity',
      },
      {
        id: quadWarpId,
        type: 'quad-warp',
        position: { x: 0, y: 0 },
        parameters: {
          quadCorner0X: -0.09,
          quadCorner0Y: -0.19,
          quadCorner1X: 0.57,
          quadCorner1Y: -0.05,
          quadCorner2X: 0.32,
          quadCorner2Y: 0.46,
          quadCorner3X: -0.57,
          quadCorner3Y: -0.46,
        },
        parameterInputModes: {},
      },
      { id: outputId, type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
    ],
    connections: [
      { id: 'c1', sourceNodeId: uvId, sourcePort: 'out', targetNodeId: quadWarpId, targetPort: 'in' },
      { id: 'c2', sourceNodeId: timeId, sourcePort: 'out', targetNodeId: intensityId, targetPort: 'a' },
      {
        id: 'c3',
        sourceNodeId: intensityId,
        sourcePort: 'out',
        targetNodeId: quadWarpId,
        targetParameter: 'quadCorner0X',
      },
      { id: 'c4', sourceNodeId: quadWarpId, sourcePort: 'out', targetNodeId: outputId, targetPort: 'in' },
    ],
  };
}

/**
 * Expected variable name for a node's "out" port (same convention as VariableNameGenerator).
 */
function expectedOutputVariableName(nodeId: string, portName: string): string {
  const sanitizedId = nodeId.replace(/[^a-zA-Z0-9]/g, '_');
  const sanitizedPort = portName.replace(/[^a-zA-Z0-9]/g, '_');
  return `node_${sanitizedId}_${sanitizedPort}`;
}

describe('NodeShaderCompiler', () => {
  /**
   * Full compile path (WP 11): minimal graph → compile → assert result structure.
   * Guards the critical path graph → NodeShaderCompiler → CompilationResult.
   */
  describe('full compile path (minimal graph)', () => {
    function buildMinimalCompilableGraph(): NodeGraph {
      const constId = 'n-const';
      const outputId = 'n-out';
      return {
        id: 'graph-minimal',
        name: 'Minimal',
        version: '2.0',
        nodes: [
          { id: constId, type: 'constant-vec3', position: { x: 0, y: 0 }, parameters: {} },
          { id: outputId, type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
        ],
        connections: [
          { id: 'c1', sourceNodeId: constId, sourcePort: 'out', targetNodeId: outputId, targetPort: 'in' },
        ],
      };
    }

    it('compiles without throwing and returns result with expected structure', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const graph = buildMinimalCompilableGraph();

      const result = compiler.compile(graph);

      expect(result.metadata.errors).toHaveLength(0);
      expect(result.shaderCode).toBeDefined();
      expect(typeof result.shaderCode).toBe('string');
      expect(result.shaderCode.length).toBeGreaterThan(0);
      expect(result.uniforms).toBeDefined();
      expect(Array.isArray(result.uniforms)).toBe(true);
      expect(result.metadata.executionOrder).toBeDefined();
      expect(Array.isArray(result.metadata.executionOrder)).toBe(true);
      expect(result.metadata.finalOutputNodeId).toBe('n-out');
    });

    it('produces fragment shader with void main and expected identifiers', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const graph = buildMinimalCompilableGraph();

      const result = compiler.compile(graph);

      expect(result.metadata.errors).toHaveLength(0);
      expect(result.shaderCode).toContain('void main()');
      expect(result.shaderCode).toContain('uTime');
      expect(result.shaderCode).toContain('uResolution');
      expect(result.shaderCode).toContain('fragColor');
    });
  });

  describe('quad-warp parameter connection (Intensity → quadCorner0X)', () => {
    it('places Intensity (multiply) before quad-warp in execution order', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const graph = buildGraphWithIntensityToQuadWarpParam();

      const result = compiler.compile(graph);

      expect(result.metadata.errors).toHaveLength(0);
      const order = result.metadata.executionOrder;
      const intensityIndex = order.indexOf('n-intensity');
      const quadWarpIndex = order.indexOf('n-quadwarp');
      expect(intensityIndex).toBeGreaterThanOrEqual(0);
      expect(quadWarpIndex).toBeGreaterThanOrEqual(0);
      expect(intensityIndex, `Execution order: ${order.join(' -> ')}`).toBeLessThan(quadWarpIndex);
    });

    it('substitutes quad-warp connected parameter with Intensity output variable in main code', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const graph = buildGraphWithIntensityToQuadWarpParam();

      const result = compiler.compile(graph);

      expect(result.metadata.errors).toHaveLength(0);
      const intensityVar = expectedOutputVariableName('n-intensity', 'out');
      // The main code is embedded in result.shaderCode; the quad-warp block should use intensityVar
      // for the connected param (quadCorner0X). So the shader must contain that variable in a
      // context that assigns to the quad-warp corners (e.g. vec2(intensityVar, ...) or similar).
      expect(result.shaderCode).toContain(intensityVar);

      // Stricter: quad-warp c00 is vec2($param.quadCorner0X, $param.quadCorner0Y); with connection
      // it must become vec2(intensityVar, ...). If we used default 0.0 we'd see vec2(0.0, ...) → solid color.
      const c00Pattern = new RegExp(`vec2\\(\\s*${intensityVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,`);
      expect(
        result.shaderCode,
        'quad-warp c00 must use Intensity variable (vec2(intensityVar, ...)), not default'
      ).toMatch(c00Pattern);
    });

    /**
     * Full preset test: load testing.json, add Intensity → quad-warp param connection, compile.
     * If this fails, the bug is in the compiler for the real graph. If it passes, the bug is
     * likely runtime (uniforms, WebGL state, etc.).
     */
    const presetPath = join(__dirname, '../presets/testing.json');
    it.skip('with full preset graph: Intensity before quad-warp and correct variable in shader (preset no longer contains this scenario)', () => {
      const raw = readFileSync(presetPath, 'utf-8');
      const preset = JSON.parse(raw) as { graph: NodeGraph; audioSetup?: AudioSetup };
      const baseGraph: NodeGraph = JSON.parse(JSON.stringify(preset.graph));
      const audioSetup: AudioSetup | undefined = preset.audioSetup;

      const intensityId = 'node-1770921234504-ezpttwmaq';
      const quadWarpId = 'node-1770921234504-3aq6894r7';
      const paramConnection: Connection = {
        id: 'conn-intensity-to-quadwarp-param',
        sourceNodeId: intensityId,
        sourcePort: 'out',
        targetNodeId: quadWarpId,
        targetParameter: 'quadCorner0X',
      };
      // Use same immutable path as app (addConnection) so graph shape matches UI
      const graph = baseGraph.connections.some(
        (c) => c.targetNodeId === quadWarpId && c.targetParameter === 'quadCorner0X'
      )
        ? baseGraph
        : addConnection(baseGraph, paramConnection);

      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const result = compiler.compile(graph, audioSetup ?? null);

      expect(result.metadata.errors, result.metadata.errors.join('; ')).toHaveLength(0);
      const order = result.metadata.executionOrder;
      const intensityIndex = order.indexOf(intensityId);
      const quadWarpIndex = order.indexOf(quadWarpId);
      expect(intensityIndex).toBeGreaterThanOrEqual(0);
      expect(quadWarpIndex).toBeGreaterThanOrEqual(0);
      expect(intensityIndex, `Execution order (full preset): ... ${order.slice(Math.max(0, intensityIndex - 1), quadWarpIndex + 2).join(' -> ')} ...`).toBeLessThan(quadWarpIndex);

      const intensityVar = expectedOutputVariableName(intensityId, 'out');
      expect(result.shaderCode, 'Shader should use Intensity output variable for quad-warp param').toContain(intensityVar);

      // Stricter: quad-warp c00 must use intensity var (vec2(intensityVar, ...)), not default 0.0
      const c00Pattern = new RegExp(`vec2\\(\\s*${intensityVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,`);
      expect(
        result.shaderCode,
        'quad-warp c00 must use Intensity variable; otherwise corner is 0 and result is solid color'
      ).toMatch(c00Pattern);
    });
  });

  /**
   * Param wiring contract (WP 02): execution order and variable substitution for a
   * parameter connection chain. Chain: time → one-minus → hexagon.hexGap.
   * See docs/architecture/audio-reactive-pipeline.md § Contract (invariants).
   */
  describe('parameter connection chain (one-minus → hexagon.hexGap)', () => {
    /**
     * Minimal graph: time → one-minus (in), one-minus (out) → hexagon hexGap (param),
     * uv → hexagon (in), hexagon (out) → final-output (in).
     */
    function buildOneMinusToHexagonParamGraph(): NodeGraph {
      const uvId = 'n-uv';
      const timeId = 'n-time';
      const oneMinusId = 'n-om';
      const hexId = 'n-hex';
      const outputId = 'n-out';

      return {
        id: 'graph-wp02',
        name: 'WP02',
        version: '2.0',
        nodes: [
          { id: uvId, type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
          { id: timeId, type: 'time', position: { x: 0, y: 0 }, parameters: {} },
          { id: oneMinusId, type: 'one-minus', position: { x: 0, y: 0 }, parameters: {} },
          {
            id: hexId,
            type: 'hexagonal-grid',
            position: { x: 0, y: 0 },
            parameters: { hexGap: 0.1 },
            parameterInputModes: {},
          },
          { id: outputId, type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
        ],
        connections: [
          { id: 'c1', sourceNodeId: timeId, sourcePort: 'out', targetNodeId: oneMinusId, targetPort: 'in' },
          {
            id: 'c2',
            sourceNodeId: oneMinusId,
            sourcePort: 'out',
            targetNodeId: hexId,
            targetParameter: 'hexGap',
          },
          { id: 'c3', sourceNodeId: uvId, sourcePort: 'out', targetNodeId: hexId, targetPort: 'in' },
          { id: 'c4', sourceNodeId: hexId, sourcePort: 'out', targetNodeId: outputId, targetPort: 'in' },
        ],
      };
    }

    it('places one-minus before hexagon in execution order (source before target)', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const graph = buildOneMinusToHexagonParamGraph();

      const result = compiler.compile(graph);

      expect(result.metadata.errors).toHaveLength(0);
      const order = result.metadata.executionOrder;
      const oneMinusIndex = order.indexOf('n-om');
      const hexIndex = order.indexOf('n-hex');
      expect(oneMinusIndex).toBeGreaterThanOrEqual(0);
      expect(hexIndex).toBeGreaterThanOrEqual(0);
      expect(
        oneMinusIndex,
        `Execution order: source (one-minus) must be before target (hexagon); got: ${order.join(' -> ')}`
      ).toBeLessThan(hexIndex);
    });

    it('substitutes hexagon hexGap with one-minus output variable in generated code (not uniform)', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const graph = buildOneMinusToHexagonParamGraph();

      const result = compiler.compile(graph);

      expect(result.metadata.errors).toHaveLength(0);
      const oneMinusVar = expectedOutputVariableName('n-om', 'out');
      expect(result.shaderCode).toContain(oneMinusVar);

      // Hexagon uses: float gap = clamp($param.hexGap, 0.0, 2.0); with connection it must become
      // clamp(oneMinusVar, 0.0, 2.0), not the default uniform for hexGap.
      const gapPattern = new RegExp(
        `clamp\\(\\s*${oneMinusVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,\\s*0\\.0\\s*,\\s*2\\.0\\s*\\)`
      );
      expect(
        result.shaderCode,
        'hexagon gap must use one-minus output variable for connected hexGap, not uniform'
      ).toMatch(gapPattern);
    });

    /**
     * Audio param chain (WP 10): virtual remap → one-minus (port) → hexagon.hexGap (param).
     * Ensures the compiler wires virtual node uniform into one-minus input and one-minus output into hexGap.
     */
    it('wires virtual remap → one-minus → hexGap when audioSetup is provided', () => {
      const remapperId = 'remap-node-test123';
      const virtualRemapId = `audio-signal:remap-${remapperId}`;
      const oneMinusId = 'n-om';
      const hexId = 'n-hex';
      const uvId = 'n-uv';
      const outputId = 'n-out';

      const graph: NodeGraph = {
        id: 'graph-wp10',
        name: 'WP10',
        version: '2.0',
        nodes: [
          { id: uvId, type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
          { id: oneMinusId, type: 'one-minus', position: { x: 0, y: 0 }, parameters: {} },
          {
            id: hexId,
            type: 'hexagonal-grid',
            position: { x: 0, y: 0 },
            parameters: { hexGap: 0.1 },
            parameterInputModes: { hexGap: 'override' },
          },
          { id: outputId, type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
        ],
        connections: [
          { id: 'c1', sourceNodeId: virtualRemapId, sourcePort: 'out', targetNodeId: oneMinusId, targetPort: 'in' },
          {
            id: 'c2',
            sourceNodeId: oneMinusId,
            sourcePort: 'out',
            targetNodeId: hexId,
            targetParameter: 'hexGap',
          },
          { id: 'c3', sourceNodeId: uvId, sourcePort: 'out', targetNodeId: hexId, targetPort: 'in' },
          { id: 'c4', sourceNodeId: hexId, sourcePort: 'out', targetNodeId: outputId, targetPort: 'in' },
        ],
      };

      const audioSetup: AudioSetup = {
        files: [],
        bands: [{ id: 'band-1', name: 'B1', sourceFileId: 'f1', frequencyBands: [[0, 1000]], smoothing: 0.8, fftSize: 4096 }],
        remappers: [
          { id: remapperId, name: 'R1', bandId: 'band-1', inMin: 0, inMax: 1, outMin: 0, outMax: 1 },
        ],
      };

      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const result = compiler.compile(graph, audioSetup);

      expect(result.metadata.errors).toHaveLength(0);
      const oneMinusVar = expectedOutputVariableName(oneMinusId, 'out');
      // Execution order: one-minus (depends only on virtual) before hexagon (depends on one-minus)
      const order = result.metadata.executionOrder;
      const oneMinusIndex = order.indexOf(oneMinusId);
      const hexIndex = order.indexOf(hexId);
      expect(oneMinusIndex).toBeGreaterThanOrEqual(0);
      expect(hexIndex).toBeGreaterThanOrEqual(0);
      expect(oneMinusIndex, 'one-minus must run before hexagon').toBeLessThan(hexIndex);
      // One-minus input must be the remap uniform (uRemap_node_test123Out or similar)
      expect(result.shaderCode).toContain(oneMinusVar);
      const gapPattern = new RegExp(
        `clamp\\(\\s*${oneMinusVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,\\s*0\\.0\\s*,\\s*2\\.0\\s*\\)`
      );
      expect(result.shaderCode, 'hexGap must use one-minus output variable').toMatch(gapPattern);
    });
  });

  describe('generic-raymarcher SDF and displacement parameter inputs', () => {
    function buildGenericRaymarcherWithEtherSdfGraph(): NodeGraph {
      const uvId = 'n-uv';
      const constId = 'n-const';
      const etherId = 'n-ether';
      const rayId = 'n-ray';
      const outputId = 'n-out';

      return {
        id: 'graph-raymarcher-sdf',
        name: 'Raymarcher SDF Param',
        version: '2.0',
        nodes: [
          { id: uvId, type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
          { id: constId, type: 'constant-float', position: { x: 0, y: 0 }, parameters: { value: 0.5 } },
          { id: etherId, type: 'ether-sdf', position: { x: 0, y: 0 }, parameters: {} },
          {
            id: rayId,
            type: 'generic-raymarcher',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          { id: outputId, type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
        ],
        connections: [
          { id: 'c1', sourceNodeId: uvId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'in' },
          { id: 'c2', sourceNodeId: etherId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'sdf' },
          {
            id: 'c3',
            sourceNodeId: constId,
            sourcePort: 'out',
            targetNodeId: etherId,
            targetParameter: 'timeOffset',
          },
          { id: 'c4', sourceNodeId: rayId, sourcePort: 'color', targetNodeId: outputId, targetPort: 'in' },
        ],
      };
    }

    function buildGenericRaymarcherWithDisplacementGraph(): NodeGraph {
      const uvId = 'n-uv';
      const constId = 'n-const';
      const etherId = 'n-ether';
      const dispId = 'n-disp';
      const rayId = 'n-ray';
      const outputId = 'n-out';

      return {
        id: 'graph-raymarcher-disp',
        name: 'Raymarcher Displacement Param',
        version: '2.0',
        nodes: [
          { id: uvId, type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
          { id: constId, type: 'constant-float', position: { x: 0, y: 0 }, parameters: { value: 0.25 } },
          { id: etherId, type: 'ether-sdf', position: { x: 0, y: 0 }, parameters: {} },
          { id: dispId, type: 'displacement-3d', position: { x: 0, y: 0 }, parameters: {} },
          {
            id: rayId,
            type: 'generic-raymarcher',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          { id: outputId, type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
        ],
        connections: [
          { id: 'd1', sourceNodeId: uvId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'in' },
          { id: 'd2', sourceNodeId: etherId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'sdf' },
          { id: 'd3', sourceNodeId: dispId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'displacement' },
          {
            id: 'd4',
            sourceNodeId: constId,
            sourcePort: 'out',
            targetNodeId: dispId,
            targetParameter: 'timeOffset',
          },
          { id: 'd5', sourceNodeId: rayId, sourcePort: 'color', targetNodeId: outputId, targetPort: 'in' },
        ],
      };
    }

    it('uses SDF parameter input variable in generic-raymarcher SDF function body', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const graph = buildGenericRaymarcherWithEtherSdfGraph();

      const result = compiler.compile(graph);

      expect(result.metadata.errors).toHaveLength(0);
      const constVar = expectedOutputVariableName('n-const', 'out');
      const sanitizedRayId = 'n_ray';
      const funcName = `generic_raymarcher_sdf_${sanitizedRayId}`;
      const pattern = new RegExp(
        `float\\s+${funcName}\\s*\\(vec3\\s+p\\)\\s*\\{[\\s\\S]*${constVar}[\\s\\S]*\\}`
      );
      expect(
        result.shaderCode,
        'generic-raymarcher SDF function must reference constant-float output variable for ether-sdf.timeOffset'
      ).toMatch(pattern);
      expect(
        result.shaderCode,
        'generic-raymarcher SDF function must not contain raw $param.timeOffset placeholder'
      ).not.toContain('$param.timeOffset');
    });

    it('uses displacement parameter input variable in generic-raymarcher displacement expression', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const graph = buildGenericRaymarcherWithDisplacementGraph();

      const result = compiler.compile(graph);

      expect(result.metadata.errors).toHaveLength(0);
      const constVar = expectedOutputVariableName('n-const', 'out');
      // Displacement expression is inlined into generic-raymarcher main code via $displacement_at_p.
      expect(
        result.shaderCode,
        'generic-raymarcher main code must reference constant-float output variable via displacement-3d.timeOffset'
      ).toContain(constVar);
      expect(
        result.shaderCode,
        'generic-raymarcher displacement expression must not contain raw $param.timeOffset placeholder'
      ).not.toContain('$param.timeOffset');
    });

    it('uses audio uniform for SDF parameter connected to virtual audio node in generic-raymarcher SDF function', () => {
      const remapperId = 'remap-node-audio123';
      const virtualRemapId = `audio-signal:remap-${remapperId}`;
      const uvId = 'n-uv-audio';
      const etherId = 'n-ether-audio';
      const rayId = 'n-ray-audio';
      const outputId = 'n-out-audio';

      const graph: NodeGraph = {
        id: 'graph-raymarcher-sdf-audio',
        name: 'Raymarcher SDF Audio Param',
        version: '2.0',
        nodes: [
          { id: uvId, type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
          { id: etherId, type: 'ether-sdf', position: { x: 0, y: 0 }, parameters: { timeOffset: 0.0 } },
          {
            id: rayId,
            type: 'generic-raymarcher',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          { id: outputId, type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
        ],
        connections: [
          { id: 'c1', sourceNodeId: uvId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'in' },
          { id: 'c2', sourceNodeId: etherId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'sdf' },
          {
            id: 'c3',
            sourceNodeId: virtualRemapId,
            sourcePort: 'out',
            targetNodeId: etherId,
            targetParameter: 'timeOffset',
          },
          { id: 'c4', sourceNodeId: rayId, sourcePort: 'color', targetNodeId: outputId, targetPort: 'in' },
        ],
      };

      const audioSetup: AudioSetup = {
        files: [],
        bands: [
          { id: 'band-1', name: 'B1', sourceFileId: 'f1', frequencyBands: [[0, 1000]], smoothing: 0.8, fftSize: 4096 },
        ],
        remappers: [
          { id: remapperId, name: 'R1', bandId: 'band-1', inMin: 0, inMax: 1, outMin: 0, outMax: 1 },
        ],
      };

      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const result = compiler.compile(graph, audioSetup);

      expect(result.metadata.errors).toHaveLength(0);

      // Expected uniform name for remap output, following UniformGenerator.sanitizeUniformName
      const uniformNodeId = `remap-${remapperId}`; // becomes "remap-remap-node-audio123"
      const sanitizedId = uniformNodeId.replace(/[^a-zA-Z0-9]/g, '_').replace(/^(\d)/, 'n$1');
      const sanitizedParam = 'Out';
      const expectedUniform = `u${sanitizedId}${sanitizedParam}`;

      const sanitizedRayId = 'n_ray_audio';
      const funcName = `generic_raymarcher_sdf_${sanitizedRayId}`;
      const pattern = new RegExp(
        `float\\s+${funcName}\\s*\\(vec3\\s+p\\)\\s*\\{([\\s\\S]*?)\\}`
      );
      const match = result.shaderCode.match(pattern);
      expect(match, 'generic-raymarcher SDF function body must be found').not.toBeNull();
      const body = match![1];

      expect(body, 'SDF function body must reference audio uniform for timeOffset').toContain(expectedUniform);
      expect(
        body,
        'SDF function body must not contain raw $param.timeOffset placeholder when audio connection is present'
      ).not.toContain('$param.timeOffset');
    });
  });
});
