/**
 * Hit testing for color map row buttons and color picker swatches.
 */

import type { HitTestContext } from './HitTestContext';

export function hitTestColorMapRowButtons(ctx: HitTestContext, mouseX: number, mouseY: number): { nodeId: string; elementIndex: number; button: 'swap' | 'reverseHue' } | null {
  const canvasPos = ctx.screenToCanvas(mouseX, mouseY);
  for (let ni = ctx.graph.nodes.length - 1; ni >= 0; ni--) {
    const node = ctx.graph.nodes[ni];
    const spec = ctx.nodeSpecs.get(node.type);
    const metrics = ctx.nodeMetrics.get(node.id);
    if (!spec?.parameterLayout?.elements || !metrics?.elementMetrics) continue;
    const layout = spec.parameterLayout.elements;
    for (let i = 0; i < layout.length; i++) {
      const el = layout[i] as { type?: string };
      if (el?.type !== 'color-picker-row') continue;
      const key = `color-picker-row-${i}`;
      const em = metrics.elementMetrics.get(key);
      if (!em || em.x == null || em.y == null) continue;
      const buttonRects = em.colorMapRowButtonRects;
      if (!Array.isArray(buttonRects)) continue;
      for (const r of buttonRects) {
        if (canvasPos.x >= em.x + r.x && canvasPos.x <= em.x + r.x + r.w &&
            canvasPos.y >= em.y + r.y && canvasPos.y <= em.y + r.y + r.h) {
          return { nodeId: node.id, elementIndex: i, button: r.type };
        }
      }
    }
  }
  return null;
}

export function hitTestColorPicker(ctx: HitTestContext, mouseX: number, mouseY: number): { nodeId: string; elementIndex: number; pickerIndex?: number } | null {
  const canvasPos = ctx.screenToCanvas(mouseX, mouseY);
  for (const node of ctx.graph.nodes) {
    const spec = ctx.nodeSpecs.get(node.type);
    const metrics = ctx.nodeMetrics.get(node.id);
    if (!spec?.parameterLayout?.elements || !metrics?.elementMetrics) continue;
    const layout = spec.parameterLayout.elements;
    for (let i = 0; i < layout.length; i++) {
      const el = layout[i] as { type?: string };
      if (el?.type === 'color-picker-row' || el?.type === 'color-picker-row-with-ports') {
        const key = `${el.type}-${i}`;
        const em = metrics.elementMetrics.get(key);
        if (!em || em.x == null || em.y == null) continue;
        const swatchRects = em.colorPickerSwatchRects;
        if (!Array.isArray(swatchRects)) continue;
        for (let pi = 0; pi < swatchRects.length; pi++) {
          const r = swatchRects[pi];
          if (canvasPos.x >= em.x + r.x && canvasPos.x <= em.x + r.x + r.w &&
              canvasPos.y >= em.y + r.y && canvasPos.y <= em.y + r.y + r.h) {
            return { nodeId: node.id, elementIndex: i, pickerIndex: pi };
          }
        }
        continue;
      }
      if (el?.type !== 'color-picker') continue;
      const key = `color-picker-${i}`;
      const em = metrics.elementMetrics.get(key);
      if (!em || em.x == null || em.y == null) continue;
      const swatch = em.colorPickerSwatchRect as { x: number; y: number; w: number; h: number } | undefined;
      if (!swatch) continue;
      if (canvasPos.x >= em.x + swatch.x && canvasPos.x <= em.x + swatch.x + swatch.w &&
          canvasPos.y >= em.y + swatch.y && canvasPos.y <= em.y + swatch.y + swatch.h) {
        return { nodeId: node.id, elementIndex: i };
      }
    }
  }
  return null;
}
