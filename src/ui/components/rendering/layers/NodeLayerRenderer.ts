/**
 * NodeLayerRenderer - Renders nodes
 */

import type { LayerRenderer } from '../LayerRenderer';
import { RenderLayer } from '../RenderState';
import type { RenderState } from '../RenderState';
import type { NodeGraph, NodeInstance } from '../../../../types/nodeGraph';
import type { NodeSpec } from '../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../NodeRenderer';

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
  audioManager?: any;
  renderNode: (node: NodeInstance, skipPorts: boolean) => void;
  isNodeVisible?: (node: NodeInstance, metrics: NodeRenderMetrics) => boolean;
  // For dirty region filtering
  getPanZoom?: () => { panX: number; panY: number; zoom: number };
  renderState?: RenderState;
}

export class NodeLayerRenderer implements LayerRenderer {
  layer = RenderLayer.Nodes;
  private context: NodeLayerContext;
  
  constructor(context: NodeLayerContext) {
    this.context = context;
  }
  
  shouldRender(_state: RenderState): boolean {
    // Nodes always render (to match old behavior)
    // Dirty tracking controls WHEN to trigger renders, not WHAT to render
    return true;
  }
  
  render(_ctx: CanvasRenderingContext2D, _state: RenderState): void {
    const graph = this.context.getGraph ? this.context.getGraph() : this.context.graph;
    // Always render all visible nodes - dirty tracking controls when to trigger renders, not what to render
    // Viewport culling filters out off-screen nodes for performance
    for (const node of graph.nodes) {
      // Get metrics to check visibility
      const metrics = this.context.nodeMetrics.get(node.id);
      
      // If viewport culling is enabled, check visibility before rendering
      // Check visibility before rendering (viewport culling)
      if (metrics && this.context.isNodeVisible && !this.context.isNodeVisible(node, metrics)) {
        continue; // Skip off-screen nodes
      }
      
      // Note: Dirty region filtering removed - without FrameBuffer we can't do true incremental rendering
      // Always render all visible nodes to ensure nothing disappears
      
      // Render node (skip ports - they're rendered in PortLayerRenderer)
      this.context.renderNode(node, true);
    }
  }
}
