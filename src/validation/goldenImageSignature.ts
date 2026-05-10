export type GridGoldenSignature = {
  version: 1;
  fixtureId: string;
  width: number;
  height: number;
  grid: [number, number];
  bytesBase64: string;
};

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin);
}

/** Sparse grid sample of RGBA for stable golden comparisons (used by glow-bloom / crepuscular fixtures). */
export function computeGridGoldenSignature(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  grid: [number, number] = [16, 12]
): Uint8Array {
  const [gw, gh] = grid;
  const out = new Uint8Array(gw * gh * 4);
  let o = 0;
  for (let gy = 0; gy < gh; gy++) {
    const fy = (gy + 0.5) / gh;
    const y = Math.min(height - 1, Math.max(0, Math.floor(fy * height)));
    for (let gx = 0; gx < gw; gx++) {
      const fx = (gx + 0.5) / gw;
      const x = Math.min(width - 1, Math.max(0, Math.floor(fx * width)));
      const i = (y * width + x) * 4;
      out[o++] = rgba[i + 0] ?? 0;
      out[o++] = rgba[i + 1] ?? 0;
      out[o++] = rgba[i + 2] ?? 0;
      out[o++] = rgba[i + 3] ?? 255;
    }
  }
  return out;
}

export function signatureBytesToBase64(bytes: Uint8Array): string {
  return bytesToBase64(bytes);
}

export function signatureBase64ToBytes(b64: string): Uint8Array {
  return base64ToBytes(b64);
}

export function compareSignaturesRms(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let sumSq = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / a.length);
}

export function defaultSignatureRmsMax(): number {
  return 6.5;
}

export function signaturePass(rms: number, rmsMax: number): boolean {
  if (!Number.isFinite(rms)) return false;
  return rms <= rmsMax * clamp01(1);
}
