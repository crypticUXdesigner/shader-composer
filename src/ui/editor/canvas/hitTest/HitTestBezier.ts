/**
 * Hit testing for bezier control points.
 */

import type { NodeInstance } from '../../../../data-model/types';
import type { NodeSpec } from '../../../../types/nodeSpec';
import { getCSSVariableAsNumber } from '../../../../utils/cssTokens';
import type { HitTestContext } from './HitTestContext';

export function hitTestBezierControlPoint(ctx: HitTestContext, mouseX: number, mouseY: number): { nodeId: string; paramNames: [string, string, string, string]; controlIndex: number } | null {
  const canvasPos = ctx.screenToCanvas(mouseX, mouseY);
  const bezierEditorPadding = getCSSVariableAsNumber('bezier-editor-padding', 12);
  const controlPointSize = getCSSVariableAsNumber('bezier-editor-control-point-size', 8);
  const controlPointHoverSize = getCSSVariableAsNumber('bezier-editor-control-point-hover-size', 12);
  const hitRadius = Math.max(controlPointSize, controlPointHoverSize) / 2 + 4;

  const getParamValue = (node: NodeInstance, spec: NodeSpec, name: string, def: number): number =>
    (node.parameters[name] ?? spec.parameters[name]?.default ?? def) as number;

  for (const node of ctx.graph.nodes) {
    const spec = ctx.nodeSpecs.get(node.type);
    const metrics = ctx.nodeMetrics.get(node.id);
    if (!spec || !metrics) continue;

    const groups: [string, string, string, string][] = [];
    const layout = spec.parameterLayout?.elements;
    if (layout) {
      for (const el of layout) {
        const e = el as { type?: string; parameters?: string[]; editors?: [string, string, string, string][] };
        if (e?.type === 'bezier-editor' && e.parameters?.length === 4) {
          groups.push(e.parameters as [string, string, string, string]);
        } else if (e?.type === 'bezier-editor-row' && Array.isArray(e.editors)) {
          for (const g of e.editors) {
            if (g?.length === 4) groups.push(g);
          }
        }
      }
    }
    if (groups.length === 0 && (spec.id === 'bezier-curve' || (spec.parameters.x1 && spec.parameters.y1 && spec.parameters.x2 && spec.parameters.y2))) {
      groups.push(['x1', 'y1', 'x2', 'y2']);
    }

    for (const paramNames of groups) {
      const [x1Name, y1Name, x2Name, y2Name] = paramNames;
      const pos = metrics.parameterGridPositions.get(x1Name);
      if (!pos) continue;
      const drawX = pos.cellX + bezierEditorPadding;
      const drawY = pos.cellY + bezierEditorPadding;
      const drawWidth = pos.cellWidth - bezierEditorPadding * 2;
      const drawHeight = pos.cellHeight - bezierEditorPadding * 2;
      if (drawWidth <= 0 || drawHeight <= 0) continue;
      const x1 = getParamValue(node, spec, x1Name, 0);
      const y1 = getParamValue(node, spec, y1Name, 0);
      const x2 = getParamValue(node, spec, x2Name, 1);
      const y2 = getParamValue(node, spec, y2Name, 1);
      const cp1X = drawX + x1 * drawWidth;
      const cp1Y = drawY + (1 - y1) * drawHeight;
      const cp2X = drawX + x2 * drawWidth;
      const cp2Y = drawY + (1 - y2) * drawHeight;
      const dx1 = canvasPos.x - cp1X;
      const dy1 = canvasPos.y - cp1Y;
      if (Math.sqrt(dx1 * dx1 + dy1 * dy1) <= hitRadius) return { nodeId: node.id, paramNames, controlIndex: 0 };
      const dx2 = canvasPos.x - cp2X;
      const dy2 = canvasPos.y - cp2Y;
      if (Math.sqrt(dx2 * dx2 + dy2 * dy2) <= hitRadius) return { nodeId: node.id, paramNames, controlIndex: 1 };
    }
  }
  return null;
}
