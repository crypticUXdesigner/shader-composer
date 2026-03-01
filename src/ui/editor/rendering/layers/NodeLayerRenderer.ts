/**
 * NodeLayerRenderer - Renders nodes
 *
 * WP 15A: All nodes are DOM-only (DomNodeLayer). No nodes are rendered on canvas.
 * Canvas retains grid, connections, overlays.
 */

import type { LayerRenderer } from '../LayerRenderer';
import { RenderLayer } from '../RenderState';
import type { RenderState } from '../RenderState';
import type { NodeGraph, NodeInstance } from '../../../../data-model/types';
import type { NodeSpec } from '../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../NodeRenderer';
import type { IAudioManager } from '../../../../runtime/types';

export interface NodeLayerContext {
  graph: NodeGraph;
  /** When set, used to read the current graph (e.g. after setGraph). Prefer over stale graph. */
  getGraph?: () => NodeGraph;
  nodeSpecs: Map<string, NodeSpec>;
  nodeMetrics: Map<string, NodeRenderMetrics>;
  selectedNodeIds: Set<string>;
  hoveredPort: { nodeId: string, port: string, isOutput: boolean, parameter?: string } | null;
  isConnecting: boolean;
  connectionStartNodeId: string | null;
  connectionStartPort: string | null;
  connectionStartParameter: string | null;
  audioManager?: IAudioManager;
  renderNode: (node: NodeInstance, skipPorts: boolean) => void;
  isNodeVisible?: (node: NodeInstance, metrics: NodeRenderMetrics) => boolean;
  // For dirty region filtering
  getPanZoom?: () => { panX: number; panY: number; zoom: number };
  renderState?: RenderState;
}

export class NodeLayerRenderer implements LayerRenderer {
  layer = RenderLayer.Nodes;

  constructor(_context: NodeLayerContext) {
    // Context kept for API compatibility; all nodes are DOM-only.
  }
  
  shouldRender(_state: RenderState): boolean {
    return true;
  }
  
  render(_ctx: CanvasRenderingContext2D, _state: RenderState): void {
    // All nodes are DOM-only; nothing to render on canvas.
  }
}
