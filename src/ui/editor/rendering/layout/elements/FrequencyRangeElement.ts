/**
 * Frequency Range Element Renderer
 *
 * Simplified range editor: label + [optional frequency scale when scale=audio] + horizontal range slider + start/end frequency inputs.
 * Layout: embed-slot with --embed-slot-pd for padding and gap, direction column.
 * Used for editing one band of an array parameter (e.g. frequencyBands[bandIndex]).
 */

import type { NodeInstance } from '../../../../../data-model/types';
import type { NodeSpec, LayoutElement, FrequencyRangeElement as FrequencyRangeElementType } from '../../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../../NodeRenderer';
import type { LayoutElementRenderer, ElementMetrics } from '../LayoutElementRenderer';
import { getCSSVariableAsNumber, getCategoryVariableAsNumber } from '../../../../../utils/cssTokens';

export const FREQ_MIN = 20;
export const FREQ_MAX = 20000;

const LOG_FREQ_MIN = Math.log10(FREQ_MIN);
const LOG_FREQ_MAX = Math.log10(FREQ_MAX);
const LOG_FREQ_SPAN = LOG_FREQ_MAX - LOG_FREQ_MIN;

export function hzToNorm(hz: number, scale: 'linear' | 'audio'): number {
  const clamped = Math.max(FREQ_MIN, Math.min(FREQ_MAX, hz));
  if (scale === 'audio') {
    return (Math.log10(clamped) - LOG_FREQ_MIN) / LOG_FREQ_SPAN;
  }
  return (clamped - FREQ_MIN) / (FREQ_MAX - FREQ_MIN);
}

export function normToHz(norm: number, scale: 'linear' | 'audio'): number {
  const t = Math.max(0, Math.min(1, norm));
  if (scale === 'audio') {
    return Math.pow(10, LOG_FREQ_MIN + t * LOG_FREQ_SPAN);
  }
  return FREQ_MIN + t * (FREQ_MAX - FREQ_MIN);
}

export class FrequencyRangeElementRenderer implements LayoutElementRenderer {
  constructor(_ctx: CanvasRenderingContext2D) {
    // ctx unused; nodes are DOM-rendered. Kept for API compatibility with ParameterLayoutManager.
  }

  canHandle(element: LayoutElement): boolean {
    return element.type === 'frequency-range';
  }

  getBandValues(
    element: FrequencyRangeElementType,
    node: NodeInstance,
    spec: NodeSpec
  ): { minHz: number; maxHz: number } {
    const param = node.parameters[element.parameter];
    const bands = Array.isArray(param) ? param : (spec.parameters[element.parameter]?.default as number[][]) ?? [];
    const band = bands[element.bandIndex];
    const arr = Array.isArray(band) && band.length >= 2 ? band : [FREQ_MIN, FREQ_MAX];
    return {
      minHz: Math.max(FREQ_MIN, Math.min(FREQ_MAX, Number(arr[0]) ?? FREQ_MIN)),
      maxHz: Math.max(FREQ_MIN, Math.min(FREQ_MAX, Number(arr[1]) ?? FREQ_MAX))
    };
  }

  calculateMetrics(
    element: FrequencyRangeElementType,
    node: NodeInstance,
    spec: NodeSpec,
    availableWidth: number,
    startY: number,
    metrics: NodeRenderMetrics
  ): ElementMetrics {
    const pd = getCSSVariableAsNumber('embed-slot-pd', 12);
    const gap = pd;
    const labelFontSize = getCSSVariableAsNumber('frequency-range-label-font-size', 18);
    const labelHeight = labelFontSize + 2;
    const sliderHeight = getCSSVariableAsNumber('frequency-range-slider-height', 16);
    const inputRowHeight = getCSSVariableAsNumber('frequency-range-input-row-height', 28);
    const scale = element.scale ?? 'linear';
    const spectrumHeight =
      scale === 'audio' ? getCSSVariableAsNumber('frequency-range-spectrum-height', 28) + gap : 0;
    const scaleHeight =
      scale === 'audio' ? getCSSVariableAsNumber('frequency-range-scale-height', 22) + gap : 0;

    const height =
      pd + labelHeight + gap + spectrumHeight + scaleHeight + sliderHeight + gap + inputRowHeight + pd;
    const category = spec.category;
    const gridPadding = category != null
      ? getCategoryVariableAsNumber('node-body-padding', category, 18)
      : getCSSVariableAsNumber('node-body-padding', 18);
    const containerX = node.position.x + gridPadding;
    const containerY = node.position.y + metrics.headerHeight + startY;

    return {
      x: containerX,
      y: containerY,
      width: availableWidth,
      height,
      parameterGridPositions: new Map()
    };
  }
}
