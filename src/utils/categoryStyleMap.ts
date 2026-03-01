/**
 * Per-category style tokens for node UI.
 * Reads from node-categories.css (single source for all category-specific node styling).
 * Used by: canvas overlays (connections, parameter labels), layout metrics, parameter renderers.
 */

import { getCategoryColor, getCSSColor } from './cssTokens';

export type CategoryStyleKey =
  | 'paramCellBg'
  | 'paramCellBgEnd'
  | 'paramCellBgConnected'
  | 'paramLabelColor'
  | 'knobValueColor'
  | 'knobValueBg'
  | 'knobRingColor'
  | 'knobRingActiveColorStatic'
  | 'knobMarkerColor'
  | 'bezierCurve'
  | 'bezierControlBg'
  | 'bezierControlHover'
  | 'paramGroupHeaderColor'
  | 'inputValueColor'
  | 'inputValueBg'
  | 'inputValueColorConnected'
  | 'inputValueBgConnected';

/** Maps CategoryStyleKey to base token name (without -- prefix). Per-category tokens use getCategoryColor. */
const TOKEN_MAP: Record<CategoryStyleKey, string> = {
  paramCellBg: 'node-param-cell-bg',
  paramCellBgEnd: 'node-param-cell-bg-end',
  paramCellBgConnected: 'param-cell-bg-connected',
  paramLabelColor: 'node-param-label-color',
  knobValueColor: 'node-knob-value-color',
  knobValueBg: 'node-knob-value-bg',
  knobRingColor: 'node-knob-ring-color',
  knobRingActiveColorStatic: 'node-knob-arc-active',
  knobMarkerColor: 'node-knob-marker',
  bezierCurve: 'node-bezier-curve',
  bezierControlBg: 'node-bezier-control',
  bezierControlHover: 'node-bezier-control-hover',
  paramGroupHeaderColor: 'param-group-header-color',
  inputValueColor: 'node-knob-value-color',
  inputValueBg: 'node-knob-value-bg',
  inputValueColorConnected: 'input-value-color-connected',
  inputValueBgConnected: 'input-value-bg-connected'
};

export function getCategoryStyleColor(category: string, key: CategoryStyleKey, fallback: string): string {
  const baseToken = TOKEN_MAP[key];
  if (!baseToken) return fallback;

  /* Shared tokens (no per-category variant) */
  if (
    key === 'paramCellBgConnected' ||
    key === 'inputValueColorConnected' ||
    key === 'inputValueBgConnected'
  ) {
    return getCSSColor(baseToken, fallback);
  }

  return getCategoryColor(baseToken, category, fallback);
}
