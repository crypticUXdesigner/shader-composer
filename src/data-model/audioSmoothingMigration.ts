import type { AudioSetup } from './audioSetupTypes';

const REFERENCE_FPS = 120;
const DEFAULT_HALF_LIFE_SECONDS = 1 / REFERENCE_FPS;

/**
 * Ensure time-based smoothing fields exist for bands.
 *
 * Canonical storage is attack/release half-life (seconds). Legacy graphs may only
 * have smoothingHalfLifeSeconds; for back-compat we map smoothing → attack/release.
 *
 * - If attack/release are missing, fill them from (legacy) smoothingHalfLifeSeconds
 *   or a deterministic default (120 Hz reference cadence).
 * - We intentionally do NOT delete smoothingHalfLifeSeconds here; older builds may
 *   still write it, and keeping it is harmless.
 */
export function ensureBandAttackReleaseHalfLives(audioSetup: AudioSetup): AudioSetup {
  if (!audioSetup.bands || audioSetup.bands.length === 0) return audioSetup;

  let changed = false;
  const bands = audioSetup.bands.map((b) => {
    const legacyHalfLife = b.smoothingHalfLifeSeconds;
    const fallbackHalfLife = legacyHalfLife ?? DEFAULT_HALF_LIFE_SECONDS;

    const attack = b.attackHalfLifeSeconds ?? fallbackHalfLife;
    const release = b.releaseHalfLifeSeconds ?? fallbackHalfLife;

    if (attack === b.attackHalfLifeSeconds && release === b.releaseHalfLifeSeconds) {
      return b;
    }
    changed = true;
    return { ...b, attackHalfLifeSeconds: attack, releaseHalfLifeSeconds: release };
  });

  return changed ? { ...audioSetup, bands } : audioSetup;
}

/**
 * Legacy shim (kept so older imports/tests don’t break):
 * historically this ensured smoothingHalfLifeSeconds existed.
 *
 * New code should use ensureBandAttackReleaseHalfLives instead.
 */
export function ensureBandSmoothingHalfLife(audioSetup: AudioSetup): AudioSetup {
  if (!audioSetup.bands || audioSetup.bands.length === 0) return audioSetup;

  let changed = false;
  const bands = audioSetup.bands.map((b) => {
    if (b.smoothingHalfLifeSeconds != null) return b;
    changed = true;
    return { ...b, smoothingHalfLifeSeconds: DEFAULT_HALF_LIFE_SECONDS };
  });

  return changed ? { ...audioSetup, bands } : audioSetup;
}

