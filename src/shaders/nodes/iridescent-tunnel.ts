import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Iridescent Tunnel node: volumetric raymarched infinite cylinders in a 3D
 * repeated, warped, rotating space with view-dependent iridescent coloring.
 * Port-inspired from Shadertoy 4ddSDS; self-contained (warp + 3D repetition + cylinder SDF + soft accumulation + iridescent color).
 */
export const iridescentTunnelNodeSpec: NodeSpec = {
  id: 'iridescent-tunnel',
  category: 'Shapes',
  displayName: 'Iridescent Tunnel',
  description:
    'Volumetric raymarched infinite cylinders in a 3D repeated, warped, rotating space with view-dependent iridescent coloring.',
  icon: 'cylinder',
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
    centerX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center X',
      knobPolarity: 'two-sided'
    },
    centerY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center Y',
      knobPolarity: 'two-sided'
    },
    colorAL: { type: 'float', default: 0.5, min: 0.0, max: 1.0, step: 0.001, label: 'A Light' },
    colorAC: { type: 'float', default: 0.18, min: 0.0, max: 0.4, step: 0.001, label: 'A Chroma' },
    colorAH: { type: 'float', default: 250.0, min: 0.0, max: 360.0, step: 0.001, label: 'A Hue' },
    colorBL: { type: 'float', default: 0.7, min: 0.0, max: 1.0, step: 0.001, label: 'B Light' },
    colorBC: { type: 'float', default: 0.17, min: 0.0, max: 0.4, step: 0.001, label: 'B Chroma' },
    colorBH: { type: 'float', default: 20.0, min: 0.0, max: 360.0, step: 0.001, label: 'B Hue' },
    repetitionScale: {
      type: 'float',
      default: 0.3,
      min: 0.1,
      max: 2.0,
      step: 0.01,
      label: 'Repetition',
      inputMode: 'override'
    },
    tubeRadius: {
      type: 'float',
      default: 0.12,
      min: 0.02,
      max: 0.5,
      step: 0.01,
      label: 'Tube Radius'
    },
    warpFreq: {
      type: 'float',
      default: 4.0,
      min: 0.0,
      max: 20.0,
      step: 0.1,
      label: 'Warp Frequency'
    },
    warpStrength: {
      type: 'float',
      default: 0.08,
      min: 0.0,
      max: 0.5,
      step: 0.01,
      label: 'Warp Strength'
    },
    cameraSpeed: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 3.0,
      step: 0.05,
      label: 'Speed',
      inputMode: 'override'
    },
    rotateSpeed: {
      type: 'float',
      default: 0.3,
      min: -2.0,
      max: 2.0,
      step: 0.05,
      label: 'Rotate',
      knobPolarity: 'two-sided'
    },
    raymarchSteps: {
      type: 'int',
      default: 64,
      min: 24,
      max: 128,
      step: 1,
      label: 'Raymarch Steps'
    },
    densityScale: {
      type: 'float',
      default: 1.0,
      min: 0.2,
      max: 3.0,
      step: 0.1,
      label: 'Density'
    },
    iridescenceMix: {
      type: 'float',
      default: 0.7,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Iridescence'
    },
    iridescenceShift: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Color shift'
    },
    fovScale: {
      type: 'float',
      default: 1.0,
      min: 0.3,
      max: 2.0,
      step: 0.05,
      label: 'Zoom'
    }
  },
  parameterGroups: [
    {
      id: 'tunnel',
      label: 'Tunnel',
      parameters: ['centerX', 'centerY', 'repetitionScale', 'tubeRadius', 'warpFreq', 'warpStrength'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'camera',
      label: 'Camera',
      parameters: ['cameraSpeed', 'rotateSpeed', 'fovScale'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'march',
      label: 'Raymarch',
      parameters: ['raymarchSteps', 'densityScale'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'color',
      label: 'Iridescence',
      parameters: [
        'colorAL',
        'colorAC',
        'colorAH',
        'colorBL',
        'colorBC',
        'colorBH',
        'iridescenceMix',
        'iridescenceShift'
      ],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    minColumns: 3,
    elements: [
      {
        type: 'grid',
        label: 'Tunnel',
        parameters: ['centerX', 'centerY', 'repetitionScale', 'tubeRadius', 'warpFreq', 'warpStrength'],
        parameterUI: { centerX: 'coords', centerY: 'coords' },
        layout: { columns: 3, coordsSpan: 2, coordsOrigin: { centerX: 'center' } }
      },
      {
        type: 'grid',
        label: 'Camera',
        parameters: ['cameraSpeed', 'rotateSpeed', 'fovScale'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Raymarch',
        parameters: ['raymarchSteps', 'densityScale'],
        layout: { columns: 2 }
      },
      {
        type: 'color-picker-row',
        label: 'Colors',
        pickers: [['colorAL', 'colorAC', 'colorAH'], ['colorBL', 'colorBC', 'colorBH']]
      },
      {
        type: 'grid',
        parameters: [
          'colorAL',
          'colorAC',
          'colorAH',
          'colorBL',
          'colorBC',
          'colorBH',
          'iridescenceMix',
          'iridescenceShift'
        ],
        parameterUI: {
          colorAL: 'input',
          colorAC: 'input',
          colorAH: 'input',
          colorBL: 'input',
          colorBC: 'input',
          colorBH: 'input'
        },
        layout: {
          columns: 3,
          parameterSpan: { iridescenceMix: 3, iridescenceShift: 3 }
        }
      }
    ]
  },
  functions: `
// OKLCH (L 0..1, C 0..0.4, H degrees) -> linear RGB 0..1 (matches picker math)
vec3 itOklchToRgb(vec3 oklch) {
  float l = oklch.x;
  float c = oklch.y;
  float h = oklch.z * 3.14159265359 / 180.0;
  float a = c * cos(h);
  float b = c * sin(h);
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

// Z-rotation matrix (angle in radians)
mat3 getRotZMat(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
}

// Map: 3D warp + Z-rotation + 3D domain repetition + infinite cylinder SDF
float mapTunnel(vec3 p, float rep, float r, float wFreq, float wStr, float angle) {
  vec3 q = p;
  q.x += sin(q.z * wFreq) * wStr;
  q.y += cos(q.z * wFreq * 1.3) * wStr;
  q = getRotZMat(angle) * q;
  vec3 repVal = vec3(rep, rep, rep);
  q = mod(q + repVal * 0.5, repVal) - repVal * 0.5;
  return length(q.xy) - r;
}
`,
  mainCode: `
  vec2 center = vec2(clamp($param.centerX, -2.0, 2.0), clamp($param.centerY, -2.0, 2.0));
  float rep = clamp($param.repetitionScale, 0.1, 2.0);
  float r = clamp($param.tubeRadius, 0.02, 0.5);
  float wFreq = $param.warpFreq;
  float wStr = clamp($param.warpStrength, 0.0, 0.5);
  float angle = $time * $param.rotateSpeed;
  float speed = $param.cameraSpeed;
  float fov = $param.fovScale;
  int maxSteps = int(clamp(float($param.raymarchSteps), 24.0, 128.0));
  float densScale = clamp($param.densityScale, 0.2, 3.0);
  float iridMix = clamp($param.iridescenceMix, 0.0, 1.0);
  float iridShift = clamp($param.iridescenceShift, 0.0, 1.0);
  vec3 colorA = itOklchToRgb(vec3($param.colorAL, $param.colorAC, $param.colorAH));
  vec3 colorB = itOklchToRgb(vec3($param.colorBL, $param.colorBC, $param.colorBH));

  vec3 ro = vec3(0.0, 0.0, -$time * speed);
  vec2 uv = ($input.in - center) * 2.0;
  uv *= fov;
  vec3 rd = normalize(vec3(uv.x, uv.y, -1.0));

  vec4 acc = vec4(0.0);
  mediump float t = 0.0;
  const float maxDist = 30.0;

  for (int i = 0; i < 128; i++) {
    if (i >= maxSteps) break;
    vec3 p = ro + t * rd;
    float d = mapTunnel(p, rep, r, wFreq, wStr, angle);
    d = max(d, 0.001);

    // Avoid NaNs when p.xy == 0 (first march step starts at origin in XY).
    float cylLen = length(p.xy);
    vec3 cylN = cylLen > 1e-5 ? vec3(p.xy / cylLen, 0.0) : vec3(0.0, 0.0, 1.0);
    float viewF = 1.0 - abs(dot(rd, cylN));
    viewF = pow(viewF, 1.5);
    vec3 iridColor = mix(colorA, colorB, viewF * iridShift + (1.0 - iridShift) * 0.5);
    vec3 baseColor = mix(vec3(0.15, 0.2, 0.35), iridColor, iridMix);

    float contrib = (1.0 / (1.0 + d * 8.0)) * densScale * 0.08;
    acc.rgb += baseColor * contrib * max(t, 0.05);
    acc.a += contrib * 0.5;

    t += max(d * 0.5, 0.008);
    if (t > maxDist) break;
  }

  acc.rgb = acc.rgb / (1.0 + acc.a);
  acc.a = clamp(acc.a * 1.2, 0.0, 1.0);
  $output.out += vec4(acc.rgb, acc.a);
`
};
