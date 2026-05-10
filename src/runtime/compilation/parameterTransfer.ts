/**
 * Transfer parameter values from old shader instance and from graph to new instance.
 * Extracted from CompilationManager for smaller module size.
 */

import type { NodeGraph } from '../../data-model/types';
import type { PreviewProgramInstance, UniformMetadata } from '../types';
import { isRuntimeOnlyParameter } from '../../utils/runtimeOnlyParams';

function toVec4(
  v: UniformMetadata['defaultValue']
): number | [number, number, number, number] {
  if (typeof v === 'number') return v;
  if (v.length === 4) return v as [number, number, number, number];
  if (v.length === 3) return [v[0], v[1], v[2], 0];
  return [v[0], v[1], 0, 0];
}

/**
 * Seed a program instance with compiler-declared default uniform values.
 *
 * Important: graphs often omit parameter keys that equal defaults (and will always omit
 * *new* parameters when loading old presets). If we only transfer `node.parameters`,
 * missing entries would otherwise read as 0.0 on GPU, breaking back-compat.
 */
export function applyUniformDefaults(
  uniforms: UniformMetadata[],
  instance: PreviewProgramInstance
): void {
  for (const u of uniforms) {
    instance.setParameter(u.nodeId, u.paramName, toVec4(u.defaultValue));
  }
}

/**
 * Transfer parameter values from old instance to new instance.
 * Only transfers parameters that were not connected in the old shader.
 */
export function transferParameters(
  graph: NodeGraph,
  oldInstance: PreviewProgramInstance,
  newInstance: PreviewProgramInstance
): void {
  const validNodeIds = new Set(graph.nodes.map(n => n.id));

  for (const [key, value] of oldInstance.getParameters()) {
    const dot = key.lastIndexOf('.');
    if (dot <= 0) continue;
    const nodeId = key.slice(0, dot);
    const paramName = key.slice(dot + 1);
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
  shaderInstance: PreviewProgramInstance
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
