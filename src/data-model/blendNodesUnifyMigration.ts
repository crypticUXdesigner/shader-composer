/**
 * Unifies legacy `blend-mode` (Blend Channel) and `blend-color` (Blend Color) into `blend`.
 */

import type { NodeGraph, NodeInstance } from './types';

const LEGACY_BLEND_MODE = 'blend-mode';
const LEGACY_BLEND_COLOR = 'blend-color';
const TARGET_TYPE = 'blend';

/** alphaMode 0 = lerp alpha (legacy Blend Color); ignored for non-vec4 at compile time. */
const DEFAULT_ALPHA_MODE = 0;

export function hasLegacyBlendNodes(graph: NodeGraph): boolean {
  return graph.nodes.some((n) => n.type === LEGACY_BLEND_MODE || n.type === LEGACY_BLEND_COLOR);
}

function migrateBlendNode(node: NodeInstance): NodeInstance {
  const params = { ...(node.parameters ?? {}) };
  if (typeof params.alphaMode !== 'number') {
    params.alphaMode = DEFAULT_ALPHA_MODE;
  }
  return {
    ...node,
    type: TARGET_TYPE,
    parameters: params as NodeInstance['parameters']
  };
}

export function migrateBlendNodesUnify(graph: NodeGraph): NodeGraph {
  if (!hasLegacyBlendNodes(graph)) return graph;
  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.type === LEGACY_BLEND_MODE || node.type === LEGACY_BLEND_COLOR
        ? migrateBlendNode(node)
        : node
    )
  };
}
