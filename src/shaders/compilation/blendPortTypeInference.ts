import type { NodeGraph, NodeInstance } from '../../data-model/types';
import type { NodeSpec, PortSpec, PortType } from '../../types/nodeSpec';

const WIDENESS: Record<Exclude<PortType, 'any'>, number> = {
  bool: 0,
  int: 1,
  float: 2,
  vec2: 3,
  vec3: 4,
  vec4: 5
};

export function pickWiderPortType(a: PortType, b: PortType): PortType {
  if (a === 'any') return b;
  if (b === 'any') return a;
  if (a === b) return a;
  const wa = WIDENESS[a as Exclude<PortType, 'any'>] ?? -1;
  const wb = WIDENESS[b as Exclude<PortType, 'any'>] ?? -1;
  return wa >= wb ? a : b;
}

export type BlendSourceTypeLookup = (
  sourceNodeId: string,
  sourcePort: string
) => PortType | undefined;

/**
 * Infers float/vec2/vec3/vec4 for a `blend` node from wired `base` / `blend` inputs.
 * Defaults to float when nothing is connected (matches legacy Blend Channel).
 */
export function inferBlendPortType(
  node: NodeInstance,
  graph: NodeGraph,
  lookupSourceOutputType: BlendSourceTypeLookup
): Exclude<PortType, 'any' | 'int' | 'bool'> {
  let inferred: PortType = 'float';

  for (const conn of graph.connections) {
    if (conn.targetNodeId !== node.id) continue;
    if (conn.targetParameter) continue;
    if (conn.targetPort !== 'base' && conn.targetPort !== 'blend') continue;

    const sourceType = lookupSourceOutputType(conn.sourceNodeId, conn.sourcePort);
    if (!sourceType || sourceType === 'any' || sourceType === 'int' || sourceType === 'bool') {
      continue;
    }
    inferred = pickWiderPortType(inferred, sourceType);
  }

  if (inferred === 'int' || inferred === 'bool' || inferred === 'any') return 'float';
  return inferred;
}

export function clonePort(p: PortSpec, patch: Partial<PortSpec>): PortSpec {
  return { ...p, ...patch };
}

export function getDefaultLiteralForPortType(
  type: Exclude<PortType, 'any' | 'int' | 'bool'>,
  kind: 'true' | 'false'
): string {
  if (type === 'float') return kind === 'true' ? '1.0' : '0.0';
  if (type === 'vec2') return kind === 'true' ? 'vec2(1.0)' : 'vec2(0.0)';
  if (type === 'vec3') return kind === 'true' ? 'vec3(1.0)' : 'vec3(0.0)';
  return kind === 'true' ? 'vec4(1.0)' : 'vec4(0.0)';
}

export function getSourceOutputType(
  sourceNodeId: string,
  sourcePort: string,
  graph: NodeGraph,
  effectiveByNodeId: Map<string, NodeSpec>,
  nodeSpecsByType: Map<string, NodeSpec>
): PortType | undefined {
  const sourceNode = graph.nodes.find((n) => n.id === sourceNodeId);
  if (!sourceNode) return undefined;
  const sourceSpec = effectiveByNodeId.get(sourceNode.id) ?? nodeSpecsByType.get(sourceNode.type);
  if (!sourceSpec) return undefined;
  const sourceOut =
    sourceSpec.outputs.find((o) => o.name === sourcePort) ?? sourceSpec.outputs[0];
  return sourceOut?.type;
}
