/**
 * Offline generator for static LUT preset tables (256 × RGB per preset).
 * Run: npx tsx scripts/generate-lut-presets.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { oklchToLinearRgb } from '../src/utils/colorConversion';

const LUT_SIZE = 256;

type Rgb = [number, number, number];
type Stop = { t: number; rgb: Rgb };
type OklchStop = { t: number; l: number; c: number; h: number };

/** Dropdown label + stable id: scientific names plain; others use short category prefix. */
function lutPreset(
  id: string,
  label: string,
  sample: (t: number) => Rgb
): { id: string; label: string; build: () => number[] } {
  return { id, label, build: () => buildLut(sample) };
}

function oklchPreset(id: string, label: string, stops: OklchStop[]) {
  return lutPreset(id, label, (t) => sampleOklchRamp(stops, t));
}

function hexPreset(id: string, label: string, stops: Array<{ t: number; hex: string }>) {
  const parsed = stops.map((s) => ({ t: s.t, rgb: parseHex(s.hex) }));
  return lutPreset(id, label, (t) => samplePiecewise(parsed, t));
}

function hsvToRgb(hDeg: number, s: number, v: number): Rgb {
  const h = ((hDeg % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function parseHex(hex: string): Rgb {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function samplePiecewise(stops: Array<{ t: number; rgb: Rgb }>, t: number): Rgb {
  const x = clamp01(t);
  if (x <= stops[0].t) return [...stops[0].rgb];
  const last = stops[stops.length - 1];
  if (x >= last.t) return [...last.rgb];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (x >= a.t && x <= b.t) {
      const u = (x - a.t) / (b.t - a.t);
      return [
        a.rgb[0] + (b.rgb[0] - a.rgb[0]) * u,
        a.rgb[1] + (b.rgb[1] - a.rgb[1]) * u,
        a.rgb[2] + (b.rgb[2] - a.rgb[2]) * u,
      ];
    }
  }
  return [...last.rgb];
}

function buildLut(sample: (t: number) => Rgb): number[] {
  const out: number[] = [];
  for (let i = 0; i < LUT_SIZE; i++) {
    const t = i / (LUT_SIZE - 1);
    const [r, g, b] = sample(t);
    out.push(clamp01(r), clamp01(g), clamp01(b));
  }
  return out;
}

function sampleOklchRamp(
  stops: Array<{ t: number; l: number; c: number; h: number }>,
  t: number
): Rgb {
  const x = clamp01(t);
  let i = 0;
  while (i < stops.length - 1 && x > stops[i + 1].t) i++;
  const a = stops[i];
  const b = stops[Math.min(i + 1, stops.length - 1)];
  const u = b.t === a.t ? 0 : (x - a.t) / (b.t - a.t);
  const l = a.l + (b.l - a.l) * u;
  const c = a.c + (b.c - a.c) * u;
  let h0 = a.h;
  let h1 = b.h;
  let dh = h1 - h0;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const h = h0 + dh * u;
  const { r, g, b: bl } = oklchToLinearRgb(l, c, ((h % 360) + 360) % 360);
  return [r, g, bl];
}

/** Google turbo colormap polynomial (sRGB 0–1). */
function turbo(t: number): Rgb {
  const x = clamp01(t);
  const r =
    0.13572138 +
    x * (4.6153926 + x * (-42.66032258 + x * (132.13108234 + x * (-152.94239396 + x * 59.28637943))));
  const g =
    0.09140261 +
    x * (2.19418839 + x * (4.84296658 + x * (-14.18503333 + x * (4.27729857 + x * 2.82956604))));
  const b =
    0.1066733 +
    x * (12.64194608 + x * (-60.58204836 + x * (110.36276771 + x * (-89.90310912 + x * 27.34824973))));
  return [clamp01(r), clamp01(g), clamp01(b)];
}

const VIRIDIS_STOPS: Stop[] = [
  { t: 0, rgb: parseHex('#440154') },
  { t: 0.06274509803921569, rgb: parseHex('#48186a') },
  { t: 0.12549019607843137, rgb: parseHex('#472d7b') },
  { t: 0.18823529411764706, rgb: parseHex('#424086') },
  { t: 0.25098039215686274, rgb: parseHex('#3b528b') },
  { t: 0.3137254901960784, rgb: parseHex('#33638d') },
  { t: 0.3764705882352941, rgb: parseHex('#2c728e') },
  { t: 0.4392156862745098, rgb: parseHex('#26828e') },
  { t: 0.5019607843137255, rgb: parseHex('#21918c') },
  { t: 0.5647058823529412, rgb: parseHex('#1fa088') },
  { t: 0.6274509803921569, rgb: parseHex('#28ae80') },
  { t: 0.6901960784313725, rgb: parseHex('#3fbc73') },
  { t: 0.7529411764705882, rgb: parseHex('#5ec962') },
  { t: 0.8156862745098039, rgb: parseHex('#84d44b') },
  { t: 0.8784313725490196, rgb: parseHex('#addc30') },
  { t: 0.9411764705882353, rgb: parseHex('#d8e219') },
  { t: 1, rgb: parseHex('#fde725') },
];

const INFERNO_STOPS: Stop[] = [
  { t: 0, rgb: [0.001462, 0.000466, 0.013866] },
  { t: 0.13, rgb: [0.258234, 0.038571, 0.406324] },
  { t: 0.25, rgb: [0.417642, 0.052902, 0.552674] },
  { t: 0.38, rgb: [0.662059, 0.084702, 0.582328] },
  { t: 0.5, rgb: [0.878423, 0.236083, 0.407645] },
  { t: 0.63, rgb: [0.993248, 0.491331, 0.209861] },
  { t: 0.75, rgb: [0.988362, 0.672459, 0.207275] },
  { t: 0.88, rgb: [0.969056, 0.842593, 0.369614] },
  { t: 1, rgb: [0.988362, 0.998364, 0.644924] },
];

const MAGMA_STOPS: Stop[] = [
  { t: 0, rgb: [0.001462, 0.000466, 0.013866] },
  { t: 0.15, rgb: [0.141477, 0.041371, 0.223228] },
  { t: 0.3, rgb: [0.399754, 0.065732, 0.433933] },
  { t: 0.45, rgb: [0.665003, 0.136207, 0.529983] },
  { t: 0.6, rgb: [0.878423, 0.301848, 0.558073] },
  { t: 0.75, rgb: [0.969056, 0.549706, 0.528593] },
  { t: 0.88, rgb: [0.988362, 0.777405, 0.561657] },
  { t: 1, rgb: [0.987053, 0.991438, 0.749504] },
];

const PLASMA_STOPS: Stop[] = [
  { t: 0, rgb: [0.050383, 0.029803, 0.527975] },
  { t: 0.15, rgb: [0.302773, 0.018803, 0.615177] },
  { t: 0.3, rgb: [0.547539, 0.051133, 0.589677] },
  { t: 0.45, rgb: [0.76751, 0.165004, 0.470624] },
  { t: 0.6, rgb: [0.925709, 0.332367, 0.361447] },
  { t: 0.75, rgb: [0.993248, 0.578304, 0.332367] },
  { t: 0.88, rgb: [0.940015, 0.821202, 0.369614] },
  { t: 1, rgb: [0.940015, 0.975158, 0.131326] },
];

const CIVIDIS_STOPS: Stop[] = [
  { t: 0, rgb: [0, 32 / 255, 76 / 255] },
  { t: 0.058824, rgb: [0, 42 / 255, 102 / 255] },
  { t: 0.117647, rgb: [0, 52 / 255, 110 / 255] },
  { t: 0.176471, rgb: [39 / 255, 63 / 255, 108 / 255] },
  { t: 0.235294, rgb: [60 / 255, 74 / 255, 107 / 255] },
  { t: 0.294118, rgb: [76 / 255, 85 / 255, 107 / 255] },
  { t: 0.352941, rgb: [91 / 255, 95 / 255, 109 / 255] },
  { t: 0.411765, rgb: [104 / 255, 106 / 255, 112 / 255] },
  { t: 0.470588, rgb: [117 / 255, 117 / 255, 117 / 255] },
  { t: 0.529412, rgb: [131 / 255, 129 / 255, 120 / 255] },
  { t: 0.588235, rgb: [146 / 255, 140 / 255, 120 / 255] },
  { t: 0.647059, rgb: [161 / 255, 152 / 255, 118 / 255] },
  { t: 0.705882, rgb: [176 / 255, 165 / 255, 114 / 255] },
  { t: 0.764706, rgb: [192 / 255, 177 / 255, 109 / 255] },
  { t: 0.823529, rgb: [209 / 255, 191 / 255, 102 / 255] },
  { t: 0.882353, rgb: [225 / 255, 204 / 255, 92 / 255] },
  { t: 0.941176, rgb: [243 / 255, 219 / 255, 79 / 255] },
  { t: 1, rgb: [1, 233 / 255, 69 / 255] },
];

// Naming: id = kebab-case slug; label = UI dropdown. Indices 0–11 are stable for saved graphs.
const PRESETS: Array<{ id: string; label: string; build: () => number[] }> = [
  // — Core library (indices 0–11, original order) —
  lutPreset('viridis', 'Viridis', (t) => samplePiecewise(VIRIDIS_STOPS, t)),
  lutPreset('inferno', 'Inferno', (t) => samplePiecewise(INFERNO_STOPS, t)),
  lutPreset('magma', 'Magma', (t) => samplePiecewise(MAGMA_STOPS, t)),
  lutPreset('plasma', 'Plasma', (t) => samplePiecewise(PLASMA_STOPS, t)),
  lutPreset('cividis', 'Cividis', (t) => samplePiecewise(CIVIDIS_STOPS, t)),
  lutPreset('turbo', 'Turbo', turbo),
  oklchPreset('cool', 'Cool', [
    { t: 0, l: 0.12, c: 0.08, h: 260 },
    { t: 0.45, l: 0.35, c: 0.12, h: 230 },
    { t: 1, l: 0.88, c: 0.14, h: 195 },
  ]),
  oklchPreset('warm', 'Warm', [
    { t: 0, l: 0.1, c: 0.1, h: 15 },
    { t: 0.5, l: 0.45, c: 0.18, h: 35 },
    { t: 1, l: 0.92, c: 0.16, h: 75 },
  ]),
  oklchPreset('neon', 'Neon', [
    { t: 0, l: 0.08, c: 0.24, h: 300 },
    { t: 0.35, l: 0.38, c: 0.3, h: 285 },
    { t: 0.65, l: 0.58, c: 0.32, h: 165 },
    { t: 1, l: 0.96, c: 0.26, h: 130 },
  ]),
  oklchPreset('film', 'Film', [
    { t: 0, l: 0.1, c: 0.07, h: 215 },
    { t: 0.3, l: 0.26, c: 0.06, h: 205 },
    { t: 0.65, l: 0.58, c: 0.11, h: 55 },
    { t: 1, l: 0.9, c: 0.13, h: 48 },
  ]),
  oklchPreset('grayscale', 'Grayscale', [
    { t: 0, l: 0, c: 0, h: 0 },
    { t: 1, l: 1, c: 0, h: 0 },
  ]),
  oklchPreset('night', 'Night', [
    { t: 0, l: 0.02, c: 0.04, h: 265 },
    { t: 0.4, l: 0.12, c: 0.08, h: 250 },
    { t: 0.75, l: 0.35, c: 0.1, h: 235 },
    { t: 1, l: 0.72, c: 0.12, h: 220 },
  ]),

  // — Extended library (indices 12+) —
  hexPreset('parula', 'Parula', [
    { t: 0, hex: '#352a87' },
    { t: 0.2, hex: '#175182' },
    { t: 0.4, hex: '#0f8b8d' },
    { t: 0.6, hex: '#3b9f3e' },
    { t: 0.8, hex: '#c5d11d' },
    { t: 1, hex: '#fde725' },
  ]),
  hexPreset('jet', 'Jet', [
    { t: 0, hex: '#00007f' },
    { t: 0.125, hex: '#0000ff' },
    { t: 0.375, hex: '#00ffff' },
    { t: 0.625, hex: '#ffff00' },
    { t: 0.875, hex: '#ff0000' },
    { t: 1, hex: '#7f0000' },
  ]),
  hexPreset('hot', 'Hot', [
    { t: 0, hex: '#000000' },
    { t: 0.33, hex: '#ff0000' },
    { t: 0.66, hex: '#ffff00' },
    { t: 1, hex: '#ffffff' },
  ]),
  hexPreset('bone', 'Bone', [
    { t: 0, hex: '#000000' },
    { t: 0.375, hex: '#4a4a6e' },
    { t: 0.75, hex: '#dedede' },
    { t: 1, hex: '#ffffff' },
  ]),
  hexPreset('copper', 'Copper', [
    { t: 0, hex: '#000000' },
    { t: 0.5, hex: '#b87333' },
    { t: 1, hex: '#ffc87c' },
  ]),
  lutPreset('rainbow', 'Rainbow', (t) => hsvToRgb(t * 300, 1, 0.55 + t * 0.45)),
  oklchPreset('ink', 'Ink', [
    { t: 0, l: 0.04, c: 0.02, h: 270 },
    { t: 0.5, l: 0.22, c: 0.03, h: 265 },
    { t: 1, l: 0.78, c: 0.04, h: 260 },
  ]),
  oklchPreset('charcoal', 'Charcoal', [
    { t: 0, l: 0.06, c: 0.01, h: 280 },
    { t: 0.55, l: 0.28, c: 0.02, h: 275 },
    { t: 1, l: 0.62, c: 0.03, h: 270 },
  ]),
  oklchPreset('silver', 'Silver', [
    { t: 0, l: 0.12, c: 0.01, h: 270 },
    { t: 0.5, l: 0.45, c: 0.02, h: 265 },
    { t: 1, l: 0.92, c: 0.02, h: 260 },
  ]),
  oklchPreset('ice', 'Ice', [
    { t: 0, l: 0.08, c: 0.06, h: 250 },
    { t: 0.4, l: 0.35, c: 0.1, h: 220 },
    { t: 1, l: 0.95, c: 0.06, h: 200 },
  ]),
  oklchPreset('fire', 'Fire', [
    { t: 0, l: 0.05, c: 0.12, h: 20 },
    { t: 0.35, l: 0.35, c: 0.22, h: 35 },
    { t: 0.7, l: 0.65, c: 0.2, h: 55 },
    { t: 1, l: 0.95, c: 0.14, h: 85 },
  ]),
  oklchPreset('ocean', 'Ocean', [
    { t: 0, l: 0.06, c: 0.1, h: 265 },
    { t: 0.45, l: 0.32, c: 0.14, h: 235 },
    { t: 1, l: 0.82, c: 0.1, h: 200 },
  ]),
  oklchPreset('forest', 'Forest', [
    { t: 0, l: 0.06, c: 0.06, h: 155 },
    { t: 0.45, l: 0.28, c: 0.12, h: 140 },
    { t: 1, l: 0.78, c: 0.14, h: 115 },
  ]),
  oklchPreset('earth', 'Earth', [
    { t: 0, l: 0.08, c: 0.05, h: 50 },
    { t: 0.4, l: 0.32, c: 0.1, h: 65 },
    { t: 1, l: 0.8, c: 0.12, h: 80 },
  ]),
  oklchPreset('sunset', 'Sunset', [
    { t: 0, l: 0.1, c: 0.14, h: 290 },
    { t: 0.35, l: 0.38, c: 0.2, h: 25 },
    { t: 0.7, l: 0.62, c: 0.18, h: 45 },
    { t: 1, l: 0.9, c: 0.12, h: 70 },
  ]),
  oklchPreset('dawn', 'Dawn', [
    { t: 0, l: 0.12, c: 0.08, h: 280 },
    { t: 0.4, l: 0.4, c: 0.14, h: 330 },
    { t: 1, l: 0.92, c: 0.1, h: 55 },
  ]),
  oklchPreset('aurora', 'Aurora', [
    { t: 0, l: 0.05, c: 0.1, h: 280 },
    { t: 0.35, l: 0.35, c: 0.2, h: 165 },
    { t: 0.65, l: 0.55, c: 0.22, h: 145 },
    { t: 1, l: 0.88, c: 0.16, h: 130 },
  ]),
  oklchPreset('lavender', 'Lavender', [
    { t: 0, l: 0.1, c: 0.08, h: 290 },
    { t: 0.5, l: 0.45, c: 0.14, h: 305 },
    { t: 1, l: 0.9, c: 0.1, h: 320 },
  ]),
  oklchPreset('rose', 'Rose', [
    { t: 0, l: 0.1, c: 0.1, h: 350 },
    { t: 0.5, l: 0.42, c: 0.16, h: 10 },
    { t: 1, l: 0.9, c: 0.12, h: 25 },
  ]),
  oklchPreset('mint', 'Mint', [
    { t: 0, l: 0.1, c: 0.06, h: 175 },
    { t: 0.5, l: 0.42, c: 0.12, h: 160 },
    { t: 1, l: 0.92, c: 0.1, h: 145 },
  ]),
  oklchPreset('gold', 'Gold', [
    { t: 0, l: 0.08, c: 0.08, h: 45 },
    { t: 0.45, l: 0.38, c: 0.16, h: 75 },
    { t: 1, l: 0.9, c: 0.14, h: 90 },
  ]),

  oklchPreset('cyber', 'Cyber', [
    { t: 0, l: 0.04, c: 0.18, h: 285 },
    { t: 0.4, l: 0.32, c: 0.26, h: 195 },
    { t: 1, l: 0.92, c: 0.22, h: 165 },
  ]),
  oklchPreset('vaporwave', 'Vaporwave', [
    { t: 0, l: 0.12, c: 0.16, h: 305 },
    { t: 0.35, l: 0.38, c: 0.22, h: 330 },
    { t: 0.7, l: 0.62, c: 0.2, h: 195 },
    { t: 1, l: 0.92, c: 0.14, h: 175 },
  ]),
  oklchPreset('laser', 'Laser', [
    { t: 0, l: 0.05, c: 0.2, h: 320 },
    { t: 0.5, l: 0.5, c: 0.28, h: 340 },
    { t: 1, l: 0.98, c: 0.2, h: 355 },
  ]),
  oklchPreset('toxic', 'Toxic', [
    { t: 0, l: 0.06, c: 0.14, h: 145 },
    { t: 0.45, l: 0.42, c: 0.26, h: 125 },
    { t: 1, l: 0.95, c: 0.22, h: 110 },
  ]),
  oklchPreset('candy', 'Candy', [
    { t: 0, l: 0.15, c: 0.18, h: 350 },
    { t: 0.33, l: 0.45, c: 0.22, h: 330 },
    { t: 0.66, l: 0.65, c: 0.2, h: 200 },
    { t: 1, l: 0.95, c: 0.16, h: 145 },
  ]),
  oklchPreset('holo', 'Holo', [
    { t: 0, l: 0.1, c: 0.14, h: 280 },
    { t: 0.25, l: 0.35, c: 0.2, h: 200 },
    { t: 0.5, l: 0.55, c: 0.22, h: 130 },
    { t: 0.75, l: 0.72, c: 0.2, h: 60 },
    { t: 1, l: 0.92, c: 0.16, h: 330 },
  ]),
  oklchPreset('infrared', 'Infrared', [
    { t: 0, l: 0.04, c: 0.08, h: 300 },
    { t: 0.4, l: 0.28, c: 0.18, h: 15 },
    { t: 1, l: 0.92, c: 0.2, h: 45 },
  ]),
  oklchPreset('ultraviolet', 'Ultraviolet', [
    { t: 0, l: 0.03, c: 0.12, h: 285 },
    { t: 0.5, l: 0.35, c: 0.24, h: 305 },
    { t: 1, l: 0.88, c: 0.18, h: 330 },
  ]),

  oklchPreset('noir', 'Noir', [
    { t: 0, l: 0.02, c: 0.01, h: 280 },
    { t: 0.35, l: 0.12, c: 0.02, h: 275 },
    { t: 0.7, l: 0.42, c: 0.03, h: 270 },
    { t: 1, l: 0.88, c: 0.02, h: 85 },
  ]),
  oklchPreset('bleach-bypass', 'Bleach Bypass', [
    { t: 0, l: 0.08, c: 0.04, h: 250 },
    { t: 0.5, l: 0.38, c: 0.05, h: 245 },
    { t: 1, l: 0.78, c: 0.04, h: 240 },
  ]),
  oklchPreset('kodachrome', 'Kodachrome', [
    { t: 0, l: 0.1, c: 0.08, h: 25 },
    { t: 0.35, l: 0.32, c: 0.12, h: 45 },
    { t: 0.7, l: 0.62, c: 0.14, h: 70 },
    { t: 1, l: 0.9, c: 0.1, h: 85 },
  ]),
  oklchPreset('polaroid', 'Polaroid', [
    { t: 0, l: 0.12, c: 0.06, h: 200 },
    { t: 0.45, l: 0.48, c: 0.1, h: 75 },
    { t: 1, l: 0.92, c: 0.08, h: 90 },
  ]),
  oklchPreset('cross-process', 'Cross Process', [
    { t: 0, l: 0.1, c: 0.1, h: 165 },
    { t: 0.4, l: 0.38, c: 0.16, h: 130 },
    { t: 1, l: 0.88, c: 0.14, h: 45 },
  ]),
  oklchPreset('teal-orange', 'Teal & Orange', [
    { t: 0, l: 0.1, c: 0.1, h: 220 },
    { t: 0.45, l: 0.35, c: 0.08, h: 210 },
    { t: 1, l: 0.9, c: 0.16, h: 55 },
  ]),
  oklchPreset('documentary', 'Documentary', [
    { t: 0, l: 0.08, c: 0.04, h: 250 },
    { t: 0.5, l: 0.4, c: 0.06, h: 70 },
    { t: 1, l: 0.82, c: 0.08, h: 85 },
  ]),

  // — Era & cultural looks —
  oklchPreset('era-50s-technicolor', '50s Technicolor', [
    { t: 0, l: 0.12, c: 0.14, h: 25 },
    { t: 0.33, l: 0.4, c: 0.2, h: 145 },
    { t: 0.66, l: 0.65, c: 0.18, h: 250 },
    { t: 1, l: 0.92, c: 0.14, h: 85 },
  ]),
  oklchPreset('era-60s-pop', '60s Pop Art', [
    { t: 0, l: 0.15, c: 0.2, h: 25 },
    { t: 0.33, l: 0.5, c: 0.22, h: 330 },
    { t: 0.66, l: 0.7, c: 0.2, h: 145 },
    { t: 1, l: 0.95, c: 0.16, h: 250 },
  ]),
  oklchPreset('era-70s-earth', '70s Earth Tones', [
    { t: 0, l: 0.1, c: 0.06, h: 55 },
    { t: 0.35, l: 0.32, c: 0.1, h: 85 },
    { t: 0.7, l: 0.58, c: 0.12, h: 115 },
    { t: 1, l: 0.82, c: 0.1, h: 75 },
  ]),
  oklchPreset('era-70s-disco', '70s Disco', [
    { t: 0, l: 0.06, c: 0.16, h: 305 },
    { t: 0.35, l: 0.38, c: 0.22, h: 85 },
    { t: 0.7, l: 0.62, c: 0.24, h: 250 },
    { t: 1, l: 0.95, c: 0.18, h: 55 },
  ]),
  oklchPreset('era-80s-synth', '80s Synthwave', [
    { t: 0, l: 0.05, c: 0.14, h: 285 },
    { t: 0.35, l: 0.28, c: 0.22, h: 305 },
    { t: 0.7, l: 0.55, c: 0.26, h: 330 },
    { t: 1, l: 0.92, c: 0.2, h: 25 },
  ]),
  oklchPreset('era-80s-miami', '80s Miami Vice', [
    { t: 0, l: 0.08, c: 0.14, h: 305 },
    { t: 0.4, l: 0.38, c: 0.2, h: 330 },
    { t: 0.75, l: 0.65, c: 0.18, h: 195 },
    { t: 1, l: 0.92, c: 0.14, h: 175 },
  ]),
  oklchPreset('era-90s-vhs', '90s VHS', [
    { t: 0, l: 0.1, c: 0.06, h: 285 },
    { t: 0.35, l: 0.32, c: 0.08, h: 310 },
    { t: 0.7, l: 0.58, c: 0.07, h: 95 },
    { t: 1, l: 0.82, c: 0.06, h: 85 },
  ]),
  oklchPreset('era-90s-grunge', '90s Grunge', [
    { t: 0, l: 0.08, c: 0.04, h: 155 },
    { t: 0.45, l: 0.3, c: 0.06, h: 140 },
    { t: 1, l: 0.68, c: 0.05, h: 75 },
  ]),
  oklchPreset('era-y2k-chrome', 'Y2K Chrome', [
    { t: 0, l: 0.1, c: 0.06, h: 265 },
    { t: 0.45, l: 0.45, c: 0.08, h: 250 },
    { t: 1, l: 0.95, c: 0.06, h: 235 },
  ]),
  oklchPreset('era-2000s-digital', '2000s Digital', [
    { t: 0, l: 0.08, c: 0.08, h: 265 },
    { t: 0.5, l: 0.42, c: 0.1, h: 240 },
    { t: 1, l: 0.95, c: 0.06, h: 220 },
  ]),
  oklchPreset('era-arcade', 'Retro Arcade', [
    { t: 0, l: 0.04, c: 0.02, h: 0 },
    { t: 0.2, l: 0.35, c: 0.24, h: 25 },
    { t: 0.45, l: 0.55, c: 0.26, h: 145 },
    { t: 0.7, l: 0.72, c: 0.24, h: 250 },
    { t: 1, l: 0.98, c: 0.2, h: 55 },
  ]),
  oklchPreset('era-silent-film', 'Silent Film Sepia', [
    { t: 0, l: 0.06, c: 0.03, h: 65 },
    { t: 0.5, l: 0.38, c: 0.06, h: 75 },
    { t: 1, l: 0.85, c: 0.08, h: 85 },
  ]),
];

function formatArray(name: string, data: number[]): string {
  const lines: string[] = [];
  for (let i = 0; i < data.length; i += 12) {
    const chunk = data.slice(i, i + 12).map((v) => v.toFixed(6));
    lines.push(`  ${chunk.join(', ')},`);
  }
  return `export const ${name}: readonly number[] = [\n${lines.join('\n')}\n] as const;`;
}

const tables = PRESETS.map((p) => p.build());
const meta = PRESETS.map((p, i) => `  { index: ${i}, id: '${p.id}', label: '${p.label}' },`).join('\n');

const out = `/** AUTO-GENERATED by scripts/generate-lut-presets.ts — do not edit by hand. */
export const LUT_PRESET_SIZE = ${LUT_SIZE} as const;
export const LUT_RGB_FLOATS_PER_PRESET = ${LUT_SIZE * 3} as const;

export interface LutPresetMeta {
  readonly index: number;
  readonly id: string;
  readonly label: string;
}

export const LUT_PRESET_META: readonly LutPresetMeta[] = [
${meta}
] as const;

${tables.map((t, i) => formatArray(`LUT_PRESET_${i}_RGB`, t)).join('\n\n')}

/** Flattened preset tables: presetIndex * LUT_RGB_FLOATS_PER_PRESET + channel offset. */
export const LUT_PRESET_TABLES_FLAT: readonly number[] = [
${tables.flat().map((v) => v.toFixed(6)).join(', ')}
] as const;
`;

const dest = join(process.cwd(), 'src', 'shaders', 'colorRamps', 'lutPresetData.generated.ts');
writeFileSync(dest, out, 'utf8');
console.log(`Wrote ${dest} (${PRESETS.length} presets × ${LUT_SIZE} samples)`);
