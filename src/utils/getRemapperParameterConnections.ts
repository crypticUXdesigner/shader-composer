import type { NodeGraph } from '../data-model/types';
import type { NodeSpec } from '../types/nodeSpec';
import { getVirtualNodeId } from './virtualNodes';

export interface RemapperParameterConnectionTarget {
  nodeId: string;
  paramName: string;
  /** Display label: "{paramLabel} ({nodeLabel})" */
  label: string;
}

/**
 * Parameter ports wired to a remapper's virtual audio output.
 */
export function getRemapperParameterConnections(
  graph: NodeGraph,
  remapperId: string,
  nodeSpecs: Map<string, NodeSpec>
): RemapperParameterConnectionTarget[] {
  const virtualNodeId = getVirtualNodeId(`remap-${remapperId}`);
  const targets: RemapperParameterConnectionTarget[] = [];

  for (const conn of graph.connections) {
    if (conn.sourceNodeId !== virtualNodeId || !conn.targetParameter) continue;

    const node = graph.nodes.find((n) => n.id === conn.targetNodeId);
    const spec = node ? nodeSpecs.get(node.type) : undefined;
    const nodeLabel = spec?.displayName ?? node?.type ?? conn.targetNodeId;
    const paramLabel = spec?.parameters?.[conn.targetParameter]?.label ?? conn.targetParameter;

    targets.push({
      nodeId: conn.targetNodeId,
      paramName: conn.targetParameter,
      label: `${paramLabel} (${nodeLabel})`,
    });
  }

  return targets.sort((a, b) => a.label.localeCompare(b.label));
}
