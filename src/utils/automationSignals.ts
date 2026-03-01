/**
 * Signal helpers for timeline automation.
 *
 * This module bridges the existing automation evaluator with the signal model
 * by creating AutomationSignalSource bindings and evaluating them at a given
 * transport time. It is intended for JS-side parameter evaluation and UI
 * display; graph storage and GLSL codegen remain unchanged.
 */

import type { NodeGraph, NodeInstance } from '../data-model/types';
import type { ParameterSpec } from '../types/nodeSpec';
import type { SignalBinding } from '../data-model/signals';
import { createAutomationSignalBinding } from '../data-model/signals';
import { getAutomationValueForParam } from './automationEvaluator';

export interface EvaluatedAutomationSignal {
  binding: SignalBinding<number>;
  value: number | null;
}

/**
 * Create an automation signal binding for a node parameter at a given time and
 * evaluate it using the existing automation evaluator.
 *
 * - binding.source.kind === 'automation'
 * - value is the automation value in parameter range or null when inactive
 */
export function evaluateAutomationSignalBindingForParam(
  node: NodeInstance,
  paramName: string,
  graph: NodeGraph,
  t: number,
  paramSpec?: ParameterSpec,
): EvaluatedAutomationSignal {
  const value = getAutomationValueForParam(node, paramName, graph, t, paramSpec);

  const binding = createAutomationSignalBinding<number>(
    `automation:${node.id}:${paramName}`,
    `${node.id}:${paramName}`,
    1,
    value ?? undefined,
  );

  return { binding, value };
}

