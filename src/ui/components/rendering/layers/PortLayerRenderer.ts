/**
 * PortLayerRenderer - Renders node ports
 */

import type { LayerRenderer } from '../LayerRenderer';
import { RenderLayer } from '../RenderState';
import type { RenderState } from '../RenderState';
import type { NodeGraph, NodeInstance } from '../../../../types/nodeGraph';
import type { NodeSpec } from '../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../NodeRenderer';

export interface PortLayerContext {
  graph: NodeGraph;
  nodeSpecs: Map<string, NodeSpec>;
  nodeMetrics: Map<string, NodeRenderMetrics>;
  hoveredPort: { nodeId: string, port: string, isOutput: boolean, parameter?: string } | null;
  isConnecting: boolean;
  connectionStartNodeId: string | null;
  connectionStartPort: string | null;
  connectionStartParameter: string | null;
  renderNodePorts: () => void;
  isNodeVisible?: (node: NodeInstance, metrics: NodeRenderMetrics) => boolean;
}

export class PortLayerRenderer implements LayerRenderer {
  layer = RenderLayer.Ports;
  private context: PortLayerContext;
  
  constructor(context: PortLayerContext) {
    this.context = context;
  }
  
  shouldRender(_state: RenderState): boolean {
    // Ports always render (to match old behavior)
    // Dirty tracking controls WHEN to trigger renders, not WHAT to render
    return true;
  }
  
  render(_ctx: CanvasRenderingContext2D, _state: RenderState): void {
    // Render all node ports
    this.context.renderNodePorts();
  }
}
