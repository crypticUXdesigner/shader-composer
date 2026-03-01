/**
 * Connection hit testing and bezier curve helpers.
 */

import type { HitTestContext } from './HitTestContext';

function bezierPoint(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  t: number
): { x: number; y: number } {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * x0 + 3 * uu * t * x1 + 3 * u * tt * x2 + ttt * x3,
    y: uuu * y0 + 3 * uu * t * y1 + 3 * u * tt * y2 + ttt * y3
  };
}

function isPointNearBezier(
  px: number, py: number,
  x0: number, y0: number,
  x3: number, y3: number,
  threshold: number
): boolean {
  const cp1X = x0 + 100;
  const cp1Y = y0;
  const cp2X = x3 - 100;
  const cp2Y = y3;
  const dx = x3 - x0;
  const dy = y3 - y0;
  const curveLength = Math.sqrt(dx * dx + dy * dy);
  const samples = Math.max(120, Math.ceil(curveLength / 3));
  let minDistance = Infinity;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const point = bezierPoint(x0, y0, cp1X, cp1Y, cp2X, cp2Y, x3, y3, t);
    const dpx = px - point.x;
    const dpy = py - point.y;
    const distance = Math.sqrt(dpx * dpx + dpy * dpy);
    minDistance = Math.min(minDistance, distance);
  }
  return minDistance < threshold;
}

export function hitTestConnection(ctx: HitTestContext, mouseX: number, mouseY: number): string | null {
  const rect = ctx.getConnectionHitTestRect?.() ?? ctx.canvas.getBoundingClientRect();
  const canvasPos = ctx.viewStateManager.screenToCanvas(mouseX, mouseY, rect);
  const viewState = ctx.getViewState();
  const hitThreshold = 24 / viewState.zoom;

  for (const conn of ctx.graph.connections) {
    const sourceNode = ctx.graph.nodes.find(n => n.id === conn.sourceNodeId);
    const targetNode = ctx.graph.nodes.find(n => n.id === conn.targetNodeId);
    if (!sourceNode || !targetNode) continue;

    const sourceSpec = ctx.nodeSpecs.get(sourceNode.type);
    const targetSpec = ctx.nodeSpecs.get(targetNode.type);
    const sourceMetrics = ctx.nodeMetrics.get(sourceNode.id);
    const targetMetrics = ctx.nodeMetrics.get(targetNode.id);
    if (!sourceSpec || !targetSpec || !sourceMetrics || !targetMetrics) continue;

    let sourcePortPos: { x: number; y: number } | undefined;
    if (conn.targetParameter) {
      const headerKey = `${conn.sourceNodeId}:output:${conn.sourcePort}`;
      sourcePortPos = ctx.getHeaderOutputPortPositionsFromDOM?.().get(headerKey);
    }
    sourcePortPos ??= sourceMetrics.portPositions.get(`output:${conn.sourcePort}`);

    let targetPortPos: { x: number; y: number } | undefined;
    if (conn.targetParameter) {
      const domKey = `${conn.targetNodeId}:${conn.targetParameter}`;
      targetPortPos = ctx.getParamPortPositionsFromDOM?.().get(domKey) ?? targetMetrics.parameterInputPortPositions.get(conn.targetParameter);
    } else {
      targetPortPos = targetMetrics.portPositions.get(`input:${conn.targetPort}`);
    }

    if (!sourcePortPos || !targetPortPos) continue;

    if (isPointNearBezier(canvasPos.x, canvasPos.y, sourcePortPos.x, sourcePortPos.y, targetPortPos.x, targetPortPos.y, hitThreshold)) {
      return conn.id;
    }
  }
  return null;
}
