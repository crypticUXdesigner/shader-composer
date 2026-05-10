import type { NodeSpec } from '../../types/nodeSpec';
import { COOK_TORRANCE_SPECULAR_GLSL } from './cook-torrance-specular';

/** OKLCH defaults reproduce legacy RGB inner (0.9, 0.85, 0.8) and background (0.05, 0.05, 0.08). */
const INNER_DEFAULT_L = 0.9502473771339662;
const INNER_DEFAULT_C = 0.01064327559590563;
const INNER_DEFAULT_H = 68.64935938360941;

const BG_DEFAULT_L = 0.37517330846478175;
const BG_DEFAULT_C = 0.02840210576339776;
const BG_DEFAULT_H = 284.9494941481643;

export const glassShellNodeSpec: NodeSpec = {
  id: 'glass-shell',
  category: 'Shapes',
  displayName: 'Glass Shell',
  icon: 'sphere',
  description:
    'Two-stage raymarch: outer SDF (sphere, box, icosahedron) → refract at hit → inner SDF (sphere, box, or blend) → shade inner or background; outer specular on glass. Output vec4 for composition.',
  inputs: [
    { name: 'in', type: 'vec2', label: 'UV' },
    {
      name: 'ro',
      type: 'vec3',
      label: 'Ray origin',
      fallbackParameter: 'cameraRoX,cameraRoY,cameraRoZ'
    },
    {
      name: 'rd',
      type: 'vec3',
      label: 'Ray direction',
      fallbackExpression: 'normalize(vec3($input.in, -1.0))'
    }
  ],
  outputs: [{ name: 'out', type: 'vec4', label: 'Color' }],
  parameters: {
    outerShape: {
      type: 'int',
      default: 0,
      min: 0,
      max: 2,
      step: 1,
      label: 'Outer shape'
    },
    innerShape: {
      type: 'int',
      default: 0,
      min: 0,
      max: 2,
      step: 1,
      label: 'Inner shape'
    },
    ior: {
      type: 'float',
      default: 1.5,
      min: 1.01,
      max: 2.0,
      step: 0.01,
      label: 'IOR'
    },
    outerSize: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 3.0,
      step: 0.1,
      label: 'Outer size'
    },
    outerCenterX: { type: 'float', default: 0.0, min: -2.0, max: 2.0, step: 0.1, label: 'Outer X',
      knobPolarity: 'two-sided' },
    outerCenterY: { type: 'float', default: 0.0, min: -2.0, max: 2.0, step: 0.1, label: 'Outer Y',
      knobPolarity: 'two-sided' },
    outerCenterZ: { type: 'float', default: 0.0, min: -2.0, max: 2.0, step: 0.1, label: 'Outer Z',
      knobPolarity: 'two-sided' },
    innerSize: {
      type: 'float',
      default: 0.4,
      min: 0.05,
      max: 1.5,
      step: 0.05,
      label: 'Inner size'
    },
    innerCenterX: { type: 'float', default: 0.0, min: -1.0, max: 1.0, step: 0.05, label: 'Inner X',
      knobPolarity: 'two-sided' },
    innerCenterY: { type: 'float', default: 0.0, min: -1.0, max: 1.0, step: 0.05, label: 'Inner Y',
      knobPolarity: 'two-sided' },
    innerCenterZ: { type: 'float', default: 0.0, min: -1.0, max: 1.0, step: 0.05, label: 'Inner Z',
      knobPolarity: 'two-sided' },
    innerBlendK: {
      type: 'float',
      default: 0.3,
      min: 0.01,
      max: 1.0,
      step: 0.01,
      label: 'Smooth blend (inner)'
    },
    outerSteps: {
      type: 'int',
      default: 40,
      min: 10,
      max: 128,
      step: 1,
      label: 'Outer steps'
    },
    innerSteps: {
      type: 'int',
      default: 32,
      min: 10,
      max: 128,
      step: 1,
      label: 'Inner steps'
    },
    lightDirX: { type: 'float', default: 0.5, min: -1.0, max: 1.0, step: 0.01, label: 'Light X',
      knobPolarity: 'two-sided' },
    lightDirY: { type: 'float', default: 0.5, min: -1.0, max: 1.0, step: 0.01, label: 'Light Y',
      knobPolarity: 'two-sided' },
    lightDirZ: { type: 'float', default: 1.0, min: -1.0, max: 1.0, step: 0.01, label: 'Light Z',
      knobPolarity: 'two-sided' },
    lightIntensity: { type: 'float', default: 1.0, min: 0.0, max: 2.0, step: 0.01, label: 'Intensity' },
    ambient: { type: 'float', default: 0.2, min: 0.0, max: 1.0, step: 0.01, label: 'Ambient' },
    innerL: {
      type: 'float',
      default: INNER_DEFAULT_L,
      min: 0.0,
      max: 1.0,
      step: 0.001,
      label: 'Inner L'
    },
    innerC: {
      type: 'float',
      default: INNER_DEFAULT_C,
      min: 0.0,
      max: 0.4,
      step: 0.001,
      label: 'Inner C'
    },
    innerH: {
      type: 'float',
      default: INNER_DEFAULT_H,
      min: 0.0,
      max: 360.0,
      step: 0.001,
      label: 'Inner H'
    },
    bgL: {
      type: 'float',
      default: BG_DEFAULT_L,
      min: 0.0,
      max: 1.0,
      step: 0.001,
      label: 'Background L'
    },
    bgC: {
      type: 'float',
      default: BG_DEFAULT_C,
      min: 0.0,
      max: 0.4,
      step: 0.001,
      label: 'Background C'
    },
    bgH: {
      type: 'float',
      default: BG_DEFAULT_H,
      min: 0.0,
      max: 360.0,
      step: 0.001,
      label: 'Background H'
    },
    specularCookTorrance: {
      type: 'int',
      default: 1,
      min: 0,
      max: 1,
      step: 1,
      label: 'Physics'
    },
    specularRoughness: { type: 'float', default: 0.08, min: 0.01, max: 1.0, step: 0.01, label: 'Roughness' },
    specularF0: { type: 'float', default: 0.04, min: 0.0, max: 1.0, step: 0.01, label: 'F0' },
    outerSpecularStr: { type: 'float', default: 0.6, min: 0.0, max: 2.0, step: 0.05, label: 'Glass spec' },
    cameraRoX: {
      type: 'float',
      default: 0.0,
      min: -10.0,
      max: 10.0,
      step: 0.1,
      label: 'Ray origin X',
      knobPolarity: 'two-sided'
    },
    cameraRoY: {
      type: 'float',
      default: 0.0,
      min: -10.0,
      max: 10.0,
      step: 0.1,
      label: 'Ray origin Y',
      knobPolarity: 'two-sided'
    },
    cameraRoZ: {
      type: 'float',
      default: 3.0,
      min: -10.0,
      max: 10.0,
      step: 0.1,
      label: 'Ray origin Z',
      knobPolarity: 'two-sided'
    }
  },
  parameterGroups: [
    {
      id: 'shell',
      label: 'Shell',
      parameters: ['outerShape', 'innerShape', 'ior', 'outerSteps', 'innerSteps'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'outer',
      label: 'Outer',
      parameters: ['outerSize', 'outerCenterX', 'outerCenterY', 'outerCenterZ'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'inner',
      label: 'Inner',
      parameters: ['innerSize', 'innerCenterX', 'innerCenterY', 'innerCenterZ'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'innerBlend',
      label: 'Inner blend',
      parameters: ['innerBlendK'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'light',
      label: 'Lighting',
      parameters: ['lightDirX', 'lightDirY', 'lightDirZ', 'lightIntensity', 'ambient'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'colors',
      label: 'Colors',
      parameters: ['innerL', 'innerC', 'innerH', 'bgL', 'bgC', 'bgH'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'cameraFallback',
      label: 'Fallback ray origin',
      parameters: ['cameraRoX', 'cameraRoY', 'cameraRoZ'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'spec',
      label: 'Specular',
      parameters: ['specularCookTorrance', 'specularRoughness', 'specularF0', 'outerSpecularStr'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['outerShape', 'innerShape', 'ior', 'outerSteps', 'innerSteps'],
        parameterUI: { outerShape: 'enum', innerShape: 'enum' },
        layout: { columns: 3, parameterSpan: { innerSteps: 2 } }
      },
      {
        type: 'grid',
        label: 'Outer',
        parameters: ['outerSize', 'outerCenterX', 'outerCenterY', 'outerCenterZ'],
        layout: { columns: 4 }
      },
      {
        type: 'grid',
        label: 'Inner',
        parameters: ['innerSize', 'innerCenterX', 'innerCenterY', 'innerCenterZ'],
        layout: { columns: 4 }
      },
      {
        type: 'grid',
        label: 'Inner blend',
        parameters: ['innerBlendK'],
        layout: { columns: 1 },
        visibleWhen: { parameter: 'innerShape', equals: 2 }
      },
      {
        type: 'grid',
        label: 'Lighting',
        parameters: ['lightDirX', 'lightDirY', 'lightDirZ', 'lightIntensity', 'ambient'],
        layout: { columns: 3, parameterSpan: { ambient: 2 } }
      },
      {
        type: 'color-picker-row',
        label: 'Colors',
        pickers: [
          ['innerL', 'innerC', 'innerH'],
          ['bgL', 'bgC', 'bgH']
        ]
      },
      {
        type: 'grid',
        label: 'Color values',
        parameters: ['innerL', 'innerC', 'innerH', 'bgL', 'bgC', 'bgH'],
        parameterUI: {
          innerL: 'input',
          innerC: 'input',
          innerH: 'input',
          bgL: 'input',
          bgC: 'input',
          bgH: 'input'
        },
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Fallback ray origin',
        parameters: ['cameraRoX', 'cameraRoY', 'cameraRoZ'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Specular',
        parameters: ['specularCookTorrance', 'specularRoughness', 'specularF0', 'outerSpecularStr'],
        parameterUI: { specularCookTorrance: 'toggle' },
        layout: { columns: 4 }
      }
    ]
  },
  functions: `
vec3 glassShellOklchToRgb(vec3 oklch) {
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
float sdSphere(vec3 p, float r) {
  return length(p) - max(r, 0.001);
}
float sdBox(vec3 p, vec3 size) {
  vec3 q = abs(p) - size;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float sdIcosahedron(vec3 p, float radius) {
  const float ICO_Q = 2.61803398875;
  float r = max(radius, 0.01);
  vec3 n1 = normalize(vec3(ICO_Q, 1.0, 0.0));
  vec3 n2 = vec3(0.57735026919);
  vec3 ap = abs(p / r);
  float a = dot(ap, n1);
  float b = dot(ap, n1.zxy);
  float c = dot(ap, n1.yzx);
  float d = dot(ap, n2) - n1.x;
  return max(max(max(a, b), c) - n1.x, d) * r;
}
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
float outerSDF(vec3 p) {
  vec3 c = vec3($param.outerCenterX, $param.outerCenterY, $param.outerCenterZ);
  vec3 q = p - c;
  float s = max($param.outerSize, 0.01);
  if ($param.outerShape == 0) return sdSphere(q, s);
  if ($param.outerShape == 1) return sdBox(q, vec3(s, s, s));
  return sdIcosahedron(q, s);
}
float innerSDF(vec3 p) {
  vec3 c = vec3($param.innerCenterX, $param.innerCenterY, $param.innerCenterZ);
  vec3 q = p - c;
  float s = max($param.innerSize, 0.01);
  if ($param.innerShape == 0) return sdSphere(q, s);
  if ($param.innerShape == 1) return sdBox(q, vec3(s, s, s));
  float k = max($param.innerBlendK, 0.01);
  return smin(sdSphere(q, s), sdBox(q, vec3(s, s, s)), k);
}
vec3 outerNormal(vec3 p) {
  float eps = 0.001;
  float d = outerSDF(p);
  return normalize(vec3(
    outerSDF(p + vec3(eps, 0.0, 0.0)) - d,
    outerSDF(p + vec3(0.0, eps, 0.0)) - d,
    outerSDF(p + vec3(0.0, 0.0, eps)) - d
  ));
}
vec3 innerNormal(vec3 p) {
  float eps = 0.001;
  float d = innerSDF(p);
  return normalize(vec3(
    innerSDF(p + vec3(eps, 0.0, 0.0)) - d,
    innerSDF(p + vec3(0.0, eps, 0.0)) - d,
    innerSDF(p + vec3(0.0, 0.0, eps)) - d
  ));
}
float raymarchOuter(vec3 ro, vec3 rd, int steps) {
  float t = 0.0;
  for (int i = 0; i < 128; i++) {
    if (i >= steps) break;
    vec3 p = ro + rd * t;
    float d = outerSDF(p);
    if (d < 0.0008) return t;
    t += d;
    if (t > 100.0) return -1.0;
  }
  return -1.0;
}
float raymarchInner(vec3 ro, vec3 rd, int steps) {
  float t = 0.0;
  for (int i = 0; i < 128; i++) {
    if (i >= steps) break;
    vec3 p = ro + rd * t;
    float d = innerSDF(p);
    if (d < 0.0008) return t;
    t += d;
    if (t > 100.0) return -1.0;
  }
  return -1.0;
}
${COOK_TORRANCE_SPECULAR_GLSL}
`,
  mainCode: `
  vec3 ro = $input.ro;
  vec3 rd = normalize($input.rd);
  float ior = max($param.ior, 1.01);
  float eta = 1.0 / ior;
  vec3 bgColor = glassShellOklchToRgb(vec3($param.bgL, $param.bgC, $param.bgH));
  vec3 innerAlbedo = glassShellOklchToRgb(vec3($param.innerL, $param.innerC, $param.innerH));

  float tOuter = raymarchOuter(ro, rd, $param.outerSteps);

  if (tOuter < 0.0) {
    $output.out = vec4(bgColor, 0.0);
  } else {
    vec3 hitP = ro + rd * tOuter;
    vec3 N = outerNormal(hitP);
    vec3 refrDir = refract(rd, N, eta);
    if (length(refrDir) < 0.01) {
      refrDir = reflect(rd, N);
    }
    vec3 roInner = hitP + N * 0.002;
    float tInner = raymarchInner(roInner, refrDir, $param.innerSteps);

    vec3 innerColor;
    if (tInner >= 0.0) {
      vec3 innerP = roInner + refrDir * tInner;
      vec3 Ni = innerNormal(innerP);
      vec3 V = -refrDir;
      vec3 L = normalize(vec3($param.lightDirX, $param.lightDirY, $param.lightDirZ));
      float diff = max(dot(Ni, L), 0.0) * $param.lightIntensity;
      float lighting = $param.ambient + diff;
      if ($param.specularCookTorrance != 0) {
        lighting += ctSpecular(Ni, V, L, $param.specularRoughness, $param.specularF0) * $param.lightIntensity;
      }
      innerColor = innerAlbedo * clamp(lighting, 0.0, 2.0);
    } else {
      innerColor = bgColor;
    }

    vec3 Vouter = -rd;
    vec3 L = normalize(vec3($param.lightDirX, $param.lightDirY, $param.lightDirZ));
    float outerSpec = 0.0;
    if ($param.specularCookTorrance != 0) {
      outerSpec = ctSpecular(N, Vouter, L, $param.specularRoughness, $param.specularF0) * $param.outerSpecularStr * $param.lightIntensity;
    } else {
      vec3 H = normalize(Vouter + L);
      outerSpec = pow(max(dot(N, H), 0.0), 32.0) * $param.outerSpecularStr * $param.lightIntensity;
    }
    vec3 finalRgb = innerColor + vec3(outerSpec, outerSpec, outerSpec);
    $output.out = vec4(clamp(finalRgb, 0.0, 1.0), 1.0);
  }
`
};
