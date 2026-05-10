import type { NodeSpec } from '../../types/nodeSpec';

/** Golden ratio for spherical Fibonacci lattice (Keinert et al.) */
const GOLDEN_RATIO = 1.618033988749895;
const PI = 3.141592653589793;

export const bloomSphereNodeSpec: NodeSpec = {
  id: 'bloom-sphere',
  category: 'Shapes',
  displayName: 'Bloom Sphere',
  description:
    'Sphere with spherical-Fibonacci lattice spots that pulse in a wave, blue outer glow and reddish inner glow. Wave phase, spacing, lattice spin, and optional detune for richer motion. Includes a Legacy Bloom mode to match older Bloom Sphere (Effect) graphs. Single composite effect (no temporal buffer).',
  icon: 'glow',
  inputs: [
    {
      name: 'in',
      type: 'vec2',
      label: 'UV'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'vec4',
      label: 'Color'
    }
  ],
  parameters: {
    mode: {
      type: 'int',
      default: 0,
      min: 0,
      max: 1,
      step: 1,
      label: 'Mode'
    },
    bloomCenterX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center X',
      knobPolarity: 'two-sided' },
    bloomCenterY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center Y',
      knobPolarity: 'two-sided' },
    sphereRadius: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 3.0,
      step: 0.01,
      label: 'Radius',
      inputMode: 'override'
    },
    spotCount: {
      type: 'int',
      default: 128,
      min: 16,
      max: 256,
      step: 1,
      label: 'Spot Count'
    },
    baseSpotAngle: {
      type: 'float',
      default: 0.25,
      min: 0.05,
      max: 0.8,
      step: 0.01,
      label: 'Spot Size'
    },
    waveSpeed: {
      type: 'float',
      default: 2.0,
      min: 0.0,
      max: 8.0,
      step: 0.001,
      label: 'Wave Speed',
      inputMode: 'override'
    },
    wavePhase: {
      type: 'float',
      default: 0.0,
      min: -12.57,
      max: 12.57,
      step: 0.01,
      label: 'Wave Phase',
      knobPolarity: 'two-sided' },
    waveDetuneFreq: {
      type: 'float',
      default: 2.0,
      min: 0.25,
      max: 8.0,
      step: 0.05,
      label: 'Detune Freq'
    },
    waveDetuneAmp: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Detune Amount'
    },
    indexPhaseScale: {
      type: 'float',
      default: 0.1,
      min: 0.0,
      max: 1.0,
      step: 0.005,
      label: 'Wave Spacing'
    },
    latticeSpinSpeed: {
      type: 'float',
      default: 0.0,
      min: -4.0,
      max: 4.0,
      step: 0.01,
      label: 'Spin Speed',
      knobPolarity: 'two-sided' },
    waveAmplitude: {
      type: 'float',
      default: 0.12,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Wave Depth'
    },
    spotSoftness: {
      type: 'float',
      default: 0.08,
      min: 0.01,
      max: 0.3,
      step: 0.01,
      label: 'Spot Softness'
    },
    outerL: {
      type: 'float',
      default: 0.7391552434772553,
      min: 0.0,
      max: 1.0,
      step: 0.001,
      label: 'Outer L'
    },
    outerC: {
      type: 'float',
      default: 0.09253691178218687,
      min: 0.0,
      max: 0.4,
      step: 0.001,
      label: 'Outer C'
    },
    outerH: {
      type: 'float',
      default: 296.59265191815484,
      min: 0.0,
      max: 360.0,
      step: 0.001,
      label: 'Outer H'
    },
    innerL: {
      type: 'float',
      default: 0.7236677864677247,
      min: 0.0,
      max: 1.0,
      step: 0.001,
      label: 'Inner L'
    },
    innerC: {
      type: 'float',
      default: 0.20734208593918924,
      min: 0.0,
      max: 0.4,
      step: 0.001,
      label: 'Inner C'
    },
    innerH: {
      type: 'float',
      default: 27.587637681632806,
      min: 0.0,
      max: 360.0,
      step: 0.001,
      label: 'Inner H'
    },
    brightness: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 3.0,
      step: 0.1,
      label: 'Brightness'
    },
    classicSpotSharpness: {
      type: 'float',
      default: 12.0,
      min: 1.0,
      max: 40.0,
      step: 0.5,
      label: 'Sharpness'
    },
    classicOuterGlowR: { type: 'float', default: 0.2, min: 0, max: 1, step: 0.001, label: 'Outer R' },
    classicOuterGlowG: { type: 'float', default: 0.4, min: 0, max: 1, step: 0.001, label: 'Outer G' },
    classicOuterGlowB: { type: 'float', default: 0.9, min: 0, max: 1, step: 0.001, label: 'Outer B' },
    classicInnerGlowR: { type: 'float', default: 0.9, min: 0, max: 1, step: 0.001, label: 'Inner R' },
    classicInnerGlowG: { type: 'float', default: 0.2, min: 0, max: 1, step: 0.001, label: 'Inner G' },
    classicInnerGlowB: { type: 'float', default: 0.2, min: 0, max: 1, step: 0.001, label: 'Inner B' },
  },
  parameterGroups: [
    {
      id: 'sphere',
      label: 'Sphere',
      parameters: ['mode', 'bloomCenterX', 'bloomCenterY', 'sphereRadius', 'brightness'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'motion',
      label: 'Spots & Motion',
      parameters: [
        'spotCount',
        'classicSpotSharpness',
        'waveSpeed',
        'wavePhase',
        'indexPhaseScale',
        'waveAmplitude',
        'waveDetuneFreq',
        'waveDetuneAmp',
        'latticeSpinSpeed'
      ],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'latticeLook',
      label: 'Lattice Look',
      parameters: ['baseSpotAngle', 'spotSoftness'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'colors',
      label: 'Colors',
      parameters: ['outerL', 'outerC', 'outerH', 'innerL', 'innerC', 'innerH'],
      collapsible: true,
      defaultCollapsed: false
    },
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        label: 'Sphere',
        parameters: ['mode', 'sphereRadius', 'brightness', 'bloomCenterX', 'bloomCenterY'],
        parameterUI: { mode: 'enum', bloomCenterX: 'coords', bloomCenterY: 'coords' },
        layout: {
          columns: 3,
          coordsSpan: 3,
          coordsOrigin: { bloomCenterX: 'center' },
          parameterSpan: { mode: 3, brightness: 2 }
        }
      },
      {
        type: 'grid',
        label: 'Spots & Motion',
        parameters: [
          'spotCount',
          'classicSpotSharpness',
          'waveSpeed',
          'wavePhase',
          'indexPhaseScale',
          'waveAmplitude',
          'waveDetuneFreq',
          'waveDetuneAmp',
          'latticeSpinSpeed'
        ],
        layout: {
          columns: 3,
          parameterSpan: { classicSpotSharpness: 2, wavePhase: 2, waveAmplitude: 2 }
        }
      },
      {
        type: 'grid',
        visibleWhen: { parameter: 'mode', equals: 0 },
        label: 'Lattice Look',
        parameters: ['baseSpotAngle', 'spotSoftness'],
        layout: { columns: 3, parameterSpan: { baseSpotAngle: 2 } }
      },
      {
        type: 'color-picker-row',
        label: 'Colors',
        pickers: [
          ['outerL', 'outerC', 'outerH'],
          ['innerL', 'innerC', 'innerH']
        ]
      },
    ]
  },
  functions: `
vec3 bloomSphereOklchToRgb(vec3 oklch) {
  float l = oklch.x;
  float c = oklch.y;
  float h = oklch.z * 3.14159265359 / 180.0;

  float a = c * cos(h);
  float b = c * sin(h);

  // OKLab to linear RGB
  float l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  float m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  float s_ = l - 0.0894841775 * a - 1.2914855480 * b;

  float l3 = l_ * l_ * l_;
  float m3 = m_ * m_ * m_;
  float s3 = s_ * s_ * s_;

  float r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  float g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  float bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

  return clamp(vec3(r, g, bl), 0.0, 1.0);
}

// Index to sphere direction (id2sf). i in [0, n-1], n >= 2. Constants in function scope so they are included when only function bodies are extracted.
vec3 bloomSphereId2Sf(float i, float n) {
  const float BS_PI = ${PI};
  const float BS_GOLDEN = ${GOLDEN_RATIO};
  float nf = max(n, 2.0);
  float z = 1.0 - (2.0 * i + 1.0) / nf;
  z = clamp(z, -1.0, 1.0);
  float phi = 2.0 * BS_PI * mod(i / BS_GOLDEN, 1.0);
  float r = sqrt(max(0.0, 1.0 - z * z));
  return vec3(r * cos(phi), r * sin(phi), z);
}

// Direction (unit) to nearest lattice index (sf2id). Returns float index in [0, n-1].
// Fixed loop bound for WebGL2; check up to 5 candidates around the continuous estimate.
float bloomSphereSf2Id(vec3 dir, float n) {
  float nf = max(n, 2.0);
  vec3 d = length(dir) > 0.001 ? normalize(dir) : vec3(0.0, 0.0, 1.0);
  float z = clamp(d.z, -1.0, 1.0);
  float iCont = (1.0 - z) * nf * 0.5 - 0.5;
  int iCenter = int(round(iCont));
  float bestDot = -2.0;
  float bestI = 0.0;
  for (int o = -2; o <= 2; o++) {
    int k = iCenter + o;
    if (k < 0) continue;
    float ik = float(k);
    if (ik >= nf) break;
    float dotK = dot(d, bloomSphereId2Sf(ik, nf));
    if (dotK > bestDot) {
      bestDot = dotK;
      bestI = ik;
    }
  }
  return bestI;
}
`,
  mainCode: `
  // in: p-space like UV Coords (aspect-corrected NDC), not raw 0–1 UV
  vec2 ndc = $input.in - vec2($param.bloomCenterX, $param.bloomCenterY);
  vec3 ro = vec3(0.0, 0.0, 3.0);
  vec3 rd = normalize(vec3(ndc, -1.0));

  float R = $param.sphereRadius;
  vec3 oc = ro;
  float a = dot(rd, rd);
  float b = 2.0 * dot(oc, rd);
  float c = dot(oc, oc) - R * R;
  float disc = b * b - 4.0 * a * c;

  if (disc < 0.0) {
    $output.out = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    float t = (-b - sqrt(disc)) / (2.0 * a);
    vec3 P = ro + t * rd;
    vec3 N = P / R;
    float nDotV = dot(N, -rd);

    if ($param.mode == 1) {
      float spinAngle = $time * $param.latticeSpinSpeed;
      float spinC = cos(spinAngle);
      float spinS = sin(spinAngle);
      vec3 Nspin = vec3(spinC * N.x + spinS * N.z, N.y, -spinS * N.x + spinC * N.z);

      float nClassic = clamp(float($param.spotCount), 2.0, 256.0);
      float idx = bloomSphereSf2Id(Nspin, nClassic);
      vec3 nearestDir = bloomSphereId2Sf(round(idx), nClassic);
      float dotN = dot(Nspin, nearestDir);

      float T = $time * $param.waveSpeed;
      float idxScale = $param.indexPhaseScale;
      float wPhase = $param.wavePhase;
      float detuneF = $param.waveDetuneFreq;
      float detuneA = clamp($param.waveDetuneAmp, 0.0, 1.0);

      float spotPhase = T + idx * idxScale + wPhase;
      float waveRaw = sin(spotPhase) + detuneA * sin(T * detuneF + idx * idxScale + wPhase);
      float wave = clamp(0.5 + 0.5 * (waveRaw / (1.0 + detuneA)), 0.0, 1.0);

      float sharp = max($param.classicSpotSharpness, 1.0);
      float spotMask = smoothstep(1.0 - 1.0 / sharp, 1.0, dotN);
      float amp = clamp($param.waveAmplitude, 0.0, 1.0);
      float waveMod = (1.0 - amp) + amp * wave;
      spotMask *= (0.3 + 0.7 * waveMod);

      vec3 outerColor = bloomSphereOklchToRgb(vec3($param.outerL, $param.outerC, $param.outerH));
      vec3 innerColor = bloomSphereOklchToRgb(vec3($param.innerL, $param.innerC, $param.innerH));
      vec3 col = mix(outerColor, innerColor, wave);
      col = mix(outerColor * 0.2, col, spotMask);
      col *= $param.brightness;

      $output.out = vec4(clamp(col, 0.0, 1.0), 1.0);
    } else {
      float nSpots = clamp(float($param.spotCount), 16.0, 256.0);
      float baseAngle = $param.baseSpotAngle;
      float waveAmp = $param.waveAmplitude;
      float waveSpeed = $param.waveSpeed;
      float sharp = max($param.classicSpotSharpness, 1.0);
      float sharpFactor = 2.0 / sqrt(sharp);
      float soft = max(0.0005, $param.spotSoftness * sharpFactor);
      float T = $time * waveSpeed;
      float wPhase = $param.wavePhase;
      float idxScale = $param.indexPhaseScale;
      float detuneF = $param.waveDetuneFreq;
      float detuneA = $param.waveDetuneAmp;
      float spinAngle = $time * $param.latticeSpinSpeed;
      float spinC = cos(spinAngle);
      float spinS = sin(spinAngle);

      vec3 outerColor = bloomSphereOklchToRgb(vec3($param.outerL, $param.outerC, $param.outerH));
      vec3 innerColor = bloomSphereOklchToRgb(vec3($param.innerL, $param.innerC, $param.innerH));

      vec3 acc = vec3(0.0);
      for (float i = 0.0; i < 256.0; i++) {
        if (i >= nSpots) break;
        vec3 spotDir = bloomSphereId2Sf(i, nSpots);
        spotDir = vec3(spinC * spotDir.x + spinS * spotDir.z, spotDir.y, -spinS * spotDir.x + spinC * spotDir.z);
        float iphase = i * idxScale;
        float wave = sin(T + iphase + wPhase) + detuneA * sin(T * detuneF + iphase + wPhase);
        float angle = baseAngle + waveAmp * wave;
        float cosAngle = cos(angle);
        float d = dot(N, spotDir);
        float spotMask = smoothstep(cosAngle - soft, cosAngle + soft * 0.5, d);
        float outerBlend = 1.0 - max(0.0, nDotV);
        float innerBlend = max(0.0, nDotV);
        vec3 spotColor = innerColor * innerBlend + outerColor * outerBlend;
        acc += spotMask * spotColor;
      }

      float norm = 8.0 / max(nSpots * 0.1, 1.0);
      acc = clamp(acc * norm * $param.brightness, 0.0, 1.0);
      $output.out = vec4(acc, 1.0);
    }
  }
`
};
