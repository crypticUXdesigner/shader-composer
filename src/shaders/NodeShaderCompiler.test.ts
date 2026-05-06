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
     * Full compile path: minimal graph → compile → assert result structure.
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

    it('includes previewDependencies with no audio uniforms for minimal graph', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const graph = buildMinimalCompilableGraph();
      const result = compiler.compile(graph);

      expect(result.metadata.errors).toHaveLength(0);
      expect(result.metadata.previewDependencies).toBeDefined();
      expect(result.metadata.previewDependencies!.usesAudioUniforms).toBe(false);
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

  describe('box-torus-sdf', () => {
    it('compiles UV → Primitives → color-map → final-output without mangling else-if into if_node_*', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const graph: NodeGraph = {
        id: 'graph-box-torus',
        name: 'Box torus',
        version: '2.0',
        nodes: [
          { id: 'n-uv', type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
          { id: 'n-bt', type: 'box-torus-sdf', position: { x: 0, y: 0 }, parameters: {} },
          { id: 'n-cm', type: 'color-map', position: { x: 0, y: 0 }, parameters: {} },
          { id: 'n-out', type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
        ],
        connections: [
          { id: 'c1', sourceNodeId: 'n-uv', sourcePort: 'out', targetNodeId: 'n-bt', targetPort: 'in' },
          { id: 'c2', sourceNodeId: 'n-bt', sourcePort: 'out', targetNodeId: 'n-cm', targetPort: 'in' },
          { id: 'c3', sourceNodeId: 'n-cm', sourcePort: 'out', targetNodeId: 'n-out', targetPort: 'in' },
        ],
      };

      const result = compiler.compile(graph);

      expect(result.metadata.errors).toHaveLength(0);
      expect(result.shaderCode).not.toMatch(/\bif_node_/);
      expect(result.shaderCode).toContain('else if');
    });

    it('embeds float param connection into sceneSDF (e.g. primitiveSizeX) and orders upstream math before Primitives', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const graph: NodeGraph = {
        id: 'graph-bt-param',
        name: 'BT param',
        version: '2.0',
        nodes: [
          { id: 'n-uv', type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
          { id: 'n-mw', type: 'mixed-wave-signal', position: { x: 0, y: 0 }, parameters: {} },
          { id: 'n-mul', type: 'multiply', position: { x: 0, y: 0 }, parameters: { b: 2.0 } },
          {
            id: 'n-bt',
            type: 'box-torus-sdf',
            position: { x: 0, y: 0 },
            parameters: { primitiveType: 0, primitiveSizeX: 1.5 },
          },
          { id: 'n-cm', type: 'color-map', position: { x: 0, y: 0 }, parameters: {} },
          { id: 'n-out', type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
        ],
        connections: [
          { id: 'c1', sourceNodeId: 'n-uv', sourcePort: 'out', targetNodeId: 'n-bt', targetPort: 'in' },
          { id: 'c2', sourceNodeId: 'n-mw', sourcePort: 'out', targetNodeId: 'n-mul', targetPort: 'a' },
          {
            id: 'c3',
            sourceNodeId: 'n-mul',
            sourcePort: 'out',
            targetNodeId: 'n-bt',
            targetParameter: 'primitiveSizeX',
          },
          { id: 'c4', sourceNodeId: 'n-bt', sourcePort: 'out', targetNodeId: 'n-cm', targetPort: 'in' },
          { id: 'c5', sourceNodeId: 'n-cm', sourcePort: 'out', targetNodeId: 'n-out', targetPort: 'in' },
        ],
      };

      const result = compiler.compile(graph);
      expect(result.metadata.errors).toHaveLength(0);
      const order = result.metadata.executionOrder;
      expect(order.indexOf('n-mul')).toBeLessThan(order.indexOf('n-bt'));

      const mulVar = expectedOutputVariableName('n-mul', 'out');
      expect(result.shaderCode).toContain(mulVar);
      const sceneIdx = result.shaderCode.indexOf('sceneSDF');
      expect(sceneIdx).toBeGreaterThanOrEqual(0);
      const sceneChunk = result.shaderCode.slice(sceneIdx, sceneIdx + 1200);
      expect(sceneChunk).toContain(`vec3(clamp((${mulVar}),`);
    });
  });

  describe('mixed-wave-signal input node', () => {
    it('compiles mixed-wave-signal → color-map → final-output', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const graph: NodeGraph = {
        id: 'graph-mws',
        name: 'Mixed wave test',
        version: '2.0',
        nodes: [
          { id: 'mws', type: 'mixed-wave-signal', position: { x: 0, y: 0 }, parameters: {} },
          { id: 'cm', type: 'color-map', position: { x: 0, y: 0 }, parameters: {} },
          { id: 'n-out', type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
        ],
        connections: [
          {
            id: 'c1',
            sourceNodeId: 'mws',
            sourcePort: 'out',
            targetNodeId: 'cm',
            targetPort: 'in',
          },
          {
            id: 'c2',
            sourceNodeId: 'cm',
            sourcePort: 'out',
            targetNodeId: 'n-out',
            targetPort: 'in',
          },
        ],
      };

      const result = compiler.compile(graph);

      expect(result.metadata.errors).toHaveLength(0);
      expect(result.shaderCode.length).toBeGreaterThan(0);
    });
  });

  describe('oscillator-2d input node', () => {
    it('compiles UV → Vortex driven by oscillator x/y → length → color-map → final-output', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const uvId = 'n-uv';
      const oscId = 'n-osc';
      const vortexId = 'n-vortex';
      const lenId = 'n-len';
      const cmId = 'n-cm';
      const outId = 'n-out';

      const graph: NodeGraph = {
        id: 'graph-osc2d',
        name: 'Oscillator 2D test',
        version: '2.0',
        nodes: [
          { id: uvId, type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
          { id: oscId, type: 'oscillator-2d', position: { x: 0, y: 0 }, parameters: {} },
          {
            id: vortexId,
            type: 'vortex',
            position: { x: 0, y: 0 },
            parameters: {
              vortexCenterX: 0.0,
              vortexCenterY: 0.0,
              vortexStrength: 0.5,
              vortexRadius: 2.0,
              vortexFalloff: 1.5,
              vortexTimeSpeed: 0.0,
            },
          },
          { id: lenId, type: 'length', position: { x: 0, y: 0 }, parameters: {} },
          { id: cmId, type: 'color-map', position: { x: 0, y: 0 }, parameters: {} },
          { id: outId, type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
        ],
        connections: [
          { id: 'c0', sourceNodeId: uvId, sourcePort: 'out', targetNodeId: vortexId, targetPort: 'in' },
          { id: 'cpx', sourceNodeId: oscId, sourcePort: 'x', targetNodeId: vortexId, targetParameter: 'vortexCenterX' },
          { id: 'cpy', sourceNodeId: oscId, sourcePort: 'y', targetNodeId: vortexId, targetParameter: 'vortexCenterY' },
          { id: 'c1', sourceNodeId: vortexId, sourcePort: 'out', targetNodeId: lenId, targetPort: 'in' },
          { id: 'c2', sourceNodeId: lenId, sourcePort: 'out', targetNodeId: cmId, targetPort: 'in' },
          { id: 'c3', sourceNodeId: cmId, sourcePort: 'out', targetNodeId: outId, targetPort: 'in' },
        ],
      };

      const result = compiler.compile(graph);

      expect(result.metadata.errors).toHaveLength(0);
      expect(result.shaderCode.length).toBeGreaterThan(0);
      expect(result.shaderCode).toContain(expectedOutputVariableName(oscId, 'x'));
      expect(result.shaderCode).toContain(expectedOutputVariableName(oscId, 'y'));
      expect(result.shaderCode).toContain('osc2dRawX');
      expect(result.shaderCode).toContain('osc2dTheta');
      expect(result.shaderCode).toContain('osc2d_combine_axis');
    });

    it('includes layer merge helper when Layer mix is Product', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const oscId = 'n-osc';
      const cmId = 'n-cm';
      const outId = 'n-out';

      const graph: NodeGraph = {
        id: 'graph-osc2d-mode',
        name: 'Oscillator 2D mode test',
        version: '2.0',
        nodes: [
          {
            id: oscId,
            type: 'oscillator-2d',
            position: { x: 0, y: 0 },
            parameters: { layerCombine: 2 },
          },
          { id: cmId, type: 'color-map', position: { x: 0, y: 0 }, parameters: {} },
          { id: outId, type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
        ],
        connections: [
          { id: 'c0', sourceNodeId: oscId, sourcePort: 'x', targetNodeId: cmId, targetPort: 'in' },
          { id: 'c1', sourceNodeId: cmId, sourcePort: 'out', targetNodeId: outId, targetPort: 'in' },
        ],
      };

      const result = compiler.compile(graph);

      expect(result.metadata.errors).toHaveLength(0);
      expect(result.shaderCode).toContain('osc2d_combine_axis');
      expect(result.shaderCode).toContain('if (mode == 2)');
    });
  });

  describe('turbulence node (function extraction must ignore // comments)', () => {
    it('compiles new preset with uv → turbulence → orbit without spurious reserved word output', () => {
      const presetPath = join(__dirname, '..', 'presets', 'bloom-sphere.json');
      const preset = JSON.parse(readFileSync(presetPath, 'utf8')) as { graph: NodeGraph };
      const graph: NodeGraph = structuredClone(preset.graph);

      const turbId = 'node-turb-test';
      graph.nodes.push({
        id: turbId,
        type: 'turbulence',
        position: { x: 0, y: 0 },
        parameters: {}
      });

      const bloomSphereNode = graph.nodes.find((n) => n.type === 'bloom-sphere');
      expect(bloomSphereNode).toBeTruthy();
      const bloomSphereId = bloomSphereNode!.id;
      const incomingToBloom = graph.connections.find(
        (c) => c.targetNodeId === bloomSphereId && c.targetPort === 'in'
      );
      expect(incomingToBloom).toBeTruthy();
      const srcId = incomingToBloom!.sourceNodeId;
      const srcPort = incomingToBloom!.sourcePort;
      graph.connections = graph.connections.filter((c) => c.id !== incomingToBloom!.id);
      graph.connections.push(
        {
          id: 'c-src-turb',
          sourceNodeId: srcId,
          sourcePort: srcPort,
          targetNodeId: turbId,
          targetPort: 'in'
        },
        {
          id: 'c-turb-bloomSphere',
          sourceNodeId: turbId,
          sourcePort: 'out',
          targetNodeId: bloomSphereId,
          targetPort: 'in'
        }
      );

      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const result = compiler.compile(graph);

      expect(result.metadata.errors).toHaveLength(0);
      expect(result.shaderCode).not.toMatch(/\noutput\n/);
      expect(result.shaderCode).toContain('vec2 turbulence(');
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
      const c00Pattern = new RegExp(
        `vec2\\(\\s*clamp\\(\\(\\s*${intensityVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\)\\s*,`
      );
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
     * Param wiring contract: execution order and variable substitution for a
   * parameter connection chain. Chain: time → one-minus → hexagon.hexGap.
   * See docs/architecture/audio-reactivity.md — Contract (invariants).
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
        name: 'ParamWiringContract',
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
      const gapVarEsc = oneMinusVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const gapPattern = new RegExp(
        // The node code clamps hexGap, and parameter substitution also clamps.
        `clamp\\(\\s*clamp\\(\\s*\\(\\s*${gapVarEsc}\\s*\\)\\s*,\\s*0\\.0\\s*,\\s*2\\.0\\s*\\)\\s*,\\s*0\\.0\\s*,\\s*2\\.0\\s*\\)`
      );
      expect(
        result.shaderCode,
        'hexagon gap must use one-minus output variable for connected hexGap, not uniform'
      ).toMatch(gapPattern);
    });

    /**
     * Audio param chain: virtual remap → one-minus (port) → hexagon.hexGap (param).
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
        name: 'AudioParamChain',
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
        bands: [{ id: 'band-1', name: 'B1', sourceFileId: 'f1', frequencyBands: [[0, 1000]], smoothingHalfLifeSeconds: 1 / 120, fftSize: 4096 }],
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
      const gapVarEsc = oneMinusVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const gapPattern = new RegExp(
        // Node code may already clamp $param.hexGap, and we also clamp the substituted expression.
        // Accept nested clamps like: clamp(clamp((node_var), 0.0, 2.0), 0.0, 2.0)
        `clamp\\(\\s*clamp\\(\\s*\\(\\s*${gapVarEsc}\\s*\\)\\s*,\\s*0\\.0\\s*,\\s*2\\.0\\s*\\)\\s*,\\s*0\\.0\\s*,\\s*2\\.0\\s*\\)`
      );
      expect(result.shaderCode, 'hexGap must use one-minus output variable').toMatch(gapPattern);
      expect(result.metadata.previewDependencies).toBeDefined();
      expect(result.metadata.previewDependencies!.usesAudioUniforms).toBe(true);
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

    it('uses sceneSDF for generic-raymarcher when SDF source is box-torus (no $output.x =) and embeds float param wires', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const uvId = 'n-uv';
      const mwId = 'n-mw';
      const mulId = 'n-mul';
      const btId = 'n-bt';
      const rayId = 'n-ray';
      const outId = 'n-out';
      const graph: NodeGraph = {
        id: 'graph-ray-bt-sdf',
        name: 'Ray BT SDF',
        version: '2.0',
        nodes: [
          { id: uvId, type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
          { id: mwId, type: 'mixed-wave-signal', position: { x: 0, y: 0 }, parameters: {} },
          { id: mulId, type: 'multiply', position: { x: 0, y: 0 }, parameters: { b: 1.0 } },
          {
            id: btId,
            type: 'box-torus-sdf',
            position: { x: 0, y: 0 },
            parameters: { primitiveType: 0, primitiveSizeX: 1.5 },
          },
          { id: rayId, type: 'generic-raymarcher', position: { x: 0, y: 0 }, parameters: {} },
          { id: outId, type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
        ],
        connections: [
          { id: 'r1', sourceNodeId: uvId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'in' },
          { id: 'r2', sourceNodeId: btId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'sdf' },
          { id: 'r3', sourceNodeId: uvId, sourcePort: 'out', targetNodeId: btId, targetPort: 'in' },
          { id: 'r4', sourceNodeId: mwId, sourcePort: 'out', targetNodeId: mulId, targetPort: 'a' },
          {
            id: 'r5',
            sourceNodeId: mulId,
            sourcePort: 'out',
            targetNodeId: btId,
            targetParameter: 'primitiveSizeX',
          },
          { id: 'r6', sourceNodeId: rayId, sourcePort: 'color', targetNodeId: outId, targetPort: 'in' },
        ],
      };

      const result = compiler.compile(graph);
      expect(result.metadata.errors).toHaveLength(0);
      const mulVar = expectedOutputVariableName(mulId, 'out');
      expect(result.shaderCode).toContain(mulVar);
      const genericFn = `generic_raymarcher_sdf_${rayId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      expect(result.shaderCode).toMatch(
        new RegExp(`float\\s+${genericFn}\\s*\\(vec3\\s+p\\)\\s*\\{\\s*return\\s+sceneSDF`)
      );
      const sceneIdx = result.shaderCode.indexOf('sceneSDF');
      expect(sceneIdx).toBeGreaterThanOrEqual(0);
      const sceneChunk = result.shaderCode.slice(sceneIdx, sceneIdx + 1200);
      expect(sceneChunk).toContain(`vec3(clamp((${mulVar}),`);
    });

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

    it('compiles generic-raymarcher with menger-sponge-sdf feeding sdf port', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const uvId = 'n-uv-ms';
      const mengerId = 'n-menger';
      const rayId = 'n-ray-ms';
      const outId = 'n-out-ms';
      const graph: NodeGraph = {
        id: 'graph-menger-ray',
        name: 'Menger Ray',
        version: '2.0',
        nodes: [
          { id: uvId, type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
          {
            id: mengerId,
            type: 'menger-sponge-sdf',
            position: { x: 0, y: 0 },
            parameters: { iterations: 2, domainScale: 1.0, deFudge: 0.2 }
          },
          { id: rayId, type: 'generic-raymarcher', position: { x: 0, y: 0 }, parameters: {} },
          { id: outId, type: 'final-output', position: { x: 0, y: 0 }, parameters: {} }
        ],
        connections: [
          { id: 'm1', sourceNodeId: uvId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'in' },
          { id: 'm2', sourceNodeId: mengerId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'sdf' },
          { id: 'm3', sourceNodeId: rayId, sourcePort: 'color', targetNodeId: outId, targetPort: 'in' }
        ]
      };

      const result = compiler.compile(graph);
      expect(result.metadata.errors, result.metadata.errors.join('; ')).toHaveLength(0);
      expect(result.shaderCode).toContain('mengerSponge_eval');
      expect(result.shaderCode).toContain('generic_raymarcher_sdf_n_ray_ms');
      expect(result.shaderCode).not.toContain('$param.iterations');
    });

    it('compiles generic-raymarcher with mandelbox-sdf feeding sdf port', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const uvId = 'n-uv-mbox';
      const mboxId = 'n-mandelbox';
      const rayId = 'n-ray-mbox';
      const outId = 'n-out-mbox';
      const graph: NodeGraph = {
        id: 'graph-mandelbox-ray',
        name: 'Mandelbox Ray',
        version: '2.0',
        nodes: [
          { id: uvId, type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
          {
            id: mboxId,
            type: 'mandelbox-sdf',
            position: { x: 0, y: 0 },
            parameters: { iterations: 8, scale: -2.0, foldingLimit: 1.0, minRadius: 0.25 }
          },
          { id: rayId, type: 'generic-raymarcher', position: { x: 0, y: 0 }, parameters: {} },
          { id: outId, type: 'final-output', position: { x: 0, y: 0 }, parameters: {} }
        ],
        connections: [
          { id: 'b1', sourceNodeId: uvId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'in' },
          { id: 'b2', sourceNodeId: mboxId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'sdf' },
          { id: 'b3', sourceNodeId: rayId, sourcePort: 'color', targetNodeId: outId, targetPort: 'in' }
        ]
      };

      const result = compiler.compile(graph);
      expect(result.metadata.errors, result.metadata.errors.join('; ')).toHaveLength(0);
      expect(result.shaderCode).toContain('mandelbox_sdf_eval');
      expect(result.shaderCode).toContain('generic_raymarcher_sdf_n_ray_mbox');
      expect(result.shaderCode).not.toContain('$param.iterations');
    });

    it('compiles generic-raymarcher with sierpinski-tetra-sdf feeding sdf port', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const uvId = 'n-uv-st';
      const stId = 'n-stetra';
      const rayId = 'n-ray-st';
      const outId = 'n-out-st';
      const graph: NodeGraph = {
        id: 'graph-stetra-ray',
        name: 'Sierpinski Tetra Ray',
        version: '2.0',
        nodes: [
          { id: uvId, type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
          {
            id: stId,
            type: 'sierpinski-tetra-sdf',
            position: { x: 0, y: 0 },
            parameters: { iterations: 4, scale: 2.0, coreRadius: 0.1 }
          },
          { id: rayId, type: 'generic-raymarcher', position: { x: 0, y: 0 }, parameters: {} },
          { id: outId, type: 'final-output', position: { x: 0, y: 0 }, parameters: {} }
        ],
        connections: [
          { id: 's1', sourceNodeId: uvId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'in' },
          { id: 's2', sourceNodeId: stId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'sdf' },
          { id: 's3', sourceNodeId: rayId, sourcePort: 'color', targetNodeId: outId, targetPort: 'in' }
        ]
      };

      const result = compiler.compile(graph);
      expect(result.metadata.errors, result.metadata.errors.join('; ')).toHaveLength(0);
      expect(result.shaderCode).toContain('stetraSdfBody');
      expect(result.shaderCode).toContain('generic_raymarcher_sdf_n_ray_st');
      expect(result.shaderCode).not.toContain('$param.iterations');
    });

    it('uses constant-float output for sierpinski-tetra-sdf.scale inside generic-raymarcher SDF function', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const uvId = 'n-uv-st2';
      const constId = 'n-const-st2';
      const stId = 'n-stetra2';
      const rayId = 'n-ray-st2';
      const outId = 'n-out-st2';
      const graph: NodeGraph = {
        id: 'graph-stetra-scale-wire',
        name: 'STetra scale wire',
        version: '2.0',
        nodes: [
          { id: uvId, type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
          { id: constId, type: 'constant-float', position: { x: 0, y: 0 }, parameters: { value: 2.2 } },
          {
            id: stId,
            type: 'sierpinski-tetra-sdf',
            position: { x: 0, y: 0 },
            parameters: { iterations: 3 }
          },
          { id: rayId, type: 'generic-raymarcher', position: { x: 0, y: 0 }, parameters: {} },
          { id: outId, type: 'final-output', position: { x: 0, y: 0 }, parameters: {} }
        ],
        connections: [
          { id: 'w1', sourceNodeId: uvId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'in' },
          { id: 'w2', sourceNodeId: stId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'sdf' },
          {
            id: 'w3',
            sourceNodeId: constId,
            sourcePort: 'out',
            targetNodeId: stId,
            targetParameter: 'scale'
          },
          { id: 'w4', sourceNodeId: rayId, sourcePort: 'color', targetNodeId: outId, targetPort: 'in' }
        ]
      };

      const result = compiler.compile(graph);
      expect(result.metadata.errors).toHaveLength(0);
      const constVar = expectedOutputVariableName(constId, 'out');
      const funcName = 'generic_raymarcher_sdf_n_ray_st2';
      const pattern = new RegExp(
        `float\\s+${funcName}\\s*\\(vec3\\s+p\\)\\s*\\{[\\s\\S]*${constVar}[\\s\\S]*\\}`
      );
      expect(result.shaderCode, 'SDF function must inline constant for scale').toMatch(pattern);
      expect(result.shaderCode).not.toContain('$param.scale');
    });

    it('uses audio uniform for sierpinski-tetra-sdf.scale in generic-raymarcher SDF function', () => {
      const remapperId = 'remap-node-stetra-audio';
      const virtualRemapId = `audio-signal:remap-${remapperId}`;
      const uvId = 'n-uv-sta';
      const stId = 'n-stetra-audio';
      const rayId = 'n-ray-sta';
      const outputId = 'n-out-sta';

      const graph: NodeGraph = {
        id: 'graph-ray-stetra-audio',
        name: 'Raymarcher STetra audio scale',
        version: '2.0',
        nodes: [
          { id: uvId, type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
          { id: stId, type: 'sierpinski-tetra-sdf', position: { x: 0, y: 0 }, parameters: { scale: 2.0 } },
          { id: rayId, type: 'generic-raymarcher', position: { x: 0, y: 0 }, parameters: {} },
          { id: outputId, type: 'final-output', position: { x: 0, y: 0 }, parameters: {} }
        ],
        connections: [
          { id: 'a1', sourceNodeId: uvId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'in' },
          { id: 'a2', sourceNodeId: stId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'sdf' },
          {
            id: 'a3',
            sourceNodeId: virtualRemapId,
            sourcePort: 'out',
            targetNodeId: stId,
            targetParameter: 'scale'
          },
          { id: 'a4', sourceNodeId: rayId, sourcePort: 'color', targetNodeId: outputId, targetPort: 'in' }
        ]
      };

      const audioSetup: AudioSetup = {
        files: [],
        bands: [
          { id: 'band-st', name: 'B1', sourceFileId: 'f1', frequencyBands: [[0, 1000]], smoothingHalfLifeSeconds: 1 / 120, fftSize: 4096 }
        ],
        remappers: [
          { id: remapperId, name: 'R1', bandId: 'band-st', inMin: 0, inMax: 1, outMin: 1.5, outMax: 2.5 }
        ]
      };

      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const result = compiler.compile(graph, audioSetup);

      expect(result.metadata.errors).toHaveLength(0);

      const uniformNodeId = `remap-${remapperId}`;
      const sanitizedId = uniformNodeId.replace(/[^a-zA-Z0-9]/g, '_').replace(/^(\d)/, 'n$1');
      const expectedUniform = `u${sanitizedId}Out`;

      const funcName = 'generic_raymarcher_sdf_n_ray_sta';
      const pattern = new RegExp(`float\\s+${funcName}\\s*\\(vec3\\s+p\\)\\s*\\{([\\s\\S]*?)\\}`);
      const match = result.shaderCode.match(pattern);
      expect(match, 'generic-raymarcher SDF function body must be found').not.toBeNull();
      const body = match![1];

      expect(body, 'SDF body must reference audio uniform for scale').toContain(expectedUniform);
      expect(body, 'SDF body must not leave raw $param.scale').not.toContain('$param.scale');
    });

    it('uses SDF parameter input variable in generic-raymarcher SDF function body for julia-slab-sdf.xyScale', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const uvId = 'n-uv';
      const constId = 'n-const-julia';
      const juliaId = 'n-julia';
      const rayId = 'n-ray-julia';
      const outputId = 'n-out-julia';

      const graph: NodeGraph = {
        id: 'graph-raymarcher-sdf-julia',
        name: 'Raymarcher Julia SDF Param',
        version: '2.0',
        nodes: [
          { id: uvId, type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
          { id: constId, type: 'constant-float', position: { x: 0, y: 0 }, parameters: { value: 2.25 } },
          { id: juliaId, type: 'julia-slab-sdf', position: { x: 0, y: 0 }, parameters: {} },
          {
            id: rayId,
            type: 'generic-raymarcher',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          { id: outputId, type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
        ],
        connections: [
          { id: 'j1', sourceNodeId: uvId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'in' },
          { id: 'j2', sourceNodeId: juliaId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'sdf' },
          {
            id: 'j3',
            sourceNodeId: constId,
            sourcePort: 'out',
            targetNodeId: juliaId,
            targetParameter: 'xyScale',
          },
          { id: 'j4', sourceNodeId: rayId, sourcePort: 'color', targetNodeId: outputId, targetPort: 'in' },
        ],
      };

      const result = compiler.compile(graph);

      expect(result.metadata.errors).toHaveLength(0);
      const constVar = expectedOutputVariableName(constId, 'out');
      const funcName = `generic_raymarcher_sdf_n_ray_julia`;
      const pattern = new RegExp(
        `float\\s+${funcName}\\s*\\(vec3\\s+p\\)\\s*\\{[\\s\\S]*${constVar}[\\s\\S]*\\}`
      );
      expect(
        result.shaderCode,
        'generic-raymarcher SDF function must reference constant-float output variable for julia-slab-sdf.xyScale'
      ).toMatch(pattern);
      expect(
        result.shaderCode,
        'generic-raymarcher SDF function must not contain raw $param.xyScale placeholder when wired'
      ).not.toContain('$param.xyScale');
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
          { id: 'band-1', name: 'B1', sourceFileId: 'f1', frequencyBands: [[0, 1000]], smoothingHalfLifeSeconds: 1 / 120, fftSize: 4096 },
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

    it('compiles graph with mandelbulb-sdf driving generic-raymarcher SDF', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const uvId = 'n-uv-mbulb';
      const mbId = 'n-mbulb';
      const rayId = 'n-ray-mbulb';
      const outId = 'n-out-mbulb';
      const graph: NodeGraph = {
        id: 'graph-mandelbulb-ray',
        name: 'Mandelbulb Ray',
        version: '2.0',
        nodes: [
          { id: uvId, type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
          { id: mbId, type: 'mandelbulb-sdf', position: { x: 0, y: 0 }, parameters: {} },
          { id: rayId, type: 'generic-raymarcher', position: { x: 0, y: 0 }, parameters: {} },
          { id: outId, type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
        ],
        connections: [
          { id: 'mb1', sourceNodeId: uvId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'in' },
          { id: 'mb2', sourceNodeId: mbId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'sdf' },
          { id: 'mb3', sourceNodeId: rayId, sourcePort: 'color', targetNodeId: outId, targetPort: 'in' },
        ],
      };

      const result = compiler.compile(graph);
      expect(result.metadata.errors).toHaveLength(0);
      expect(result.shaderCode).toContain('mandelbulbSdf');
      expect(result.shaderCode).toContain('generic_raymarcher_sdf_n_ray_mbulb');
    });

    it('mandelbulb-sdf bailout and deFudge grid compile without errors (DE verification matrix)', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const bailouts = [1.35, 1.9, 2.5, 3.5];
      const deFudges = [0.12, 0.45, 0.78, 1.25];
      for (const bailout of bailouts) {
        for (const deFudge of deFudges) {
          const graph: NodeGraph = {
            id: `graph-mb-sweep-${bailout}-${deFudge}`,
            name: 'Mandelbulb sweep',
            version: '2.0',
            nodes: [
              { id: 'n-uv-sw', type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
              {
                id: 'n-mb-sw',
                type: 'mandelbulb-sdf',
                position: { x: 0, y: 0 },
                parameters: { bailout, deFudge, hybridMix: 0.0 },
              },
              { id: 'n-ray-sw', type: 'generic-raymarcher', position: { x: 0, y: 0 }, parameters: {} },
              { id: 'n-out-sw', type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
            ],
            connections: [
              { id: 's1', sourceNodeId: 'n-uv-sw', sourcePort: 'out', targetNodeId: 'n-ray-sw', targetPort: 'in' },
              { id: 's2', sourceNodeId: 'n-mb-sw', sourcePort: 'out', targetNodeId: 'n-ray-sw', targetPort: 'sdf' },
              { id: 's3', sourceNodeId: 'n-ray-sw', sourcePort: 'color', targetNodeId: 'n-out-sw', targetPort: 'in' },
            ],
          };
          const result = compiler.compile(graph);
          expect(result.metadata.errors, `bailout=${bailout} deFudge=${deFudge}`).toHaveLength(0);
        }
      }
    });

    it('mandelbulb-sdf uses audio uniform for deFudge in generic-raymarcher SDF function', () => {
      const remapperId = 'remap-mb-defudge';
      const virtualRemapId = `audio-signal:remap-${remapperId}`;
      const uvId = 'n-uv-mb-aud';
      const mbId = 'n-mb-aud';
      const rayId = 'n-ray-mb-aud';
      const outputId = 'n-out-mb-aud';

      const graph: NodeGraph = {
        id: 'graph-mb-audio-defudge',
        name: 'Mandelbulb deFudge audio',
        version: '2.0',
        nodes: [
          { id: uvId, type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
          { id: mbId, type: 'mandelbulb-sdf', position: { x: 0, y: 0 }, parameters: { deFudge: 0.5 } },
          {
            id: rayId,
            type: 'generic-raymarcher',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          { id: outputId, type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
        ],
        connections: [
          { id: 'a1', sourceNodeId: uvId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'in' },
          { id: 'a2', sourceNodeId: mbId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'sdf' },
          {
            id: 'a3',
            sourceNodeId: virtualRemapId,
            sourcePort: 'out',
            targetNodeId: mbId,
            targetParameter: 'deFudge',
          },
          { id: 'a4', sourceNodeId: rayId, sourcePort: 'color', targetNodeId: outputId, targetPort: 'in' },
        ],
      };

      const audioSetup: AudioSetup = {
        files: [],
        bands: [
          { id: 'band-mb', name: 'B1', sourceFileId: 'f1', frequencyBands: [[0, 1000]], smoothingHalfLifeSeconds: 1 / 120, fftSize: 4096 },
        ],
        remappers: [
          { id: remapperId, name: 'R1', bandId: 'band-mb', inMin: 0, inMax: 1, outMin: 0.05, outMax: 1.5 },
        ],
      };

      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const result = compiler.compile(graph, audioSetup);

      expect(result.metadata.errors).toHaveLength(0);

      const uniformNodeId = `remap-${remapperId}`;
      const sanitizedId = uniformNodeId.replace(/[^a-zA-Z0-9]/g, '_').replace(/^(\d)/, 'n$1');
      const expectedUniform = `u${sanitizedId}Out`;

      const funcName = 'generic_raymarcher_sdf_n_ray_mb_aud';
      const pattern = new RegExp(`float\\s+${funcName}\\s*\\(vec3\\s+p\\)\\s*\\{([\\s\\S]*?)\\}`);
      const match = result.shaderCode.match(pattern);
      expect(match, 'generic-raymarcher SDF function body must be found').not.toBeNull();
      const body = match![1];
      expect(body, 'SDF body must reference audio uniform for mandelbulb deFudge').toContain(expectedUniform);
      expect(body, 'must not leave raw deFudge placeholder').not.toContain('$param.deFudge');
    });

    it('mandelbulb-sdf uses constant-float output for hybridMix in generic-raymarcher SDF function', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const uvId = 'n-uv-mb-hyb';
      const constId = 'n-const-mb-hyb';
      const mbId = 'n-mb-hyb';
      const rayId = 'n-ray-mb-hyb';
      const outputId = 'n-out-mb-hyb';

      const graph: NodeGraph = {
        id: 'graph-mb-hybrid',
        name: 'Mandelbulb hybrid',
        version: '2.0',
        nodes: [
          { id: uvId, type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
          { id: constId, type: 'constant-float', position: { x: 0, y: 0 }, parameters: { value: 0.42 } },
          { id: mbId, type: 'mandelbulb-sdf', position: { x: 0, y: 0 }, parameters: {} },
          { id: rayId, type: 'generic-raymarcher', position: { x: 0, y: 0 }, parameters: {} },
          { id: outputId, type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
        ],
        connections: [
          { id: 'h1', sourceNodeId: uvId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'in' },
          { id: 'h2', sourceNodeId: mbId, sourcePort: 'out', targetNodeId: rayId, targetPort: 'sdf' },
          {
            id: 'h3',
            sourceNodeId: constId,
            sourcePort: 'out',
            targetNodeId: mbId,
            targetParameter: 'hybridMix',
          },
          { id: 'h4', sourceNodeId: rayId, sourcePort: 'color', targetNodeId: outputId, targetPort: 'in' },
        ],
      };

      const result = compiler.compile(graph);
      expect(result.metadata.errors).toHaveLength(0);
      const constVar = expectedOutputVariableName(constId, 'out');
      const funcName = 'generic_raymarcher_sdf_n_ray_mb_hyb';
      const pattern = new RegExp(
        `float\\s+${funcName}\\s*\\(vec3\\s+p\\)\\s*\\{[\\s\\S]*${constVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*\\}`
      );
      expect(result.shaderCode, 'SDF function must inline constant-float for hybridMix').toMatch(pattern);
      expect(result.shaderCode).not.toContain('$param.hybridMix');
    });
  });

  describe('inflated-icosahedron shader preamble identifiers', () => {
    function buildInflatedIcosahedronGraph(): NodeGraph {
      const uvId = 'n-uv';
      const icoId = 'n-ico';
      const outputId = 'n-out';

      return {
        id: 'graph-inflated-icosahedron',
        name: 'Inflated Icosahedron',
        version: '2.0',
        nodes: [
          { id: uvId, type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
          {
            id: icoId,
            type: 'inflated-icosahedron',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          { id: outputId, type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
        ],
        connections: [
          { id: 'c1', sourceNodeId: uvId, sourcePort: 'out', targetNodeId: icoId, targetPort: 'in' },
          { id: 'c2', sourceNodeId: icoId, sourcePort: 'out', targetNodeId: outputId, targetPort: 'in' },
        ],
      };
    }

    it('includes nc/pbc/pca and GDF* preamble so struct-dependent functions compile', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const graph = buildInflatedIcosahedronGraph();

      const result = compiler.compile(graph);
      expect(result.metadata.errors).toHaveLength(0);

      // These are "preamble" identifiers used by initIcosahedronInflated/pModIcosahedronInflated.
      expect(result.shaderCode).toContain('vec3 nc, pbc, pca;');
      expect(result.shaderCode).toContain('#define GDF13');
      expect(result.shaderCode).toContain('#define GDF18b');

      // A sanity check that a function body referencing nc is present.
      expect(result.shaderCode).toContain('nc = vec3(');
      expect(result.shaderCode).toContain('pModIcosahedronInflated(inout vec3 p)');
    });
  });

  describe('compileIncremental execution-order extensions', () => {
    it('succeeds after adding a disconnected constant-float (subsequence order)', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const base: NodeGraph = {
        id: 'g-ext',
        name: 'g',
        version: '2.0',
        nodes: [
          { id: 'n1', type: 'time', position: { x: 0, y: 0 }, parameters: {} },
          { id: 'n2', type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
        ],
        connections: [
          { id: 'c1', sourceNodeId: 'n1', sourcePort: 'out', targetNodeId: 'n2', targetPort: 'in' },
        ],
      };
      const prev = compiler.compile(base);
      expect(prev.metadata.errors).toHaveLength(0);
      const extended: NodeGraph = {
        ...base,
        nodes: [
          ...base.nodes,
          {
            id: 'nf',
            type: 'constant-float',
            position: { x: 0, y: 0 },
            parameters: { value: 0.25 },
          },
        ],
      };
      const incr = compiler.compileIncremental(extended, prev, new Set(['nf']));
      expect(incr).not.toBeNull();
      expect(incr!.metadata.executionOrder.length).toBe(prev.metadata.executionOrder.length + 1);
      expect(incr!.metadata.errors).toHaveLength(0);
    });

    it('returns null when a previous-order node is missing from the graph', () => {
      const nodeSpecsMap = buildNodeSpecsMap();
      const compiler = new NodeShaderCompiler(nodeSpecsMap);
      const base: NodeGraph = {
        id: 'g-rem',
        name: 'g',
        version: '2.0',
        nodes: [
          { id: 'n1', type: 'time', position: { x: 0, y: 0 }, parameters: {} },
          { id: 'n2', type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
        ],
        connections: [
          { id: 'c1', sourceNodeId: 'n1', sourcePort: 'out', targetNodeId: 'n2', targetPort: 'in' },
        ],
      };
      const prev = compiler.compile(base);
      const broken: NodeGraph = {
        ...base,
        nodes: [{ id: 'n2', type: 'final-output', position: { x: 0, y: 0 }, parameters: {} }],
        connections: [],
      };
      const incr = compiler.compileIncremental(broken, prev, new Set(['n2']));
      expect(incr).toBeNull();
    });
  });
});
