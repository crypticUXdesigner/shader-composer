/**
 * Resolves which Select node value input is active (matches GLSL: condition > 0.5).
 */

import type { NodeGraph, NodeInstance } from '../data-model/types';
import type { NodeSpec } from '../types/nodeSpec';
import type { IAudioManager } from '../runtime/types';
import { computeEffectiveParameterValue } from './parameterValueCalculator';
import { getNodeInputPortScalarValue } from './parameterValueCalculatorInput';
import { evaluateAutomationSignalBindingForParam } from './automationSignals';

export type SelectActiveBranchPort = 'trueValue' | 'falseValue';

export function resolveSelectActiveBranchPort(
  node: NodeInstance,
  spec: NodeSpec,
  graph: NodeGraph,
  nodeSpecs: Map<string, NodeSpec>,
  audioManager: IAudioManager | undefined,
  timelineTime: number
): SelectActiveBranchPort | null {
  if (spec.id !== 'select') return null;

  const paramSpec = spec.parameters?.condition;
  if (!paramSpec) return null;

  const conditionConnected = graph.connections.some(
    (c) => !c.disabled && c.targetNodeId === node.id && c.targetPort === 'condition'
  );

  let condition: number | null = null;
  if (conditionConnected) {
    condition = getNodeInputPortScalarValue(node.id, 'condition', graph, nodeSpecs, audioManager, 0);
  }

  if (condition === null) {
    const { value: automationVal } = evaluateAutomationSignalBindingForParam(
      node,
      'condition',
      graph,
      timelineTime,
      paramSpec
    );
    const effective = computeEffectiveParameterValue(
      node,
      'condition',
      paramSpec,
      graph,
      nodeSpecs,
      audioManager,
      automationVal ?? undefined
    );
    condition =
      effective !== null && typeof effective === 'number' && isFinite(effective) ? effective : null;
  }

  if (condition === null) return null;
  return condition > 0.5 ? 'trueValue' : 'falseValue';
}
