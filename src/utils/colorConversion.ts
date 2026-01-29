/**
 * Color conversion utilities for the color picker.
 * OKLCH (storage) ↔ RGB ↔ HSV (picker UI).
 * RGB from OKLCH is linear; we convert to sRGB for display.
 */

export interface OKLCH {
  l: number; // 0–1
  c: number; // 0–0.4 typical
  h: number; // 0–360
}

export interface RGB {
  r: number; // 0–1 linear or 0–255 sRGB depending on context
  g: number;
  b: number;
}

export interface HSV {
  h: number; // 0–360
  s: number; // 0–1
  v: number; // 0–1
}

/** Linear RGB (0–1) from OKLCH. Matches shader oklchToRgb. */
export function oklchToLinearRgb(l: number, c: number, h: number): { r: number; g: number; b: number } {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;
  const r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const b_ = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
  return {
    r: Math.max(0, Math.min(1, r)),
    g: Math.max(0, Math.min(1, g)),
    b: Math.max(0, Math.min(1, b_))
  };
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** sRGB hex or rgb() string for CSS from OKLCH. */
export function oklchToCssRgb(l: number, c: number, h: number): string {
  const { r, g, b } = oklchToLinearRgb(l, c, h);
  const R = Math.round(linearToSrgb(r) * 255);
  const G = Math.round(linearToSrgb(g) * 255);
  const B = Math.round(linearToSrgb(b) * 255);
  return `rgb(${R},${G},${B})`;
}

/** Linear RGB (0–1) to HSV (h 0–360, s/v 0–1). */
export function linearRgbToHsv(r: number, g: number, b: number): HSV {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s, v };
}

/** OKLCH to HSV (for picker UI). */
export function oklchToHsv(l: number, c: number, h: number): HSV {
  const rgb = oklchToLinearRgb(l, c, h);
  return linearRgbToHsv(rgb.r, rgb.g, rgb.b);
}

/** HSV to linear RGB (0–1). */
export function hsvToLinearRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const H = ((h % 360) + 360) % 360 / 60;
  const C = v * s;
  const X = C * (1 - Math.abs((H % 2) - 1));
  const m = v - C;
  let r = 0, g = 0, b = 0;
  if (H < 1) { r = C; g = X; b = 0; }
  else if (H < 2) { r = X; g = C; b = 0; }
  else if (H < 3) { r = 0; g = C; b = X; }
  else if (H < 4) { r = 0; g = X; b = C; }
  else if (H < 5) { r = X; g = 0; b = C; }
  else { r = C; g = 0; b = X; }
  return { r: r + m, g: g + m, b: b + m };
}

/** Linear RGB to OKLCH. Inverse of oklchToLinearRgb (simplified: RGB → XYZ → Lab → LCH). */
export function linearRgbToOklch(r: number, g: number, b: number): OKLCH {
  // Linear sRGB to XYZ (D65)
  const rl = Math.max(0, Math.min(1, r));
  const gl = Math.max(0, Math.min(1, g));
  const bl = Math.max(0, Math.min(1, b));
  const x = 0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl;
  const y = 0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl;
  const z = 0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl;
  // XYZ to OKLab
  const x_ = Math.cbrt(x);
  const y_ = Math.cbrt(y);
  const z_ = Math.cbrt(z);
  const l_ = 0.8189330101 * x_ + 0.3618667424 * y_ - 0.1288597137 * z_;
  const m_ = 0.0329845436 * x_ + 0.9293118715 * y_ + 0.0361456387 * z_;
  const s_ = 0.0480767532 * x_ + 0.2643662691 * y_ + 0.6338517070 * z_;
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  // Lab to LCH
  const C = Math.sqrt(a * a + b_ * b_);
  let H = (Math.atan2(b_, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return {
    l: Math.max(0, Math.min(1, L)),
    c: Math.max(0, Math.min(0.4, C)),
    h: H
  };
}

/** HSV to OKLCH (for saving from picker). */
export function hsvToOklch(h: number, s: number, v: number): OKLCH {
  const rgb = hsvToLinearRgb(h, s, v);
  return linearRgbToOklch(rgb.r, rgb.g, rgb.b);
}
