/**
 * Transfer parameter values from old shader instance and from graph to new instance.
 * Extracted from CompilationManager for smaller module size.
 */

import type { NodeGraph } from '../../data-model/types';
import { ShaderInstance } from '../ShaderInstance';
import { isRuntimeOnlyParameter } from '../../utils/runtimeOnlyParams';

/**
 * Transfer parameter values from old instance to new instance.
 * Only transfers parameters that were not connected in the old shader.
 */
export function transferParameters(
  graph: NodeGraph,
  oldInstance: ShaderInstance,
  newInstance: ShaderInstance
): void {
  const validNodeIds = new Set(graph.nodes.map(n => n.id));

  for (const [key, value] of oldInstance.getParameters()) {
    const [nodeId, paramName] = key.split('.');
    if (!validNodeIds.has(nodeId) || !paramName) continue;

    const isConnected = graph.connections.some(
      conn => conn.targetNodeId === nodeId && conn.targetParameter === paramName
    );
    if (isConnected) {
      const node = graph.nodes.find(n => n.id === nodeId);
      if (node?.parameterInputModes?.[paramName] === 'override') continue;
    }

    const uniformValue = value as number | [number, number, number, number];
    newInstance.setParameter(nodeId, paramName, uniformValue);
  }
}

/**
 * Transfer parameter values from graph to shader instance.
 * Used for initial compilation and to fill gaps after transferring from old instance.
 */
export function transferParametersFromGraph(
  graph: NodeGraph,
  shaderInstance: ShaderInstance
): void {
  for (const node of graph.nodes) {
    for (const [paramName, value] of Object.entries(node.parameters)) {
      if (isRuntimeOnlyParameter(node.type, paramName)) continue;

      const isConnected = graph.connections.some(
        conn => conn.targetNodeId === node.id && conn.targetParameter === paramName
      );
      if (isConnected && node.parameterInputModes?.[paramName] === 'override') continue;

      if (typeof value === 'number') {
        shaderInstance.setParameter(node.id, paramName, value);
      } else if (Array.isArray(value) && value.length === 4 && value.every(x => typeof x === 'number')) {
        shaderInstance.setParameter(node.id, paramName, value as [number, number, number, number]);
      }
    }
  }
}
