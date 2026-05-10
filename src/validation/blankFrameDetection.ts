export function isProbablyBlankFrame(rgba: Uint8ClampedArray): boolean {
  // "Blank" here means "very likely unrendered": fully transparent or almost-uniform near-black.
  //
  // Keep this robust against legitimately dark frames by also checking for spatial variation.
  let maxRgb = 0;
  let minRgb = 255;
  let aMax = 0;
  let aMin = 255;

  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i] ?? 0;
    const g = rgba[i + 1] ?? 0;
    const b = rgba[i + 2] ?? 0;
    const a = rgba[i + 3] ?? 0;
    maxRgb = Math.max(maxRgb, r, g, b);
    minRgb = Math.min(minRgb, r, g, b);
    aMax = Math.max(aMax, a);
    aMin = Math.min(aMin, a);
  }

  // All-transparent is unambiguously blank.
  if (aMax <= 1) return true;

  // For near-black frames, require near-uniformity to count as blank.
  if (maxRgb <= 8) {
    // Quick uniformity probe: compare a sparse sample set to the first pixel.
    const r0 = rgba[0] ?? 0;
    const g0 = rgba[1] ?? 0;
    const b0 = rgba[2] ?? 0;
    const a0 = rgba[3] ?? 0;
    const stride = Math.max(4, Math.floor(rgba.length / (4 * 64))) * 4;
    for (let i = 0; i < rgba.length; i += stride) {
      const dr = Math.abs((rgba[i] ?? 0) - r0);
      const dg = Math.abs((rgba[i + 1] ?? 0) - g0);
      const db = Math.abs((rgba[i + 2] ?? 0) - b0);
      const da = Math.abs((rgba[i + 3] ?? 0) - a0);
      if (dr + dg + db + da > 6) return false;
    }

    // Also allow a little noise range; truly blank frames tend to be exactly uniform.
    if (maxRgb - minRgb <= 2 && aMax - aMin <= 2) return true;
  }

  return false;
}

