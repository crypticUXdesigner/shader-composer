/**
 * SmartGuidesCalculator - Calculates smart guides and snap position for node dragging.
 * Extracted from NodeEditorCanvas to reduce its size.
 */

import type { NodeGraph, NodeInstance } from '../../data-model/types';
import type { NodeSpec } from '../../types/nodeSpec';
import type { NodeRenderer, NodeRenderMetrics } from './NodeRenderer';
import type { SmartGuidesManager } from './canvas/SmartGuidesManager';
import type { SmartGuidesResult, SmartGuide } from './canvas/SmartGuidesManager';

export interface SmartGuidesCalculatorDeps {
  viewStateManager: { getState: () => { zoom: number } };
  smartGuidesManager: SmartGuidesManager;
  graph: NodeGraph;
  nodeSpecs: Map<string, NodeSpec>;
  nodeMetrics: Map<string, NodeRenderMetrics>;
  nodeRenderer: NodeRenderer;
  /** Optional: when provided, only nodes that are visible in the viewport are used as snap targets. When omitted, all nodes are considered (locality is still enforced by SmartGuidesManager's orthogonal distance). */
  isNodeVisible?: (node: NodeInstance, metrics: NodeRenderMetrics) => boolean;
  setCurrentGuides: (guides: SmartGuide) => void;
}

/**
 * Returns a function that computes smart guides and snap position for a dragging node,
 * and updates the current guides via setCurrentGuides.
 */
export function createSmartGuidesCalculator(deps: SmartGuidesCalculatorDeps): (
  draggingNode: NodeInstance,
  proposedX: number,
  proposedY: number
) => SmartGuidesResult {
  return function calculateSmartGuides(
    draggingNode: NodeInstance,
    proposedX: number,
    proposedY: number
  ): SmartGuidesResult {
    const viewState = deps.viewStateManager.getState();
    const result = deps.smartGuidesManager.calculateGuides(
      draggingNode,
      proposedX,
      proposedY,
      {
        getNodeMetrics: (nodeId: string) => {
          const cached = deps.nodeMetrics.get(nodeId);
          if (cached) return cached;
          const node = deps.graph.nodes.find((n) => n.id === nodeId);
          if (!node) return undefined;
          const spec = deps.nodeSpecs.get(node.type);
          if (!spec) return undefined;
          const metrics = deps.nodeRenderer.calculateMetrics(node, spec);
          deps.nodeMetrics.set(nodeId, metrics);
          return metrics;
        },
        isNodeVisible: (node, metrics) => (deps.isNodeVisible ?? (() => true))(node, metrics),
        getZoom: () => viewState.zoom,
        getNodes: () => deps.graph.nodes
      }
    );
    deps.setCurrentGuides(result.guides);
    return result;
  };
}
