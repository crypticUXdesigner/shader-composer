/**
 * Rising-edge detector with hysteresis for radial pulse spawn.
 * Re-arm only after signal dips to ~fallThreshold or below.
 */
export function advanceRadialPulseSchmitt(
  armed: boolean,
  signal: number,
  riseThreshold: number,
  fallThreshold: number
): { armed: boolean; fired: boolean } {
  let rise = riseThreshold;
  let fall = fallThreshold;
  if (rise < fall) {
    const swap = rise;
    rise = fall;
    fall = swap;
  }

  let nextArmed = armed;
  let fired = false;
  if (signal <= fall) {
    nextArmed = true;
  } else if (armed && signal >= rise) {
    fired = true;
    nextArmed = false;
  }
  return { armed: nextArmed, fired };
}
