/**
 * SmartGuidesManager
 * 
 * Manages smart guides for node alignment during dragging.
 * Calculates alignment guides and snapping positions.
 */
import type { NodeInstance } from '../../../types/nodeGraph';
import type { NodeRenderMetrics } from '../NodeRenderer';
import { getCSSColor } from '../../../utils/cssTokens';

export interface SmartGuide {
  vertical: Array<{ x: number; startY: number; endY: number }>;
  horizontal: Array<{ y: number; startX: number; endX: number }>;
}

export interface SmartGuidesResult {
  snappedX: number;
  snappedY: number;
  guides: SmartGuide;
}

export interface SmartGuidesContext {
  getNodeMetrics: (nodeId: string) => NodeRenderMetrics | undefined;
  isNodeVisible: (node: NodeInstance, metrics: NodeRenderMetrics) => boolean;
  getZoom: () => number;
  getNodes: () => NodeInstance[];
}

export class SmartGuidesManager {
  private readonly SNAP_THRESHOLD = 14; // pixels in screen space (effective threshold scales with zoom)
  private readonly MAX_ORTHOGONAL_GUIDE_DISTANCE = 250; // pixels in screen space; prevents snapping to far-away nodes

  /**
   * Calculate smart guides and snap position for a node being dragged
   */
  calculateGuides(
    draggingNode: NodeInstance,
    proposedX: number,
    proposedY: number,
    context: SmartGuidesContext
  ): SmartGuidesResult {
    const draggingMetrics = context.getNodeMetrics(draggingNode.id);
    if (!draggingMetrics) {
      return { snappedX: proposedX, snappedY: proposedY, guides: { vertical: [], horizontal: [] } };
    }

    const draggingLeft = proposedX;
    const draggingRight = proposedX + draggingMetrics.width;
    const draggingTop = proposedY;
    const draggingBottom = proposedY + draggingMetrics.height;

    const verticalGuides: Array<{ x: number; startY: number; endY: number }> = [];
    const horizontalGuides: Array<{ y: number; startX: number; endX: number }> = [];

    let snappedX = proposedX;
    let snappedY = proposedY;
    let bestSnapX: { pos: number; distance: number; alignType: string } | null = null;
    let bestSnapY: { pos: number; distance: number; alignType: string } | null = null;

    const snapThreshold = this.SNAP_THRESHOLD / context.getZoom();
    const maxOrthogonalDistance = this.MAX_ORTHOGONAL_GUIDE_DISTANCE / context.getZoom();

    const intervalGap = (aStart: number, aEnd: number, bStart: number, bEnd: number): number => {
      // Distance between two 1D intervals (0 if overlapping)
      if (aEnd < bStart) return bStart - aEnd;
      if (bEnd < aStart) return aStart - bEnd;
      return 0;
    };

    // Check alignment with other visible nodes
    for (const node of context.getNodes()) {
      if (node.id === draggingNode.id) continue;

      const metrics = context.getNodeMetrics(node.id);
      if (!metrics) continue;

      // Only consider nodes that are at least partially visible
      if (!context.isNodeVisible(node, metrics)) continue;

      const nodeLeft = node.position.x;
      const nodeRight = node.position.x + metrics.width;
      const nodeTop = node.position.y;
      const nodeBottom = node.position.y + metrics.height;

      // Keep guides local: only consider nodes that are reasonably close on the orthogonal axis.
      // This avoids snapping to an alignment line from a far-away node when a nearby node is the
      // one the user is actually trying to align with.
      const verticalGap = intervalGap(draggingTop, draggingBottom, nodeTop, nodeBottom);
      const horizontalGap = intervalGap(draggingLeft, draggingRight, nodeLeft, nodeRight);

      // Vertical alignment checks (left, right)
      const alignmentsX = verticalGap <= maxOrthogonalDistance ? [
        { pos: nodeLeft, alignType: 'left' },
        { pos: nodeRight, alignType: 'right' }
      ] : [];

      for (const align of alignmentsX) {
        // Check if dragging node's left edge aligns
        const distLeft = Math.abs(draggingLeft - align.pos);
        const positionChangeLeft = Math.abs(align.pos - proposedX);
        if (distLeft < snapThreshold && positionChangeLeft <= snapThreshold && (!bestSnapX || distLeft < bestSnapX.distance)) {
          bestSnapX = { pos: align.pos, distance: distLeft, alignType: align.alignType };
        }

        // Check if dragging node's right edge aligns
        const distRight = Math.abs(draggingRight - align.pos);
        const positionChangeRight = Math.abs((align.pos - draggingMetrics.width) - proposedX);
        if (distRight < snapThreshold && positionChangeRight <= snapThreshold && (!bestSnapX || distRight < bestSnapX.distance)) {
          bestSnapX = { pos: align.pos, distance: distRight, alignType: align.alignType };
        }

        // Only add guide if we're actually close enough to potentially snap
        if ((distLeft < snapThreshold && positionChangeLeft <= snapThreshold) ||
            (distRight < snapThreshold && positionChangeRight <= snapThreshold)) {
          const guideStartY = Math.min(draggingTop, nodeTop);
          const guideEndY = Math.max(draggingBottom, nodeBottom);
          verticalGuides.push({ x: align.pos, startY: guideStartY, endY: guideEndY });
        }
      }

      // Horizontal alignment checks (top, bottom)
      const alignmentsY = horizontalGap <= maxOrthogonalDistance ? [
        { pos: nodeTop, alignType: 'top' },
        { pos: nodeBottom, alignType: 'bottom' }
      ] : [];

      for (const align of alignmentsY) {
        // Check if dragging node's top edge aligns
        const distTop = Math.abs(draggingTop - align.pos);
        const positionChangeTop = Math.abs(align.pos - proposedY);
        if (distTop < snapThreshold && positionChangeTop <= snapThreshold && (!bestSnapY || distTop < bestSnapY.distance)) {
          bestSnapY = { pos: align.pos, distance: distTop, alignType: align.alignType };
        }

        // Check if dragging node's bottom edge aligns
        const distBottom = Math.abs(draggingBottom - align.pos);
        const positionChangeBottom = Math.abs((align.pos - draggingMetrics.height) - proposedY);
        if (distBottom < snapThreshold && positionChangeBottom <= snapThreshold && (!bestSnapY || distBottom < bestSnapY.distance)) {
          bestSnapY = { pos: align.pos, distance: distBottom, alignType: align.alignType };
        }

        // Only add guide if we're actually close enough to potentially snap
        if ((distTop < snapThreshold && positionChangeTop <= snapThreshold) ||
            (distBottom < snapThreshold && positionChangeBottom <= snapThreshold)) {
          const guideStartX = Math.min(draggingLeft, nodeLeft);
          const guideEndX = Math.max(draggingRight, nodeRight);
          horizontalGuides.push({ y: align.pos, startX: guideStartX, endX: guideEndX });
        }
      }
    }

    // Apply snapping based on best matches
    if (bestSnapX) {
      let candidateSnappedX: number;
      if (bestSnapX.alignType === 'left') {
        candidateSnappedX = bestSnapX.pos;
      } else if (bestSnapX.alignType === 'right') {
        candidateSnappedX = bestSnapX.pos - draggingMetrics.width;
      } else {
        candidateSnappedX = proposedX;
      }

      const positionChangeX = Math.abs(candidateSnappedX - proposedX);
      if (positionChangeX <= snapThreshold) {
        snappedX = candidateSnappedX;
      }
    }

    if (bestSnapY) {
      let candidateSnappedY: number;
      if (bestSnapY.alignType === 'top') {
        candidateSnappedY = bestSnapY.pos;
      } else if (bestSnapY.alignType === 'bottom') {
        candidateSnappedY = bestSnapY.pos - draggingMetrics.height;
      } else {
        candidateSnappedY = proposedY;
      }

      const positionChangeY = Math.abs(candidateSnappedY - proposedY);
      if (positionChangeY <= snapThreshold) {
        snappedY = candidateSnappedY;
      }
    }

    // Filter duplicate guides
    const uniqueVerticalGuides = new Map<number, { x: number; startY: number; endY: number }>();
    for (const guide of verticalGuides) {
      const existing = uniqueVerticalGuides.get(guide.x);
      if (!existing) {
        uniqueVerticalGuides.set(guide.x, guide);
      } else {
        existing.startY = Math.min(existing.startY, guide.startY);
        existing.endY = Math.max(existing.endY, guide.endY);
      }
    }

    const uniqueHorizontalGuides = new Map<number, { y: number; startX: number; endX: number }>();
    for (const guide of horizontalGuides) {
      const existing = uniqueHorizontalGuides.get(guide.y);
      if (!existing) {
        uniqueHorizontalGuides.set(guide.y, guide);
      } else {
        existing.startX = Math.min(existing.startX, guide.startX);
        existing.endX = Math.max(existing.endX, guide.endX);
      }
    }

    return {
      snappedX,
      snappedY,
      guides: {
        vertical: Array.from(uniqueVerticalGuides.values()),
        horizontal: Array.from(uniqueHorizontalGuides.values())
      }
    };
  }

  /**
   * Render smart guide lines
   */
  renderGuides(
    ctx: CanvasRenderingContext2D,
    guides: SmartGuide,
    viewState: { panX: number; panY: number; zoom: number },
    canvasRect: DOMRect
  ): void {
    if (guides.vertical.length === 0 && guides.horizontal.length === 0) {
      return;
    }

    ctx.save();

    const viewportLeft = -viewState.panX / viewState.zoom;
    const viewportTop = -viewState.panY / viewState.zoom;
    const viewportRight = (canvasRect.width - viewState.panX) / viewState.zoom;
    const viewportBottom = (canvasRect.height - viewState.panY) / viewState.zoom;

    // Get guide color from CSS
    const guideColor = getCSSColor('smart-guide-color', getCSSColor('color-blue-90', '#6565dc'));
    const guideWidth = 1;

    ctx.strokeStyle = guideColor;
    ctx.lineWidth = guideWidth / viewState.zoom;
    ctx.setLineDash([4 / viewState.zoom, 4 / viewState.zoom]);
    ctx.globalAlpha = 0.8;

    // Render vertical guides
    for (const guide of guides.vertical) {
      const startY = Math.max(viewportTop, Math.min(viewportBottom, guide.startY));
      const endY = Math.max(viewportTop, Math.min(viewportBottom, guide.endY));

      if (endY > startY) {
        ctx.beginPath();
        ctx.moveTo(guide.x, startY);
        ctx.lineTo(guide.x, endY);
        ctx.stroke();
      }
    }

    // Render horizontal guides
    for (const guide of guides.horizontal) {
      const startX = Math.max(viewportLeft, Math.min(viewportRight, guide.startX));
      const endX = Math.max(viewportLeft, Math.min(viewportRight, guide.endX));

      if (endX > startX) {
        ctx.beginPath();
        ctx.moveTo(startX, guide.y);
        ctx.lineTo(endX, guide.y);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
