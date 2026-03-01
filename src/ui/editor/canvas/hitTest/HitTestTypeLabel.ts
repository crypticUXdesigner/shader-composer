/**
 * Hit testing for type labels, parameter mode buttons, and header labels.
 */

import type { NodeSpec } from '../../../../types/nodeSpec';
import { getCSSVariableAsNumber } from '../../../../utils/cssTokens';
import { getPortTypeDisplayLabel } from '../../rendering/RenderingUtils';
import type { HitTestContext } from './HitTestContext';

export function hitTestHeaderLabel(ctx: HitTestContext, mouseX: number, mouseY: number): { nodeId: string } | null {
  const canvasPos = ctx.screenToCanvas(mouseX, mouseY);
  for (const node of ctx.graph.nodes) {
    const spec = ctx.nodeSpecs.get(node.type);
    const metrics = ctx.nodeMetrics.get(node.id);
    if (!spec || !metrics) continue;
    const headerHeight = metrics.headerHeight;
    const iconBoxHeight = getCSSVariableAsNumber('node-icon-box-height', 48);
    const iconBoxNameSpacing = getCSSVariableAsNumber('node-icon-box-name-spacing', 4);
    const nameSize = getCSSVariableAsNumber('node-header-name-size', 30);
    const nameWeight = getCSSVariableAsNumber('node-header-name-weight', 600);
    const groupHeight = iconBoxHeight + iconBoxNameSpacing + nameSize;
    const iconBoxY = node.position.y + (headerHeight - groupHeight) / 2;
    const nameY = iconBoxY + iconBoxHeight + iconBoxNameSpacing;
    const iconX = node.position.x + metrics.width / 2;
    ctx.ctx.font = `${nameWeight} ${nameSize}px "Space Grotesk", sans-serif`;
    const labelText = node.label ?? spec.displayName;
    const textMetrics = ctx.ctx.measureText(labelText);
    const textWidth = textMetrics.width;
    const textHeight = nameSize;
    const padding = 4;
    const labelLeft = iconX - textWidth / 2 - padding;
    const labelRight = iconX + textWidth / 2 + padding;
    const labelTop = nameY - padding;
    const labelBottom = nameY + textHeight + padding;
    if (canvasPos.x >= labelLeft && canvasPos.x <= labelRight && canvasPos.y >= labelTop && canvasPos.y <= labelBottom) {
      return { nodeId: node.id };
    }
  }
  return null;
}

export function hitTestParameterMode(ctx: HitTestContext, mouseX: number, mouseY: number): { nodeId: string; paramName: string } | null {
  const canvasPos = ctx.screenToCanvas(mouseX, mouseY);
  const hasPort = (spec: NodeSpec, paramName: string) =>
    !spec.parameterLayout?.parametersWithoutPorts?.includes(paramName);
  for (let i = ctx.graph.nodes.length - 1; i >= 0; i--) {
    const node = ctx.graph.nodes[i];
    const spec = ctx.nodeSpecs.get(node.type);
    const metrics = ctx.nodeMetrics.get(node.id);
    if (!spec || !metrics) continue;
    for (const [paramName, gridPos] of metrics.parameterGridPositions.entries()) {
      const paramSpec = spec.parameters[paramName];
      if (!paramSpec || paramSpec.type !== 'float' || !hasPort(spec, paramName)) continue;
      const modeButtonSize = getCSSVariableAsNumber('param-mode-button-size', 20);
      const modeButtonRadius = modeButtonSize / 2;
      const r2 = modeButtonRadius * modeButtonRadius;
      const dx = canvasPos.x - gridPos.portX;
      const dy = canvasPos.y - gridPos.knobY;
      if (dx * dx + dy * dy <= r2) return { nodeId: node.id, paramName };
    }
  }
  return null;
}

export function hitTestTypeLabel(ctx: HitTestContext, mouseX: number, mouseY: number): {
  nodeId: string;
  portName: string;
  portType: string;
  isOutput: boolean;
  screenX: number;
  screenY: number;
  typeLabelBounds?: { left: number; top: number; right: number; bottom: number; width: number; height: number };
} | null {
  const canvasPos = ctx.screenToCanvas(mouseX, mouseY);
  const typeFontSize = getCSSVariableAsNumber('port-type-font-size', 15);
  const typeFontWeight = getCSSVariableAsNumber('port-type-font-weight', 600);
  const typePaddingH = getCSSVariableAsNumber('port-type-padding-horizontal', 8);
  const typePaddingV = getCSSVariableAsNumber('port-type-padding-vertical', 4);
  const portRadius = getCSSVariableAsNumber('port-radius', 12);
  const labelSpacing = getCSSVariableAsNumber('port-label-spacing', 12);
  ctx.ctx.font = `${typeFontWeight} ${typeFontSize}px "Space Grotesk", sans-serif`;

  for (const node of ctx.graph.nodes) {
    const spec = ctx.nodeSpecs.get(node.type);
    const metrics = ctx.nodeMetrics.get(node.id);
    if (!spec || !metrics) continue;

    for (const port of spec.inputs) {
      const pos = metrics.portPositions.get(`input:${port.name}`);
      if (!pos) continue;
      const typeStartX = pos.x + portRadius + labelSpacing;
      const typeWidth = ctx.ctx.measureText(getPortTypeDisplayLabel(port.type)).width;
      const typeBgWidth = typeWidth + typePaddingH * 2;
      const typeBgHeight = typeFontSize + typePaddingV * 2;
      const typeBgX = typeStartX;
      const typeBgY = pos.y - typeBgHeight / 2;
      if (canvasPos.x >= typeBgX && canvasPos.x <= typeBgX + typeBgWidth && canvasPos.y >= typeBgY && canvasPos.y <= typeBgY + typeBgHeight) {
        const rect = ctx.canvas.getBoundingClientRect();
        const screenPos = ctx.viewStateManager.canvasToScreen(typeBgX + typeBgWidth / 2, pos.y, rect);
        const typeLabelTopLeft = ctx.viewStateManager.canvasToScreen(typeBgX, typeBgY, rect);
        const typeLabelBottomRight = ctx.viewStateManager.canvasToScreen(typeBgX + typeBgWidth, typeBgY + typeBgHeight, rect);
        return {
          nodeId: node.id,
          portName: port.name,
          portType: port.type,
          isOutput: false,
          screenX: screenPos.x,
          screenY: screenPos.y,
          typeLabelBounds: {
            left: typeLabelTopLeft.x,
            top: typeLabelTopLeft.y,
            right: typeLabelBottomRight.x,
            bottom: typeLabelBottomRight.y,
            width: typeLabelBottomRight.x - typeLabelTopLeft.x,
            height: typeLabelBottomRight.y - typeLabelTopLeft.y
          }
        };
      }
    }

    for (const port of spec.outputs) {
      const pos = metrics.portPositions.get(`output:${port.name}`);
      if (!pos) continue;
      const typeEndX = pos.x - portRadius - labelSpacing;
      const typeWidth = ctx.ctx.measureText(getPortTypeDisplayLabel(port.type)).width;
      const typeBgWidth = typeWidth + typePaddingH * 2;
      const typeBgHeight = typeFontSize + typePaddingV * 2;
      const typeBgX = typeEndX - typeBgWidth;
      const typeBgY = pos.y - typeBgHeight / 2;
      if (canvasPos.x >= typeBgX && canvasPos.x <= typeBgX + typeBgWidth && canvasPos.y >= typeBgY && canvasPos.y <= typeBgY + typeBgHeight) {
        const rect = ctx.canvas.getBoundingClientRect();
        const screenPos = ctx.viewStateManager.canvasToScreen(typeBgX + typeBgWidth / 2, pos.y, rect);
        const typeLabelTopLeft = ctx.viewStateManager.canvasToScreen(typeBgX, typeBgY, rect);
        const typeLabelBottomRight = ctx.viewStateManager.canvasToScreen(typeBgX + typeBgWidth, typeBgY + typeBgHeight, rect);
        return {
          nodeId: node.id,
          portName: port.name,
          portType: port.type,
          isOutput: true,
          screenX: screenPos.x,
          screenY: screenPos.y,
          typeLabelBounds: {
            left: typeLabelTopLeft.x,
            top: typeLabelTopLeft.y,
            right: typeLabelBottomRight.x,
            bottom: typeLabelBottomRight.y,
            width: typeLabelBottomRight.x - typeLabelTopLeft.x,
            height: typeLabelBottomRight.y - typeLabelTopLeft.y
          }
        };
      }
    }
  }
  return null;
}
