/**
 * Snap parameter values to constraints (min/max/step/int).
 * Extracted from parameterValueCalculator for smaller module size.
 */

import type { ParameterSpec } from '../types/nodeSpec';

/**
 * Snap a raw number to the parameter's constraints so that dragging/typing
 * can hit discrete values. Without this, only min/max are enforced and
 * paramSpec.step / type 'int' are ignored, making some values unreachable.
 *
 * - Clamps to [min, max]
 * - If step is defined: snaps to nearest step (min + k*step)
 * - If type is 'int' and no step: rounds to integer
 */
export function snapParameterValue(value: number, paramSpec: ParameterSpec): number {
  const min = paramSpec.min ?? 0;
  const max = paramSpec.max ?? 1;
  let v = Math.max(min, Math.min(max, value));

  if (typeof paramSpec.step === 'number' && paramSpec.step > 0) {
    const step = paramSpec.step;
    v = min + Math.round((v - min) / step) * step;
    v = Math.max(min, Math.min(max, v));
  } else if (paramSpec.type === 'int') {
    v = Math.round(v);
    v = Math.max(min, Math.min(max, v));
  }

  return v;
}
