/**
 * ParameterConnectionLayerRenderer - Renders parameter connections (on top of nodes)
 * 
 * Phase 3.3: Optimized with path caching - caches connection paths and only
 * recalculates when port positions change.
 */

import type { LayerRenderer } from '../LayerRenderer';
import { RenderLayer } from '../RenderState';
import type { RenderState } from '../RenderState';
import type { NodeGraph, Connection } from '../../../../types/nodeGraph';
import type { NodeSpec } from '../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../NodeRenderer';
import { getCSSColor, getCSSVariableAsNumber } from '../../../../utils/cssTokens';

export interface ParameterConnectionLayerContext {
  graph: NodeGraph;
  nodeSpecs: Map<string, NodeSpec>;
  nodeMetrics: Map<string, NodeRenderMetrics>;
  selectedConnectionIds: Set<string>;
  isConnectionVisible?: (conn: Connection) => boolean;
  // Phase 3.4: Recalculate metrics for dragged nodes before rendering connections
  recalculateMetricsForNodes?: (nodeIds: string[]) => void;
  getDraggedNodeIds?: () => string[];
  // For dirty region filtering
  getPanZoom?: () => { panX: number; panY: number; zoom: number };
  renderState?: RenderState;
}

interface CachedConnectionPath {
  path: Path2D;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

export class ParameterConnectionLayerRenderer implements LayerRenderer {
  layer = RenderLayer.ParameterConnections;
  private context: ParameterConnectionLayerContext;
  
  // Phase 3.3: Cache connection paths to avoid recalculating every frame
  private pathCache: Map<string, CachedConnectionPath> = new Map();
  private positionCache: Map<string, { sourceX: number; sourceY: number; targetX: number; targetY: number }> = new Map();
  
  constructor(context: ParameterConnectionLayerContext) {
    this.context = context;
  }
  
  shouldRender(_state: RenderState): boolean {
    // Parameter connections always render (to match old behavior)
    // Dirty tracking controls WHEN to trigger renders, not WHAT to render
    return true;
  }
  
  render(ctx: CanvasRenderingContext2D, _state: RenderState): void {
    // Phase 3.4: Recalculate metrics for dragged nodes before rendering connections
    // This prevents flickering by ensuring connections use fresh port positions
    if (this.context.getDraggedNodeIds && this.context.recalculateMetricsForNodes) {
      const draggedNodeIds = this.context.getDraggedNodeIds();
      if (draggedNodeIds.length > 0) {
        this.context.recalculateMetricsForNodes(draggedNodeIds);
      }
    }
    
    // Render parameter connections (connections to parameter ports)
    for (const conn of this.context.graph.connections) {
      if (conn.targetParameter) {
        // If viewport culling is enabled, check if connection is visible
        // Check visibility before rendering (viewport culling)
        if (this.context.isConnectionVisible && !this.context.isConnectionVisible(conn)) {
          continue; // Skip off-screen connections
        }
        
        // Note: Dirty region filtering removed - without FrameBuffer we can't do true incremental rendering
        // Always render all visible connections to ensure nothing disappears
        
        this.renderConnection(ctx, conn);
      }
    }
  }
  
  private renderConnection(ctx: CanvasRenderingContext2D, conn: Connection): void {
    const sourceNode = this.context.graph.nodes.find(n => n.id === conn.sourceNodeId);
    const targetNode = this.context.graph.nodes.find(n => n.id === conn.targetNodeId);
    
    if (!sourceNode || !targetNode) return;
    
    const sourceSpec = this.context.nodeSpecs.get(sourceNode.type);
    const targetSpec = this.context.nodeSpecs.get(targetNode.type);
    const sourceMetrics = this.context.nodeMetrics.get(sourceNode.id);
    const targetMetrics = this.context.nodeMetrics.get(targetNode.id);
    
    if (!sourceSpec || !targetSpec || !sourceMetrics || !targetMetrics) return;
    
    const isSelected = this.context.selectedConnectionIds.has(conn.id);
    
    // Get actual port positions
    const sourcePortPos = sourceMetrics.portPositions.get(`output:${conn.sourcePort}`);
    if (!conn.targetParameter) return; // Should not happen for parameter connections
    const targetPortPos = targetMetrics.parameterInputPortPositions.get(conn.targetParameter);
    
    if (!sourcePortPos || !targetPortPos) return;
    
    const sourceX = sourcePortPos.x;
    const sourceY = sourcePortPos.y;
    const targetX = targetPortPos.x;
    const targetY = targetPortPos.y;
    
    // Phase 3.3: Check if positions changed (cache hit/miss)
    const cached = this.positionCache.get(conn.id);
    const positionsChanged = !cached || 
      cached.sourceX !== sourceX || cached.sourceY !== sourceY ||
      cached.targetX !== targetX || cached.targetY !== targetY;
    
    let path: Path2D;
    
    if (!positionsChanged && this.pathCache.has(conn.id)) {
      // Use cached path
      const cachedPath = this.pathCache.get(conn.id)!;
      path = cachedPath.path;
    } else {
      // Calculate new path
      const cp1X = sourceX + 100;
      const cp1Y = sourceY;
      const cp2X = targetX - 100;
      const cp2Y = targetY;
      
      path = new Path2D();
      path.moveTo(sourceX, sourceY);
      path.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, targetX, targetY);
      
      // Cache path and positions
      this.pathCache.set(conn.id, { path, sourceX, sourceY, targetX, targetY });
      this.positionCache.set(conn.id, { sourceX, sourceY, targetX, targetY });
    }
    
    // Get connection color based on source port type
    const sourcePortSpec = sourceSpec.outputs.find(p => p.name === conn.sourcePort);
    const portType = sourcePortSpec?.type || 'float';
    
    // Map port type to connection color token
    const connectionColorMap: Record<string, string> = {
      'float': 'connection-color-float',
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
    
    // Reset canvas state
    ctx.globalAlpha = 1.0;
    ctx.setLineDash([]);
  }
  
  /**
   * Invalidate cache for a specific connection (e.g., when connection is deleted)
   */
  invalidateConnection(connectionId: string): void {
    this.pathCache.delete(connectionId);
    this.positionCache.delete(connectionId);
  }
  
  /**
   * Clear all cached paths (e.g., when graph structure changes significantly)
   */
  clearCache(): void {
    this.pathCache.clear();
    this.positionCache.clear();
  }
}
