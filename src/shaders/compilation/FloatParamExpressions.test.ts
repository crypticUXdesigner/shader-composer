/**
 * Tests for buildFloatParamExpressions: float parameter GLSL expressions
 * (config value + automation + optional input connection with inputMode).
 *
 * Run: npm test (or npx vitest run src/shaders/compilation/FloatParamExpressions.test.ts)
 */
import { describe, it, expect } from 'vitest';
import type { NodeGraph } from '../../data-model/types';
import type { NodeSpec } from '../../types/nodeSpec';
import { buildFloatParamExpressions } from './FloatParamExpressions';

function buildTestNodeSpecs(): Map<string, NodeSpec> {
  const sourceSpec: NodeSpec = {
    id: 'test-source',
    displayName: 'Test Source',
    category: 'Test',
    inputs: [],
    outputs: [
      { name: 'out', type: 'float' }
    ],
    parameters: {},
    mainCode: 'void main() {}'
  };

  const targetSpec: NodeSpec = {
    id: 'test-target',
    displayName: 'Test Target',
    category: 'Test',
    inputs: [],
    outputs: [
      { name: 'out', type: 'float' }
    ],
    parameters: {
      gain: {
        type: 'float',
        default: 0.5
      }
    },
    mainCode: 'void main() {}'
  };

  return new Map<string, NodeSpec>([
    [sourceSpec.id, sourceSpec],
    [targetSpec.id, targetSpec]
  ]);
}

function buildEmptyGraphForTarget(targetId: string): NodeGraph {
  return {
    id: 'graph-test',
    name: 'Test',
    version: '2.0',
    nodes: [
      {
        id: targetId,
        type: 'test-target',
        position: { x: 0, y: 0 },
        parameters: {
          gain: 0.5
        },
        parameterInputModes: {}
      }
    ],
    connections: []
  };
}

describe('buildFloatParamExpressions', () => {
  const escapeIdentity = (s: string): string => s;

  it('uses uniform for float param when there is no connection or automation', () => {
    const nodeSpecs = buildTestNodeSpecs();
    const targetNode = {
      id: 'n-target',
      type: 'test-target',
      position: { x: 0, y: 0 },
      parameters: {
        gain: 0.5
      },
      parameterInputModes: {}
    };
    const graph: NodeGraph = {
      id: 'graph-uniform',
      name: 'Uniform',
      version: '2.0',
      nodes: [targetNode],
      connections: []
    };
    const uniformNames = new Map<string, string>([
      [`${targetNode.id}.gain`, 'uTargetGain']
    ]);
    const variableNames = new Map<string, Map<string, string>>();

    const expressions = buildFloatParamExpressions(
      targetNode,
      nodeSpecs.get('test-target')!,
      graph,
      uniformNames,
      variableNames,
      nodeSpecs,
      (configValue, inputValue, mode, _paramType) =>
        `(${configValue}) ${mode} (${inputValue})`,
      escapeIdentity
    );

    expect(expressions.gain).toBe('uTargetGain');
    expect(expressions.__hasInputConnections).toBeUndefined();
  });

  it('uses automation expression when an automation lane is present', () => {
    const nodeSpecs = buildTestNodeSpecs();
    const targetNode = {
      id: 'n-target-auto',
      type: 'test-target',
      position: { x: 0, y: 0 },
      parameters: {
        gain: 0.25
      },
      parameterInputModes: {}
    };
    const graph: NodeGraph = {
      id: 'graph-automation',
      name: 'Automation',
      version: '2.0',
      nodes: [targetNode],
      connections: [],
      automation: {
        bpm: 120,
        durationSeconds: 8,
        lanes: [
          {
            id: 'lane-123',
            nodeId: targetNode.id,
            paramName: 'gain',
            regions: [
              {
                id: 'region-1',
                startTime: 0,
                duration: 2,
                loop: false,
                curve: {
                  interpolation: 'linear',
                  keyframes: [
                    { time: 0, value: 0 },
                    { time: 1, value: 1 }
                  ]
                }
              }
            ]
          }
        ]
      }
    };
    const uniformNames = new Map<string, string>([
      [`${targetNode.id}.gain`, 'uIgnoredGain']
    ]);
    const variableNames = new Map<string, Map<string, string>>();

    const expressions = buildFloatParamExpressions(
      targetNode,
      nodeSpecs.get('test-target')!,
      graph,
      uniformNames,
      variableNames,
      nodeSpecs,
      (configValue, inputValue, mode, _paramType) =>
        `(${configValue}) ${mode} (${inputValue})`,
      escapeIdentity
    );

    // lane-123 → sanitized to lane_123 in getAutomationExpressionForParam
    expect(expressions.gain).toBe('evalAutomation_lane_123(uTimelineTime)');
    expect(expressions.__hasInputConnections).toBeUndefined();
  });

  it('uses input variable directly when inputMode is override', () => {
    const nodeSpecs = buildTestNodeSpecs();
    const sourceNode = {
      id: 'n-source',
      type: 'test-source',
      position: { x: 0, y: 0 },
      parameters: {}
    };
    const targetNode = {
      id: 'n-target-override',
      type: 'test-target',
      position: { x: 0, y: 0 },
      parameters: {
        gain: 0.5
      },
      parameterInputModes: {
        gain: 'override'
      }
    };
    const graph: NodeGraph = {
      id: 'graph-override',
      name: 'Override',
      version: '2.0',
      nodes: [sourceNode, targetNode],
      connections: [
        {
          id: 'c1',
          sourceNodeId: sourceNode.id,
          sourcePort: 'out',
          targetNodeId: targetNode.id,
          targetParameter: 'gain'
        }
      ]
    };
    const uniformNames = new Map<string, string>();
    const variableNames = new Map<string, Map<string, string>>([
      [
        sourceNode.id,
        new Map<string, string>([['out', 'node_source_out']])
      ]
    ]);

    const expressions = buildFloatParamExpressions(
      targetNode,
      nodeSpecs.get('test-target')!,
      graph,
      uniformNames,
      variableNames,
      nodeSpecs,
      (configValue, inputValue, mode, _paramType) =>
        `(${configValue}) ${mode} (${inputValue})`,
      escapeIdentity
    );

    expect(expressions.gain).toBe('node_source_out');
    expect(expressions.__hasInputConnections).toBe(true);
  });

  it('combines config and input for add, subtract, and multiply input modes', () => {
    const nodeSpecs = buildTestNodeSpecs();
    const sourceNode = {
      id: 'n-source-2',
      type: 'test-source',
      position: { x: 0, y: 0 },
      parameters: {}
    };
    const baseTarget = {
      id: 'n-target-combine',
      type: 'test-target',
      position: { x: 0, y: 0 },
      parameters: {
        gain: 0.5
      }
    };
    const graphBase: Omit<NodeGraph, 'connections'> = {
      id: 'graph-combine',
      name: 'Combine',
      version: '2.0',
      nodes: [sourceNode, baseTarget]
    };
    const uniformNames = new Map<string, string>();
    const variableNames = new Map<string, Map<string, string>>([
      [
        sourceNode.id,
        new Map<string, string>([['out', 'node_src_out']])
      ]
    ]);

    const generateCombination = (
      configValue: string,
      inputValue: string,
      mode: 'override' | 'add' | 'subtract' | 'multiply',
      _paramType: 'float' | 'int'
    ): string => {
      return `combine(${configValue},${mode},${inputValue})`;
    };

    const modes: Array<'add' | 'subtract' | 'multiply'> = ['add', 'subtract', 'multiply'];

    for (const mode of modes) {
      const targetNode = {
        ...baseTarget,
        parameterInputModes: {
          gain: mode
        }
      };
      const graph: NodeGraph = {
        ...graphBase,
        nodes: [sourceNode, targetNode],
        connections: [
          {
            id: `c-${mode}`,
            sourceNodeId: sourceNode.id,
            sourcePort: 'out',
            targetNodeId: targetNode.id,
            targetParameter: 'gain'
          }
        ]
      };

      const expressions = buildFloatParamExpressions(
        targetNode,
        nodeSpecs.get('test-target')!,
        graph,
        uniformNames,
        variableNames,
        nodeSpecs,
        generateCombination,
        escapeIdentity
      );

      expect(expressions.gain).toBe('combine(0.5,' + mode + ',node_src_out)');
      expect(expressions.__hasInputConnections).toBe(true);
    }
  });

  it('uses mapped audio uniform for virtual-node parameter connection', () => {
    const nodeSpecs = buildTestNodeSpecs();
    const targetNode = {
      id: 'n-target-virtual-audio',
      type: 'test-target',
      position: { x: 0, y: 0 },
      parameters: {
        gain: 0.5
      },
      parameterInputModes: {
        gain: 'override'
      }
    };
    const virtualNodeId = 'audio-signal:remap-test123';
    const graph: NodeGraph = {
      id: 'graph-virtual-audio',
      name: 'VirtualAudio',
      version: '2.0',
      nodes: [targetNode],
      connections: [
        {
          id: 'c-virtual',
          sourceNodeId: virtualNodeId,
          sourcePort: 'out',
          targetNodeId: targetNode.id,
          targetParameter: 'gain'
        }
      ]
    };

    const audioUniformName = 'uAudioRemapTest123Out';
    const uniformNames = new Map<string, string>([
      [virtualNodeId, audioUniformName]
    ]);
    const variableNames = new Map<string, Map<string, string>>();

    const expressions = buildFloatParamExpressions(
      targetNode,
      nodeSpecs.get('test-target')!,
      graph,
      uniformNames,
      variableNames,
      nodeSpecs,
      (configValue, inputValue, mode, _paramType) =>
        `(${configValue}) ${mode} (${inputValue})`,
      escapeIdentity
    );

    expect(expressions.gain).toBe(audioUniformName);
    expect(expressions.__hasInputConnections).toBe(true);
  });
});

