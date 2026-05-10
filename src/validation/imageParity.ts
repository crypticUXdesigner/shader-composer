/**
 * CPU-side RGBA comparison for WebGL vs WebGPU golden parity (browser or Node).
 */

export type RgbaParityMetrics = {
  rms: number;
  mad: number;
  maxDelta: number;
  /** Mean absolute error per channel (0–255 scale) */
  channelMae: [number, number, number, number];
};

/** Default allowed RMS on 8-bit RGBA channels (tune as WGSL output stabilizes). */
export const DEFAULT_PARITY_RMS_MAX = 2.75;

export function computeRgbaParityMetrics(a: Uint8ClampedArray, b: Uint8ClampedArray): RgbaParityMetrics {
  if (a.length !== b.length) {
    throw new Error(`RGBA length mismatch: ${a.length} vs ${b.length}`);
  }
  const n = a.length;
  if (n === 0) {
    return {
      rms: 0,
      mad: 0,
      maxDelta: 0,
      channelMae: [0, 0, 0, 0]
    };
  }
  let sumSq = 0;
  let sumAbs = 0;
  let maxD = 0;
  const chSum = [0, 0, 0, 0] as [number, number, number, number];
  const chCount = n / 4;

  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    const ad = Math.abs(d);
    sumSq += d * d;
    sumAbs += ad;
    if (ad > maxD) maxD = ad;
    chSum[i % 4] += ad;
  }

  return {
    rms: Math.sqrt(sumSq / n),
    mad: sumAbs / n,
    maxDelta: maxD,
    channelMae: [
      chSum[0] / chCount,
      chSum[1] / chCount,
      chSum[2] / chCount,
      chSum[3] / chCount
    ]
  };
}

/** Absolute difference magnified for debugging (128 + (a-b)/2 clamped). */
export function rgbaDiffToImageData(
  width: number,
  height: number,
  a: Uint8ClampedArray,
  b: Uint8ClampedArray
): ImageData {
  const out = new Uint8ClampedArray(a.length);
  for (let i = 0; i < a.length; i += 4) {
    const dx = Math.abs(a[i] - b[i]);
    const dy = Math.abs(a[i + 1] - b[i + 1]);
    const dz = Math.abs(a[i + 2] - b[i + 2]);
    const dw = Math.abs(a[i + 3] - b[i + 3]);
    const m = Math.max(dx, dy, dz, dw);
    const v = Math.min(255, Math.max(0, 64 + m * 2));
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = 255;
  }
  return new ImageData(out, width, height);
}
