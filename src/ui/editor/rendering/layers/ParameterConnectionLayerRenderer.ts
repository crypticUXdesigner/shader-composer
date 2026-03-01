/**
 * ParameterConnectionLayerRenderer - Renders parameter connections (on top of nodes)
 * 
 * Phase 3.3: Optimized with path caching - caches connection paths and only
 * recalculates when port positions change.
 * 
 * PERF_CONNECTION_RENDERING: Refactored to use ConnectionPathCache for better
 * cache management and selective invalidation.
 */

import type { LayerRenderer } from '../LayerRenderer';
import { RenderLayer } from '../RenderState';
import type { RenderState } from '../RenderState';
import type { NodeGraph, Connection, NodeInstance } from '../../../../data-model/types';
import type { NodeSpec } from '../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../NodeRenderer';
import { getCSSColor, getCSSVariableAsNumber } from '../../../../utils/cssTokens';
import { ConnectionPathCache } from '../ConnectionPathCache';
import { isVirtualNodeId } from '../../../../utils/virtualNodes';

export interface ParameterConnectionLayerContext {
  graph: NodeGraph;
  /** When set, used to read the current graph (e.g. after setGraph). Prefer over stale graph. */
  getGraph?: () => NodeGraph;
  nodeSpecs: Map<string, NodeSpec>;
  nodeMetrics: Map<string, NodeRenderMetrics>;
  /** Resolve selected connection IDs at render time so selection updates are visible. */
  getSelectedConnectionIds: () => Set<string>;
  getValidVirtualNodeIds?: () => Set<string>;
  isConnectionVisible?: (conn: Connection) => boolean;
  // PERF_VIEWPORT_CULLING: Check if a node is visible in viewport
  isNodeVisible?: (node: NodeInstance, metrics: NodeRenderMetrics) => boolean;
  // Phase 3.4: Recalculate metrics for dragged nodes before rendering connections
  recalculateMetricsForNodes?: (nodeIds: string[]) => void;
  getDraggedNodeIds?: () => string[];
  // For dirty region filtering
  getPanZoom?: () => { panX: number; panY: number; zoom: number };
  getViewportDimensions?: () => { width: number; height: number };
  renderState?: RenderState;
  /** DOM-derived param port positions (key: nodeId:paramName). Use when available to match actual port layout. */
  getParamPortPositionsFromDOM?: () => Map<string, { x: number; y: number }>;
  /** DOM-derived header output port positions (key: nodeId:output:portName). Use when available for connection masks. */
  getHeaderOutputPortPositionsFromDOM?: () => Map<string, { x: number; y: number }>;
}

export class ParameterConnectionLayerRenderer implements LayerRenderer {
  layer = RenderLayer.ParameterConnections;
  private context: ParameterConnectionLayerContext;
  
  // PERF_CONNECTION_RENDERING: Use dedicated cache class for better management
  private pathCache: ConnectionPathCache = new ConnectionPathCache();
  
  constructor(context: ParameterConnectionLayerContext) {
    this.context = context;
  }
  
  shouldRender(_state: RenderState): boolean {
    // Parameter connections always render (to match old behavior)
    // Dirty tracking controls WHEN to trigger renders, not WHAT to render
    return true;
  }

  render(ctx: CanvasRenderingContext2D, _state: RenderState): void {
    // PERF: Skip parameter connection rendering while dragging node(s) to keep movement smooth.
    if (this.context.getDraggedNodeIds) {
      const dragged = this.context.getDraggedNodeIds();
      if (dragged.length > 0) {
        return;
      }
    }

    // Phase 3.4: Recalculate metrics for dragged nodes before rendering connections
    // This prevents flickering by ensuring connections use fresh port positions
    if (this.context.getDraggedNodeIds && this.context.recalculateMetricsForNodes) {
      const draggedNodeIds = this.context.getDraggedNodeIds();
      if (draggedNodeIds.length > 0) {
        this.context.recalculateMetricsForNodes(draggedNodeIds);
      }
    }
    
    const graph = this.context.getGraph ? this.context.getGraph() : this.context.graph;
    // PERF_VIEWPORT_CULLING: Build visible node set once for efficient culling
    // This avoids checking visibility for every connection
    const visibleNodeIds = new Set<string>();
    if (this.context.isNodeVisible) {
      for (const node of graph.nodes) {
        const metrics = this.context.nodeMetrics.get(node.id);
        if (metrics && this.context.isNodeVisible(node, metrics)) {
          visibleNodeIds.add(node.id);
        }
      }
    }

    // Render parameter connections (connections to parameter ports)
    for (const conn of graph.connections) {
      if (conn.targetParameter) {
        // WP 11: Never draw connections from audio sources on the canvas – they have no visual node
        if (isVirtualNodeId(conn.sourceNodeId)) {
          continue;
        }

        // PERF_VIEWPORT_CULLING: Use visible node set for efficient culling
        // Skip connections where both nodes are off-screen
        if (this.context.isNodeVisible && visibleNodeIds.size > 0) {
          const sourceVisible = visibleNodeIds.has(conn.sourceNodeId);
          const targetVisible = visibleNodeIds.has(conn.targetNodeId);
          
          // Skip if both nodes are off-screen
          if (!sourceVisible && !targetVisible) {
            continue;
          }
        } else if (this.context.isConnectionVisible && !this.context.isConnectionVisible(conn)) {
          // Fallback to isConnectionVisible if isNodeVisible not available
          continue; // Skip off-screen connections
        }
        
        // Note: Dirty region filtering removed - without FrameBuffer we can't do true incremental rendering
        // Always render all visible connections to ensure nothing disappears
        
        this.renderConnection(ctx, conn, graph);
      }
    }
  }
  
  private renderConnection(ctx: CanvasRenderingContext2D, conn: Connection, graph: NodeGraph): void {
    const targetNode = graph.nodes.find(n => n.id === conn.targetNodeId);
    if (!targetNode) return;

    if (!conn.targetParameter) return; // Should not happen for parameter connections
    const targetMetrics = this.context.nodeMetrics.get(targetNode.id);
    const targetSpec = this.context.nodeSpecs.get(targetNode.type);
    if (!targetSpec || !targetMetrics) return;

    // Prefer DOM-derived position (matches actual layout); fallback to metrics
    const domKey = `${conn.targetNodeId}:${conn.targetParameter}`;
    const domPos = this.context.getParamPortPositionsFromDOM?.().get(domKey);
    const targetPortPos = domPos ?? targetMetrics.parameterInputPortPositions.get(conn.targetParameter);
    if (!targetPortPos) return;

    const targetPos = { x: targetPortPos.x, y: targetPortPos.y };

    // WP 11: Virtual node source - no visual node; use fixed anchor to the left of target
    let sourcePos: { x: number; y: number };
    let sourceSpec: NodeSpec | undefined;
    if (isVirtualNodeId(conn.sourceNodeId)) {
      sourcePos = { x: targetPos.x - 150, y: targetPos.y };
      sourceSpec = { id: 'audio-signal', outputs: [{ name: 'out', type: 'float' }] } as NodeSpec;
    } else {
      const sourceNode = graph.nodes.find(n => n.id === conn.sourceNodeId);
      if (!sourceNode) return;
      sourceSpec = this.context.nodeSpecs.get(sourceNode.type);
      const sourceMetrics = this.context.nodeMetrics.get(sourceNode.id);
      if (!sourceSpec || !sourceMetrics) return;
      const headerKey = `${conn.sourceNodeId}:output:${conn.sourcePort}`;
      const domSourcePos = this.context.getHeaderOutputPortPositionsFromDOM?.().get(headerKey);
      const sourcePortPos = domSourcePos ?? sourceMetrics.portPositions.get(`output:${conn.sourcePort}`);
      if (!sourcePortPos) return;
      sourcePos = { x: sourcePortPos.x, y: sourcePortPos.y };
    }

    const selectedIds = this.context.getSelectedConnectionIds();
    const isSelected = selectedIds.has(conn.id);
    
    // PERF_CONNECTION_RENDERING: Use cache to get or calculate path
    let path = this.pathCache.getPath(conn.id, sourcePos, targetPos);
    
    if (!path) {
      path = new Path2D();
      path.moveTo(sourcePos.x, sourcePos.y);
      path.bezierCurveTo(
        sourcePos.x + 100,
        sourcePos.y,
        targetPos.x - 100,
        targetPos.y,
        targetPos.x,
        targetPos.y
      );
      this.pathCache.setPath(conn.id, path, sourcePos, targetPos);
    }
    
    // Get connection color based on source port type
    const sourcePortSpec = sourceSpec.outputs.find(p => p.name === conn.sourcePort);
    const portType = sourcePortSpec?.type || 'float';
    
    // Map port type to connection color token (float→parameter port uses dedicated token)
    const connectionColorMap: Record<string, string> = {
      'float': 'connection-color-float-parameter',
      'vec2': 'connection-color-vec2',
      'vec3': 'connection-color-vec3',
      'vec4': 'connection-color-vec4',
      'int': 'connection-color-int',
      'bool': 'connection-color-bool'
    };
    const connectionColorToken = connectionColorMap[portType] || 'connection-color-default';
    const connectionColor = getCSSColor(connectionColorToken, getCSSColor('connection-color-default', getCSSColor('color-gray-100', '#747e87')));
    const connectionWidth = isSelected
      ? getCSSVariableAsNumber('connection-width-selected', 3)
      : getCSSVariableAsNumber('connection-width', 2);
    const connectionOpacity = isSelected
      ? getCSSVariableAsNumber('connection-opacity-selected', 1.0)
      : getCSSVariableAsNumber('connection-opacity', 0.8);
    
    // Reset canvas state to ensure clean rendering
    ctx.setLineDash([]);
    ctx.strokeStyle = connectionColor;
    ctx.lineWidth = connectionWidth;
    ctx.globalAlpha = connectionOpacity;
    
    ctx.stroke(path);

    // Circle masks at both ends: erase connection so it does not overlap ports visually
    const portRadius = getCSSVariableAsNumber('param-port-circle-size', 14) / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(targetPos.x, targetPos.y, portRadius, 0, Math.PI * 2);
    if (!isVirtualNodeId(conn.sourceNodeId)) {
      ctx.arc(sourcePos.x, sourcePos.y, portRadius, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();

    // Reset canvas state
    ctx.globalAlpha = 1.0;
    ctx.setLineDash([]);
  }
  
  /**
   * Invalidate cache for a specific connection (e.g., when connection is deleted)
   */
  invalidateConnection(connectionId: string): void {
    this.pathCache.invalidate(connectionId);
  }
  
  /**
   * Invalidate all connections involving a specific node
   * PERF_CONNECTION_RENDERING: More efficient than clearing entire cache
   */
  invalidateNodeConnections(nodeId: string): void {
    const graph = this.context.getGraph ? this.context.getGraph() : this.context.graph;
    this.pathCache.invalidateNodeConnections(nodeId, graph.connections);
  }

  /**
   * Clear all cached paths (e.g., when graph structure changes significantly)
   */
  clearCache(): void {
    this.pathCache.clear();
  }
}
