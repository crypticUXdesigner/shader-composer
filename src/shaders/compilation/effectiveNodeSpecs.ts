import type { NodeGraph, NodeInstance } from '../../data-model/types';
import type { NodeSpec, PortSpec, PortType } from '../../types/nodeSpec';
import { buildBlendMainCode, type BlendAlphaMode } from '../nodes/blendNodeCode';
import {
  clonePort,
  getDefaultLiteralForPortType,
  getSourceOutputType,
  inferBlendPortType
} from './blendPortTypeInference';

/**
 * Returns a per-node effective NodeSpec map.
 *
 * Escape hatch for nodes whose port types (and sometimes mainCode) depend on connections
 * (`select`, `blend`). Most nodes use their canonical NodeSpec unchanged.
 */
export function computeEffectiveNodeSpecs(
  graph: NodeGraph,
  executionOrder: string[],
  nodeSpecsByType: Map<string, NodeSpec>
): Map<string, NodeSpec> {
  const effectiveByNodeId = new Map<string, NodeSpec>();

  for (const nodeId of executionOrder) {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) continue;
    const canonical = nodeSpecsByType.get(node.type);
    if (!canonical) continue;

    if (canonical.id === 'select') {
      effectiveByNodeId.set(node.id, buildEffectiveSelectSpec(node, graph, canonical, effectiveByNodeId, nodeSpecsByType));
      continue;
    }

    if (canonical.id === 'blend') {
      effectiveByNodeId.set(node.id, buildEffectiveBlendSpec(node, graph, canonical, effectiveByNodeId, nodeSpecsByType));
      continue;
    }

    effectiveByNodeId.set(node.id, canonical);
  }

  for (const node of graph.nodes) {
    if (effectiveByNodeId.has(node.id)) continue;
    const canonical = nodeSpecsByType.get(node.type);
    if (canonical) effectiveByNodeId.set(node.id, canonical);
  }

  return effectiveByNodeId;
}

function buildEffectiveSelectSpec(
  node: NodeInstance,
  graph: NodeGraph,
  canonical: NodeSpec,
  effectiveByNodeId: Map<string, NodeSpec>,
  nodeSpecsByType: Map<string, NodeSpec>
): NodeSpec {
  let inferred: PortType = 'float';
  for (const conn of graph.connections) {
    if (conn.targetNodeId !== node.id) continue;
    if (conn.targetParameter) continue;
    if (conn.targetPort !== 'trueValue' && conn.targetPort !== 'falseValue') continue;

    const sourceType = getSourceOutputType(
      conn.sourceNodeId,
      conn.sourcePort,
      graph,
      effectiveByNodeId,
      nodeSpecsByType
    );
    if (!sourceType) continue;
    inferred = pickWiderType(inferred, sourceType);
  }

  if (inferred === 'float') {
    const inputs = canonical.inputs.map((p) => {
      if (p.name !== 'trueValue' && p.name !== 'falseValue') return p;
      return clonePort(p, { type: 'float', fallbackExpression: undefined });
    });
    const outputs: PortSpec[] = canonical.outputs.map((o) =>
      o.name === 'out' ? { ...o, type: 'float' as const } : o
    );
    return { ...canonical, inputs, outputs };
  }

  if (canonical.inputs.find((i) => i.name === 'trueValue')?.type !== 'any') {
    return canonical;
  }

  const inputs = canonical.inputs.map((p) => {
    if (p.name !== 'trueValue' && p.name !== 'falseValue') return p;
    const kind = p.name === 'trueValue' ? 'true' : 'false';
    const lit = getDefaultLiteralForPortType(
      inferred as Exclude<PortType, 'any' | 'int' | 'bool'>,
      kind
    );
    return clonePort(p, {
      type: inferred,
      fallbackParameter: undefined,
      fallbackExpression: lit
    });
  });
  const outputs: PortSpec[] = canonical.outputs.map((o) =>
    o.name === 'out' ? { ...o, type: inferred } : o
  );
  return { ...canonical, inputs, outputs };
}

function buildEffectiveBlendSpec(
  node: NodeInstance,
  graph: NodeGraph,
  canonical: NodeSpec,
  effectiveByNodeId: Map<string, NodeSpec>,
  nodeSpecsByType: Map<string, NodeSpec>
): NodeSpec {
  const resolvedType = inferBlendPortType(node, graph, (sourceNodeId, sourcePort) =>
    getSourceOutputType(sourceNodeId, sourcePort, graph, effectiveByNodeId, nodeSpecsByType)
  );

  const rawAlpha = node.parameters?.alphaMode;
  const alphaMode: BlendAlphaMode =
    typeof rawAlpha === 'number' && rawAlpha >= 1 ? 1 : 0;

  const inputs = canonical.inputs.map((p) => {
    if (p.name !== 'base' && p.name !== 'blend') return p;
    return clonePort(p, {
      type: resolvedType,
      fallbackParameter: undefined,
      fallbackExpression: getDefaultLiteralForPortType(resolvedType, 'false')
    });
  });

  const outputs: PortSpec[] = canonical.outputs.map((o) =>
    o.name === 'out' ? { ...o, type: resolvedType } : o
  );

  return {
    ...canonical,
    inputs,
    outputs,
    mainCode: buildBlendMainCode(resolvedType, alphaMode)
  };
}

function pickWiderType(a: PortType, b: PortType): PortType {
  const WIDENESS: Record<Exclude<PortType, 'any'>, number> = {
    bool: 0,
    int: 1,
    float: 2,
    vec2: 3,
    vec3: 4,
    vec4: 5
  };
  if (a === 'any') return b;
  if (b === 'any') return a;
  if (a === b) return a;
  const wa = WIDENESS[a as Exclude<PortType, 'any'>] ?? -1;
  const wb = WIDENESS[b as Exclude<PortType, 'any'>] ?? -1;
  return wa >= wb ? a : b;
}
