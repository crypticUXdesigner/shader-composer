/**
 * Canvas / hit-test helpers for node header layout when an optional Power strip
 * sits above the main inputs | logo | outputs row (see NodeHeader.svelte).
 */

import type { NodeSpec } from '../types/nodeSpec';
import { nodeSupportsPower } from '../shaders/nodePower';
import { getCSSVariableAsNumber } from './cssTokens';

/** Vertical space reserved inside the header (below top padding) for the power row — must match `--node-header-power-strip-height`. */
export function getHeaderPowerStripHeightForSpec(spec: NodeSpec): number {
  if (!nodeSupportsPower(spec)) return 0;
  return getCSSVariableAsNumber('node-header-power-strip-height', 36);
}

/**
 * Vertical bounds of the main header band (inputs | logo | outputs), in canvas Y,
 * excluding outer `--node-header-padding` and excluding the power strip when present.
 */
export function getHeaderMainContentBoundsCanvas(
  nodeTopY: number,
  headerHeight: number,
  spec: NodeSpec
): { mainTop: number; mainHeight: number } {
  const pad = getCSSVariableAsNumber('node-header-padding', 36);
  const innerTop = nodeTopY + pad;
  const innerHeight = headerHeight - 2 * pad;
  const powerStrip = getHeaderPowerStripHeightForSpec(spec);
  const mainHeight = Math.max(0, innerHeight - powerStrip);
  const mainTop = innerTop + powerStrip;
  return { mainTop, mainHeight };
}
