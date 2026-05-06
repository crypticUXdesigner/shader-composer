import type { AudioSetup } from './audioSetupTypes';

const DEFAULT_BAND_MODE = 'mean' as const;

/**
 * Ensure bandMode exists for bands.
 * - If bandMode is missing, set a deterministic default ("mean") matching legacy behavior.
 */
export function ensureBandMode(audioSetup: AudioSetup): AudioSetup {
  if (!audioSetup.bands || audioSetup.bands.length === 0) return audioSetup;

  let changed = false;
  const bands = audioSetup.bands.map((b) => {
    if (b.bandMode != null) return b;
    changed = true;
    return { ...b, bandMode: DEFAULT_BAND_MODE };
  });

  return changed ? { ...audioSetup, bands } : audioSetup;
}

