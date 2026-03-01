/**
 * Edge-scroll logic for NodeDragHandler when dragging nodes near canvas edges.
 * Extracted to keep NodeDragHandler under ~450 lines.
 */

import type { HandlerContext } from '../HandlerContext';
import { RenderLayer } from '../../editor/rendering/RenderState';

export interface NodeDragEdgeScrollDragState {
  isDraggingNode: boolean;
  draggingNodeId: string | null;
  draggingNodeInitialPos: { x: number; y: number } | null;
  selectedNodesInitialPositions: Map<string, { x: number; y: number }>;
  currentMouseX: number;
  currentMouseY: number;
  dragOffsetX: number;
  dragOffsetY: number;
}

const EDGE_SCROLL_ZONE = 0.1;
const MAX_EDGE_SCROLL_SPEED = 800;

export interface NodeDragEdgeScrollDeps {
  context: HandlerContext;
  getDragState: () => NodeDragEdgeScrollDragState;
}

export function createNodeDragEdgeScroll(deps: NodeDragEdgeScrollDeps): {
  updateVelocity(mouseX: number, mouseY: number): void;
  start(): void;
  stop(): void;
} {
  let edgeScrollAnimationFrame: number | null = null;
  let edgeScrollVelocityX = 0;
  let edgeScrollVelocityY = 0;

  function updateVelocity(mouseX: number, mouseY: number): void {
    const rect = deps.context.getCanvasRect?.();
    if (!rect) return;
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    const scrollZoneWidth = canvasWidth * EDGE_SCROLL_ZONE;
    const scrollZoneHeight = canvasHeight * EDGE_SCROLL_ZONE;
    const distFromLeft = mouseX - rect.left;
    const distFromRight = rect.right - mouseX;
    const distFromTop = mouseY - rect.top;
    const distFromBottom = rect.bottom - mouseY;
    let velocityX = 0;
    if (distFromLeft < scrollZoneWidth) {
      const proximity = 1 - (distFromLeft / scrollZoneWidth);
      velocityX = MAX_EDGE_SCROLL_SPEED * proximity * proximity;
    } else if (distFromRight < scrollZoneWidth) {
      const proximity = 1 - (distFromRight / scrollZoneWidth);
      velocityX = -MAX_EDGE_SCROLL_SPEED * proximity * proximity;
    }
    let velocityY = 0;
    if (distFromTop < scrollZoneHeight) {
      const proximity = 1 - (distFromTop / scrollZoneHeight);
      velocityY = MAX_EDGE_SCROLL_SPEED * proximity * proximity;
    } else if (distFromBottom < scrollZoneHeight) {
      const proximity = 1 - (distFromBottom / scrollZoneHeight);
      velocityY = -MAX_EDGE_SCROLL_SPEED * proximity * proximity;
    }
    edgeScrollVelocityX = velocityX;
    edgeScrollVelocityY = velocityY;
  }

  function start(): void {
    if (edgeScrollAnimationFrame !== null) return;
    let lastTime = performance.now();
    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      const state = deps.context.getState();
      const drag = deps.getDragState();
      updateVelocity(drag.currentMouseX, drag.currentMouseY);
      if (edgeScrollVelocityX !== 0 || edgeScrollVelocityY !== 0) {
        const newState = { ...state };
        newState.panX += edgeScrollVelocityX * deltaTime;
        newState.panY += edgeScrollVelocityY * deltaTime;
        deps.context.setState(() => newState);
        if (drag.isDraggingNode && drag.draggingNodeId && drag.draggingNodeInitialPos) {
          const graph = deps.context.getGraph();
          const node = graph.nodes.find(n => n.id === drag.draggingNodeId);
          if (node) {
            const canvasPos = deps.context.screenToCanvas(
              drag.currentMouseX - drag.dragOffsetX,
              drag.currentMouseY - drag.dragOffsetY
            );
            const { snappedX, snappedY, guides } = deps.context.calculateSmartGuides?.(node, canvasPos.x, canvasPos.y)
              ?? { snappedX: canvasPos.x, snappedY: canvasPos.y, guides: { vertical: [], horizontal: [] } };
            const deltaX = snappedX - drag.draggingNodeInitialPos.x;
            const deltaY = snappedY - drag.draggingNodeInitialPos.y;
            const movedNodeIds: string[] = [];
            for (const [nodeId, initialPos] of drag.selectedNodesInitialPositions.entries()) {
              const selectedNode = graph.nodes.find(n => n.id === nodeId);
              if (selectedNode) {
                selectedNode.position.x = Math.round(initialPos.x + deltaX);
                selectedNode.position.y = Math.round(initialPos.y + deltaY);
                deps.context.onNodeMoved?.(nodeId, selectedNode.position.x, selectedNode.position.y);
                movedNodeIds.push(nodeId);
              }
            }
            deps.context.setSmartGuides?.(guides);
            deps.context.setDraggedNodeIds?.(movedNodeIds);
            deps.context.markNodesDirty?.(movedNodeIds);
            deps.context.markLayerDirty?.(RenderLayer.Overlays);
            const connectionsToUpdate: string[] = [];
            for (const nodeId of movedNodeIds) {
              for (const conn of graph.connections) {
                if (conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId) {
                  connectionsToUpdate.push(conn.id);
                }
              }
            }
            if (connectionsToUpdate.length > 0) {
              deps.context.markConnectionsDirty?.(connectionsToUpdate);
            }
            deps.context.markLayerDirty?.(RenderLayer.Ports);
            deps.context.markLayerDirty?.(RenderLayer.Connections);
            deps.context.markLayerDirty?.(RenderLayer.ParameterConnections);
          }
        }
        deps.context.requestRender();
      }
      if (deps.getDragState().isDraggingNode) {
        edgeScrollAnimationFrame = requestAnimationFrame(animate);
      } else {
        edgeScrollAnimationFrame = null;
      }
    };
    edgeScrollAnimationFrame = requestAnimationFrame(animate);
  }

  function stop(): void {
    if (edgeScrollAnimationFrame !== null) {
      cancelAnimationFrame(edgeScrollAnimationFrame);
      edgeScrollAnimationFrame = null;
    }
    edgeScrollVelocityX = 0;
    edgeScrollVelocityY = 0;
  }

  return { updateVelocity, start, stop };
}
